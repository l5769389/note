import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import type { PersistedAppState } from "../shared/appState";
import {
  createDefaultSyncConfiguration,
  createInitialSyncStatus,
  getPublicSyncConfiguration,
  mergeSyncConfiguration,
  normalizeSyncConfiguration,
  normalizeSyncIndex,
  normalizeSyncServerUrl,
  normalizeSyncWorkspaceId,
  type SyncAppStatePayload,
  type SyncConfiguration,
  type SyncConfigurationInput,
  type SyncFileSnapshot,
  type SyncIndexEntry,
  type SyncLoginInput,
  type SyncLoginResult,
  type SyncManifest,
  type SyncManifestEntry,
  type SyncUserSummary,
  type SyncWorkspaceSummary,
  type SyncStatusSnapshot,
  type SyncWorkspaceIndex,
  syncProtocolVersion,
} from "../shared/sync";

const supportedDocumentExtensions = new Set([
  ".excalidraw",
  ".htm",
  ".html",
  ".md",
  ".markdown",
  ".mdown",
  ".pdf",
  ".univer",
  ".xls",
  ".xlsb",
  ".xlsm",
  ".xlsx",
  ".docx",
]);
const ignoredDirectoryNames = new Set([
  "build",
  "dist",
  "node_modules",
  "out",
  "release",
  "target",
]);
const workspaceAssetDirectoryName = ".assets";
const cloudWorkspaceDirectoryName = "notedock-cloud-workspaces";
const cloudWorkspaceFilesDirectoryName = "files";
const syncConfigFileName = "notedock-sync-config-v1.json";
const syncIndexDirectoryName = "notedock-sync-index-v1";
const syncPollIntervalMs = 30_000;
const syncRequestTimeoutMs = 30_000;
const syncScheduleDelayMs = 1_200;

export type SyncServiceOptions = {
  getAppState: () => Promise<PersistedAppState>;
  markSyncFileWrite?: (filePath: string) => void;
  notifyStatus: (status: SyncStatusSnapshot) => void;
  setAppState: (state: PersistedAppState) => Promise<PersistedAppState>;
  skipInitialConfigurationRestore?: boolean;
  userDataPath: string;
};

export type SyncFileActionPlan = {
  deleteLocal: string[];
  deleteRemote: string[];
  pull: string[];
  push: string[];
};

type SyncLoginResponse = {
  accessToken: string;
  expiresAt: string;
  user: SyncUserSummary;
};

type SyncTokenResponse = {
  token: string;
  tokenId: string;
  workspace: SyncWorkspaceSummary;
};

export type CloudWorkspaceOpenResult = {
  appState?: PersistedAppState;
  directoryPath: string;
  workspaceId: string;
  workspaceName: string;
};

function sha256(buffer: Buffer | string) {
  return createHash("sha256").update(buffer).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

export function getCloudWorkspaceFilesPath(
  userDataPath: string,
  workspaceId: string,
) {
  return join(
    userDataPath,
    cloudWorkspaceDirectoryName,
    normalizeSyncWorkspaceId(workspaceId),
    cloudWorkspaceFilesDirectoryName,
  );
}

export function normalizeSyncRelativePath(value: string) {
  const input = toPosixPath(value).trim().replace(/^\/+|\/+$/g, "");
  const parts: string[] = [];

  for (const part of input.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      throw new Error("Sync paths cannot leave the workspace.");
    }

    parts.push(part);
  }

  if (!parts.length || isAbsolute(input)) {
    throw new Error("A workspace relative sync path is required.");
  }

  return parts.join("/");
}

export function getWorkspaceRelativeSyncPath(
  workspacePath: string,
  filePath: string,
) {
  const relativePath = relative(resolve(workspacePath), resolve(filePath));

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return null;
  }

  return normalizeSyncRelativePath(relativePath);
}

function resolveWorkspaceSyncPath(workspacePath: string, relativePath: string) {
  const cleanPath = normalizeSyncRelativePath(relativePath);
  const absolutePath = resolve(workspacePath, cleanPath.split("/").join(sep));
  const relativeBack = relative(resolve(workspacePath), absolutePath);

  if (
    !relativeBack ||
    relativeBack.startsWith("..") ||
    isAbsolute(relativeBack)
  ) {
    throw new Error("Sync path resolves outside the workspace.");
  }

  return absolutePath;
}

function isWorkspaceAssetPath(relativePath: string) {
  const segments = relativePath.split("/");
  const assetIndex = segments.indexOf(workspaceAssetDirectoryName);

  return assetIndex >= 0 && assetIndex < segments.length - 1;
}

export function isSyncableWorkspaceFile(relativePath: string) {
  const cleanPath = normalizeSyncRelativePath(relativePath);
  const fileName = cleanPath.split("/").at(-1) ?? "";

  if (fileName.startsWith(".") && !isWorkspaceAssetPath(cleanPath)) {
    return false;
  }

  return (
    isWorkspaceAssetPath(cleanPath) ||
    supportedDocumentExtensions.has(extname(cleanPath).toLowerCase())
  );
}

async function exists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await rename(temporaryPath, filePath);
}

async function readJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as unknown;
  } catch {
    return null;
  }
}

function shouldSkipDirectory(name: string) {
  return (
    ignoredDirectoryNames.has(name) ||
    (name.startsWith(".") && name !== workspaceAssetDirectoryName)
  );
}

export async function scanWorkspaceSyncFiles(
  workspacePath: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 24) {
    return [];
  }

  const entries = await readdir(workspacePath, { withFileTypes: true }).catch(
    () => [],
  );
  const files = await Promise.all(
    entries.flatMap(async (entry) => {
      const entryPath = join(workspacePath, entry.name);

      if (entry.isDirectory()) {
        return shouldSkipDirectory(entry.name)
          ? []
          : scanWorkspaceSyncFiles(entryPath, depth + 1);
      }

      if (!entry.isFile()) {
        return [];
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

export async function createWorkspaceManifest(
  workspacePath: string,
): Promise<Map<string, SyncFileSnapshot>> {
  const rootPath = resolve(workspacePath);
  const files = await scanWorkspaceSyncFiles(rootPath);
  const snapshots = await Promise.all(
    files.map(async (filePath) => {
      const relativePath = getWorkspaceRelativeSyncPath(rootPath, filePath);

      if (!relativePath || !isSyncableWorkspaceFile(relativePath)) {
        return null;
      }

      const [fileStat, content] = await Promise.all([
        stat(filePath),
        readFile(filePath),
      ]);

      return {
        path: relativePath,
        sha256: sha256(content),
        size: content.byteLength,
        updatedAt: fileStat.mtime.toISOString(),
      } satisfies SyncFileSnapshot;
    }),
  );

  return new Map(
    snapshots
      .filter((snapshot): snapshot is SyncFileSnapshot => Boolean(snapshot))
      .map((snapshot) => [snapshot.path, snapshot]),
  );
}

export function planSyncFileActions({
  index,
  localFiles,
  remoteManifest,
}: {
  index: SyncWorkspaceIndex;
  localFiles: Map<string, SyncFileSnapshot>;
  remoteManifest: SyncManifest;
}): SyncFileActionPlan {
  const remoteFiles = new Map(
    remoteManifest.files.map((entry) => [entry.path, entry]),
  );
  const allPaths = new Set([
    ...localFiles.keys(),
    ...remoteFiles.keys(),
    ...Object.keys(index.files),
  ]);
  const plan: SyncFileActionPlan = {
    deleteLocal: [],
    deleteRemote: [],
    pull: [],
    push: [],
  };

  allPaths.forEach((path) => {
    const local = localFiles.get(path);
    const remote = remoteFiles.get(path);
    const indexed = index.files[path];

    if (local && remote && !remote.deleted) {
      if (local.sha256 === remote.sha256) {
        return;
      }

      const localChanged = !indexed || indexed.sha256 !== local.sha256 || indexed.deleted;
      const remoteChanged =
        !indexed || indexed.remoteRevision !== remote.revision || indexed.deleted;

      if (localChanged || !remoteChanged) {
        plan.push.push(path);
      } else {
        plan.pull.push(path);
      }
      return;
    }

    if (local && (!remote || remote.deleted)) {
      const localChanged = !indexed || indexed.sha256 !== local.sha256 || indexed.deleted;
      const remoteChanged =
        Boolean(remote?.deleted) &&
        Boolean(indexed) &&
        indexed.remoteRevision !== remote?.revision;

      if (remote?.deleted && !localChanged && remoteChanged) {
        plan.deleteLocal.push(path);
      } else {
        plan.push.push(path);
      }
      return;
    }

    if (!local && remote && !remote.deleted) {
      if (indexed && !indexed.deleted) {
        plan.deleteRemote.push(path);
      } else {
        plan.pull.push(path);
      }
    }
  });

  return plan;
}

export function shouldBlockInitialWorkspaceMerge({
  index,
  localFiles,
  remoteManifest,
}: {
  index: SyncWorkspaceIndex;
  localFiles: Map<string, SyncFileSnapshot>;
  remoteManifest: SyncManifest;
}) {
  const hasLocalFiles = localFiles.size > 0;
  const hasRemoteFiles = remoteManifest.files.some((entry) => !entry.deleted);
  const hasSyncHistory =
    Object.keys(index.files).length > 0 ||
    typeof index.lastRemoteRevision === "number" ||
    typeof index.appStateRevision === "number" ||
    typeof index.appStateSha256 === "string";

  return !hasSyncHistory && hasLocalFiles && hasRemoteFiles;
}

function mapIndexEntry(entry: SyncManifestEntry): SyncIndexEntry {
  return {
    deleted: Boolean(entry.deleted),
    remoteRevision: entry.revision,
    sha256: entry.sha256,
  };
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function absolutizePathValue(workspacePath: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return value;
  }

  if (isAbsolute(value)) {
    return value;
  }

  return resolveWorkspaceSyncPath(workspacePath, value);
}

function relativizePathValue(workspacePath: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return value;
  }

  return getWorkspaceRelativeSyncPath(workspacePath, value) ?? undefined;
}

export function createRelativeSyncAppState(
  state: PersistedAppState,
  workspacePath: string,
): PersistedAppState {
  const workspace = cloneRecord(state.workspace);
  const source = cloneRecord(workspace.source);
  const documents = Array.isArray(workspace.documents)
    ? workspace.documents.map((document) => {
        const nextDocument = cloneRecord(document);
        const nextFilePath = relativizePathValue(workspacePath, nextDocument.filePath);

        if (nextFilePath) {
          nextDocument.filePath = nextFilePath;
        } else {
          delete nextDocument.filePath;
        }

        return nextDocument;
      })
    : [];
  const recentDirectories = Array.isArray(state.recentDirectories)
    ? state.recentDirectories
        .map((directoryPath) => relativizePathValue(workspacePath, directoryPath))
        .filter((value): value is string => typeof value === "string")
    : [];

  delete workspace.workspacePath;
  if (source.kind === "cloud") {
    delete source.cachePath;
    workspace.source = source;
  } else {
    delete workspace.source;
  }
  workspace.documents = documents;

  return {
    ...state,
    recentDirectories,
    workspace,
  };
}

export function createAbsoluteSyncAppState(
  state: PersistedAppState,
  workspacePath: string,
): PersistedAppState {
  const workspace = cloneRecord(state.workspace);
  const source = cloneRecord(workspace.source);
  const documents = Array.isArray(workspace.documents)
    ? workspace.documents.map((document) => {
        const nextDocument = cloneRecord(document);
        nextDocument.filePath = absolutizePathValue(
          workspacePath,
          nextDocument.filePath,
        );
        return nextDocument;
      })
    : [];
  const recentDirectories = Array.isArray(state.recentDirectories)
    ? state.recentDirectories
        .map((directoryPath) => absolutizePathValue(workspacePath, directoryPath))
        .filter((value): value is string => typeof value === "string")
    : [];

  workspace.documents = documents;
  workspace.workspacePath = workspacePath;
  if (source.kind === "cloud") {
    workspace.source = {
      ...source,
      cachePath: workspacePath,
    };
  }

  return {
    ...state,
    recentDirectories: recentDirectories.length ? recentDirectories : [workspacePath],
    workspace,
  };
}

function isCloudWorkspaceState(
  state: PersistedAppState,
  workspaceId: string,
  workspacePath: string,
) {
  const workspace = cloneRecord(state.workspace);
  const source = cloneRecord(workspace.source);

  if (
    source.kind === "cloud" &&
    normalizeSyncWorkspaceId(source.workspaceId) ===
      normalizeSyncWorkspaceId(workspaceId)
  ) {
    return true;
  }

  return typeof workspace.workspacePath === "string"
    ? resolve(workspace.workspacePath) === resolve(workspacePath)
    : false;
}

function getSyncIndexFilePath(userDataPath: string, workspaceId: string) {
  return join(userDataPath, syncIndexDirectoryName, `${workspaceId}.json`);
}

async function readSyncIndex(userDataPath: string, workspaceId: string) {
  return normalizeSyncIndex(
    await readJsonFile(getSyncIndexFilePath(userDataPath, workspaceId)),
    workspaceId,
  );
}

async function writeSyncIndex(userDataPath: string, index: SyncWorkspaceIndex) {
  await writeJsonFile(getSyncIndexFilePath(userDataPath, index.workspaceId), {
    ...index,
    updatedAt: new Date().toISOString(),
    version: syncProtocolVersion,
  });
}

function getSyncConfigFilePath(userDataPath: string) {
  return join(userDataPath, syncConfigFileName);
}

async function readSyncConfiguration(userDataPath: string) {
  return normalizeSyncConfiguration(
    await readJsonFile(getSyncConfigFilePath(userDataPath)),
  );
}

async function writeSyncConfiguration(
  userDataPath: string,
  configuration: SyncConfiguration,
) {
  await writeJsonFile(getSyncConfigFilePath(userDataPath), configuration);
}

async function readResponseBody(response: Response) {
  return response.text().catch(() => "");
}

export class SyncService {
  private configuration = createDefaultSyncConfiguration();
  private isRunning = false;
  private pendingRun = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private status = createInitialSyncStatus(this.configuration);

  constructor(private readonly options: SyncServiceOptions) {}

  async initialize() {
    this.configuration = this.options.skipInitialConfigurationRestore
      ? createDefaultSyncConfiguration()
      : await readSyncConfiguration(this.options.userDataPath);
    this.setStatus({
      configuration: getPublicSyncConfiguration(this.configuration),
      state: this.configuration.enabled ? "idle" : "disabled",
      workspaceKind: this.configuration.enabled ? "cloud" : undefined,
      workspaceName: this.configuration.enabled ? "云端笔记" : undefined,
    });

    if (this.configuration.enabled) {
      this.startAutoSync();
    }
  }

  getStatus() {
    return this.status;
  }

  async configure(input: SyncConfigurationInput) {
    this.configuration = mergeSyncConfiguration(this.configuration, input);
    await writeSyncConfiguration(this.options.userDataPath, this.configuration);
    this.setStatus({
      configuration: getPublicSyncConfiguration(this.configuration),
      message: this.configuration.enabled
        ? "同步已启用。"
        : "同步已停用。",
      state: this.configuration.enabled ? "idle" : "disabled",
      workspaceKind: this.configuration.enabled ? "cloud" : undefined,
      workspaceName: this.configuration.enabled ? "云端笔记" : undefined,
    });

    if (this.configuration.enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }

    return this.status;
  }

  async createAccessToken(input: SyncLoginInput): Promise<SyncLoginResult> {
    const serverUrl = normalizeSyncServerUrl(input.serverUrl);

    if (!serverUrl) {
      throw new Error("未配置同步服务器地址。");
    }

    if (!input.username.trim() || !input.password) {
      throw new Error("请输入同步用户名和密码。");
    }

    const login = await this.requestJson<SyncLoginResponse>(
      serverUrl,
      "/api/v1/auth/login",
      {
        body: JSON.stringify({
          password: input.password,
          username: input.username.trim(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    const token = await this.requestJson<SyncTokenResponse>(
      serverUrl,
      "/api/v1/sync-tokens",
      {
        headers: {
          Authorization: `Bearer ${login.accessToken}`,
        },
        method: "POST",
      },
    );

    return {
      token: token.token,
      tokenId: token.tokenId,
      user: login.user,
      workspaceId: token.workspace.id,
      workspaceName: token.workspace.name,
    };
  }

  getCloudWorkspacePath() {
    return getCloudWorkspaceFilesPath(
      this.options.userDataPath,
      this.configuration.workspaceId,
    );
  }

  async openCloudWorkspace(): Promise<CloudWorkspaceOpenResult> {
    this.ensureCloudSyncConfigured();

    if (!this.configuration.enabled) {
      this.configuration = {
        ...this.configuration,
        enabled: true,
      };
      await writeSyncConfiguration(this.options.userDataPath, this.configuration);
      this.startAutoSync();
    }

    const directoryPath = this.getCloudWorkspacePath();
    await mkdir(directoryPath, { recursive: true });
    await this.syncNow({ activateCloudWorkspace: true });
    const appState = await this.options.getAppState();

    return {
      appState: isCloudWorkspaceState(
        appState,
        this.configuration.workspaceId,
        directoryPath,
      )
        ? appState
        : undefined,
      directoryPath,
      workspaceId: this.configuration.workspaceId,
      workspaceName: "云端笔记",
    };
  }

  scheduleSync(delayMs = syncScheduleDelayMs) {
    if (!this.configuration.enabled) {
      return;
    }

    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
    }

    this.setStatus({
      ...this.status,
      configuration: getPublicSyncConfiguration(this.configuration),
      state: this.isRunning ? "syncing" : "pending",
      workspaceKind: "cloud",
      workspaceName: "云端笔记",
    });
    this.scheduleTimer = setTimeout(() => {
      this.scheduleTimer = null;
      void this.syncNow();
    }, delayMs);
  }

  private startAutoSync() {
    this.scheduleSync();

    if (this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      this.scheduleSync();
    }, syncPollIntervalMs);
  }

  private stopAutoSync() {
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async syncNow(options: { activateCloudWorkspace?: boolean } = {}) {
    if (!this.configuration.enabled) {
      this.setStatus({
        configuration: getPublicSyncConfiguration(this.configuration),
        state: "disabled",
      });
      return this.status;
    }

    if (this.isRunning) {
      this.pendingRun = true;
      this.setStatus({
        ...this.status,
        state: "pending",
      });
      return this.status;
    }

    this.isRunning = true;
    this.setStatus({
      ...this.status,
      configuration: getPublicSyncConfiguration(this.configuration),
      message: "正在同步工作区...",
      state: "syncing",
      workspaceKind: "cloud",
      workspaceName: "云端笔记",
    });

    try {
      await this.runSync(options);
      this.setStatus({
        configuration: getPublicSyncConfiguration(this.configuration),
        lastSyncedAt: new Date().toISOString(),
        message: "工作区已同步。",
        state: "synced",
        workspaceKind: "cloud",
        workspaceName: "云端笔记",
      });
    } catch (error) {
      this.setStatus({
        ...this.status,
        configuration: getPublicSyncConfiguration(this.configuration),
        message: error instanceof Error ? error.message : "同步失败。",
        state: "failed",
        workspaceKind: "cloud",
        workspaceName: "云端笔记",
      });
    } finally {
      this.isRunning = false;

      if (this.pendingRun) {
        this.pendingRun = false;
        this.scheduleSync(500);
      }
    }

    return this.status;
  }

  private setStatus(status: SyncStatusSnapshot) {
    this.status = status;
    this.options.notifyStatus(status);
  }

  private async runSync(options: { activateCloudWorkspace?: boolean } = {}) {
    this.ensureCloudSyncConfigured();
    const appState = await this.options.getAppState();
    const workspaceId = this.configuration.workspaceId;
    const workspacePath = this.getCloudWorkspacePath();
    await mkdir(workspacePath, { recursive: true });

    if (!workspacePath || !(await exists(workspacePath))) {
      throw new Error("请先打开一个本地工作区后再同步。");
    }

    if (
      !this.configuration.serverUrl ||
      !normalizeSyncServerUrl(this.configuration.serverUrl)
    ) {
      throw new Error("未配置同步服务器地址。");
    }

    if (!this.configuration.token?.trim()) {
      throw new Error("未配置同步访问令牌。");
    }

    const index = await readSyncIndex(this.options.userDataPath, workspaceId);
    const [localFiles, remoteManifest] = await Promise.all([
      createWorkspaceManifest(workspacePath),
      this.fetchManifest(),
    ]);

    if (
      shouldBlockInitialWorkspaceMerge({
        index,
        localFiles,
        remoteManifest,
      })
    ) {
      throw new Error(
        "当前本地目录和云端同步空间都已有文件。为避免误合并或覆盖，首次同步请使用空目录、换一个独立账号，或先备份后清空其中一侧。",
      );
    }

    const plan = planSyncFileActions({
      index,
      localFiles,
      remoteManifest,
    });

    await this.applyFilePlan({
      index,
      localFiles,
      plan,
      remoteManifest,
      workspacePath,
    });
    const isCloudAppState = isCloudWorkspaceState(
      appState,
      workspaceId,
      workspacePath,
    );

    if (isCloudAppState || options.activateCloudWorkspace) {
      await this.syncAppState({
        allowLocalUpload: isCloudAppState,
        appState,
        index,
        workspacePath,
      });
    }

    index.lastRemoteRevision = Math.max(
      remoteManifest.revision,
      ...Object.values(index.files).map((entry) => entry.remoteRevision),
    );
    await writeSyncIndex(this.options.userDataPath, index);
  }

  private ensureCloudSyncConfigured() {
    if (
      !this.configuration.serverUrl ||
      !normalizeSyncServerUrl(this.configuration.serverUrl)
    ) {
      throw new Error("未配置云端笔记服务器地址。");
    }

    if (!this.configuration.token?.trim()) {
      throw new Error("未配置云端笔记访问令牌。");
    }
  }

  private async applyFilePlan({
    index,
    localFiles,
    plan,
    remoteManifest,
    workspacePath,
  }: {
    index: SyncWorkspaceIndex;
    localFiles: Map<string, SyncFileSnapshot>;
    plan: SyncFileActionPlan;
    remoteManifest: SyncManifest;
    workspacePath: string;
  }) {
    const remoteFiles = new Map(
      remoteManifest.files.map((entry) => [entry.path, entry]),
    );

    for (const path of plan.pull) {
      const remote = remoteFiles.get(path);

      if (!remote || remote.deleted) {
        continue;
      }

      const content = await this.downloadFile(remote.path);
      const filePath = resolveWorkspaceSyncPath(workspacePath, remote.path);
      this.options.markSyncFileWrite?.(filePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
      index.files[path] = mapIndexEntry(remote);
    }

    for (const path of plan.deleteLocal) {
      const filePath = resolveWorkspaceSyncPath(workspacePath, path);
      this.options.markSyncFileWrite?.(filePath);
      await rm(filePath, { force: true });
      const remote = remoteFiles.get(path);
      if (remote) {
        index.files[path] = mapIndexEntry(remote);
      }
    }

    for (const path of plan.push) {
      const local = localFiles.get(path);

      if (!local) {
        continue;
      }

      const filePath = resolveWorkspaceSyncPath(workspacePath, path);
      const responseEntry = await this.uploadFile(path, await readFile(filePath));
      index.files[path] = mapIndexEntry(responseEntry);
    }

    for (const path of plan.deleteRemote) {
      const responseEntry = await this.deleteRemoteFile(path);
      index.files[path] = mapIndexEntry(responseEntry);
    }
  }

  private async syncAppState({
    allowLocalUpload = true,
    appState,
    index,
    workspacePath,
  }: {
    allowLocalUpload?: boolean;
    appState: PersistedAppState;
    index: SyncWorkspaceIndex;
    workspacePath: string;
  }) {
    const remotePayload = await this.fetchAppState();
    const relativeAppState = createRelativeSyncAppState(appState, workspacePath);
    const localHash = sha256(stableJson(relativeAppState));
    const localChanged = index.appStateSha256 !== localHash;
    const remoteChanged =
      remotePayload.revision > 0 &&
      index.appStateRevision !== remotePayload.revision;
    const initialAppStateSync =
      typeof index.appStateRevision !== "number" &&
      typeof index.appStateSha256 !== "string";

    if (!allowLocalUpload) {
      if (remotePayload.state && remoteChanged) {
        const nextAppState = createAbsoluteSyncAppState(
          remotePayload.state,
          workspacePath,
        );
        await this.options.setAppState(nextAppState);
        index.appStateRevision = remotePayload.revision;
        index.appStateSha256 =
          remotePayload.sha256 ?? sha256(stableJson(remotePayload.state));
      }
      return;
    }

    if (remotePayload.state && remoteChanged && initialAppStateSync) {
      const nextAppState = createAbsoluteSyncAppState(
        remotePayload.state,
        workspacePath,
      );
      await this.options.setAppState(nextAppState);
      index.appStateRevision = remotePayload.revision;
      index.appStateSha256 = remotePayload.sha256 ?? sha256(stableJson(remotePayload.state));
      return;
    }

    if (localChanged || !remoteChanged) {
      const nextPayload = await this.uploadAppState(relativeAppState);
      index.appStateRevision = nextPayload.revision;
      index.appStateSha256 = localHash;
      return;
    }

    if (remotePayload.state) {
      const nextAppState = createAbsoluteSyncAppState(
        remotePayload.state,
        workspacePath,
      );
      await this.options.setAppState(nextAppState);
      index.appStateRevision = remotePayload.revision;
      index.appStateSha256 = remotePayload.sha256 ?? sha256(stableJson(remotePayload.state));
    }
  }

  private async request(
    path: string,
    init: RequestInit & { expectJson?: boolean } = {},
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), syncRequestTimeoutMs);
    const url = `${normalizeSyncServerUrl(this.configuration.serverUrl)}${path}`;

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.configuration.token}`,
          ...(init.body instanceof Buffer
            ? { "Content-Type": "application/octet-stream" }
            : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `同步请求失败（${response.status}）：${await readResponseBody(response)}`,
        );
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestJson<T>(
    serverUrl: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), syncRequestTimeoutMs);

    try {
      const response = await fetch(`${normalizeSyncServerUrl(serverUrl)}${path}`, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `同步请求失败（${response.status}）：${await readResponseBody(response)}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchManifest(): Promise<SyncManifest> {
    const response = await this.request("/api/v1/sync/manifest");

    return (await response.json()) as SyncManifest;
  }

  private async uploadFile(path: string, content: Buffer) {
    const response = await this.request(
      `/api/v1/sync/file?path=${encodeURIComponent(path)}`,
      {
        body: content as unknown as BodyInit,
        method: "PUT",
      },
    );

    return (await response.json()) as SyncManifestEntry;
  }

  private async downloadFile(path: string) {
    const response = await this.request(
      `/api/v1/sync/file?path=${encodeURIComponent(path)}`,
    );

    return Buffer.from(await response.arrayBuffer());
  }

  private async deleteRemoteFile(path: string) {
    const response = await this.request(
      `/api/v1/sync/file?path=${encodeURIComponent(path)}`,
      { method: "DELETE" },
    );

    return (await response.json()) as SyncManifestEntry;
  }

  private async fetchAppState(): Promise<SyncAppStatePayload> {
    const response = await this.request("/api/v1/sync/app-state");

    return (await response.json()) as SyncAppStatePayload;
  }

  private async uploadAppState(
    state: PersistedAppState,
  ): Promise<SyncAppStatePayload> {
    const response = await this.request("/api/v1/sync/app-state", {
      body: JSON.stringify({ state }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });

    return (await response.json()) as SyncAppStatePayload;
  }
}
