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
});
