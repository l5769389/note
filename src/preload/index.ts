import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";

type WorkspaceFileChangePayload = {
  event: "add" | "change" | "unlink";
  filePath: string;
  updatedAt?: string;
};

contextBridge.exposeInMainWorld("desktop", {
  getPathForFile: (file: unknown) =>
    webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]),
  hasClipboardContent: () => ipcRenderer.invoke("clipboard:has-content"),
  listClipboardMediaFiles: () => ipcRenderer.invoke("clipboard:list-media-files"),
  readClipboardImage: () => ipcRenderer.invoke("clipboard:read-image"),
  readClipboardMediaFiles: () => ipcRenderer.invoke("clipboard:read-media-files"),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
  checkAssetReferences: (payload: {
    documentFilePath: string;
    references: string[];
  }) => ipcRenderer.invoke("workspace:check-asset-references", payload),
  copyAssetFromFile: (payload: {
    documentFilePath: string;
    fileName: string;
    sourceFilePath: string;
  }) => ipcRenderer.invoke("workspace:copy-asset-from-file", payload),
  createDocumentFile: (payload: {
    content: string;
    directoryPath: string;
    extension: ".excalidraw" | ".md" | ".univer";
    title: string;
  }) => ipcRenderer.invoke("workspace:create-document-file", payload),
  createMarkdownFile: (payload: { directoryPath: string; title: string }) =>
    ipcRenderer.invoke("workspace:create-markdown-file", payload),
  deleteDocumentFile: (filePath: string) =>
    ipcRenderer.invoke("workspace:delete-document-file", filePath),
  duplicateDocumentFile: (filePath: string) =>
    ipcRenderer.invoke("workspace:duplicate-document-file", filePath),
  exportHtmlFile: (payload: { filePath?: string; html: string; title: string }) =>
    ipcRenderer.invoke("export:html", payload),
  exportPdfFile: (payload: { filePath?: string; html: string; title: string }) =>
    ipcRenderer.invoke("export:pdf", payload),
  getDefaultWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:get-default-directory"),
  getZoomFactor: () =>
    ipcRenderer.invoke("window:get-zoom-factor"),
  listMarkdownFiles: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:list-markdown-files", directoryPath),
  newWindow: () =>
    ipcRenderer.invoke("window:new"),
  getWindowState: () =>
    ipcRenderer.invoke("window:get-state"),
  onWorkspaceFileChanged: (
    callback: (payload: WorkspaceFileChangePayload) => void,
  ) => {
    const listener = (_: IpcRendererEvent, payload: WorkspaceFileChangePayload) => {
      callback(payload);
    };

    ipcRenderer.on("workspace:file-change", listener);

    return () => {
      ipcRenderer.removeListener("workspace:file-change", listener);
    };
  },
  onZoomFactorChanged: (callback: (factor: number) => void) => {
    const listener = (_: IpcRendererEvent, factor: number) => {
      callback(factor);
    };

    ipcRenderer.on("window:zoom-factor-changed", listener);

    return () => {
      ipcRenderer.removeListener("window:zoom-factor-changed", listener);
    };
  },
  openWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:open-directory"),
  openPath: (targetPath: string) =>
    ipcRenderer.invoke("workspace:open-path", targetPath),
  pathExists: (filePath: string) =>
    ipcRenderer.invoke("workspace:path-exists", filePath),
  readDirectoryTree: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:read-directory-tree", directoryPath),
  readMarkdownFile: (filePath: string) =>
    ipcRenderer.invoke("workspace:read-markdown-file", filePath),
  readTextAsset: (payload: { documentFilePath: string; reference: string }) =>
    ipcRenderer.invoke("workspace:read-text-asset", payload),
  readWordDocument: (filePath: string) =>
    ipcRenderer.invoke("workspace:read-word-document", filePath),
  readExcelDocument: (filePath: string) =>
    ipcRenderer.invoke("workspace:read-excel-document", filePath),
  renameAsset: (payload: {
    documentFilePath: string;
    nextName: string;
    reference: string;
  }) => ipcRenderer.invoke("workspace:rename-asset", payload),
  saveMarkdownFileAs: (payload: { content: string; filePath?: string; title: string }) =>
    ipcRenderer.invoke("workspace:save-markdown-file-as", payload),
  selectMarkdownFile: () =>
    ipcRenderer.invoke("workspace:select-markdown-file"),
  selectWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:select-directory"),
  saveAsset: (payload: {
    content: string;
    documentFilePath: string;
    encoding: "dataUrl" | "utf-8";
    fileName: string;
  }) => ipcRenderer.invoke("workspace:save-asset", payload),
  showInFolder: (targetPath: string) =>
    ipcRenderer.invoke("workspace:show-in-folder", targetPath),
  unwatchWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:unwatch-directory"),
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  windowControl: (action: "close" | "maximize" | "minimize") =>
    ipcRenderer.invoke(`window:${action}`),
  toggleAlwaysOnTop: () =>
    ipcRenderer.invoke("window:toggle-always-on-top"),
  toggleFullScreen: () =>
    ipcRenderer.invoke("window:toggle-fullscreen"),
  resetZoom: () =>
    ipcRenderer.invoke("window:reset-zoom"),
  setZoomFactor: (factor: number) =>
    ipcRenderer.invoke("window:set-zoom-factor", factor),
  watchWorkspaceDirectory: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:watch-directory", directoryPath),
  writeMarkdownFile: (payload: { content: string; filePath: string }) =>
    ipcRenderer.invoke("workspace:write-markdown-file", payload),
  writeTextAsset: (payload: {
    content: string;
    documentFilePath: string;
    reference: string;
  }) => ipcRenderer.invoke("workspace:write-text-asset", payload),
  zoomIn: () =>
    ipcRenderer.invoke("window:zoom-in"),
  zoomOut: () =>
    ipcRenderer.invoke("window:zoom-out"),
});
