import { storedRecentDirectoryLimit } from "./appPersistence";

export function normalizeDirectoryKey(path?: string) {
  return path?.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() ?? "";
}

export function rememberRecentDirectoryPath(
  currentPaths: string[],
  path?: string,
  limit = storedRecentDirectoryLimit,
) {
  const key = normalizeDirectoryKey(path);

  if (!path || !key) {
    return currentPaths;
  }

  return [
    path,
    ...currentPaths.filter((item) => normalizeDirectoryKey(item) !== key),
  ].slice(0, limit);
}
