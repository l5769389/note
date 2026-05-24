import { describe, expect, it } from "vitest";
import {
  getDirectoryDisplayPath,
  getDocumentTypeLabel,
  getDocumentTypeName,
  getPathLabel,
  normalizeFilePathKey,
} from "../workspaceDisplay";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Document",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("workspace display helpers", () => {
  it("normalizes file path keys consistently", () => {
    expect(normalizeFilePathKey("D:\\Notes\\A.md")).toBe("d:/notes/a.md");
    expect(normalizeFilePathKey()).toBe("");
  });

  it("shows directory paths relative to the workspace", () => {
    expect(getDirectoryDisplayPath("D:/notes/project/a.md", "D:/notes")).toBe(
      "project",
    );
    expect(getDirectoryDisplayPath("D:/notes/a.md", "D:/notes")).toBe("");
  });

  it("formats path and document type labels", () => {
    expect(getPathLabel("D:/notes/project")).toBe("project");
    expect(getPathLabel()).toBe("Desktop");
    expect(getDocumentTypeName("pdf")).toBe("PDF");
    expect(getDocumentTypeLabel(document({ documentType: "sheet" }))).toBe(
      "在线表格",
    );
  });
});
