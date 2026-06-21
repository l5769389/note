import type { PersistedAppState } from "./appState.js";

export const syncProtocolVersion = 1;
export const defaultSyncWorkspaceId = "default";

export type SyncState =
  | "disabled"
  | "idle"
  | "pending"
  | "syncing"
  | "synced"
  | "failed";

export type SyncConfiguration = {
  enabled: boolean;
  serverUrl: string;
  token?: string;
  workspaceId: string;
};

export type SyncConfigurationInput = {
  enabled: boolean;
  serverUrl: string;
  token?: string;
  workspaceId?: string;
};

export type PublicSyncConfiguration = {
  enabled: boolean;
  serverUrl: string;
  tokenConfigured: boolean;
  workspaceId: string;
};

export type SyncStatusSnapshot = {
  configuration: PublicSyncConfiguration;
  lastSyncedAt?: string;
  message?: string;
  state: SyncState;
  workspaceKind?: "local" | "cloud";
  workspaceName?: string;
};

export type SyncManifestEntry = {
  deleted?: boolean;
  path: string;
  revision: number;
  sha256: string;
  size: number;
  updatedAt: string;
};

export type SyncManifest = {
  files: SyncManifestEntry[];
  revision: number;
  workspaceId: string;
};

export type SyncAppStatePayload = {
  revision: number;
  sha256?: string;
  state: PersistedAppState | null;
  updatedAt?: string;
};

export type SyncIndexEntry = {
  deleted?: boolean;
  remoteRevision: number;
  sha256: string;
};

export type SyncWorkspaceIndex = {
  appStateRevision?: number;
  appStateSha256?: string;
  files: Record<string, SyncIndexEntry>;
  lastRemoteRevision?: number;
  updatedAt?: string;
  version: typeof syncProtocolVersion;
  workspaceId: string;
};

export type SyncFileSnapshot = {
  path: string;
  sha256: string;
  size: number;
  updatedAt: string;
};

export type SyncRunInput = {
  appState: PersistedAppState;
  workspacePath: string;
};

export type SyncUserSummary = {
  id: string;
  role?: string;
  username: string;
};

export type SyncWorkspaceSummary = {
  id: string;
  name: string;
};

export type SyncLoginInput = {
  password: string;
  serverUrl: string;
  username: string;
};

export type SyncLoginResult = {
  token: string;
  tokenId: string;
  user: SyncUserSummary;
  workspaceId: string;
  workspaceName?: string;
};

export function normalizeSyncWorkspaceId(value: unknown) {
  const input = typeof value === "string" ? value.trim() : "";
  const normalized = input
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || defaultSyncWorkspaceId;
}

export function normalizeSyncServerUrl(value: unknown) {
  const input = typeof value === "string" ? value.trim() : "";

  return input.replace(/\/+$/, "");
}

export function getPublicSyncConfiguration(
  configuration: SyncConfiguration,
): PublicSyncConfiguration {
  return {
    enabled: Boolean(configuration.enabled),
    serverUrl: normalizeSyncServerUrl(configuration.serverUrl),
    tokenConfigured: Boolean(configuration.token?.trim()),
    workspaceId: normalizeSyncWorkspaceId(configuration.workspaceId),
  };
}

export function createDefaultSyncConfiguration(): SyncConfiguration {
  return {
    enabled: false,
    serverUrl: "",
    token: "",
    workspaceId: defaultSyncWorkspaceId,
  };
}

export function normalizeSyncConfiguration(
  value: unknown,
): SyncConfiguration {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<SyncConfiguration>)
      : {};

  return {
    enabled: Boolean(record.enabled),
    serverUrl: normalizeSyncServerUrl(record.serverUrl),
    token: typeof record.token === "string" ? record.token : "",
    workspaceId: normalizeSyncWorkspaceId(record.workspaceId),
  };
}

export function mergeSyncConfiguration(
  current: SyncConfiguration,
  input: SyncConfigurationInput,
): SyncConfiguration {
  const nextServerUrl = normalizeSyncServerUrl(input.serverUrl);
  const nextToken =
    input.token !== undefined && input.token.trim()
      ? input.token.trim()
      : current.token;

  return {
    enabled: Boolean(input.enabled),
    serverUrl: nextServerUrl,
    token: nextToken ?? "",
    workspaceId: normalizeSyncWorkspaceId(input.workspaceId ?? current.workspaceId),
  };
}

export function createInitialSyncStatus(
  configuration = createDefaultSyncConfiguration(),
): SyncStatusSnapshot {
  return {
    configuration: getPublicSyncConfiguration(configuration),
    state: configuration.enabled ? "idle" : "disabled",
  };
}

export function normalizeSyncIndex(
  value: unknown,
  workspaceId: string,
): SyncWorkspaceIndex {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<SyncWorkspaceIndex>)
      : {};
  const files =
    record.files && typeof record.files === "object" && !Array.isArray(record.files)
      ? Object.fromEntries(
          Object.entries(record.files).flatMap(([path, entry]) => {
            const fileEntry =
              entry && typeof entry === "object" && !Array.isArray(entry)
                ? (entry as Partial<SyncIndexEntry>)
                : null;

            if (!fileEntry || typeof fileEntry.sha256 !== "string") {
              return [];
            }

            return [
              [
                path,
                {
                  deleted: Boolean(fileEntry.deleted),
                  remoteRevision:
                    typeof fileEntry.remoteRevision === "number" &&
                    Number.isFinite(fileEntry.remoteRevision)
                      ? fileEntry.remoteRevision
                      : 0,
                  sha256: fileEntry.sha256,
                } satisfies SyncIndexEntry,
              ],
            ];
          }),
        )
      : {};

  return {
    appStateRevision:
      typeof record.appStateRevision === "number" &&
      Number.isFinite(record.appStateRevision)
        ? record.appStateRevision
        : undefined,
    appStateSha256:
      typeof record.appStateSha256 === "string"
        ? record.appStateSha256
        : undefined,
    files,
    lastRemoteRevision:
      typeof record.lastRemoteRevision === "number" &&
      Number.isFinite(record.lastRemoteRevision)
        ? record.lastRemoteRevision
        : undefined,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    version: syncProtocolVersion,
    workspaceId,
  };
}
