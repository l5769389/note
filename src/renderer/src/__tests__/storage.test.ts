import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceSnapshot,
  renameFromMarkdown,
  serializeWorkspaceSnapshot,
} from "../storage";
import type { MarkdownDocument, WorkspaceSnapshot } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "# Title",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    metadata: {
      documentLinks: [],
      properties: [],
      tags: [],
    },
    title: "Doc",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("workspace storage helpers", () => {
  it("normalizes stored documents without restoring an active document", () => {
    const storedMetadata = {
      documentLinks: [
        { filePath: "D:/Docs/A.md", title: "A" },
        { path: "D:\\Docs\\A.md", name: "Duplicate A" },
        { filePath: "D:/Docs/B.pdf", updatedAt: "2026-01-02T00:00:00.000Z" },
      ],
      properties: [
        { key: "Status", value: " Ready " },
        { key: "status", value: "Duplicate" },
        { key: "", value: "ignored" },
      ],
      tags: [" Inbox ", "inbox", "", "Work"],
    } as unknown as MarkdownDocument["metadata"];
    const normalized = normalizeWorkspaceSnapshot({
      activeDocumentId: "doc",
      documents: [
        {
          ...document({
            content: "cached pdf text",
            documentType: undefined as unknown as MarkdownDocument["documentType"],
            filePath: "D:/Docs/manual.pdf",
            metadata: storedMetadata,
          }),
          drawings: undefined,
          fileExtension: undefined,
          lastOpenedAt: 1,
        },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    });
    const storedDocument = normalized.documents[0];

    expect(normalized.activeDocumentId).toBe("");
    expect(storedDocument).toBeDefined();
    expect(storedDocument).toMatchObject({
      content: "",
      documentType: "pdf",
      drawings: {},
      fileExtension: ".pdf",
      lastOpenedAt: undefined,
      metadata: {
        properties: [{ key: "Status", value: "Ready" }],
        tags: ["Inbox", "Work"],
      },
    });
    expect(storedDocument!.metadata!.documentLinks).toEqual([
      {
        createdAt: expect.any(String),
        documentType: "markdown",
        filePath: "D:/Docs/A.md",
        title: "A",
      },
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        documentType: "pdf",
        filePath: "D:/Docs/B.pdf",
        title: "D:/Docs/B.pdf",
      },
    ]);
  });

  it("falls back to an initial workspace for invalid stored data", () => {
    const normalized = normalizeWorkspaceSnapshot({
      activeDocumentId: "missing",
      documents: [],
      version: 1,
    });

    expect(normalized.activeDocumentId).toBe("");
    expect(normalized.documents.length).toBe(1);
    expect(normalized.version).toBe(1);
  });

  it("serializes read-only document content out of the persisted workspace", () => {
    const snapshot: WorkspaceSnapshot = {
      activeDocumentId: "pdf",
      documents: [
        document({ content: "markdown", id: "md" }),
        document({
          content: "extracted pdf text",
          documentType: "pdf",
          id: "pdf",
        }),
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    };

    const serialized = serializeWorkspaceSnapshot(snapshot);

    expect(serialized.documents.find((item) => item.id === "md")?.content).toBe(
      "markdown",
    );
    expect(serialized.documents.find((item) => item.id === "pdf")?.content).toBe("");
    expect(serialized.updatedAt).not.toBe(snapshot.updatedAt);
  });

  it("renames markdown documents from their first heading", () => {
    expect(renameFromMarkdown("intro\n# Project Plan\nbody", "Untitled")).toBe(
      "Project Plan",
    );
    expect(renameFromMarkdown("intro only", "Untitled")).toBe("Untitled");
  });
});
