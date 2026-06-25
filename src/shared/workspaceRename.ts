export type WorkspaceRenameEntryType = "directory" | "file";

const invalidWorkspaceNamePattern = /[<>:"/\\|?*\u0000-\u001f]/;

export function splitWorkspaceEntryNameForRename(
  entryName: string,
  entryType: WorkspaceRenameEntryType,
) {
  if (entryType === "directory") {
    return {
      editableName: entryName,
      extension: "",
    };
  }

  const lastDotIndex = entryName.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0 && lastDotIndex < entryName.length - 1;

  if (!hasExtension) {
    return {
      editableName: entryName,
      extension: "",
    };
  }

  return {
    editableName: entryName.slice(0, lastDotIndex),
    extension: entryName.slice(lastDotIndex),
  };
}

export function normalizeWorkspaceRenameBaseName(value: string) {
  return value.trim();
}

export function validateWorkspaceRenameBaseName(value: string) {
  const baseName = normalizeWorkspaceRenameBaseName(value);

  if (!baseName) {
    return "名称不能为空。";
  }

  if (baseName === "." || baseName === "..") {
    return "名称不能使用保留路径。";
  }

  if (invalidWorkspaceNamePattern.test(baseName)) {
    return "名称不能包含 <>:\"/\\|?* 等特殊字符。";
  }

  return null;
}

export function createWorkspaceRenamedEntryName({
  currentName,
  entryType,
  nextBaseName,
}: {
  currentName: string;
  entryType: WorkspaceRenameEntryType;
  nextBaseName: string;
}) {
  const validationError = validateWorkspaceRenameBaseName(nextBaseName);

  if (validationError) {
    throw new Error(validationError);
  }

  const { extension } = splitWorkspaceEntryNameForRename(currentName, entryType);
  return `${normalizeWorkspaceRenameBaseName(nextBaseName)}${extension}`;
}
