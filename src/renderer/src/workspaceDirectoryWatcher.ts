import { useEffect } from "react";

export type WatchWorkspaceDirectory = (directoryPath: string) => Promise<boolean>;
export type UnwatchWorkspaceDirectory = () => Promise<void>;

export function shouldWatchWorkspaceDirectory(
  workspacePath?: string,
  watchWorkspaceDirectory?: WatchWorkspaceDirectory,
) {
  return Boolean(workspacePath && watchWorkspaceDirectory);
}

export function useWorkspaceDirectoryWatcher(
  workspacePath: string | undefined,
  watchWorkspaceDirectory?: WatchWorkspaceDirectory,
  unwatchWorkspaceDirectory?: UnwatchWorkspaceDirectory,
) {
  useEffect(() => {
    if (!shouldWatchWorkspaceDirectory(workspacePath, watchWorkspaceDirectory)) {
      void unwatchWorkspaceDirectory?.();
      return undefined;
    }

    void watchWorkspaceDirectory?.(workspacePath!);

    return () => {
      void unwatchWorkspaceDirectory?.();
    };
  }, [unwatchWorkspaceDirectory, watchWorkspaceDirectory, workspacePath]);
}
