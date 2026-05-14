/// <reference types="vite/client" />

import type {
  DirectoryTreeItem,
  LocalMarkdownFile,
  LocalWorkspaceDirectory,
} from "./types";

type DesktopApi = {
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
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  pathExists: (filePath: string) => Promise<boolean>;
  platform: string;
  readDirectoryTree: (directoryPath: string) => Promise<DirectoryTreeItem>;
  readMarkdownFile: (filePath: string) => Promise<LocalMarkdownFile>;
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
