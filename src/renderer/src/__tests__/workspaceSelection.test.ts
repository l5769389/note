import { describe, expect, it } from "vitest";
import type { DirectoryTreeItem } from "../types";
import {
  collectWorkspaceEntryPaths,
  isWorkspaceEntrySelected,
  toggleWorkspaceEntrySelection,
} from "../workspaceSelection";
import { normalizeFilePathKey } from "../workspaceDisplay";

const tree: DirectoryTreeItem = {
  children: [
    {
      children: [
        {
          name: "nested.md",
          path: "D:/cloud/project/child/nested.md",
          type: "file",
        },
      ],
      name: "child",
      path: "D:/cloud/project/child",
      type: "directory",
    },
    {
      name: "note.md",
      path: "D:/cloud/project/note.md",
      type: "file",
    },
  ],
  name: "project",
  path: "D:/cloud/project",
  type: "directory",
};

function entryMap(item: DirectoryTreeItem, map = new Map<string, DirectoryTreeItem>()) {
  map.set(normalizeFilePathKey(item.path), item);

  item.children?.forEach((child) => entryMap(child, map));
  return map;
}

describe("workspace selection", () => {
  it("selects a directory and all nested entries", () => {
    const next = toggleWorkspaceEntrySelection(new Set(), tree, entryMap(tree));

    expect(Array.from(next).sort()).toEqual(collectWorkspaceEntryPaths(tree).sort());
  });

  it("treats a selected directory as including nested folders and files", () => {
    const next = toggleWorkspaceEntrySelection(new Set(), tree, entryMap(tree));
    const childDirectory = tree.children?.[0];
    const nestedFile = childDirectory?.children?.[0];

    if (!childDirectory || !nestedFile) {
      throw new Error("missing fixture child");
    }

    expect(isWorkspaceEntrySelected(next, tree)).toBe(true);
    expect(isWorkspaceEntrySelected(next, childDirectory)).toBe(true);
    expect(isWorkspaceEntrySelected(next, nestedFile)).toBe(true);
  });

  it("checks selection using normalized path keys", () => {
    const selected = new Set(["d:/cloud/project/child/nested.md"]);
    const childDirectory = tree.children?.[0];
    const nestedFile = childDirectory?.children?.[0];

    if (!nestedFile) {
      throw new Error("missing fixture child");
    }

    expect(isWorkspaceEntrySelected(selected, nestedFile)).toBe(true);
  });

  it("unselects a child without keeping its selected ancestor directory", () => {
    const map = entryMap(tree);
    const selected = toggleWorkspaceEntrySelection(new Set(), tree, map);
    const childFile = tree.children?.[1];

    if (!childFile) {
      throw new Error("missing fixture child");
    }

    const next = toggleWorkspaceEntrySelection(selected, childFile, map);

    expect(next.has(tree.path)).toBe(false);
    expect(next.has(childFile.path)).toBe(false);
    expect(next.has("D:/cloud/project/child/nested.md")).toBe(true);
  });
});
