/// <reference types="vite/client" />

import type {
  DirectoryTreeItem,
  LocalMarkdownFile,
  LocalWorkspaceDirectory,
} from "./types";

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
  openPath: (targetPath: string) => Promise<string>;
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  pathExists: (filePath: string) => Promise<boolean>;
  platform: string;
  readDirectoryTree: (directoryPath: string) => Promise<DirectoryTreeItem>;
  readMarkdownFile: (filePath: string) => Promise<LocalMarkdownFile>;
  renderWordDocument: (filePath: string) => Promise<{
    html: string;
    messages: Array<{ message: string; type: string }>;
  }>;
  saveMarkdownFileAs: (payload: {
    content: string;
    filePath?: string;
    title: string;
  }) => Promise<LocalMarkdownFile | null>;
  selectMarkdownFile: () => Promise<LocalMarkdownFile | null>;
  selectWorkspaceDirectory: () => Promise<string | null>;
  showInFolder: (targetPath: string) => Promise<void>;
  versions: {
    chrome: string;
    electron: string;
  };
  windowControl: (action: "close" | "maximize" | "minimize") => Promise<boolean | void>;
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
