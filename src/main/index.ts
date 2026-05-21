import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions, SaveDialogOptions } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getClipboardFormatMimeType,
  getMediaFileExtensionFromMimeType,
  getMediaMimeTypeForExtension,
} from "../shared/mediaTypes";

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const appName = "noteDock";
const appUserModelId = "com.local.notedock";
const localPreviewProtocol = "typora-local";
const windowZoomMax = 2;
const windowZoomMin = 0.5;
const windowZoomStep = 0.1;
type WindowZoomCommand = "reset" | "zoomIn" | "zoomOut";

type WindowKeyboardInput = {
  alt?: boolean;
  code?: string;
  control?: boolean;
  key?: string;
  meta?: boolean;
  shift?: boolean;
};

protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
    scheme: localPreviewProtocol,
  },
]);

let mainWindow: BrowserWindow | null = null;
const workspaceWatchers = new Map<number, FSWatcher>();
const ignoredDirectoryNames = new Set([
  "build",
  "dist",
  "node_modules",
  "out",
  "target",
]);
const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);
const htmlExtensions = new Set([".html", ".htm"]);
const pdfExtensions = new Set([".pdf"]);
const wordExtensions = new Set([".docx"]);
const excelExtensions = new Set([".xlsx", ".xls", ".xlsm", ".xlsb"]);
const sheetExtensions = new Set([".univer"]);
const drawingExtensions = new Set([".excalidraw"]);
const maxDirectoryTreeDepth = 8;
const workspaceAssetsDirectoryName = ".assets";
const localSchemePattern = /^[a-z][a-z\d+.-]*:/i;

type DocumentFileType = "markdown" | "html" | "pdf" | "word" | "excel" | "sheet" | "drawing";

type DirectoryTreeItem = {
  children?: DirectoryTreeItem[];
  name: string;
  path: string;
  type: "directory" | "file";
};

type ExportDocumentPayload = {
  filePath?: string;
  html: string;
  title: string;
};

type WorkspaceFileChangePayload = {
  event: "add" | "change" | "unlink";
  filePath: string;
  updatedAt?: string;
};

type SaveWorkspaceAssetPayload = {
  content: string;
  documentFilePath: string;
  encoding: "dataUrl" | "utf-8";
  fileName: string;
};

type CopyWorkspaceAssetFromFilePayload = {
  documentFilePath: string;
  fileName: string;
  sourceFilePath: string;
};

type ClipboardMediaFile = {
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
};

type ClipboardMediaData = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

type ReadWorkspaceAssetPayload = {
  documentFilePath: string;
  reference: string;
};

type WriteWorkspaceTextAssetPayload = ReadWorkspaceAssetPayload & {
  content: string;
};

type RenameWorkspaceAssetPayload = ReadWorkspaceAssetPayload & {
  nextName: string;
};

type CheckWorkspaceAssetReferencesPayload = {
  documentFilePath: string;
  references: string[];
};

function createTimestampedFileName(prefix: string, extension: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .slice(0, 19);

  return `${prefix}-${timestamp}.${extension}`;
}

function getClipboardMediaMimeType(filePath: string) {
  return getMediaMimeTypeForExtension(extname(filePath));
}

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function splitClipboardPathText(value: string) {
  return value
    .split(/\0|\r?\n/)
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function normalizeClipboardFilePathCandidate(candidate: string) {
  const value = candidate.trim().replace(/^"|"$/g, "");

  if (!value) {
    return null;
  }

  if (/^file:\/\//i.test(value)) {
    try {
      return fileURLToPath(value);
    } catch {
      return null;
    }
  }

  if (process.platform === "win32" && /^\/[a-zA-Z]:[\\/]/.test(value)) {
    return value.slice(1);
  }

  return isAbsolute(value) ? value : null;
}

function extractClipboardFileUrls(value: string) {
  return Array.from(value.matchAll(/file:\/\/(?:\/|localhost\/)?[^\s"'<>]+/gi)).map(
    (match) => match[0] ?? "",
  );
}

function readClipboardPathFormat(format: string, encoding: BufferEncoding) {
  const text = clipboard.read(format);

  if (text.trim()) {
    return splitClipboardPathText(text.replace(/\0+$/g, ""));
  }

  const buffer = clipboard.readBuffer(format);

  if (!buffer.length) {
    return [];
  }

  return splitClipboardPathText(buffer.toString(encoding).replace(/\0+$/g, ""));
}

function readClipboardTextLikeFormat(format: string) {
  const text = clipboard.read(format);

  if (text.trim()) {
    return text.replace(/\0+$/g, "");
  }

  const buffer = clipboard.readBuffer(format);

  if (!buffer.length) {
    return "";
  }

  const hasUtf16Nulls = buffer.length > 1 && buffer[1] === 0;
  const encoding: BufferEncoding = hasUtf16Nulls ? "utf16le" : "utf-8";

  return buffer.toString(encoding).replace(/\0+$/g, "");
}

function getClipboardFormatPathCandidates(formats: string[]) {
  const candidates: string[] = [];

  for (const format of formats) {
    const normalizedFormat = format.trim().toLowerCase();

    if (normalizedFormat === "filenamew") {
      candidates.push(...readClipboardPathFormat(format, "utf16le"));
      continue;
    }

    if (normalizedFormat === "filename") {
      candidates.push(...readClipboardPathFormat(format, "utf-8"));
      continue;
    }

    if (
      normalizedFormat === "text/uri-list" ||
      normalizedFormat.includes("file") ||
      normalizedFormat.includes("uri")
    ) {
      const text = readClipboardTextLikeFormat(format);
      candidates.push(...splitClipboardPathText(text), ...extractClipboardFileUrls(text));
    }
  }

  return candidates;
}

function getClipboardFilePathCandidates() {
  const formats = clipboard.availableFormats();
  const candidates = [
    ...splitClipboardPathText(clipboard.readText()),
    ...extractClipboardFileUrls(clipboard.readHTML()),
    ...getClipboardFormatPathCandidates(formats),
  ];
  const seen = new Set<string>();

  return candidates
    .map((candidate) => normalizeClipboardFilePathCandidate(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => {
      const key = candidate.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

async function getClipboardMediaFiles(): Promise<ClipboardMediaFile[]> {
  const mediaFiles = await Promise.all(
    getClipboardFilePathCandidates().map(async (filePath) => {
      const mimeType = getClipboardMediaMimeType(filePath);

      if (!mimeType || !(await pathExists(filePath))) {
        return null;
      }

      try {
        const fileStat = await stat(filePath);

        if (!fileStat.isFile()) {
          return null;
        }

        return {
          fileName: basename(filePath),
          filePath,
          mimeType,
          size: fileStat.size,
        } satisfies ClipboardMediaFile;
      } catch {
        return null;
      }
    }),
  );

  return mediaFiles.filter((file): file is ClipboardMediaFile => Boolean(file));
}

function readClipboardBufferedMediaFiles() {
  const mediaFiles: ClipboardMediaData[] = [];
  const seenFormats = new Set<string>();

  for (const format of clipboard.availableFormats()) {
    const mimeType = getClipboardFormatMimeType(format);

    if (!mimeType) {
      continue;
    }

    const key = `${format.toLowerCase()}|${mimeType}`;

    if (seenFormats.has(key)) {
      continue;
    }

    seenFormats.add(key);

    const buffer = clipboard.readBuffer(format);

    if (!buffer.length) {
      continue;
    }

    const prefix = mimeType.startsWith("video/") ? "video" : "image";
    mediaFiles.push({
      dataUrl: bufferToDataUrl(buffer, mimeType),
      fileName: createTimestampedFileName(
        prefix,
        getMediaFileExtensionFromMimeType(mimeType),
      ),
      mimeType,
    });
  }

  return mediaFiles;
}

function getWorkspaceLabel(directoryPath: string) {
  return basename(directoryPath) || directoryPath;
}

function normalizeMarkdownName(name: string) {
  const baseName = name
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ");

  return baseName || "Untitled";
}

function normalizeDocumentName(name: string, extension: string) {
  const escapedExtension = extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const extensionPattern = new RegExp(`${escapedExtension}$`, "i");
  const baseName = name
    .trim()
    .replace(extensionPattern, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ");

  return baseName || "Untitled";
}

function normalizeAssetFileName(name: string) {
  const safeName = basename(name || "asset")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ");

  return safeName || "asset";
}

async function pathExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createUniqueMarkdownPath(directoryPath: string, title: string) {
  let index = 0;

  while (true) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = join(directoryPath, `${title}${suffix}.md`);

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    index += 1;
  }
}

async function createUniqueDocumentPath(
  directoryPath: string,
  title: string,
  extension: string,
) {
  let index = 0;

  while (true) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = join(directoryPath, `${title}${suffix}${extension}`);

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    index += 1;
  }
}

async function createUniqueWorkspaceAssetPath(directoryPath: string, fileName: string) {
  const safeFileName = normalizeAssetFileName(fileName);
  const extension = extname(safeFileName);
  const baseName = basename(safeFileName, extension) || "asset";
  let index = 0;

  while (true) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = join(directoryPath, `${baseName}${suffix}${extension}`);

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    index += 1;
  }
}

function getWorkspaceAssetDirectory(documentFilePath: string) {
  return join(dirname(documentFilePath), workspaceAssetsDirectoryName);
}

function getWorkspaceAssetReference(documentFilePath: string, assetFilePath: string) {
  return relative(dirname(documentFilePath), assetFilePath).replace(/\\/g, "/");
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^,]*),(.*)$/s);

  if (!match) {
    throw new Error("Invalid data URL.");
  }

  const metadata = match[1] ?? "";
  const body = match[2] ?? "";

  return metadata.includes(";base64")
    ? Buffer.from(body, "base64")
    : Buffer.from(decodeURIComponent(body), "utf-8");
}

function normalizeWorkspaceReference(reference: string) {
  return reference
    .trim()
    .replace(/^<|>$/g, "")
    .split(/[?#]/)[0]!
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function resolveWorkspaceReference(documentFilePath: string, reference: string) {
  const cleanReference = normalizeWorkspaceReference(reference);
  const referenceSegments = cleanReference.split("/").filter(Boolean);

  if (
    !cleanReference ||
    isAbsolute(cleanReference) ||
    localSchemePattern.test(cleanReference) ||
    !referenceSegments.includes(workspaceAssetsDirectoryName) ||
    referenceSegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid workspace asset reference.");
  }

  const documentDirectoryPath = resolve(dirname(documentFilePath));
  const assetFilePath = resolve(documentDirectoryPath, cleanReference);
  const relativeAssetPath = relative(documentDirectoryPath, assetFilePath);

  if (
    !relativeAssetPath ||
    relativeAssetPath.startsWith("..") ||
    isAbsolute(relativeAssetPath)
  ) {
    throw new Error("Workspace asset reference points outside the document directory.");
  }

  return assetFilePath;
}

function titleFromFilePath(filePath: string) {
  return basename(filePath, extname(filePath));
}

function getDocumentFileType(filePath: string): DocumentFileType | null {
  const extension = extname(filePath).toLowerCase();

  if (markdownExtensions.has(extension)) {
    return "markdown";
  }

  if (htmlExtensions.has(extension)) {
    return "html";
  }

  if (pdfExtensions.has(extension)) {
    return "pdf";
  }

  if (wordExtensions.has(extension)) {
    return "word";
  }

  if (excelExtensions.has(extension)) {
    return "excel";
  }

  if (sheetExtensions.has(extension)) {
    return "sheet";
  }

  if (drawingExtensions.has(extension)) {
    return "drawing";
  }

  return null;
}

function isSupportedDocumentFile(filePath: string) {
  return getDocumentFileType(filePath) !== null;
}

function closeWorkspaceWatcher(webContentsId: number) {
  const watcher = workspaceWatchers.get(webContentsId);

  if (!watcher) {
    return;
  }

  workspaceWatchers.delete(webContentsId);
  void watcher.close();
}

function shouldIgnoreWatchPath(path: string) {
  return path
    .split(/[\\/]/)
    .some((segment) => segment.startsWith(".") || ignoredDirectoryNames.has(segment));
}

async function createWorkspaceFileChangePayload(
  event: WorkspaceFileChangePayload["event"],
  filePath: string,
): Promise<WorkspaceFileChangePayload> {
  if (event === "unlink") {
    return { event, filePath };
  }

  try {
    const fileStat = await stat(filePath);

    return { event, filePath, updatedAt: fileStat.mtime.toISOString() };
  } catch {
    return { event, filePath };
  }
}

function getDefaultExportPath(payload: ExportDocumentPayload, extension: "html" | "pdf") {
  const safeTitle = normalizeMarkdownName(payload.title);
  const directoryPath = payload.filePath ? dirname(payload.filePath) : app.getPath("documents");

  return join(directoryPath, `${safeTitle}.${extension}`);
}

async function pickExportFilePath(
  event: IpcMainInvokeEvent,
  payload: ExportDocumentPayload,
  extension: "html" | "pdf",
) {
  const options: SaveDialogOptions = {
    defaultPath: getDefaultExportPath(payload, extension),
    filters: [
      extension === "pdf"
        ? { name: "PDF", extensions: ["pdf"] }
        : { name: "HTML", extensions: ["html", "htm"] },
    ],
    title: extension === "pdf" ? "导出为 PDF" : "导出为 HTML",
  };
  const owner = getDialogOwner(event);
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options);

  return result.canceled ? null : result.filePath ?? null;
}

async function readMarkdownFile(filePath: string) {
  const fileStat = await stat(filePath);
  const documentType = getDocumentFileType(filePath);

  if (!documentType) {
    throw new Error(`Unsupported document file: ${filePath}`);
  }

  return {
    content:
      documentType === "markdown" ||
      documentType === "html" ||
      documentType === "sheet" ||
      documentType === "drawing"
        ? await readFile(filePath, "utf-8")
        : "",
    createdAt: fileStat.birthtime.toISOString(),
    documentType,
    filePath,
    fileExtension: extname(filePath).toLowerCase(),
    title: titleFromFilePath(filePath),
    updatedAt: fileStat.mtime.toISOString(),
  };
}

async function pickWorkspaceDirectory() {
  const options: OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"],
    title: "选择工作目录",
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled ? null : result.filePaths[0];
}

async function readSafeDirectoryEntries(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readDirectoryTree(
  directoryPath: string,
  depth = 0,
): Promise<DirectoryTreeItem | null> {
  const entries = await readSafeDirectoryEntries(directoryPath);
  const children: DirectoryTreeItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (depth >= maxDirectoryTreeDepth) {
        continue;
      }

      const childTree = await readDirectoryTree(entryPath, depth + 1);

      if (childTree?.children?.length) {
        children.push(childTree);
      }

      continue;
    }

    if (entry.isFile() && isSupportedDocumentFile(entry.name)) {
      children.push({ name: entry.name, path: entryPath, type: "file" });
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });

  if (!children.length && depth > 0) {
    return null;
  }

  return {
    children,
    name: getWorkspaceLabel(directoryPath),
    path: directoryPath,
    type: "directory",
  };
}

async function listMarkdownFiles(directoryPath: string, depth = 0): Promise<Awaited<ReturnType<typeof readMarkdownFile>>[]> {
  const entries = await readSafeDirectoryEntries(directoryPath);
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".") || ignoredDirectoryNames.has(entry.name)) {
        return [];
      }

      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return depth >= 3 ? [] : listMarkdownFiles(entryPath, depth + 1);
      }

      if (entry.isFile() && isSupportedDocumentFile(entry.name)) {
        try {
          return [await readMarkdownFile(entryPath)];
        } catch {
          return [];
        }
      }

      return [];
    }),
  );

  return files
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isSafeNavigation(url: string): boolean {
  if (!devServerUrl) {
    return url.startsWith("file://");
  }

  return url.startsWith(devServerUrl);
}

function getAppIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, "icon.ico")
    : join(process.cwd(), "resources", "icon.ico");
}

function getSenderWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? mainWindow;
}

function clampWindowZoomFactor(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(windowZoomMax, Math.max(windowZoomMin, value));
}

function setWindowZoomFactor(window: BrowserWindow | null, factor: number) {
  if (!window) {
    return 1;
  }

  const nextFactor = Number(clampWindowZoomFactor(factor).toFixed(2));
  window.webContents.setZoomFactor(nextFactor);
  window.webContents.send("window:zoom-factor-changed", nextFactor);
  return nextFactor;
}

function isWindowShortcutModifier(input: WindowKeyboardInput) {
  return Boolean(input.control || input.meta) && !(input.control && input.meta);
}

function getKeyboardInputDigit(input: WindowKeyboardInput) {
  if (input.code && /^Digit[0-9]$/.test(input.code)) {
    return input.code.slice("Digit".length);
  }

  return input.key && /^[0-9]$/.test(input.key) ? input.key : "";
}

function isMainPlusInput(input: WindowKeyboardInput) {
  return input.code === "Equal" || input.key === "+" || input.key === "=";
}

function isMainMinusInput(input: WindowKeyboardInput) {
  return input.code === "Minus" || input.key === "-" || input.key === "_";
}

function getWindowZoomShortcutCommand(input: WindowKeyboardInput): WindowZoomCommand | null {
  if (!isWindowShortcutModifier(input) || input.alt) {
    return null;
  }

  if (input.shift && getKeyboardInputDigit(input) === "9") {
    return "reset";
  }

  if (!input.shift && input.code === "Numpad0") {
    return "reset";
  }

  if (input.code === "NumpadAdd" || (input.shift && isMainPlusInput(input))) {
    return "zoomIn";
  }

  if (input.code === "NumpadSubtract" || (input.shift && isMainMinusInput(input))) {
    return "zoomOut";
  }

  return null;
}

function runWindowZoomShortcut(window: BrowserWindow, command: WindowZoomCommand) {
  if (command === "reset") {
    return setWindowZoomFactor(window, 1);
  }

  const currentFactor = window.webContents.getZoomFactor() ?? 1;
  const delta = command === "zoomIn" ? windowZoomStep : -windowZoomStep;

  return setWindowZoomFactor(window, currentFactor + delta);
}

function getDialogOwner(event?: IpcMainInvokeEvent) {
  return event ? getSenderWindow(event) : BrowserWindow.getFocusedWindow() ?? mainWindow;
}

function registerLocalPreviewProtocol() {
  protocol.handle(localPreviewProtocol, (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    const filePath =
      process.platform === "win32" && /^\/[a-zA-Z]:\//.test(pathname)
        ? pathname.slice(1)
        : pathname;

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f5f6f8",
    autoHideMenuBar: true,
    frame: false,
    icon: getAppIconPath(),
    title: appName,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, "../preload/index.mjs"),
    },
  });

  mainWindow = window;

  window.webContents.on("before-input-event", (event, input) => {
    const zoomCommand = getWindowZoomShortcutCommand(input);

    if (!zoomCommand) {
      return;
    }

    event.preventDefault();
    runWindowZoomShortcut(window, zoomCommand);
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = BrowserWindow.getAllWindows().find((item) => item !== window) ?? null;
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isSafeNavigation(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  void window.loadFile(join(__dirname, "../renderer/index.html"));
  return window;
}

if (process.platform === "win32") {
  app.setAppUserModelId(appUserModelId);
}

function registerFileIpc() {
  ipcMain.handle("clipboard:read-image", () => {
    const image = clipboard.readImage();

    if (image.isEmpty()) {
      return null;
    }

    return {
      dataUrl: image.toDataURL(),
      fileName: createTimestampedFileName("screenshot", "png"),
      mimeType: "image/png",
    };
  });

  ipcMain.handle("clipboard:list-media-files", () => getClipboardMediaFiles());

  ipcMain.handle("clipboard:has-content", () => {
    return (
      clipboard.availableFormats().length > 0 ||
      Boolean(clipboard.readText()) ||
      !clipboard.readImage().isEmpty()
    );
  });

  ipcMain.handle("clipboard:read-media-files", async () => {
    const mediaFiles = await Promise.all(
      (await getClipboardMediaFiles()).map(async (file) => {
        try {
          const buffer = await readFile(file.filePath);

          return {
            dataUrl: bufferToDataUrl(buffer, file.mimeType),
            fileName: file.fileName,
            mimeType: file.mimeType,
          };
        } catch {
          return null;
        }
      }),
    );

    return [
      ...mediaFiles.filter((file): file is ClipboardMediaData => Boolean(file)),
      ...readClipboardBufferedMediaFiles(),
    ];
  });

  ipcMain.handle("clipboard:read-text", () => clipboard.readText());

  ipcMain.handle("workspace:get-default-directory", () => app.getPath("desktop"));

  ipcMain.handle("workspace:select-directory", async () => {
    return pickWorkspaceDirectory();
  });

  ipcMain.handle("workspace:open-directory", async () => {
    const directoryPath = await pickWorkspaceDirectory();

    if (!directoryPath) {
      return null;
    }

    const [files, tree] = await Promise.all([
      listMarkdownFiles(directoryPath),
      readDirectoryTree(directoryPath),
    ]);

    return { directoryPath, files, tree };
  });

  ipcMain.handle("workspace:select-markdown-file", async () => {
    const options: OpenDialogOptions = {
      filters: [
        { name: "Documents", extensions: ["md", "markdown", "mdown", "html", "htm", "pdf", "docx", "xlsx", "xls", "xlsm", "xlsb", "univer", "excalidraw"] },
        { name: "Markdown", extensions: ["md", "markdown", "mdown"] },
        { name: "HTML", extensions: ["html", "htm"] },
        { name: "PDF", extensions: ["pdf"] },
        { name: "Word", extensions: ["docx"] },
        { name: "Excel", extensions: ["xlsx", "xls", "xlsm", "xlsb"] },
        { name: "Univer Sheet", extensions: ["univer"] },
        { name: "Excalidraw", extensions: ["excalidraw"] },
      ],
      properties: ["openFile"],
      title: "选择 Markdown 文件",
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? null : readMarkdownFile(result.filePaths[0]);
  });

  ipcMain.handle("workspace:save-markdown-file-as", async (event, payload: { content: string; filePath?: string; title: string }) => {
    const safeTitle = normalizeMarkdownName(payload.title);
    const defaultPath = payload.filePath || join(app.getPath("documents"), `${safeTitle}.md`);
    const options: SaveDialogOptions = {
      defaultPath,
      filters: [
        { name: "Documents", extensions: ["md", "markdown", "mdown", "html", "htm"] },
        { name: "Markdown", extensions: ["md", "markdown", "mdown"] },
        { name: "HTML", extensions: ["html", "htm"] },
      ],
      title: "另存为 Markdown 文件",
    };
    const owner = getDialogOwner(event);
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(result.filePath, payload.content, "utf-8");
    return readMarkdownFile(result.filePath);
  });

  ipcMain.handle("workspace:create-markdown-file", async (_, payload: { directoryPath: string; title: string }) => {
    const directoryPath = payload.directoryPath || app.getPath("desktop");
    const title = normalizeMarkdownName(payload.title);

    await mkdir(directoryPath, { recursive: true });

    const filePath = await createUniqueMarkdownPath(directoryPath, title);
    const content = "";

    await writeFile(filePath, content, "utf-8");

    return readMarkdownFile(filePath);
  });

  ipcMain.handle(
    "workspace:create-document-file",
    async (
      _,
      payload: {
        content: string;
        directoryPath: string;
        extension: ".excalidraw" | ".md" | ".univer";
        title: string;
      },
    ) => {
      const directoryPath = payload.directoryPath || app.getPath("desktop");
      const allowedExtensions = new Set([".excalidraw", ".md", ".univer"]);
      const extension = allowedExtensions.has(payload.extension)
        ? payload.extension
        : ".md";
      const title = normalizeDocumentName(payload.title, extension);

      await mkdir(directoryPath, { recursive: true });

      const filePath = await createUniqueDocumentPath(directoryPath, title, extension);
      await writeFile(filePath, payload.content, "utf-8");

      return readMarkdownFile(filePath);
    },
  );

  ipcMain.handle("workspace:duplicate-document-file", async (_, filePath: string) => {
    if (!getDocumentFileType(filePath)) {
      throw new Error(`Unsupported document file: ${filePath}`);
    }

    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new Error(`Cannot duplicate a directory: ${filePath}`);
    }

    const extension = extname(filePath).toLowerCase();
    const title = normalizeDocumentName(`${titleFromFilePath(filePath)} copy`, extension);
    const targetPath = await createUniqueDocumentPath(dirname(filePath), title, extension);

    await copyFile(filePath, targetPath);

    return readMarkdownFile(targetPath);
  });

  ipcMain.handle("workspace:delete-document-file", async (_, filePath: string) => {
    if (!getDocumentFileType(filePath)) {
      throw new Error(`Unsupported document file: ${filePath}`);
    }

    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new Error(`Cannot delete a directory: ${filePath}`);
    }

    await rm(filePath, { force: true });

    return true;
  });

  ipcMain.handle(
    "workspace:save-asset",
    async (_, payload: SaveWorkspaceAssetPayload) => {
      if (!payload.documentFilePath) {
        throw new Error("A document file path is required to save assets.");
      }

      const assetDirectoryPath = getWorkspaceAssetDirectory(payload.documentFilePath);
      await mkdir(assetDirectoryPath, { recursive: true });

      const assetFilePath = await createUniqueWorkspaceAssetPath(
        assetDirectoryPath,
        payload.fileName,
      );

      if (payload.encoding === "dataUrl") {
        await writeFile(assetFilePath, decodeDataUrl(payload.content));
      } else {
        await writeFile(assetFilePath, payload.content, "utf-8");
      }

      return {
        assetFilePath,
        reference: getWorkspaceAssetReference(payload.documentFilePath, assetFilePath),
      };
    },
  );

  ipcMain.handle(
    "workspace:copy-asset-from-file",
    async (_, payload: CopyWorkspaceAssetFromFilePayload) => {
      if (!payload.documentFilePath) {
        throw new Error("A document file path is required to save assets.");
      }

      if (!payload.sourceFilePath || !(await pathExists(payload.sourceFilePath))) {
        throw new Error("Source media file does not exist.");
      }

      const sourceStat = await stat(payload.sourceFilePath);

      if (!sourceStat.isFile()) {
        throw new Error("Source media path is not a file.");
      }

      const assetDirectoryPath = getWorkspaceAssetDirectory(payload.documentFilePath);
      await mkdir(assetDirectoryPath, { recursive: true });

      const assetFilePath = await createUniqueWorkspaceAssetPath(
        assetDirectoryPath,
        payload.fileName || basename(payload.sourceFilePath),
      );

      await copyFile(payload.sourceFilePath, assetFilePath);

      return {
        assetFilePath,
        reference: getWorkspaceAssetReference(payload.documentFilePath, assetFilePath),
      };
    },
  );

  ipcMain.handle(
    "workspace:read-text-asset",
    async (_, payload: ReadWorkspaceAssetPayload) => {
      const assetFilePath = resolveWorkspaceReference(
        payload.documentFilePath,
        payload.reference,
      );

      return readFile(assetFilePath, "utf-8");
    },
  );

  ipcMain.handle(
    "workspace:write-text-asset",
    async (_, payload: WriteWorkspaceTextAssetPayload) => {
      const assetFilePath = resolveWorkspaceReference(
        payload.documentFilePath,
        payload.reference,
      );

      await mkdir(dirname(assetFilePath), { recursive: true });
      await writeFile(assetFilePath, payload.content, "utf-8");

      return {
        assetFilePath,
        reference: getWorkspaceAssetReference(payload.documentFilePath, assetFilePath),
      };
    },
  );

  ipcMain.handle(
    "workspace:rename-asset",
    async (_, payload: RenameWorkspaceAssetPayload) => {
      const currentAssetFilePath = resolveWorkspaceReference(
        payload.documentFilePath,
        payload.reference,
      );
      const currentExtension = extname(currentAssetFilePath);
      const requestedName = normalizeAssetFileName(payload.nextName);
      const requestedExtension = extname(requestedName);
      const nextFileName = requestedExtension
        ? requestedName
        : `${requestedName}${currentExtension}`;
      const nextDirectoryPath = dirname(currentAssetFilePath);
      const preferredAssetFilePath = join(nextDirectoryPath, nextFileName);

      if (preferredAssetFilePath.toLowerCase() === currentAssetFilePath.toLowerCase()) {
        return {
          assetFilePath: currentAssetFilePath,
          reference: getWorkspaceAssetReference(payload.documentFilePath, currentAssetFilePath),
        };
      }

      const nextAssetFilePath = await createUniqueWorkspaceAssetPath(
        nextDirectoryPath,
        nextFileName,
      );

      await rename(currentAssetFilePath, nextAssetFilePath);

      return {
        assetFilePath: nextAssetFilePath,
        reference: getWorkspaceAssetReference(payload.documentFilePath, nextAssetFilePath),
      };
    },
  );

  ipcMain.handle(
    "workspace:check-asset-references",
    async (_, payload: CheckWorkspaceAssetReferencesPayload) => {
      const missing: string[] = [];

      await Promise.all(
        payload.references.map(async (reference) => {
          try {
            const assetFilePath = resolveWorkspaceReference(
              payload.documentFilePath,
              reference,
            );

            if (!(await pathExists(assetFilePath))) {
              missing.push(reference);
            }
          } catch {
            missing.push(reference);
          }
        }),
      );

      return missing.sort((first, second) => first.localeCompare(second));
    },
  );

  ipcMain.handle("workspace:write-markdown-file", async (_, payload: { content: string; filePath: string }) => {
    await writeFile(payload.filePath, payload.content, "utf-8");
    return readMarkdownFile(payload.filePath);
  });

  ipcMain.handle("workspace:read-markdown-file", async (_, filePath: string) => {
    return readMarkdownFile(filePath);
  });

  ipcMain.handle("workspace:read-word-document", async (_, filePath: string) => {
    if (!wordExtensions.has(extname(filePath).toLowerCase())) {
      throw new Error(`Unsupported Word document: ${filePath}`);
    }

    return (await readFile(filePath)).toString("base64");
  });

  ipcMain.handle("workspace:read-excel-document", async (_, filePath: string) => {
    if (!excelExtensions.has(extname(filePath).toLowerCase())) {
      throw new Error(`Unsupported Excel document: ${filePath}`);
    }

    return (await readFile(filePath)).toString("base64");
  });

  ipcMain.handle("workspace:path-exists", async (_, filePath: string) => {
    return pathExists(filePath);
  });

  ipcMain.handle("workspace:list-markdown-files", async (_, directoryPath: string) => {
    return listMarkdownFiles(directoryPath || app.getPath("desktop"));
  });

  ipcMain.handle("workspace:read-directory-tree", async (_, directoryPath: string) => {
    return readDirectoryTree(directoryPath || app.getPath("desktop"));
  });

  ipcMain.handle("workspace:watch-directory", async (event, directoryPath?: string) => {
    const webContents = event.sender;
    const webContentsId = webContents.id;

    closeWorkspaceWatcher(webContentsId);

    if (!directoryPath || !(await pathExists(directoryPath))) {
      return false;
    }

    const watcher = chokidar.watch(directoryPath, {
      awaitWriteFinish: {
        pollInterval: 100,
        stabilityThreshold: 250,
      },
      depth: maxDirectoryTreeDepth,
      ignoreInitial: true,
      ignored: (targetPath) => shouldIgnoreWatchPath(targetPath),
    });

    const sendChange = async (
      changeEvent: WorkspaceFileChangePayload["event"],
      filePath: string,
    ) => {
      if (!isSupportedDocumentFile(filePath) || webContents.isDestroyed()) {
        return;
      }

      webContents.send(
        "workspace:file-change",
        await createWorkspaceFileChangePayload(changeEvent, filePath),
      );
    };

    watcher
      .on("add", (filePath) => void sendChange("add", filePath))
      .on("change", (filePath) => void sendChange("change", filePath))
      .on("unlink", (filePath) => void sendChange("unlink", filePath));

    webContents.once("destroyed", () => closeWorkspaceWatcher(webContentsId));
    workspaceWatchers.set(webContentsId, watcher);

    return true;
  });

  ipcMain.handle("workspace:unwatch-directory", (event) => {
    closeWorkspaceWatcher(event.sender.id);
  });

  ipcMain.handle("workspace:show-in-folder", async (_, targetPath: string) => {
    const targetStat = await stat(targetPath);

    if (targetStat.isDirectory()) {
      await shell.openPath(targetPath);
      return;
    }

    shell.showItemInFolder(targetPath);
  });

  ipcMain.handle("workspace:open-path", async (_, targetPath: string) => {
    return shell.openPath(targetPath);
  });

  ipcMain.handle("export:html", async (event, payload: ExportDocumentPayload) => {
    const filePath = await pickExportFilePath(event, payload, "html");

    if (!filePath) {
      return null;
    }

    await writeFile(filePath, payload.html, "utf-8");
    return filePath;
  });

  ipcMain.handle("export:pdf", async (event, payload: ExportDocumentPayload) => {
    const filePath = await pickExportFilePath(event, payload, "pdf");

    if (!filePath) {
      return null;
    }

    const tempHtmlPath = join(tmpdir(), `markdown-studio-export-${randomUUID()}.html`);
    let exportWindow: BrowserWindow | null = null;

    try {
      await writeFile(tempHtmlPath, payload.html, "utf-8");

      exportWindow = new BrowserWindow({
        show: false,
        backgroundColor: "#ffffff",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      exportWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

      await exportWindow.loadFile(tempHtmlPath);
      await exportWindow.webContents
        .executeJavaScript(
          "document.fonts?.ready ? document.fonts.ready.then(() => true) : true",
          true,
        )
        .catch(() => true);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const pdf = await exportWindow.webContents.printToPDF({
        displayHeaderFooter: false,
        generateDocumentOutline: true,
        margins: { marginType: "none" },
        pageSize: "A4",
        preferCSSPageSize: true,
        printBackground: true,
      });

      await writeFile(filePath, pdf);
      return filePath;
    } finally {
      exportWindow?.destroy();
      await rm(tempHtmlPath, { force: true });
    }
  });
}

function registerWindowIpc() {
  ipcMain.handle("window:new", () => {
    createMainWindow();
  });

  ipcMain.handle("window:minimize", (event) => {
    getSenderWindow(event)?.minimize();
  });

  ipcMain.handle("window:maximize", (event) => {
    const window = getSenderWindow(event);

    if (!window) {
      return false;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });

  ipcMain.handle("window:toggle-fullscreen", (event) => {
    const window = getSenderWindow(event);

    if (!window) {
      return false;
    }

    const nextFullScreenState = !window.isFullScreen();
    window.setFullScreen(nextFullScreenState);
    return nextFullScreenState;
  });

  ipcMain.handle("window:get-zoom-factor", (event) => {
    return getSenderWindow(event)?.webContents.getZoomFactor() ?? 1;
  });

  ipcMain.handle("window:reset-zoom", (event) => {
    return setWindowZoomFactor(getSenderWindow(event), 1);
  });

  ipcMain.handle("window:set-zoom-factor", (event, factor: number) => {
    return setWindowZoomFactor(getSenderWindow(event), factor);
  });

  ipcMain.handle("window:zoom-in", (event) => {
    const window = getSenderWindow(event);

    return setWindowZoomFactor(
      window,
      (window?.webContents.getZoomFactor() ?? 1) + windowZoomStep,
    );
  });

  ipcMain.handle("window:zoom-out", (event) => {
    const window = getSenderWindow(event);

    return setWindowZoomFactor(
      window,
      (window?.webContents.getZoomFactor() ?? 1) - windowZoomStep,
    );
  });

  ipcMain.handle("window:toggle-always-on-top", (event) => {
    const window = getSenderWindow(event);

    if (!window) {
      return false;
    }

    const nextAlwaysOnTopState = !window.isAlwaysOnTop();
    window.setAlwaysOnTop(nextAlwaysOnTopState);
    return nextAlwaysOnTopState;
  });

  ipcMain.handle("window:get-state", (event) => {
    const window = getSenderWindow(event);

    return {
      alwaysOnTop: Boolean(window?.isAlwaysOnTop()),
      fullScreen: Boolean(window?.isFullScreen()),
    };
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event)?.close();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerLocalPreviewProtocol();
  registerFileIpc();
  registerWindowIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  for (const webContentsId of workspaceWatchers.keys()) {
    closeWorkspaceWatcher(webContentsId);
  }
});
