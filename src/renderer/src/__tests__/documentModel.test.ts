import { describe, expect, it } from "vitest";
import {
  getDocumentDisplayName,
  getDocumentTypeFromPath,
  mergeDocumentByFilePath,
} from "../documentModel";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument>): MarkdownDocument {
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

describe("document model helpers", () => {
  it("detects html files separately from markdown files", () => {
    expect(getDocumentTypeFromPath("D:/notes/page.html")).toBe("html");
    expect(getDocumentTypeFromPath("D:/notes/page.htm")).toBe("html");
    expect(getDocumentTypeFromPath("D:/notes/page.md")).toBe("markdown");
  });

  it("uses the stored extension when building display names", () => {
    expect(
      getDocumentDisplayName(
        document({ documentType: "html", fileExtension: ".html", title: "index" }),
      ),
    ).toBe("index.html");
    expect(
      getDocumentDisplayName(
        document({ fileExtension: ".md", title: "already.md" }),
      ),
    ).toBe("already.md");
  });

  it("merges opened files by path while preserving the existing document id", () => {
    const existing = document({
      content: "old",
      filePath: "D:/notes/a.md",
      id: "existing-id",
    });
    const next = document({
      content: "new",
      filePath: "D:/notes/a.md",
      id: "new-id",
    });

    expect(mergeDocumentByFilePath([existing], next)).toEqual([
      {
        ...next,
        id: "existing-id",
      },
    ]);
  });
});

