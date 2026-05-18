/// <reference types="vite/client" />

import type {
  DirectoryTreeItem,
  LocalMarkdownFile,
  LocalWorkspaceDirectory,
} from "./types";

type WorkspaceFileChangePayload = {
  event: "add" | "change" | "unlink";
  filePath: string;
  updatedAt?: string;
};

type DesktopApi = {
  createDocumentFile: (payload: {
    content: string;
    directoryPath: string;
    extension: ".excalidraw" | ".md" | ".univer";
    title: string;
  }) => Promise<LocalMarkdownFile>;
  createMarkdownFile: (payload: {
    directoryPath: string;
    title: string;
  }) => Promise<LocalMarkdownFile>;
  exportHtmlFile: (payload: {
    filePath?: string;
    html: string;
    title: string;
  }) => Promise<string | null>;
  exportPdfFile: (payload: {
    filePath?: string;
    html: string;
    title: string;
  }) => Promise<string | null>;
  getDefaultWorkspaceDirectory: () => Promise<string>;
  listMarkdownFiles: (directoryPath: string) => Promise<LocalMarkdownFile[]>;
  newWindow: () => Promise<void>;
  onWorkspaceFileChanged: (
    callback: (payload: WorkspaceFileChangePayload) => void,
  ) => () => void;
  openPath: (targetPath: string) => Promise<string>;
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  pathExists: (filePath: string) => Promise<boolean>;
  platform: string;
  readDirectoryTree: (directoryPath: string) => Promise<DirectoryTreeItem>;
  readExcelDocument: (filePath: string) => Promise<string>;
  readMarkdownFile: (filePath: string) => Promise<LocalMarkdownFile>;
  readWordDocument: (filePath: string) => Promise<string>;
  saveMarkdownFileAs: (payload: {
    content: string;
    filePath?: string;
    title: string;
  }) => Promise<LocalMarkdownFile | null>;
  selectMarkdownFile: () => Promise<LocalMarkdownFile | null>;
  selectWorkspaceDirectory: () => Promise<string | null>;
  showInFolder: (targetPath: string) => Promise<void>;
  unwatchWorkspaceDirectory: () => Promise<void>;
  versions: {
    chrome: string;
    electron: string;
  };
  windowControl: (action: "close" | "maximize" | "minimize") => Promise<boolean | void>;
  watchWorkspaceDirectory: (directoryPath: string) => Promise<boolean>;
  writeMarkdownFile: (payload: {
    content: string;
    filePath: string;
  }) => Promise<LocalMarkdownFile>;
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
