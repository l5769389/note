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
  hasClipboardContent: () => Promise<boolean>;
  listClipboardMediaFiles: () => Promise<
    Array<{
      fileName: string;
      filePath: string;
      mimeType: string;
      size: number;
    }>
  >;
  readClipboardImage: () => Promise<{
    dataUrl: string;
    fileName: string;
    mimeType: string;
  } | null>;
  readClipboardMediaFiles: () => Promise<
    Array<{
      dataUrl: string;
      fileName: string;
      mimeType: string;
    }>
  >;
  readClipboardText: () => Promise<string>;
  checkAssetReferences: (payload: {
    documentFilePath: string;
    references: string[];
  }) => Promise<string[]>;
  copyAssetFromFile: (payload: {
    documentFilePath: string;
    fileName: string;
    sourceFilePath: string;
  }) => Promise<{ assetFilePath: string; reference: string }>;
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
  deleteDocumentFile: (filePath: string) => Promise<boolean>;
  duplicateDocumentFile: (filePath: string) => Promise<LocalMarkdownFile>;
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
  getPathForFile: (file: File) => string;
  getZoomFactor: () => Promise<number>;
  getWindowState: () => Promise<{
    alwaysOnTop: boolean;
    fullScreen: boolean;
  }>;
  listMarkdownFiles: (directoryPath: string) => Promise<LocalMarkdownFile[]>;
  newWindow: () => Promise<void>;
  onWorkspaceFileChanged: (
    callback: (payload: WorkspaceFileChangePayload) => void,
  ) => () => void;
  onZoomFactorChanged: (callback: (factor: number) => void) => () => void;
  openPath: (targetPath: string) => Promise<string>;
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  pathExists: (filePath: string) => Promise<boolean>;
  platform: string;
  readDirectoryTree: (directoryPath: string) => Promise<DirectoryTreeItem>;
  readExcelDocument: (filePath: string) => Promise<string>;
  readMarkdownFile: (filePath: string) => Promise<LocalMarkdownFile>;
  readTextAsset: (payload: {
    documentFilePath: string;
    reference: string;
  }) => Promise<string>;
  readWordDocument: (filePath: string) => Promise<string>;
  renameAsset: (payload: {
    documentFilePath: string;
    nextName: string;
    reference: string;
  }) => Promise<{ assetFilePath: string; reference: string }>;
  saveMarkdownFileAs: (payload: {
    content: string;
    filePath?: string;
    title: string;
  }) => Promise<LocalMarkdownFile | null>;
  selectMarkdownFile: () => Promise<LocalMarkdownFile | null>;
  selectWorkspaceDirectory: () => Promise<string | null>;
  saveAsset: (payload: {
    content: string;
    documentFilePath: string;
    encoding: "dataUrl" | "utf-8";
    fileName: string;
  }) => Promise<{ assetFilePath: string; reference: string }>;
  showInFolder: (targetPath: string) => Promise<void>;
  unwatchWorkspaceDirectory: () => Promise<void>;
  versions: {
    chrome: string;
    electron: string;
  };
  windowControl: (action: "close" | "maximize" | "minimize") => Promise<boolean | void>;
  resetZoom: () => Promise<number>;
  setZoomFactor: (factor: number) => Promise<number>;
  toggleAlwaysOnTop: () => Promise<boolean>;
  toggleFullScreen: () => Promise<boolean>;
  watchWorkspaceDirectory: (directoryPath: string) => Promise<boolean>;
  writeMarkdownFile: (payload: {
    content: string;
    filePath: string;
  }) => Promise<LocalMarkdownFile>;
  writeTextAsset: (payload: {
    content: string;
    documentFilePath: string;
    reference: string;
  }) => Promise<{ assetFilePath: string; reference: string }>;
  zoomIn: () => Promise<number>;
  zoomOut: () => Promise<number>;
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
