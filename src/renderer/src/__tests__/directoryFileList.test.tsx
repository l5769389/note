import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DirectoryFileList } from "../components/DirectoryFileList";
import type { DirectoryTreeItem, MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "# Title\n\nA useful preview sentence.",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Document",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

const items: DirectoryTreeItem[] = [
  {
    children: [
      {
        name: "note.md",
        path: "D:/notes/project/note.md",
        type: "file",
      },
      {
        name: "manual.pdf",
        path: "D:/notes/project/manual.pdf",
        type: "file",
      },
    ],
    name: "project",
    path: "D:/notes/project",
    type: "directory",
  },
];

describe("DirectoryFileList", () => {
  it("renders nested file paths with previews", () => {
    const html = renderToStaticMarkup(
      <DirectoryFileList
        activeFilePath="D:/notes/project/note.md"
        documents={[
          document({ filePath: "D:/notes/project/note.md" }),
          document({
            documentType: "pdf",
            filePath: "D:/notes/project/manual.pdf",
            fileExtension: ".pdf",
          }),
        ]}
        items={items}
        workspacePath="D:/notes"
        onOpenFile={() => {}}
      />,
    );

    expect(html).toContain("directory-file-list-item-active");
    expect(html).toContain("project");
    expect(html).toContain("A useful preview sentence.");
    expect(html).toContain("PDF 文档");
  });
});
