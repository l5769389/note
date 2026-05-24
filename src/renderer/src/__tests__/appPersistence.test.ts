import { describe, expect, it } from "vitest";
import {
  createPersistedAppHydration,
  createPersistedAppState,
  defaultSidebarWidth,
  hasBrowserPersistedAppState,
  loadRecentDirectoryPaths,
  migrateLegacyPersistedAppHydration,
  maxSidebarWidth,
  minSidebarWidth,
  normalizePersistedDirectories,
  normalizeSidebarWidth,
  normalizeTheme,
} from "../appPersistence";
import { defaultAppSettings } from "../appSettings";
import { noteDockStorageKeys } from "../storageKeys";
import type { WorkspaceSnapshot } from "../types";

function createMemoryStorage(initialEntries: Array<[string, string]> = []) {
  const entries = new Map(initialEntries);

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
}

const workspace: WorkspaceSnapshot = {
  activeDocumentId: "",
  documents: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

const persistedWorkspace: WorkspaceSnapshot = {
  activeDocumentId: "doc",
  documents: [
    {
      content: "# Note",
      createdAt: "2026-01-01T00:00:00.000Z",
      documentType: "markdown",
      drawings: {},
      filePath: "D:/notes/note.md",
      id: "doc",
      title: "Note",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

describe("app persistence helpers", () => {
  it("normalizes persisted primitive values", () => {
    expect(normalizeTheme("paper")).toBe("paper");
    expect(normalizeTheme("unknown")).toBe("github");
    expect(normalizeSidebarWidth(10)).toBe(minSidebarWidth);
    expect(normalizeSidebarWidth(9999)).toBe(maxSidebarWidth);
    expect(normalizeSidebarWidth("invalid")).toBe(defaultSidebarWidth);
    expect(normalizePersistedDirectories(["D:/notes", 1, null])).toEqual([
      "D:/notes",
    ]);
  });

  it("loads recent directories and detects stored state", () => {
    const storage = createMemoryStorage([
      [noteDockStorageKeys.recentDirectories, JSON.stringify(["D:/notes"])],
    ]);

    expect(hasBrowserPersistedAppState(storage)).toBe(true);
    expect(loadRecentDirectoryPaths(storage)).toEqual(["D:/notes"]);
  });

  it("creates a serialized app state snapshot", () => {
    const state = createPersistedAppState({
      recentDirectories: ["D:/notes"],
      settings: defaultAppSettings,
      sidebarWidth: 320,
      theme: "github",
      workspace,
    });

    expect(state.version).toBe(1);
    expect(state.recentDirectories).toEqual(["D:/notes"]);
    expect((state.workspace as WorkspaceSnapshot).documents).toEqual([]);
  });

  it("hydrates from the main process state before legacy browser state", () => {
    const hydration = createPersistedAppHydration(
      {
        appSettings: { editorMode: "source" },
        recentDirectories: ["D:/main"],
        sidebarWidth: 380,
        theme: "paper",
        version: 1,
        workspace: {
          ...persistedWorkspace,
          workspacePath: "D:/main",
        },
      },
      {
        recentDirectories: ["D:/legacy"],
        theme: "dark",
        version: 1,
        workspace: {
          ...persistedWorkspace,
          workspacePath: "D:/legacy",
        },
      },
    );

    expect(hydration.recentDirectories).toEqual(["D:/main"]);
    expect(hydration.settings.editorMode).toBe("source");
    expect(hydration.shouldMigrateLegacyState).toBe(false);
    expect(hydration.theme).toBe("paper");
    expect(hydration.workspace.workspacePath).toBe("D:/main");
  });

  it("hydrates from legacy state when main process state is empty", () => {
    const hydration = createPersistedAppHydration(
      null,
      {
        recentDirectories: ["D:/legacy", 1 as unknown as string],
        sidebarWidth: 9999,
        theme: "dark",
        version: 1,
        workspace: {
          ...persistedWorkspace,
          workspacePath: "D:/legacy",
        },
      },
    );

    expect(hydration.recentDirectories).toEqual(["D:/legacy"]);
    expect(hydration.shouldMigrateLegacyState).toBe(true);
    expect(hydration.sidebarWidth).toBe(maxSidebarWidth);
    expect(hydration.theme).toBe("dark");
    expect(hydration.workspace.workspacePath).toBe("D:/legacy");
  });

  it("migrates legacy hydration through the main process persistence API", async () => {
    let savedState: unknown = null;
    let cleared = false;

    const migrated = await migrateLegacyPersistedAppHydration(
      {
        recentDirectories: ["D:/legacy"],
        settings: defaultAppSettings,
        shouldMigrateLegacyState: true,
        sidebarWidth: 320,
        theme: "github",
        workspace,
      },
      async (state) => {
        savedState = state;
        return state;
      },
      () => {
        cleared = true;
      },
    );

    expect(migrated).toBe(true);
    expect(cleared).toBe(true);
    expect((savedState as { recentDirectories: string[] }).recentDirectories).toEqual([
      "D:/legacy",
    ]);
  });
});
