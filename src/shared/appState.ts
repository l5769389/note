export const persistedAppStateVersion = 1;

export type PersistedAppState = {
  appSettings?: unknown;
  recentDirectories?: string[];
  sidebarWidth?: number;
  theme?: string;
  updatedAt?: string;
  version: typeof persistedAppStateVersion;
  workspace?: unknown;
};
