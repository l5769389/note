export const noteDockStorageKeys = {
  appSettings: "notedock:settings",
  recentDirectories: "notedock:recent-directories:v1",
  sidebarWidth: "notedock:sidebar-width",
  theme: "notedock:theme",
  workspace: "notedock:workspace:v1",
} as const;

const previousBrandPrefix = `${["typo", "ra"].join("")}-like`;

export const legacyNoteDockStorageKeys = {
  appSettings: `${previousBrandPrefix}-settings`,
  recentDirectories: `${previousBrandPrefix}-editor:recent-directories:v1`,
  sidebarWidth: `${previousBrandPrefix}-sidebar-width`,
  theme: `${previousBrandPrefix}-theme`,
  workspace: `${previousBrandPrefix}-editor:workspace:v1`,
} as const;

export function removeLegacyStorageItem(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function getMigratedStorageItem(
  storage: Storage | undefined,
  key: string,
  legacyKey: string,
) {
  const storedValue = storage?.getItem(key);

  if (storedValue !== undefined && storedValue !== null) {
    removeLegacyStorageItem(storage, legacyKey);
    return storedValue;
  }

  const legacyValue = storage?.getItem(legacyKey);

  if (legacyValue === undefined || legacyValue === null) {
    return null;
  }

  try {
    storage?.setItem(key, legacyValue);
  } catch {
    // Keep returning the value even if the browser refuses the write.
  }

  removeLegacyStorageItem(storage, legacyKey);
  return legacyValue;
}
