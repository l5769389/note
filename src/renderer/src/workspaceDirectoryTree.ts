import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectoryTreeItem } from "./types";

export type ReadDirectoryTree = (
  directoryPath: string,
) => Promise<DirectoryTreeItem>;

export function collectDirectoryPaths(item: DirectoryTreeItem): string[] {
  if (item.type !== "directory") {
    return [];
  }

  return [
    item.path,
    ...(item.children ?? []).flatMap((child) => collectDirectoryPaths(child)),
  ];
}

export function addLoadedDirectoryRoot(
  currentPaths: Set<string>,
  tree: DirectoryTreeItem,
) {
  const next = new Set(currentPaths);
  next.add(tree.path);
  return next;
}

export function useWorkspaceDirectoryTree({
  onLoadFailure,
  readDirectoryTree,
  workspacePath,
}: {
  onLoadFailure?: () => void;
  readDirectoryTree?: ReadDirectoryTree;
  workspacePath?: string;
}) {
  const [directoryTree, setDirectoryTree] = useState<DirectoryTreeItem | null>(
    null,
  );
  const [expandedDirectoryPaths, setExpandedDirectoryPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const onLoadFailureRef = useRef(onLoadFailure);

  useEffect(() => {
    onLoadFailureRef.current = onLoadFailure;
  }, [onLoadFailure]);

  const applyDirectoryTree = useCallback((tree: DirectoryTreeItem | null) => {
    setDirectoryTree(tree);
    setExpandedDirectoryPaths(new Set(tree ? collectDirectoryPaths(tree) : []));
  }, []);

  const loadDirectoryTree = useCallback(
    async (directoryPath = workspacePath) => {
      if (!directoryPath || !readDirectoryTree) {
        setDirectoryTree(null);
        return null;
      }

      try {
        const tree = await readDirectoryTree(directoryPath);

        setDirectoryTree(tree);
        setExpandedDirectoryPaths((current) => addLoadedDirectoryRoot(current, tree));

        return tree;
      } catch {
        setDirectoryTree(null);
        onLoadFailureRef.current?.();
        return null;
      }
    },
    [readDirectoryTree, workspacePath],
  );

  useEffect(() => {
    if (!workspacePath) {
      return;
    }

    void loadDirectoryTree(workspacePath);
  }, [loadDirectoryTree, workspacePath]);

  return {
    applyDirectoryTree,
    directoryTree,
    expandedDirectoryPaths,
    loadDirectoryTree,
    setExpandedDirectoryPaths,
  };
}
