import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  createMarkdownFile: (payload: { directoryPath: string; title: string }) =>
    ipcRenderer.invoke("workspace:create-markdown-file", payload),
  getDefaultWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:get-default-directory"),
  listMarkdownFiles: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:list-markdown-files", directoryPath),
  openWorkspaceDirectory: () =>
    ipcRenderer.invoke("workspace:open-directory"),
  readDirectoryTree: (directoryPath: string) =>
    ipcRenderer.invoke("workspace:read-directory-tree", directoryPath),
  readMarkdownFile: (filePath: string) =>
    ipcRenderer.invoke("workspace:read-markdown-file", filePath),
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
  writeMarkdownFile: (payload: { content: string; filePath: string }) =>
    ipcRenderer.invoke("workspace:write-markdown-file", payload),
});
