import type { MarkdownDocument, LocalMarkdownFile } from "./types";
import type { AppDialogState } from "./useAppDialog";
import type { AppTheme } from "./appSettings";
import { mergeDocumentByFilePath, updateDocument } from "./documentModel";
import { isWritableTextDocument } from "./filePersistence";
import { getDirectoryPath } from "./localPreviewUrls";
import { normalizeFilePathKey } from "./workspaceDisplay";
import type { WorkspaceSnapshot } from "./types";

export type AppAlertOptions = Omit<AppDialogState, "type" | "cancelLabel">;
export type ExportDocumentFormat = "html" | "pdf";
export type WriteExistingDocumentResult = "save-as" | "skipped" | "written";
export type WriteMarkdownFile = (payload: {
  content: string;
  filePath: string;
}) => Promise<unknown>;
export type ExportMarkdownFile = (payload: {
  filePath?: string;
  html: string;
  title: string;
}) => Promise<string | null>;
export type CreateMarkdownExportHtml = (payload: {
  document: MarkdownDocument;
  theme: AppTheme;
}) => Promise<string>;

export function getWorkspacePathAfterOpen(
  currentWorkspacePath: string | undefined,
  filePath?: string,
) {
  return currentWorkspacePath || getDirectoryPath(filePath);
}

export function getWorkspacePathAfterSaveAs(
  currentWorkspacePath: string | undefined,
  filePath: string,
) {
  return currentWorkspacePath || getDirectoryPath(filePath) || currentWorkspacePath;
}

export function createDocumentFromSavedFile(
  document: MarkdownDocument,
  savedFile: LocalMarkdownFile,
): MarkdownDocument {
  return {
    ...document,
    content: savedFile.content,
    documentType: savedFile.documentType,
    fileExtension: savedFile.fileExtension,
    filePath: savedFile.filePath,
    title: savedFile.title,
    updatedAt: savedFile.updatedAt,
  };
}

function getMergedDocumentActiveId(
  documents: MarkdownDocument[],
  document: MarkdownDocument,
  preferredActiveDocumentId?: string,
) {
  if (preferredActiveDocumentId) {
    return preferredActiveDocumentId;
  }

  const existingDocument = document.filePath
    ? documents.find((item) => item.filePath === document.filePath)
    : null;

  return existingDocument?.id ?? document.id;
}

export function addOpenedDocumentToWorkspace(
  workspace: WorkspaceSnapshot,
  document: MarkdownDocument,
  preferredActiveDocumentId?: string,
): WorkspaceSnapshot {
  return {
    ...workspace,
    activeDocumentId: getMergedDocumentActiveId(
      workspace.documents,
      document,
      preferredActiveDocumentId,
    ),
    documents: mergeDocumentByFilePath(workspace.documents, document),
    workspacePath: getWorkspacePathAfterOpen(
      workspace.workspacePath,
      document.filePath,
    ),
  };
}

export function addCreatedDocumentToWorkspace(
  workspace: WorkspaceSnapshot,
  document: MarkdownDocument,
  directoryPath?: string,
): WorkspaceSnapshot {
  return {
    ...workspace,
    activeDocumentId: getMergedDocumentActiveId(workspace.documents, document),
    documents: mergeDocumentByFilePath(workspace.documents, document),
    workspacePath:
      directoryPath || getWorkspacePathAfterOpen(workspace.workspacePath, document.filePath),
  };
}

export function applySavedDocumentToWorkspace(
  workspace: WorkspaceSnapshot,
  document: MarkdownDocument,
): WorkspaceSnapshot {
  return {
    ...updateDocument(workspace, document),
    activeDocumentId: document.id,
    workspacePath: getWorkspacePathAfterSaveAs(
      workspace.workspacePath,
      document.filePath ?? "",
    ),
  };
}

export async function isExternallyDeletedFile({
  externalConflictPaths,
  filePath,
  pathExists,
}: {
  externalConflictPaths: Set<string>;
  filePath?: string;
  pathExists?: (filePath: string) => Promise<boolean>;
}) {
  if (!filePath || !pathExists) {
    return false;
  }

  return (
    externalConflictPaths.has(normalizeFilePathKey(filePath)) &&
    !(await pathExists(filePath))
  );
}

export async function writeExistingDocumentIfNeeded({
  acknowledgeSavedFileContent,
  document,
  externalConflictPaths,
  pathExists,
  rememberInternalFileWrite,
  writeMarkdownFile,
}: {
  acknowledgeSavedFileContent: (filePath: string, content: string) => void;
  document?: MarkdownDocument | null;
  externalConflictPaths: Set<string>;
  pathExists?: (filePath: string) => Promise<boolean>;
  rememberInternalFileWrite: (filePath: string, content: string) => void;
  writeMarkdownFile?: WriteMarkdownFile;
}): Promise<WriteExistingDocumentResult> {
  if (!isWritableTextDocument(document) || !document?.filePath || !writeMarkdownFile) {
    return "skipped";
  }

  if (
    await isExternallyDeletedFile({
      externalConflictPaths,
      filePath: document.filePath,
      pathExists,
    })
  ) {
    return "save-as";
  }

  rememberInternalFileWrite(document.filePath, document.content);
  await writeMarkdownFile({
    content: document.content,
    filePath: document.filePath,
  });
  acknowledgeSavedFileContent(document.filePath, document.content);

  return "written";
}

export async function exportMarkdownDocument({
  createHtml,
  document,
  exportHtmlFile,
  exportPdfFile,
  format,
  showInFolder,
  theme,
}: {
  createHtml: CreateMarkdownExportHtml;
  document: MarkdownDocument;
  exportHtmlFile: ExportMarkdownFile;
  exportPdfFile: ExportMarkdownFile;
  format: ExportDocumentFormat;
  showInFolder?: (filePath: string) => Promise<unknown>;
  theme: AppTheme;
}) {
  const html = await createHtml({ document, theme });
  const exportedFilePath =
    format === "pdf"
      ? await exportPdfFile({
          filePath: document.filePath,
          html,
          title: document.title,
        })
      : await exportHtmlFile({
          filePath: document.filePath,
          html,
          title: document.title,
        });

  if (exportedFilePath) {
    await showInFolder?.(exportedFilePath);
  }

  return exportedFilePath;
}

export function getSaveAsReadonlyAlert(): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description: "当前文件类型只支持预览，不能另存为 Markdown。",
    title: "这是只读预览文件",
    tone: "info",
  };
}

export function getSaveAsFailedAlert(): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description: "请确认目标路径可写，或换一个保存位置。",
    title: "另存为失败",
    tone: "danger",
  };
}

export function getExportReadonlyAlert(): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description: "当前文件类型只支持预览，不能从 Markdown 模式导出。",
    title: "这是只读预览文件",
    tone: "info",
  };
}

export function getExportUnsupportedAlert(): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description: "当前运行环境没有暴露导出能力，请在 Electron 桌面端中使用。",
    title: "当前环境不支持导出",
    tone: "warning",
  };
}

export function getExportFailedAlert(format: ExportDocumentFormat): AppAlertOptions {
  return {
    confirmLabel: "知道了",
    description: "导出过程中发生错误，请稍后重试或检查文件路径权限。",
    title: format === "pdf" ? "导出 PDF 失败" : "导出 HTML 失败",
    tone: "danger",
  };
}
