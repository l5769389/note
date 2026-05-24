import {
  appSettingsStorageKey,
  appThemeValues,
  getInitialTheme,
  loadAppSettings,
  normalizeAppSettings,
  type AppSettings,
  type AppTheme,
} from "./appSettings";
import {
  getMigratedStorageItem,
  legacyNoteDockStorageKeys,
  noteDockStorageKeys,
  removeLegacyStorageItem,
} from "./storageKeys";
import {
  loadWorkspaceFromStorage,
  normalizeWorkspaceSnapshot,
  saveWorkspaceToStorage,
  serializeWorkspaceSnapshot,
} from "./storage";
import {
  persistedAppStateVersion,
  type PersistedAppState,
} from "../../shared/appState";
import type { WorkspaceSnapshot } from "./types";

export const defaultSidebarWidth = 334;
export const minSidebarWidth = 236;
export const maxSidebarWidth = 560;
export const storedRecentDirectoryLimit = 12;

const recentDirectoryStorageKey = noteDockStorageKeys.recentDirectories;

function clampSidebarWidth(width: number) {
  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, width));
}

export function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function loadRecentDirectoryPaths(storage = getBrowserStorage()) {
  try {
    const raw = getMigratedStorageItem(
      storage,
      recentDirectoryStorageKey,
      legacyNoteDockStorageKeys.recentDirectories,
    );
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === "string")
      : [];
  } catch {
    return [];
  }
}

export function normalizeTheme(value: unknown): AppTheme {
  return appThemeValues.includes(value as AppTheme) ? (value as AppTheme) : "github";
}

export function normalizeSidebarWidth(value: unknown) {
  const width =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(width)
    ? clampSidebarWidth(width)
    : defaultSidebarWidth;
}

export function hasPersistedAppState(
  state: PersistedAppState | null | undefined,
) {
  return Boolean(
    state &&
      (state.workspace !== undefined ||
        state.appSettings !== undefined ||
        state.theme !== undefined ||
        state.sidebarWidth !== undefined ||
        (state.recentDirectories?.length ?? 0) > 0),
  );
}

export function hasBrowserPersistedAppState(storage = getBrowserStorage()) {
  if (!storage) {
    return false;
  }

  try {
    return [
      ...Object.values(noteDockStorageKeys),
      ...Object.values(legacyNoteDockStorageKeys),
    ].some((key) => storage.getItem(key) !== null);
  } catch {
    return false;
  }
}

export function getLegacyPersistedAppState(
  storage = getBrowserStorage(),
): PersistedAppState | null {
  if (!hasBrowserPersistedAppState(storage)) {
    return null;
  }

  return {
    appSettings: loadAppSettings(storage),
    recentDirectories: loadRecentDirectoryPaths(storage),
    sidebarWidth: normalizeSidebarWidth(
      getMigratedStorageItem(
        storage,
        noteDockStorageKeys.sidebarWidth,
        legacyNoteDockStorageKeys.sidebarWidth,
      ),
    ),
    theme: getInitialTheme(storage),
    version: persistedAppStateVersion,
    workspace: loadWorkspaceFromStorage(storage),
  };
}

export function normalizePersistedDirectories(value: unknown) {
  return Array.isArray(value)
    ? value.filter((path): path is string => typeof path === "string")
    : [];
}

export function createPersistedAppState({
  recentDirectories,
  settings,
  sidebarWidth,
  theme,
  workspace,
}: {
  recentDirectories: string[];
  settings: AppSettings;
  sidebarWidth: number;
  theme: AppTheme;
  workspace: WorkspaceSnapshot;
}): PersistedAppState {
  return {
    appSettings: settings,
    recentDirectories,
    sidebarWidth,
    theme,
    updatedAt: new Date().toISOString(),
    version: persistedAppStateVersion,
    workspace: serializeWorkspaceSnapshot(workspace),
  };
}

export type PersistedAppHydration = {
  recentDirectories: string[];
  settings: AppSettings;
  shouldMigrateLegacyState: boolean;
  sidebarWidth: number;
  theme: AppTheme;
  workspace: WorkspaceSnapshot;
};

export function createPersistedAppHydration(
  mainState: PersistedAppState | null | undefined,
  legacyState: PersistedAppState | null | undefined,
): PersistedAppHydration {
  const hasMainState = hasPersistedAppState(mainState);
  const sourceState = hasMainState ? mainState : legacyState;

  return {
    recentDirectories: normalizePersistedDirectories(
      sourceState?.recentDirectories,
    ),
    settings: normalizeAppSettings(sourceState?.appSettings),
    shouldMigrateLegacyState: !hasMainState && Boolean(legacyState),
    sidebarWidth: normalizeSidebarWidth(sourceState?.sidebarWidth),
    theme: normalizeTheme(sourceState?.theme),
    workspace: normalizeWorkspaceSnapshot(sourceState?.workspace),
  };
}

export async function loadPersistedAppHydration(
  loadAppState?: () => Promise<PersistedAppState>,
): Promise<PersistedAppHydration> {
  const mainState = await loadAppState?.().catch(() => null);
  const legacyState = getLegacyPersistedAppState();

  return createPersistedAppHydration(mainState, legacyState);
}

export async function migrateLegacyPersistedAppHydration(
  hydration: PersistedAppHydration,
  saveAppState?: (state: PersistedAppState) => Promise<PersistedAppState>,
  clearLegacyState = clearBrowserPersistedAppState,
) {
  if (!hydration.shouldMigrateLegacyState || !saveAppState) {
    return false;
  }

  await saveAppState(
    createPersistedAppState({
      recentDirectories: hydration.recentDirectories,
      settings: hydration.settings,
      sidebarWidth: hydration.sidebarWidth,
      theme: hydration.theme,
      workspace: hydration.workspace,
    }),
  );
  clearLegacyState();

  return true;
}

export function saveLegacyPersistedAppState(state: PersistedAppState) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  saveWorkspaceToStorage(normalizeWorkspaceSnapshot(state.workspace), storage);
  storage.setItem(
    appSettingsStorageKey,
    JSON.stringify(normalizeAppSettings(state.appSettings)),
  );
  storage.setItem(noteDockStorageKeys.theme, normalizeTheme(state.theme));
  storage.setItem(
    noteDockStorageKeys.sidebarWidth,
    String(normalizeSidebarWidth(state.sidebarWidth)),
  );
  storage.setItem(
    recentDirectoryStorageKey,
    JSON.stringify(normalizePersistedDirectories(state.recentDirectories)),
  );
}

export async function savePersistedAppState(state: PersistedAppState) {
  if (window.desktop?.saveAppState) {
    await window.desktop.saveAppState(state);
    return;
  }

  saveLegacyPersistedAppState(state);
}

export function clearBrowserPersistedAppState(storage = getBrowserStorage()) {
  [...Object.values(noteDockStorageKeys), ...Object.values(legacyNoteDockStorageKeys)].forEach(
    (key) => removeLegacyStorageItem(storage, key),
  );
}
