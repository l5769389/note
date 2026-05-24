import { describe, expect, it } from "vitest";
import { shouldWatchWorkspaceDirectory } from "../workspaceDirectoryWatcher";

describe("workspace directory watcher helpers", () => {
  it("requires both a workspace path and a watcher", () => {
    const watch = async () => true;

    expect(shouldWatchWorkspaceDirectory("D:/notes", watch)).toBe(true);
    expect(shouldWatchWorkspaceDirectory("", watch)).toBe(false);
    expect(shouldWatchWorkspaceDirectory("D:/notes")).toBe(false);
  });
});
