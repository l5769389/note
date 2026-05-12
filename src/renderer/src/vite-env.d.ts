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
  getDefaultWorkspaceDirectory: () => Promise<string>;
  listMarkdownFiles: (directoryPath: string) => Promise<LocalMarkdownFile[]>;
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  platform: string;
  readDirectoryTree: (directoryPath: string) => Promise<DirectoryTreeItem>;
  readMarkdownFile: (filePath: string) => Promise<LocalMarkdownFile>;
  selectMarkdownFile: () => Promise<LocalMarkdownFile | null>;
  selectWorkspaceDirectory: () => Promise<string | null>;
  showInFolder: (targetPath: string) => Promise<void>;
  versions: {
    chrome: string;
    electron: string;
  };
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
