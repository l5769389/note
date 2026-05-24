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
  it("renders expanded folders and active files", () => {
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

    expect(html).toContain("directory-tree-folder-active");
    expect(html).toContain("directory-tree-file-active");
    expect(html).toContain("note.md");
  });
});
