import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DirectoryTreeItems } from "../components/DirectoryTree";
import type { DirectoryTreeItem } from "../types";

const tree: DirectoryTreeItem[] = [
  {
    children: [
      {
        name: "note.md",
        path: "D:/notes/project/note.md",
        type: "file",
      },
    ],
    name: "project",
    path: "D:/notes/project",
    type: "directory",
  },
];

describe("DirectoryTreeItems", () => {
  it("renders files inside expanded folders", () => {
    const html = renderToStaticMarkup(
      <DirectoryTreeItems
        activeDirectoryPath="D:/notes/project"
        activeFilePath="D:/notes/project/note.md"
        expandedPaths={new Set(["D:/notes/project"])}
        items={tree}
        level={0}
        onOpenFile={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).toContain('title="project"');
    expect(html).toContain("note.md");
  });

  it("does not render collapsed folder children", () => {
    const html = renderToStaticMarkup(
      <DirectoryTreeItems
        activeDirectoryPath="D:/notes/project"
        activeFilePath="D:/notes/project/note.md"
        expandedPaths={new Set()}
        items={tree}
        level={0}
        onOpenFile={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).toContain('title="project"');
    expect(html).not.toContain("note.md");
  });

  it("renders an inline rename input for files without exposing the extension", () => {
    const html = renderToStaticMarkup(
      <DirectoryTreeItems
        activeDirectoryPath="D:/notes/project"
        activeFilePath="D:/notes/project/note.md"
        expandedPaths={new Set(["D:/notes/project"])}
        items={tree}
        level={0}
        renameDraft="renamed"
        renamingEntryPath="D:/notes/project/note.md"
        onCancelRename={() => {}}
        onCommitRename={() => {}}
        onOpenFile={() => {}}
        onRenameDraftChange={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).toContain('value="renamed"');
    expect(html).toContain(".md");
  });

  it("renders a live drop preview inside the target folder", () => {
    const html = renderToStaticMarkup(
      <DirectoryTreeItems
        activeDirectoryPath="D:/notes/project"
        activeFilePath="D:/notes/project/note.md"
        directoryDragPreview={{
          entryType: "file",
          name: "draft.md",
          path: "D:/notes/draft.md",
        }}
        directoryDropTargetPath="D:/notes/project"
        expandedPaths={new Set(["D:/notes/project"])}
        items={tree}
        level={0}
        onOpenFile={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).toContain("directory-tree-drop-preview");
    expect(html).toContain("directory-tree-file");
    expect(html).toContain("draft.md");
    expect(html.indexOf("draft.md")).toBeLessThan(html.indexOf("note.md"));
  });

  it("does not render the drop preview while the target folder is collapsed", () => {
    const html = renderToStaticMarkup(
      <DirectoryTreeItems
        activeDirectoryPath="D:/notes/project"
        activeFilePath="D:/notes/project/note.md"
        directoryDragPreview={{
          entryType: "file",
          name: "draft.md",
          path: "D:/notes/draft.md",
        }}
        directoryDropTargetPath="D:/notes/project"
        expandedPaths={new Set()}
        items={tree}
        level={0}
        onOpenFile={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).not.toContain("directory-tree-drop-preview");
  });
});
