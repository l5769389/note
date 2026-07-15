import { storedRecentDirectoryLimit } from "./appPersistence";
import { isPathInsideDiaryRoot } from "./diaryModel";

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

export function shouldShowInRecentDirectories(
  path: string | undefined,
  workspacePath: string | undefined,
) {
  return Boolean(path && !isPathInsideDiaryRoot(path, workspacePath));
}
