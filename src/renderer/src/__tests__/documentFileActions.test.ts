import { describe, expect, it } from "vitest";
import {
  addCreatedDocumentToWorkspace,
  addOpenedDocumentToWorkspace,
  applySavedDocumentToWorkspace,
  createDocumentFromSavedFile,
  exportMarkdownDocument,
  getExportFailedAlert,
  getExportReadonlyAlert,
  getExportUnsupportedAlert,
  getSaveAsFailedAlert,
  getSaveAsReadonlyAlert,
  getWorkspacePathAfterOpen,
  getWorkspacePathAfterSaveAs,
  isExternallyDeletedFile,
  writeExistingDocumentIfNeeded,
} from "../documentFileActions";
import type { LocalMarkdownFile, MarkdownDocument, WorkspaceSnapshot } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "old",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Old",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const savedFile: LocalMarkdownFile = {
  content: "new",
  createdAt: "2026-01-02T00:00:00.000Z",
  documentType: "markdown",
  fileExtension: ".md",
  filePath: "D:/Notes/New.md",
  title: "New",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

function workspace(
  overrides: Partial<WorkspaceSnapshot> = {},
): WorkspaceSnapshot {
  return {
    activeDocumentId: "",
    documents: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("document file action helpers", () => {
  it("derives workspace paths after opening and saving", () => {
    expect(getWorkspacePathAfterOpen(undefined, "D:/Notes/A.md")).toBe(
      "D:/Notes",
    );
    expect(getWorkspacePathAfterOpen("D:/Workspace", "D:/Notes/A.md")).toBe(
      "D:/Workspace",
    );
    expect(getWorkspacePathAfterSaveAs(undefined, "D:/Notes/A.md")).toBe(
      "D:/Notes",
    );
  });

  it("creates a document snapshot from a saved file result", () => {
    expect(createDocumentFromSavedFile(document({ drawings: { x: {} as never } }), savedFile)).toEqual({
      content: "new",
      createdAt: "2026-01-01T00:00:00.000Z",
      documentType: "markdown",
      drawings: { x: {} },
      fileExtension: ".md",
      filePath: "D:/Notes/New.md",
      id: "doc",
      title: "New",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
  });

  it("adds opened documents while preserving existing document ids by path", () => {
    const existing = document({
      id: "existing",
      filePath: "D:/Notes/New.md",
      content: "old",
    });
    const incoming = document({
      id: "incoming",
      filePath: "D:/Notes/New.md",
      content: "fresh",
    });

    expect(
      addOpenedDocumentToWorkspace(
        workspace({ documents: [existing] }),
        incoming,
      ),
    ).toMatchObject({
      activeDocumentId: "existing",
      documents: [{ id: "existing", content: "fresh" }],
      workspacePath: "D:/Notes",
    });
  });

  it("adds created documents with an explicit creation directory", () => {
    expect(
      addCreatedDocumentToWorkspace(
        workspace(),
        document({ filePath: "D:/Notes/New.md" }),
        "D:/Chosen",
      ),
    ).toMatchObject({
      activeDocumentId: "doc",
      workspacePath: "D:/Chosen",
    });
  });

  it("applies saved documents to the current workspace", () => {
    const current = workspace({
      documents: [document({ id: "doc", filePath: "D:/Old.md" })],
    });
    const savedDocument = createDocumentFromSavedFile(
      current.documents[0],
      savedFile,
    );

    expect(applySavedDocumentToWorkspace(current, savedDocument)).toMatchObject({
      activeDocumentId: "doc",
      documents: [{ id: "doc", filePath: "D:/Notes/New.md" }],
      workspacePath: "D:/Notes",
    });
  });

  it("detects externally deleted conflicted files", async () => {
    expect(
      await isExternallyDeletedFile({
        externalConflictPaths: new Set(["d:/notes/a.md"]),
        filePath: "D:/Notes/A.md",
        pathExists: async () => false,
      }),
    ).toBe(true);
    expect(
      await isExternallyDeletedFile({
        externalConflictPaths: new Set(),
        filePath: "D:/Notes/A.md",
        pathExists: async () => false,
      }),
    ).toBe(false);
  });

  it("writes existing editable documents and acknowledges saved content", async () => {
    const calls: string[] = [];
    const result = await writeExistingDocumentIfNeeded({
      acknowledgeSavedFileContent: (filePath, content) => {
        calls.push(`ack:${filePath}:${content}`);
      },
      document: document({ filePath: "D:/Notes/A.md", content: "Saved" }),
      externalConflictPaths: new Set(),
      rememberInternalFileWrite: (filePath, content) => {
        calls.push(`track:${filePath}:${content}`);
      },
      writeMarkdownFile: async ({ content, filePath }) => {
        calls.push(`write:${filePath}:${content}`);
      },
    });

    expect(result).toBe("written");
    expect(calls).toEqual([
      "track:D:/Notes/A.md:Saved",
      "write:D:/Notes/A.md:Saved",
      "ack:D:/Notes/A.md:Saved",
    ]);
  });

  it("requests save-as for externally deleted active files", async () => {
    const result = await writeExistingDocumentIfNeeded({
      acknowledgeSavedFileContent: () => {
        throw new Error("should not acknowledge");
      },
      document: document({ filePath: "D:/Notes/A.md" }),
      externalConflictPaths: new Set(["d:/notes/a.md"]),
      pathExists: async () => false,
      rememberInternalFileWrite: () => {
        throw new Error("should not track");
      },
      writeMarkdownFile: async () => {
        throw new Error("should not write");
      },
    });

    expect(result).toBe("save-as");
  });

  it("skips unsupported or unsaved documents", async () => {
    await expect(
      writeExistingDocumentIfNeeded({
        acknowledgeSavedFileContent: () => undefined,
        document: document({ documentType: "pdf", filePath: "D:/A.pdf" }),
        externalConflictPaths: new Set(),
        rememberInternalFileWrite: () => undefined,
        writeMarkdownFile: async () => undefined,
      }),
    ).resolves.toBe("skipped");
  });

  it("exports markdown documents through the selected desktop exporter", async () => {
    const calls: string[] = [];
    const exportedPath = await exportMarkdownDocument({
      createHtml: async ({ document: inputDocument, theme }) =>
        `<html data-theme="${theme}">${inputDocument.content}</html>`,
      document: document({
        content: "# Hello",
        filePath: "D:/Notes/A.md",
        title: "A",
      }),
      exportHtmlFile: async (payload) => {
        calls.push(`html:${payload.title}:${payload.html}`);
        return "D:/Notes/A.html";
      },
      exportPdfFile: async () => {
        throw new Error("should not export pdf");
      },
      format: "html",
      showInFolder: async (filePath) => {
        calls.push(`show:${filePath}`);
      },
      theme: "github",
    });

    expect(exportedPath).toBe("D:/Notes/A.html");
    expect(calls).toEqual([
      'html:A:<html data-theme="github"># Hello</html>',
      "show:D:/Notes/A.html",
    ]);
  });

  it("provides file action alert copy", () => {
    expect(getSaveAsReadonlyAlert().title).toBe("这是只读预览文件");
    expect(getSaveAsFailedAlert().tone).toBe("danger");
    expect(getExportReadonlyAlert().tone).toBe("info");
    expect(getExportUnsupportedAlert().tone).toBe("warning");
    expect(getExportFailedAlert("pdf").title).toBe("导出 PDF 失败");
    expect(getExportFailedAlert("html").title).toBe("导出 HTML 失败");
  });
});
