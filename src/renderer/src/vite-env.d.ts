/// <reference types="vite/client" />

import type {
  DirectoryTreeItem,
  LocalMarkdownFile,
  LocalWorkspaceDirectory,
} from "./types";
import type { PersistedAppState } from "../../shared/appState";
import type {
  SyncConfigurationInput,
  SyncLoginInput,
  SyncLoginResult,
  SyncStatusSnapshot,
} from "../../shared/sync";

type WorkspaceFileChangePayload = {
  event: "add" | "change" | "unlink";
  filePath: string;
  source?: "sync";
  updatedAt?: string;
};

type DesktopApi = {
  loadAppState: () => Promise<PersistedAppState>;
  saveAppState: (state: PersistedAppState) => Promise<PersistedAppState>;
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
  writeImageFileToClipboard: (filePath: string) => Promise<boolean>;
  checkAssetReferences: (payload: {
    documentFilePath: string;
    references: string[];
  }) => Promise<string[]>;
  copyAssetFromFile: (payload: {
    documentFilePath: string;
    fileName: string;
    sourceFilePath: string;
  }) => Promise<{ assetFilePath: string; reference: string }>;
  copyEntryToDirectory: (payload: {
    queueSync?: boolean;
    sourcePath: string;
    targetDirectoryPath: string;
  }) => Promise<{ copiedCount: number; targetPath: string }>;
  createDocumentFile: (payload: {
    content: string;
    directoryPath: string;
    extension: ".excalidraw" | ".md" | ".univer";
    title: string;
  }) => Promise<LocalMarkdownFile>;
  createWorkspaceDirectory: (payload: {
    directoryPath: string;
    name?: string;
    queueSync?: boolean;
  }) => Promise<{ directoryPath: string }>;
  renameWorkspaceEntry: (payload: {
    entryPath: string;
    nextBaseName: string;
  }) => Promise<{ entryPath: string }>;
  moveEntryToDirectory: (payload: {
    queueSync?: boolean;
    sourcePath: string;
    targetDirectoryPath: string;
  }) => Promise<{ entryPath: string }>;
  createMarkdownFile: (payload: {
    directoryPath: string;
    title: string;
  }) => Promise<LocalMarkdownFile>;
  deleteDocumentFile: (filePath: string) => Promise<boolean>;
  deleteWorkspaceEntry: (entryPath: string) => Promise<boolean>;
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
    maximized: boolean;
  }>;
  getSyncStatus: () => Promise<SyncStatusSnapshot | undefined>;
  importLocalDirectoryToCloud: (directoryPath?: string) => Promise<
    | (LocalWorkspaceDirectory & {
        importedCount: number;
        skippedCount: number;
        sourceDirectoryPath: string;
        workspaceId: string;
        workspaceName: string;
      })
    | null
  >;
  listMarkdownFiles: (directoryPath: string) => Promise<LocalMarkdownFile[]>;
  newWindow: () => Promise<void>;
  onWorkspaceFileChanged: (
    callback: (payload: WorkspaceFileChangePayload) => void,
  ) => () => void;
  onInspirationNote: (callback: () => void) => () => void;
  onWindowStateChanged: (
    callback: (state: {
      alwaysOnTop: boolean;
      fullScreen: boolean;
      maximized: boolean;
    }) => void,
  ) => () => void;
  onSyncStatusChanged: (
    callback: (status: SyncStatusSnapshot) => void,
  ) => () => void;
  onZoomFactorChanged: (callback: (factor: number) => void) => () => void;
  openCloudWorkspace: () => Promise<
    | (LocalWorkspaceDirectory & {
        appState?: PersistedAppState;
        workspaceId: string;
        workspaceName: string;
      })
    | null
  >;
  openPath: (targetPath: string) => Promise<string>;
  openWorkspaceDirectory: () => Promise<LocalWorkspaceDirectory | null>;
  pathExists: (filePath: string) => Promise<boolean>;
  platform: string;
  readDirectoryTree: (
    directoryPath: string,
    options?: { includeEmptyDirectories?: boolean },
  ) => Promise<DirectoryTreeItem>;
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
  syncConfigure: (input: SyncConfigurationInput) => Promise<SyncStatusSnapshot | undefined>;
  syncCreateAccessToken: (input: SyncLoginInput) => Promise<SyncLoginResult>;
  syncNow: () => Promise<SyncStatusSnapshot | undefined>;
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
