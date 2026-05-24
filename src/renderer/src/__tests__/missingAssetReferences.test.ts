import { describe, expect, it } from "vitest";
import { getDocumentAssetReferenceCheckPayload } from "../missingAssetReferences";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/current.md",
    id: "doc",
    title: "Current",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("missing asset reference helpers", () => {
  it("skips documents that cannot have local asset references checked", () => {
    expect(getDocumentAssetReferenceCheckPayload(null)).toBeNull();
    expect(
      getDocumentAssetReferenceCheckPayload(document({ filePath: undefined })),
    ).toBeNull();
    expect(
      getDocumentAssetReferenceCheckPayload(
        document({
          content: "![asset](.assets/image.png)",
          documentType: "html",
          filePath: "D:/notes/current.html",
        }),
      ),
    ).toBeNull();
  });

  it("extracts local references for markdown documents on disk", () => {
    expect(
      getDocumentAssetReferenceCheckPayload(
        document({
          content: [
            "![local](.assets/image.png)",
            "![remote](https://example.com/image.png)",
            '<img src="./.assets/chart.svg">',
          ].join("\n"),
        }),
      ),
    ).toEqual({
      documentFilePath: "D:/notes/current.md",
      references: [".assets/image.png", "./.assets/chart.svg"],
    });
  });
});
