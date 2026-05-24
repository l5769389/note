import { describe, expect, it } from "vitest";
import {
  consumeInternalFileDelete,
  getDiskChangeDecision,
  getExternalChangeConfirm,
  getExternalDeleteAlert,
  getWorkspaceFileChangeContext,
  mergeDiskDocumentIntoWorkspace,
  shouldMergeInternalWriteBack,
} from "../workspaceFileChanges";
import type { MarkdownDocument, WorkspaceSnapshot } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "content",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/Notes/A.md",
    id: "doc",
    title: "A",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function workspace(
  overrides: Partial<WorkspaceSnapshot> = {},
): WorkspaceSnapshot {
  return {
    activeDocumentId: "doc",
    documents: [document()],
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("workspace file change helpers", () => {
  it("builds change context using normalized paths", () => {
    expect(
      getWorkspaceFileChangeContext({
        activeDocument: document({ filePath: "d:/notes/a.md" }),
        documents: [document()],
        payload: { event: "change", filePath: "D:\\Notes\\A.md" },
      }),
    ).toMatchObject({
      changedDocument: { id: "doc" },
      fileKey: "d:/notes/a.md",
      isCurrentDocument: true,
    });
  });

  it("consumes internal delete markers once", () => {
    const deletes = new Set(["d:/notes/a.md"]);

    expect(consumeInternalFileDelete(deletes, "d:/notes/a.md")).toBe(true);
    expect(consumeInternalFileDelete(deletes, "d:/notes/a.md")).toBe(false);
  });

  it("decides how to handle disk changes", () => {
    const changedDocument = document({ content: "local" });
    const diskDocument = document({ content: "disk" });

    expect(
      getDiskChangeDecision({
        changedDocument,
        diskDocument: document({ content: "local" }),
        hasLocalChanges: true,
        isCurrentDocument: true,
      }),
    ).toBe("same-content");
    expect(
      getDiskChangeDecision({
        changedDocument,
        diskDocument,
        hasLocalChanges: false,
        isCurrentDocument: false,
      }),
    ).toBe("apply-disk");
    expect(
      getDiskChangeDecision({
        changedDocument,
        diskDocument,
        hasLocalChanges: true,
        isCurrentDocument: true,
      }),
    ).toBe("confirm-current-reload");
    expect(
      getDiskChangeDecision({
        changedDocument,
        diskDocument,
        hasLocalChanges: true,
        isCurrentDocument: false,
      }),
    ).toBe("keep-background-conflict");
  });

  it("identifies internal write echo updates", () => {
    expect(
      shouldMergeInternalWriteBack({
        currentDocument: document({ content: "disk" }),
        diskDocument: document({ content: "disk" }),
      }),
    ).toBe(true);
    expect(
      shouldMergeInternalWriteBack({
        currentDocument: document({ content: "local" }),
        diskDocument: document({ content: "disk" }),
      }),
    ).toBe(false);
  });

  it("merges disk documents into the workspace", () => {
    expect(
      mergeDiskDocumentIntoWorkspace(
        workspace(),
        document({ content: "disk", id: "incoming" }),
      ).documents[0],
    ).toMatchObject({
      content: "disk",
      id: "doc",
    });
  });

  it("provides conflict dialog copy", () => {
    expect(getExternalDeleteAlert("D:/Notes/A.md").tone).toBe("danger");
    expect(getExternalChangeConfirm("D:/Notes/A.md").confirmLabel).toBe(
      "重新加载",
    );
  });
});
