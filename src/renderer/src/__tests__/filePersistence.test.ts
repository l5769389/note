import { describe, expect, it } from "vitest";
import {
  acknowledgeSavedFileContent,
  createSavedFileContentByPath,
  getWritableDirtyDocuments,
  hasUnsavedFileContent,
  isMatchingInternalFileWrite,
  isWritableTextDocument,
  rememberInternalFileWrite,
} from "../filePersistence";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "content",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Doc",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("file persistence helpers", () => {
  it("creates a saved-content map for file-backed documents", () => {
    expect(
      createSavedFileContentByPath([
        document({ filePath: "D:/a.md", content: "A" }),
        document({ filePath: undefined, content: "B" }),
      ]),
    ).toEqual(new Map([["D:/a.md", "A"]]));
  });

  it("detects writable dirty documents while ignoring external conflicts", () => {
    const clean = document({ id: "clean", filePath: "D:/clean.md", content: "A" });
    const dirty = document({ id: "dirty", filePath: "D:/dirty.md", content: "B" });
    const pdf = document({
      id: "pdf",
      documentType: "pdf",
      filePath: "D:/file.pdf",
      content: "B",
    });
    const savedFileContentByPath = new Map([
      ["D:/clean.md", "A"],
      ["D:/dirty.md", "A"],
      ["D:/file.pdf", "A"],
    ]);

    expect(isWritableTextDocument(pdf)).toBe(false);
    expect(hasUnsavedFileContent(dirty, savedFileContentByPath)).toBe(true);
    expect(
      getWritableDirtyDocuments({
        documents: [clean, dirty, pdf],
        externalConflictPaths: new Set(["d:/dirty.md"]),
        savedFileContentByPath,
      }),
    ).toEqual([]);
    expect(
      getWritableDirtyDocuments({
        documents: [clean, dirty, pdf],
        externalConflictPaths: new Set(),
        savedFileContentByPath,
      }),
    ).toEqual([dirty]);
  });

  it("tracks internal file writes and prunes expired snapshots", () => {
    const writes = new Map();

    rememberInternalFileWrite(writes, "D:/A.md", "A", 100);

    expect(isMatchingInternalFileWrite(writes, "d:/a.md", "A", 101)).toBe(true);
    expect(isMatchingInternalFileWrite(writes, "d:/a.md", "B", 101)).toBe(false);
    expect(isMatchingInternalFileWrite(writes, "d:/a.md", "A", 9000)).toBe(false);
    expect(writes.size).toBe(0);
  });

  it("acknowledges saved content for canonical and known document paths", () => {
    const savedFileContentByPath = new Map<string, string>();
    const externalConflictPaths = new Set(["d:/notes/a.md"]);

    acknowledgeSavedFileContent({
      content: "Saved",
      documents: [document({ filePath: "D:/Notes/A.md" })],
      externalConflictPaths,
      filePath: "d:/notes/a.md",
      savedFileContentByPath,
    });

    expect(savedFileContentByPath.get("d:/notes/a.md")).toBe("Saved");
    expect(savedFileContentByPath.get("D:/Notes/A.md")).toBe("Saved");
    expect(externalConflictPaths.size).toBe(0);
  });
});
