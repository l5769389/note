import { describe, expect, it } from "vitest";
import {
  addLoadedDirectoryRoot,
  collectDirectoryPaths,
} from "../workspaceDirectoryTree";
import type { DirectoryTreeItem } from "../types";

const tree: DirectoryTreeItem = {
  children: [
    {
      children: [
        {
          name: "note.md",
          path: "D:/notes/projects/note.md",
          type: "file",
        },
      ],
      name: "projects",
      path: "D:/notes/projects",
      type: "directory",
    },
    {
      name: "index.md",
      path: "D:/notes/index.md",
      type: "file",
    },
  ],
  name: "notes",
  path: "D:/notes",
  type: "directory",
};

describe("workspace directory tree helpers", () => {
  it("collects only directory paths", () => {
    expect(collectDirectoryPaths(tree)).toEqual([
      "D:/notes",
      "D:/notes/projects",
    ]);
  });

  it("adds the loaded root without losing expanded child paths", () => {
    expect(
      Array.from(addLoadedDirectoryRoot(new Set(["D:/notes/projects"]), tree)),
    ).toEqual(["D:/notes/projects", "D:/notes"]);
  });
});
