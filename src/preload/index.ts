import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  createMarkdownFile: (payload: { directoryPath: string; title: string }) =>
    ipcRenderer.invoke("workspace:create-markdown-file", payload),
  exportHtmlFile: (payload: { filePath?: string; html: string; title: string }) =>
    ipcRenderer.invoke("export:html", payload),
  exportPdfFile: (payload: { filePath?: string; html: string; title: string }) =>
    ipcRenderer.invoke("export:pdf", payload),
  getDefaultWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:get-default-directory"),
  listMarkdownFiles: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:list-markdown-files", directoryPath),
  newWindow: () =>
    ipcRenderer.invoke("window:new"),
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
  saveMarkdownFileAs: (payload: { content: string; filePath?: string; title: string }) =>
    ipcRenderer.invoke("workspace:save-markdown-file-as", payload),
  selectMarkdownFile: () =>
    ipcRenderer.invoke("workspace:select-markdown-file"),
  selectWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:select-directory"),
  showInFolder: (targetPath: string) =>
    ipcRenderer.invoke("workspace:show-in-folder", targetPath),
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  windowControl: (action: "close" | "maximize" | "minimize") =>
    ipcRenderer.invoke(`window:${action}`),
  writeMarkdownFile: (payload: { content: string; filePath: string }) =>
    ipcRenderer.invoke("workspace:write-markdown-file", payload),
});
