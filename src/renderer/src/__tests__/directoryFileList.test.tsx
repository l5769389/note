import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DirectoryFileList,
  getFileListPreview,
} from "../components/DirectoryFileList";
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
  it("renders nested file paths with document previews", () => {
    const html = renderToStaticMarkup(
      <DirectoryFileList
        activeFilePath="D:/notes/project/note.md"
        documents={[
          document({ filePath: "D:/notes/project/note.md" }),
          document({
            documentType: "pdf",
            fileExtension: ".pdf",
            filePath: "D:/notes/project/manual.pdf",
          }),
        ]}
        items={items}
        workspacePath="D:/notes"
        onOpenFile={() => {}}
      />,
    );

    expect(html).toContain('title="note.md"');
    expect(html).toContain('title="manual.pdf"');
    expect(html).toContain("project");
    expect(html).toContain("A useful preview sentence.");
    expect(html).toContain("PDF");
  });

  it("filters resource addresses from text previews", () => {
    expect(
      getFileListPreview(
        document({
          content:
            "---\ntags: [demo]\n---\n\n![Hero](./.assets/hero.gif)\n\n正文摘要保留下来。\n\n```ts\nconst hidden = true\n```",
        }),
      ),
    ).toBe("正文摘要保留下来。");
  });

  it("does not invent previews for non-text files", () => {
    expect(
      getFileListPreview(
        document({
          documentType: "pdf",
          fileExtension: ".pdf",
          filePath: "D:/notes/project/manual.pdf",
        }),
      ),
    ).toBe("");
  });

  it("renders the configured empty state when no files are available", () => {
    const html = renderToStaticMarkup(
      <DirectoryFileList
        documents={[]}
        emptyLabel="No files"
        items={[]}
        onOpenFile={() => {}}
      />,
    );

    expect(html).toContain("No files");
  });

  it("renders an inline rename input while keeping the file extension fixed", () => {
    const html = renderToStaticMarkup(
      <DirectoryFileList
        activeFilePath="D:/notes/project/note.md"
        documents={[document({ filePath: "D:/notes/project/note.md" })]}
        items={items}
        renameDraft="renamed-note"
        renamingEntryPath="D:/notes/project/note.md"
        workspacePath="D:/notes"
        onCancelRename={() => {}}
        onCommitRename={() => {}}
        onOpenFile={() => {}}
        onRenameDraftChange={() => {}}
      />,
    );

    expect(html).toContain('value="renamed-note"');
    expect(html).toContain(".md");
  });
});
