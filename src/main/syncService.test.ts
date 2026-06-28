import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { PersistedAppState } from "../shared/appState";
import { mergeSyncConfiguration } from "../shared/sync";
import {
  createAbsoluteSyncAppState,
  createRelativeSyncAppState,
  createWorkspaceManifest,
  getCloudWorkspaceFilesPath,
  getWorkspaceRelativeSyncPath,
  hasSyncFileActions,
  normalizeSyncRelativePath,
  planSyncFileActions,
  shouldBlockInitialWorkspaceMerge,
} from "./syncService";
import type { SyncManifest, SyncWorkspaceIndex } from "../shared/sync";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "notedock-sync-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("sync path helpers", () => {
  it("normalizes relative sync paths and rejects traversal", () => {
    expect(normalizeSyncRelativePath("./notes\\A.md")).toBe("notes/A.md");
    expect(() => normalizeSyncRelativePath("../A.md")).toThrow();
  });

  it("creates workspace relative paths only for files inside the workspace", async () => {
    const root = await makeTempDir();

    expect(getWorkspaceRelativeSyncPath(root, join(root, "A.md"))).toBe("A.md");
    expect(getWorkspaceRelativeSyncPath(root, join(root, "..", "A.md"))).toBeNull();
  });

  it("keeps cloud workspace caches inside app user data", async () => {
    const userData = await makeTempDir();

    expect(getCloudWorkspaceFilesPath(userData, "user/default")).toBe(
      join(userData, "notedock-cloud-workspaces", "user-default", "files"),
    );
  });
});

describe("workspace manifest", () => {
  it("includes supported documents and workspace assets", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "A.md"), "A", "utf-8");
    await writeFile(join(root, "skip.txt"), "skip", "utf-8");
    await writeFile(join(root, ".assets-image.txt"), "skip", "utf-8");
    await writeFile(join(root, "B.excalidraw"), "{}", "utf-8");
    await writeFile(join(root, ".hidden.md"), "skip", "utf-8");
    await writeFile(join(root, ".assets"), "", "utf-8").catch(() => undefined);

    const assetDir = join(root, "notes", ".assets");
    await writeFile(join(root, "notes.md"), "notes", "utf-8");
    await writeFile(join(root, "notes.html"), "<p>notes</p>", "utf-8");
    await mkdir(assetDir, { recursive: true });
    await writeFile(join(assetDir, "image.png"), "img", "utf-8");

    const manifest = await createWorkspaceManifest(root);

    expect([...manifest.keys()].sort()).toEqual([
      "A.md",
      "B.excalidraw",
      "notes.html",
      "notes.md",
      "notes/.assets/image.png",
    ]);
  });
});

describe("sync planning", () => {
  const index = (files: SyncWorkspaceIndex["files"]): SyncWorkspaceIndex => ({
    files,
    version: 1,
    workspaceId: "default",
  });
  const remote = (files: SyncManifest["files"]): SyncManifest => ({
    files,
    revision: Math.max(0, ...files.map((file) => file.revision)),
    workspaceId: "default",
  });

  it("pushes local edits when local and remote both changed", () => {
    const plan = planSyncFileActions({
      index: index({
        "A.md": {
          remoteRevision: 1,
          sha256: "base",
        },
      }),
      localFiles: new Map([
        [
          "A.md",
          {
            path: "A.md",
            sha256: "local",
            size: 5,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      ]),
      remoteManifest: remote([
        {
          path: "A.md",
          revision: 2,
          sha256: "remote",
          size: 6,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    });

    expect(plan.push).toEqual(["A.md"]);
    expect(plan.pull).toEqual([]);
    expect(hasSyncFileActions(plan)).toBe(true);
  });

  it("detects an empty sync file plan", () => {
    expect(
      hasSyncFileActions({
        deleteLocal: [],
        deleteRemote: [],
        pull: [],
        push: [],
      }),
    ).toBe(false);
  });

  it("pulls remote files that are not known locally", () => {
    const plan = planSyncFileActions({
      index: index({}),
      localFiles: new Map(),
      remoteManifest: remote([
        {
          path: "A.md",
          revision: 1,
          sha256: "remote",
          size: 6,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    });

    expect(plan.pull).toEqual(["A.md"]);
  });

  it("blocks first sync when both local and remote workspaces already contain files", () => {
    expect(
      shouldBlockInitialWorkspaceMerge({
        index: index({}),
        localFiles: new Map([
          [
            "B.md",
            {
              path: "B.md",
              sha256: "local",
              size: 5,
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        ]),
        remoteManifest: remote([
          {
            path: "A.md",
            revision: 1,
            sha256: "remote",
            size: 6,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      }),
    ).toBe(true);
  });

  it("allows first sync from an empty local workspace into an existing remote workspace", () => {
    expect(
      shouldBlockInitialWorkspaceMerge({
        index: index({}),
        localFiles: new Map(),
        remoteManifest: remote([
          {
            path: "A.md",
            revision: 1,
            sha256: "remote",
            size: 6,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      }),
    ).toBe(false);
  });
});

describe("sync configuration", () => {
  it("clears the stored token when an empty token is provided", () => {
    expect(
      mergeSyncConfiguration(
        {
          enabled: true,
          serverUrl: "https://sync.example.com",
          token: "existing-token",
          workspaceId: "default",
        },
        {
          enabled: false,
          serverUrl: "https://sync.example.com",
          token: "",
          workspaceId: "default",
        },
      ).token,
    ).toBe("");
  });
});

describe("app state path conversion", () => {
  it("stores app state paths relative to the workspace and restores local absolute paths", async () => {
    const root = await makeTempDir();
    const state: PersistedAppState = {
      recentDirectories: [join(root, "notes")],
      version: 1,
      workspace: {
        activeDocumentId: "doc",
        documents: [
          {
            content: "A",
            createdAt: "2026-01-01T00:00:00.000Z",
            documentType: "markdown",
            drawings: {},
            filePath: join(root, "notes", "A.md"),
            id: "doc",
            title: "A",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        workspacePath: root,
      },
    };

    const relativeState = createRelativeSyncAppState(state, root);
    expect(
      ((relativeState.workspace as Record<string, unknown>).documents as Array<Record<string, unknown>>)[0]
        .filePath,
    ).toBe("notes/A.md");
    expect((relativeState.workspace as Record<string, unknown>).workspacePath).toBeUndefined();

    const absoluteState = createAbsoluteSyncAppState(relativeState, root);
    expect(
      ((absoluteState.workspace as Record<string, unknown>).documents as Array<Record<string, unknown>>)[0]
        .filePath,
    ).toBe(join(root, "notes", "A.md"));
    expect((absoluteState.workspace as Record<string, unknown>).workspacePath).toBe(root);
  });

  it("syncs cloud app state without persisting the local cache path remotely", async () => {
    const root = await makeTempDir();
    const state: PersistedAppState = {
      recentDirectories: [root],
      version: 1,
      workspace: {
        activeDocumentId: "doc",
        documents: [
          {
            content: "A",
            createdAt: "2026-01-01T00:00:00.000Z",
            documentType: "markdown",
            drawings: {},
            filePath: join(root, "A.md"),
            id: "doc",
            title: "A",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        source: {
          cachePath: root,
          kind: "cloud",
          workspaceId: "w_1",
          workspaceName: "云端笔记",
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        workspacePath: root,
      },
    };

    const relativeState = createRelativeSyncAppState(state, root);
    const relativeWorkspace = relativeState.workspace as Record<string, unknown>;
    const relativeSource = relativeWorkspace.source as Record<string, unknown>;

    expect(relativeSource.kind).toBe("cloud");
    expect(relativeSource.workspaceId).toBe("w_1");
    expect(relativeSource.cachePath).toBeUndefined();

    const absoluteState = createAbsoluteSyncAppState(relativeState, root);
    const absoluteSource = (absoluteState.workspace as Record<string, unknown>)
      .source as Record<string, unknown>;

    expect(absoluteSource.cachePath).toBe(root);
  });
});
