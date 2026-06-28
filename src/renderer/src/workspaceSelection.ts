import type { DirectoryTreeItem } from "./types";
import { normalizeFilePathKey } from "./workspaceDisplay";

function isPathInsideDirectoryPath(childPath: string, directoryPath: string) {
  const childKey = normalizeFilePathKey(childPath).replace(/\/+$/, "");
  const directoryKey = normalizeFilePathKey(directoryPath).replace(/\/+$/, "");

  return childKey === directoryKey || childKey.startsWith(`${directoryKey}/`);
}

export function collectWorkspaceEntryPaths(item: DirectoryTreeItem) {
  const paths = [item.path];

  for (const child of item.children ?? []) {
    paths.push(...collectWorkspaceEntryPaths(child));
  }

  return paths;
}

export function toggleWorkspaceEntrySelection(
  selectedPaths: Set<string>,
  item: DirectoryTreeItem,
  entryMap: Map<string, DirectoryTreeItem>,
) {
  const next = new Set(selectedPaths);
  const itemPaths =
    item.type === "directory" ? collectWorkspaceEntryPaths(item) : [item.path];
  const selectedKeys = new Set(
    Array.from(next, (path) => normalizeFilePathKey(path)),
  );
  const isFullySelected = itemPaths.every((path) =>
    selectedKeys.has(normalizeFilePathKey(path)),
  );

  if (isFullySelected) {
    itemPaths.forEach((path) => next.delete(path));

    for (const selectedPath of Array.from(next)) {
      const selectedEntry = entryMap.get(normalizeFilePathKey(selectedPath));

      if (
        selectedEntry?.type === "directory" &&
        normalizeFilePathKey(selectedEntry.path) !== normalizeFilePathKey(item.path) &&
        isPathInsideDirectoryPath(item.path, selectedEntry.path)
      ) {
        next.delete(selectedEntry.path);
      }
    }

    return next;
  }

  itemPaths.forEach((path) => next.add(path));
  return next;
}

export function isWorkspaceEntrySelected(
  selectedPaths: Set<string> | undefined,
  item: DirectoryTreeItem,
) {
  if (!selectedPaths?.size) {
    return false;
  }

  const selectedKeys = new Set(
    Array.from(selectedPaths, (path) => normalizeFilePathKey(path)),
  );
  const itemPaths =
    item.type === "directory" ? collectWorkspaceEntryPaths(item) : [item.path];

  return itemPaths.every((path) => selectedKeys.has(normalizeFilePathKey(path)));
}
