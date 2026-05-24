import { mergeDocumentByFilePath } from "./documentModel";
import type { MarkdownDocument, WorkspaceSnapshot } from "./types";
import type { AppDialogState } from "./useAppDialog";
import { normalizeFilePathKey } from "./workspaceDisplay";

export type WorkspaceFileChangePayload = {
  event: "add" | "change" | "unlink";
  filePath: string;
  updatedAt?: string;
};

export type WorkspaceFileChangeContext = {
  changedDocument?: MarkdownDocument;
  fileKey: string;
  isCurrentDocument: boolean;
};

export type DiskChangeDecision =
  | "apply-disk"
  | "confirm-current-reload"
  | "keep-background-conflict"
  | "same-content";

export type AppConfirmOptions = Omit<AppDialogState, "type">;
export type AppAlertOptions = Omit<AppDialogState, "type" | "cancelLabel">;

export function getWorkspaceFileChangeContext({
  activeDocument,
  documents,
  payload,
}: {
  activeDocument?: MarkdownDocument | null;
  documents: MarkdownDocument[];
  payload: WorkspaceFileChangePayload;
}): WorkspaceFileChangeContext {
  const fileKey = normalizeFilePathKey(payload.filePath);

  return {
    changedDocument: documents.find(
      (document) => normalizeFilePathKey(document.filePath) === fileKey,
    ),
    fileKey,
    isCurrentDocument: normalizeFilePathKey(activeDocument?.filePath) === fileKey,
  };
}

export function consumeInternalFileDelete(
  internalFileDeletes: Set<string>,
  fileKey: string,
) {
  if (!internalFileDeletes.has(fileKey)) {
    return false;
  }

  internalFileDeletes.delete(fileKey);
  return true;
}

export function shouldMergeInternalWriteBack({
  currentDocument,
  diskDocument,
}: {
  currentDocument?: MarkdownDocument | null;
  diskDocument: MarkdownDocument;
}) {
  return Boolean(currentDocument && currentDocument.content === diskDocument.content);
}

export function getDiskChangeDecision({
  changedDocument,
  diskDocument,
  hasLocalChanges,
  isCurrentDocument,
}: {
  changedDocument: MarkdownDocument;
  diskDocument: MarkdownDocument;
  hasLocalChanges: boolean;
  isCurrentDocument: boolean;
}): DiskChangeDecision {
  if (diskDocument.content === changedDocument.content) {
    return "same-content";
  }

  if (!hasLocalChanges) {
    return "apply-disk";
  }

  return isCurrentDocument ? "confirm-current-reload" : "keep-background-conflict";
}

export function mergeDiskDocumentIntoWorkspace(
  workspace: WorkspaceSnapshot,
  diskDocument: MarkdownDocument,
): WorkspaceSnapshot {
  return {
    ...workspace,
    documents: mergeDocumentByFilePath(workspace.documents, diskDocument),
  };
}

export function getExternalDeleteAlert(filePath: string): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description:
      "编辑器会暂时保留当前内容。再次保存时会弹出保存位置，你可以沿用原文件名重新保存。",
    detail: filePath,
    title: "当前文件已在外部被删除",
    tone: "danger",
  };
}

export function getExternalChangeConfirm(filePath: string): AppConfirmOptions {
  return {
    cancelLabel: "保留当前内容",
    confirmLabel: "重新加载",
    description:
      "重新加载会使用磁盘上的最新内容，并丢弃编辑器中尚未保存的内容；保留当前内容则会暂停该文件的自动保存，直到你手动保存或重新加载。",
    detail: filePath,
    title: "当前文件已在外部修改",
    tone: "warning",
  };
}
