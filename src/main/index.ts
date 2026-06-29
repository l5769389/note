import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, protocol, shell, Tray } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions, SaveDialogOptions } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  persistedAppStateVersion,
  type PersistedAppState,
} from "../shared/appState";
import {
  getWorkspaceRelativeSyncPath,
  scanWorkspaceSyncFiles,
  SyncService,
} from "./syncService";
import {
  createDefaultSyncConfiguration,
  getDefaultSyncServerUrl,
  type SyncConfigurationInput,
  type SyncLoginInput,
  type SyncStatusSnapshot,
} from "../shared/sync";
import {
  getClipboardFormatMimeType,
  getMediaFileExtensionFromMimeType,
  getMediaMimeTypeForExtension,
} from "../shared/mediaTypes";
import {
  createWorkspaceRenamedEntryName,
  splitWorkspaceEntryNameForRename,
} from "../shared/workspaceRename";
import {
  createDocumentHistoryVersion,
  listDocumentHistoryVersions,
  maybeCreateDocumentHistoryVersion,
  readCurrentDocumentContent,
  readDocumentHistoryVersion,
  type DocumentHistoryVersionReason,
} from "./documentHistory";

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isE2E = process.env.NOTEDOCK_E2E === "1";
const testUserDataDirectory = process.env.NOTEDOCK_TEST_USER_DATA_DIR;
const allowMultipleInstances = process.env.NOTEDOCK_ALLOW_MULTI_INSTANCE === "1";
const skipInitialAppStateRestore =
  process.env.NOTEDOCK_SKIP_INITIAL_APP_STATE_RESTORE === "1";
const skipInitialSyncConfigurationRestore =
  process.env.NOTEDOCK_SKIP_INITIAL_SYNC_CONFIG_RESTORE === "1";
const allowSelfSignedSyncCertificate =
  process.env.NOTEDOCK_ALLOW_SELF_SIGNED_SYNC_CERT === "1";
const defaultSyncServerUrl =
  process.env.NOTEDOCK_DEFAULT_SYNC_SERVER_URL?.trim() ||
  getDefaultSyncServerUrl(devServerUrl ? "development" : "production");
const appName = "noteDock";
const appUserModelId = "com.local.notedock";
const appStateFileName = "notedock-state-v1.json";
const documentHistoryDirectoryName = "document-history-v1";
const localPreviewProtocol = "typora-local";
const windowZoomMax = 2;
const windowZoomMin = 0.5;
const windowZoomStep = 0.1;
type WindowZoomCommand = "reset" | "zoomIn" | "zoomOut";

if (testUserDataDirectory) {
  app.setPath("userData", testUserDataDirectory);
}

if (allowSelfSignedSyncCertificate) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
  if (!allowSelfSignedSyncCertificate) {
    callback(false);
    return;
  }

  event.preventDefault();
  callback(true);
});

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
let tray: Tray | null = null;
let isQuitting = false;
let syncService: SyncService | null = null;
const workspaceWatchers = new Map<number, FSWatcher>();
const syncFileWrites = new Map<string, number>();
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

type CreateDocumentHistoryVersionPayload = {
  content: string;
  filePath: string;
  reason?: DocumentHistoryVersionReason;
};

type ReadDocumentHistoryVersionPayload = {
  filePath: string;
  versionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function normalizePersistedAppState(value: unknown): PersistedAppState {
  const record = isRecord(value) ? value : {};
  const recentDirectories = normalizeStringList(record.recentDirectories);
  const sidebarWidth =
    typeof record.sidebarWidth === "number" && Number.isFinite(record.sidebarWidth)
      ? record.sidebarWidth
      : undefined;

  return {
    version: persistedAppStateVersion,
    ...(record.appSettings !== undefined ? { appSettings: record.appSettings } : {}),
    ...(recentDirectories ? { recentDirectories } : {}),
    ...(sidebarWidth !== undefined ? { sidebarWidth } : {}),
    ...(typeof record.theme === "string" ? { theme: record.theme } : {}),
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
    ...(record.workspace !== undefined ? { workspace: record.workspace } : {}),
  };
}

function getAppStateFilePath() {
  return join(app.getPath("userData"), appStateFileName);
}

function createEmptyPersistedAppState(): PersistedAppState {
  return { version: persistedAppStateVersion };
}

async function readPersistedAppState(): Promise<PersistedAppState> {
  try {
    return normalizePersistedAppState(
      JSON.parse(await readFile(getAppStateFilePath(), "utf-8")),
    );
  } catch {
    return { version: persistedAppStateVersion };
  }
}

async function writePersistedAppState(state: PersistedAppState) {
  const filePath = getAppStateFilePath();
  const nextState = normalizePersistedAppState({
    ...state,
    updatedAt: new Date().toISOString(),
    version: persistedAppStateVersion,
  });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(nextState, null, 2)}\n`, "utf-8");
  await rename(temporaryPath, filePath);

  return nextState;
}

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
  source?: "sync";
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

type ExportCloudEntriesPayload = {
  entryPaths?: string[];
};

type ExportCloudEntriesResult = {
  exportedCount: number;
  targetDirectoryPath: string;
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

type ClipboardRichHtmlPayload = {
  html?: string;
  text?: string;
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

async function createUniqueDirectoryPath(directoryPath: string, name: string) {
  const safeName =
    basename(name || "Folder")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ") || "Folder";
  let index = 0;

  while (true) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = join(directoryPath, `${safeName}${suffix}`);

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

const markdownAssetReferencePattern =
  /!\[([^\]]*)]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"([^"]*)")?\s*\)/g;
const htmlAssetReferencePattern =
  /(<(?:img|source|video|audio)\b[^>]*?\s(?:src|poster)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function isTextDocumentWithWorkspaceAssets(filePath: string) {
  const documentFileType = getDocumentFileType(filePath);

  return documentFileType === "markdown" || documentFileType === "html";
}

function getWorkspaceAssetReferenceKey(reference: string) {
  try {
    const cleanReference = normalizeWorkspaceReference(reference);
    const referenceSegments = cleanReference.split("/").filter(Boolean);

    if (
      !cleanReference ||
      isAbsolute(cleanReference) ||
      localSchemePattern.test(cleanReference) ||
      !referenceSegments.includes(workspaceAssetsDirectoryName) ||
      referenceSegments.some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }

    return cleanReference;
  } catch {
    return null;
  }
}

function collectWorkspaceAssetReferences(content: string) {
  const references = new Set<string>();

  for (const match of content.matchAll(markdownAssetReferencePattern)) {
    const source = match[2];
    const key = source ? getWorkspaceAssetReferenceKey(source) : null;

    if (key) {
      references.add(key);
    }
  }

  for (const match of content.matchAll(htmlAssetReferencePattern)) {
    const source = match[2] ?? match[3] ?? match[4];
    const key = source ? getWorkspaceAssetReferenceKey(source) : null;

    if (key) {
      references.add(key);
    }
  }

  return Array.from(references);
}

async function copyReferencedWorkspaceAsset(
  previousDocumentFilePath: string,
  nextDocumentFilePath: string,
  reference: string,
  copiedReferences: Map<string, string>,
) {
  const sourceAssetFilePath = resolveWorkspaceReference(
    previousDocumentFilePath,
    reference,
  );
  const sourceAssetKey = resolve(sourceAssetFilePath).toLowerCase();
  const existingReference = copiedReferences.get(sourceAssetKey);

  if (existingReference) {
    return existingReference;
  }

  const sourceAssetStats = await stat(sourceAssetFilePath);

  if (!sourceAssetStats.isFile()) {
    throw new Error("Workspace asset reference is not a file.");
  }

  const targetAssetDirectoryPath =
    getWorkspaceAssetDirectory(nextDocumentFilePath);
  await mkdir(targetAssetDirectoryPath, { recursive: true });

  const targetAssetFilePath = await createUniqueWorkspaceAssetPath(
    targetAssetDirectoryPath,
    basename(sourceAssetFilePath),
  );

  await copyFile(sourceAssetFilePath, targetAssetFilePath);

  const nextReference = getWorkspaceAssetReference(
    nextDocumentFilePath,
    targetAssetFilePath,
  );
  copiedReferences.set(sourceAssetKey, nextReference);
  return nextReference;
}

function replaceWorkspaceAssetReferences(
  content: string,
  replacements: Map<string, string>,
) {
  let nextContent = content.replace(
    markdownAssetReferencePattern,
    (match, _alt, rawSource: string) => {
      const key = getWorkspaceAssetReferenceKey(rawSource);
      const nextReference = key ? replacements.get(key) : null;

      if (!nextReference) {
        return match;
      }

      const trimmedSource = rawSource.trim();
      const nextSource =
        trimmedSource.startsWith("<") && trimmedSource.endsWith(">")
          ? `<${nextReference}>`
          : nextReference;

      return match.replace(rawSource, nextSource);
    },
  );

  nextContent = nextContent.replace(
    htmlAssetReferencePattern,
    (
      match,
      prefix: string,
      doubleQuotedSource: string | undefined,
      singleQuotedSource: string | undefined,
      unquotedSource: string | undefined,
    ) => {
      const source = doubleQuotedSource ?? singleQuotedSource ?? unquotedSource;
      const key = source ? getWorkspaceAssetReferenceKey(source) : null;
      const nextReference = key ? replacements.get(key) : null;

      if (!source || !nextReference) {
        return match;
      }

      if (doubleQuotedSource !== undefined) {
        return `${prefix}"${nextReference}"`;
      }

      if (singleQuotedSource !== undefined) {
        return `${prefix}'${nextReference}'`;
      }

      return `${prefix}${nextReference}`;
    },
  );

  return nextContent;
}

async function copyWorkspaceAssetReferencesForDocumentMove(
  previousDocumentFilePath: string,
  nextDocumentFilePath: string,
) {
  if (!isTextDocumentWithWorkspaceAssets(nextDocumentFilePath)) {
    return;
  }

  const content = await readFile(nextDocumentFilePath, "utf-8");
  const references = collectWorkspaceAssetReferences(content);

  if (!references.length) {
    return;
  }

  const replacements = new Map<string, string>();
  const copiedReferences = new Map<string, string>();

  for (const reference of references) {
    try {
      replacements.set(
        reference,
        await copyReferencedWorkspaceAsset(
          previousDocumentFilePath,
          nextDocumentFilePath,
          reference,
          copiedReferences,
        ),
      );
    } catch {
      // Keep broken or missing asset references unchanged.
    }
  }

  if (!replacements.size) {
    return;
  }

  const nextContent = replaceWorkspaceAssetReferences(content, replacements);

  if (nextContent !== content) {
    await writeFile(nextDocumentFilePath, nextContent, "utf-8");
  }
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

async function copySupportedWorkspaceDirectory(
  sourceDirectoryPath: string,
  targetDirectoryPath: string,
): Promise<number> {
  const entries = await readSafeDirectoryEntries(sourceDirectoryPath);
  let copiedCount = 0;

  await mkdir(targetDirectoryPath, { recursive: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDirectoryPath, entry.name);
    const targetPath = join(targetDirectoryPath, entry.name);

    if (entry.isDirectory() && entry.name === workspaceAssetsDirectoryName) {
      await cp(sourcePath, targetPath, { recursive: true });
      continue;
    }

    if (entry.name.startsWith(".") || ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copiedCount += await copySupportedWorkspaceDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile() || !isSupportedDocumentFile(entry.name)) {
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    copiedCount += 1;
  }

  return copiedCount;
}

function closeWorkspaceWatcher(webContentsId: number) {
  const watcher = workspaceWatchers.get(webContentsId);

  if (!watcher) {
    return;
  }

  workspaceWatchers.delete(webContentsId);
  void watcher.close();
}

function getSyncFileWriteKey(filePath: string) {
  return resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function rememberSyncFileWrite(filePath: string) {
  syncFileWrites.set(getSyncFileWriteKey(filePath), Date.now() + 10_000);
}

function consumeSyncFileWrite(filePath: string) {
  const key = getSyncFileWriteKey(filePath);
  const expiresAt = syncFileWrites.get(key);

  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    syncFileWrites.delete(key);
    return false;
  }

  syncFileWrites.delete(key);
  return true;
}

function queueSync() {
  syncService?.scheduleSync();
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
  const source = consumeSyncFileWrite(filePath) ? "sync" : undefined;

  if (event === "unlink") {
    return { event, filePath, ...(source ? { source } : {}) };
  }

  try {
    const fileStat = await stat(filePath);

    return {
      event,
      filePath,
      ...(source ? { source } : {}),
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return { event, filePath, ...(source ? { source } : {}) };
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

function getDocumentHistoryRootPath() {
  return join(app.getPath("userData"), documentHistoryDirectoryName);
}

async function writeDocumentFileWithHistory(filePath: string, content: string) {
  const documentType = getDocumentFileType(filePath);

  if (documentType === "markdown") {
    const previousContent = await readCurrentDocumentContent(filePath);

    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath: getDocumentHistoryRootPath(),
      nextContent: content,
      previousContent,
    });
  }

  await writeFile(filePath, content, "utf-8");
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
  options: { includeEmptyDirectories?: boolean } = {},
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

      const childTree = await readDirectoryTree(entryPath, depth + 1, options);

      if (childTree && (options.includeEmptyDirectories || childTree.children?.length)) {
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

  if (!children.length && depth > 0 && !options.includeEmptyDirectories) {
    return null;
  }

  return {
    children,
    name: getWorkspaceLabel(directoryPath),
    path: directoryPath,
    type: "directory",
  };
}

function isPathInsideRoot(targetPath: string, rootPath: string) {
  const relativePath = relative(resolve(rootPath), resolve(targetPath));

  return (
    !relativePath ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function getRelativePathInsideRoot(rootPath: string, targetPath: string) {
  const relativePath = relative(resolve(rootPath), resolve(targetPath));

  if (
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error("Selected cloud file is outside the cloud workspace.");
  }

  return relativePath.replace(/\\/g, "/");
}

function resolveExportTargetPath(targetDirectoryPath: string, relativePath: string) {
  return relativePath
    ? resolve(targetDirectoryPath, ...relativePath.split("/").filter(Boolean))
    : resolve(targetDirectoryPath);
}

async function copyCloudExportFile({
  copiedTargetPaths,
  sourcePath,
  sourceRootPath,
  targetDirectoryPath,
}: {
  copiedTargetPaths: Set<string>;
  sourcePath: string;
  sourceRootPath: string;
  targetDirectoryPath: string;
}) {
  const relativePath = getRelativePathInsideRoot(sourceRootPath, sourcePath);
  const targetPath = resolveExportTargetPath(targetDirectoryPath, relativePath);
  const targetKey = resolve(targetPath).toLowerCase();

  if (copiedTargetPaths.has(targetKey)) {
    return 0;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  copiedTargetPaths.add(targetKey);
  return 1;
}

async function copyCloudExportAssetReferences({
  copiedTargetPaths,
  sourcePath,
  sourceRootPath,
  targetDirectoryPath,
}: {
  copiedTargetPaths: Set<string>;
  sourcePath: string;
  sourceRootPath: string;
  targetDirectoryPath: string;
}) {
  if (!isTextDocumentWithWorkspaceAssets(sourcePath)) {
    return 0;
  }

  let content = "";

  try {
    content = await readFile(sourcePath, "utf-8");
  } catch {
    return 0;
  }

  let copiedCount = 0;

  for (const reference of collectWorkspaceAssetReferences(content)) {
    try {
      const assetPath = resolveWorkspaceReference(sourcePath, reference);

      if (!isPathInsideRoot(assetPath, sourceRootPath)) {
        continue;
      }

      const assetStats = await stat(assetPath);

      if (!assetStats.isFile()) {
        continue;
      }

      copiedCount += await copyCloudExportFile({
        copiedTargetPaths,
        sourcePath: assetPath,
        sourceRootPath,
        targetDirectoryPath,
      });
    } catch {
      // Keep export best-effort for broken asset references.
    }
  }

  return copiedCount;
}

async function copyCloudExportEntry({
  copiedTargetPaths,
  sourcePath,
  sourceRootPath,
  targetDirectoryPath,
}: {
  copiedTargetPaths: Set<string>;
  sourcePath: string;
  sourceRootPath: string;
  targetDirectoryPath: string;
}): Promise<number> {
  const sourceStats = await stat(sourcePath);

  if (sourceStats.isFile()) {
    const copiedDocumentCount = await copyCloudExportFile({
      copiedTargetPaths,
      sourcePath,
      sourceRootPath,
      targetDirectoryPath,
    });
    const copiedAssetCount = await copyCloudExportAssetReferences({
      copiedTargetPaths,
      sourcePath,
      sourceRootPath,
      targetDirectoryPath,
    });

    return copiedDocumentCount + copiedAssetCount;
  }

  if (!sourceStats.isDirectory()) {
    return 0;
  }

  let copiedCount = 0;

  for (const entry of await readSafeDirectoryEntries(sourcePath)) {
    if (ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    copiedCount += await copyCloudExportEntry({
      copiedTargetPaths,
      sourcePath: join(sourcePath, entry.name),
      sourceRootPath,
      targetDirectoryPath,
    });
  }

  return copiedCount;
}

async function getCloudExportSourcePaths(
  sourceRootPath: string,
  entryPaths?: string[],
) {
  const hasExplicitEntryPaths = Array.isArray(entryPaths);
  const requestedPaths = (entryPaths ?? [])
    .filter((entryPath): entryPath is string => typeof entryPath === "string")
    .map((entryPath) => resolve(entryPath))
    .filter((entryPath) => isPathInsideRoot(entryPath, sourceRootPath));

  if (!hasExplicitEntryPaths) {
    return [resolve(sourceRootPath)];
  }

  if (!requestedPaths.length) {
    return [];
  }

  const uniquePaths = Array.from(new Set(requestedPaths));
  const existingPaths: string[] = [];

  for (const entryPath of uniquePaths) {
    if (await pathExists(entryPath)) {
      existingPaths.push(entryPath);
    }
  }

  const sortedPaths = existingPaths.sort(
    (first, second) => first.length - second.length,
  );
  const topLevelPaths: string[] = [];

  for (const entryPath of sortedPaths) {
    if (
      topLevelPaths.some(
        (parentPath) =>
          resolve(parentPath) !== resolve(entryPath) &&
          isPathInsideRoot(entryPath, parentPath),
      )
    ) {
      continue;
    }

    topLevelPaths.push(entryPath);
  }

  return topLevelPaths;
}

async function exportCloudEntriesFromCache({
  entryPaths,
  sourceRootPath,
  targetDirectoryPath,
}: {
  entryPaths?: string[];
  sourceRootPath: string;
  targetDirectoryPath: string;
}) {
  if (isPathInsideRoot(targetDirectoryPath, sourceRootPath)) {
    throw new Error("不能导出到云端缓存目录内部。");
  }

  await mkdir(targetDirectoryPath, { recursive: true });

  const sourcePaths = await getCloudExportSourcePaths(sourceRootPath, entryPaths);
  const copiedTargetPaths = new Set<string>();
  let exportedCount = 0;

  for (const sourcePath of sourcePaths) {
    exportedCount += await copyCloudExportEntry({
      copiedTargetPaths,
      sourcePath,
      sourceRootPath,
      targetDirectoryPath,
    });
  }

  return {
    exportedCount,
    targetDirectoryPath,
  } satisfies ExportCloudEntriesResult;
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

function showMainWindow() {
  const window = mainWindow ?? createMainWindow();

  if (window.isDestroyed()) {
    return null;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();

  return window;
}

function requestInspirationNote() {
  const window = showMainWindow();

  if (!window || window.isDestroyed()) {
    return;
  }

  const sendInspirationNote = () => {
    if (!window.isDestroyed()) {
      window.webContents.send("inspiration-note:open");
    }
  };

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", sendInspirationNote);
    return;
  }

  sendInspirationNote();
}

function hideWindowToTray(window: BrowserWindow) {
  if (window.isDestroyed()) {
    return;
  }

  if (isE2E) {
    isQuitting = true;
    window.close();
    return;
  }

  window.hide();
}

function quitApp() {
  isQuitting = true;
  tray?.destroy();
  tray = null;
  app.quit();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示 noteDock", click: showMainWindow },
      { label: "灵感便签", click: requestInspirationNote },
      {
        label: "隐藏窗口",
        enabled: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
        click: () => {
          if (mainWindow) {
            hideWindowToTray(mainWindow);
          }
        },
      },
      { type: "separator" },
      { label: "退出", click: quitApp },
    ]),
  );
}

function createTray() {
  if (isE2E) {
    return null;
  }

  if (tray) {
    updateTrayMenu();
    return tray;
  }

  tray = new Tray(getAppIconPath());
  tray.setToolTip("noteDock");
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
  return tray;
}

function getSenderWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? mainWindow;
}

function getWindowStateSnapshot(window: BrowserWindow | null) {
  return {
    alwaysOnTop: Boolean(window?.isAlwaysOnTop()),
    fullScreen: Boolean(window?.isFullScreen()),
    maximized: Boolean(window?.isMaximized()),
  };
}

function sendWindowStateChanged(window: BrowserWindow | null) {
  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.send("window:state-changed", getWindowStateSnapshot(window));
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
  createTray();

  window.webContents.on("before-input-event", (event, input) => {
    const zoomCommand = getWindowZoomShortcutCommand(input);

    if (!zoomCommand) {
      return;
    }

    event.preventDefault();
    runWindowZoomShortcut(window, zoomCommand);
  });

  window.on("close", (event) => {
    if (isQuitting || isE2E) {
      return;
    }

    event.preventDefault();
    hideWindowToTray(window);
  });

  window.on("show", updateTrayMenu);
  window.on("hide", updateTrayMenu);
  window.on("enter-full-screen", () => sendWindowStateChanged(window));
  window.on("leave-full-screen", () => sendWindowStateChanged(window));
  window.on("maximize", () => sendWindowStateChanged(window));
  window.on("unmaximize", () => sendWindowStateChanged(window));
  window.on("restore", () => sendWindowStateChanged(window));

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

function registerAppStateIpc() {
  let shouldSkipInitialAppStateLoad = skipInitialAppStateRestore;

  ipcMain.handle("app-state:load", () => {
    if (shouldSkipInitialAppStateLoad) {
      shouldSkipInitialAppStateLoad = false;
      return createEmptyPersistedAppState();
    }

    return readPersistedAppState();
  });

  ipcMain.handle("app-state:save", async (_, state: PersistedAppState) => {
    const nextState = await writePersistedAppState(state);
    queueSync();
    return nextState;
  });
}

function sendSyncStatusChanged(status: SyncStatusSnapshot) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send("sync:status-changed", status);
    }
  });
}

async function initializeSyncService() {
  syncService = new SyncService({
    defaultConfiguration: createDefaultSyncConfiguration(defaultSyncServerUrl),
    getAppState: readPersistedAppState,
    markSyncFileWrite: rememberSyncFileWrite,
    notifyStatus: sendSyncStatusChanged,
    setAppState: writePersistedAppState,
    skipInitialConfigurationRestore: skipInitialSyncConfigurationRestore,
    userDataPath: app.getPath("userData"),
  });
  await syncService.initialize();
}

function registerSyncIpc() {
  ipcMain.handle("sync:configure", async (_, input: SyncConfigurationInput) => {
    return syncService?.configure(input);
  });

  ipcMain.handle("sync:create-access-token", async (_, input: SyncLoginInput) => {
    return syncService?.createAccessToken(input);
  });

  ipcMain.handle("sync:get-status", () => {
    return syncService?.getStatus();
  });

  ipcMain.handle("sync:open-cloud-workspace", async () => {
    const workspace = await syncService?.openCloudWorkspace();

    if (!workspace) {
      return null;
    }

    const [files, tree] = await Promise.all([
      listMarkdownFiles(workspace.directoryPath),
      readDirectoryTree(workspace.directoryPath, 0, {
        includeEmptyDirectories: true,
      }),
    ]);

    return {
      ...workspace,
      files,
      source: {
        cachePath: workspace.directoryPath,
        kind: "cloud",
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName,
      },
      tree,
    };
  });

  ipcMain.handle(
    "sync:import-local-directory-to-cloud",
    async (_, inputDirectoryPath?: string) => {
      const hasExplicitSourcePath = Boolean(
        inputDirectoryPath && (await pathExists(inputDirectoryPath)),
      );
      const sourceDirectoryPath =
        hasExplicitSourcePath && inputDirectoryPath
          ? inputDirectoryPath
          : await pickWorkspaceDirectory();

      if (!sourceDirectoryPath) {
        return null;
      }

      const sourceStats = await stat(sourceDirectoryPath);
      const sourceRootPath = sourceStats.isFile()
        ? dirname(sourceDirectoryPath)
        : hasExplicitSourcePath
          ? dirname(sourceDirectoryPath)
        : sourceDirectoryPath;

      const workspace = await syncService?.openCloudWorkspace();

      if (!workspace) {
        return null;
      }

      const sourceFiles = sourceStats.isFile()
        ? [sourceDirectoryPath]
        : await scanWorkspaceSyncFiles(sourceDirectoryPath);
      let importedCount = 0;
      let skippedCount = 0;

      for (const sourceFilePath of sourceFiles) {
        const relativePath = getWorkspaceRelativeSyncPath(
          sourceRootPath,
          sourceFilePath,
        );

        if (!relativePath) {
          continue;
        }

        const targetPath = resolve(
          workspace.directoryPath,
          ...relativePath.split("/"),
        );

        if (await pathExists(targetPath)) {
          skippedCount += 1;
          continue;
        }

        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(sourceFilePath, targetPath);
        importedCount += 1;
      }

      queueSync();

      const [files, tree] = await Promise.all([
        listMarkdownFiles(workspace.directoryPath),
        readDirectoryTree(workspace.directoryPath, 0, {
          includeEmptyDirectories: true,
        }),
      ]);

      return {
        ...workspace,
        files,
        importedCount,
        skippedCount,
        source: {
          cachePath: workspace.directoryPath,
          kind: "cloud",
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.workspaceName,
        },
        sourceDirectoryPath,
        tree,
      };
    },
  );

  ipcMain.handle("sync:now", async () => {
    return syncService?.syncNow();
  });

  ipcMain.handle(
    "sync:export-cloud-entries",
    async (_, payload?: ExportCloudEntriesPayload) => {
      if (!syncService) {
        throw new Error("云同步服务尚未初始化。");
      }

      const targetDirectoryPath = await pickWorkspaceDirectory();

      if (!targetDirectoryPath) {
        return null;
      }

      const syncStatus = await syncService.syncNow();

      if (syncStatus.state === "failed") {
        throw new Error(syncStatus.message || "同步云端文件失败，无法导出。");
      }

      return exportCloudEntriesFromCache({
        entryPaths: payload?.entryPaths,
        sourceRootPath: syncService.getCloudWorkspacePath(),
        targetDirectoryPath,
      });
    },
  );
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

  ipcMain.handle(
    "clipboard:write-rich-html",
    async (_, payload: ClipboardRichHtmlPayload) => {
      const html = typeof payload?.html === "string" ? payload.html : "";
      const text = typeof payload?.text === "string" ? payload.text : "";

      if (!html && !text) {
        return false;
      }

      clipboard.write({ html, text });
      return true;
    },
  );

  ipcMain.handle("clipboard:write-image-file", async (_, filePath: string) => {
    if (typeof filePath !== "string" || !filePath.trim()) {
      return false;
    }

    const image = nativeImage.createFromPath(filePath);

    if (image.isEmpty()) {
      return false;
    }

    clipboard.writeImage(image);
    return true;
  });

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

    await writeDocumentFileWithHistory(result.filePath, payload.content);
    queueSync();
    return readMarkdownFile(result.filePath);
  });

  ipcMain.handle("workspace:create-markdown-file", async (_, payload: { directoryPath: string; title: string }) => {
    const directoryPath = payload.directoryPath || app.getPath("desktop");
    const title = normalizeMarkdownName(payload.title);

    await mkdir(directoryPath, { recursive: true });

    const filePath = await createUniqueMarkdownPath(directoryPath, title);
    const content = "";

    await writeFile(filePath, content, "utf-8");
    queueSync();

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
      await writeDocumentFileWithHistory(filePath, payload.content);
      queueSync();

      return readMarkdownFile(filePath);
    },
  );

  ipcMain.handle(
    "workspace:create-directory",
    async (
      _,
      payload: {
        directoryPath: string;
        name?: string;
        queueSync?: boolean;
      },
    ) => {
      const directoryPath = payload.directoryPath || app.getPath("desktop");
      const targetPath = await createUniqueDirectoryPath(
        directoryPath,
        payload.name || "New Folder",
      );

      await mkdir(directoryPath, { recursive: true });
      await mkdir(targetPath, { recursive: false });

      if (payload.queueSync !== false) {
        queueSync();
      }

      return {
        directoryPath: targetPath,
      };
    },
  );

  ipcMain.handle(
    "workspace:rename-entry",
    async (
      _,
      payload: {
        entryPath: string;
        nextBaseName: string;
      },
    ) => {
      const entryPath = payload.entryPath;
      const entryStats = await stat(entryPath);
      const entryType = entryStats.isDirectory()
        ? "directory"
        : entryStats.isFile()
          ? "file"
          : null;

      if (!entryType) {
        throw new Error(`Unsupported workspace entry: ${entryPath}`);
      }

      const currentName = basename(entryPath);
      const nextName = createWorkspaceRenamedEntryName({
        currentName,
        entryType,
        nextBaseName: payload.nextBaseName,
      });
      const targetPath = join(dirname(entryPath), nextName);
      const currentKey = resolve(entryPath).toLowerCase();
      const targetKey = resolve(targetPath).toLowerCase();

      if (targetPath === entryPath) {
        return {
          entryPath,
        };
      }

      if (targetKey !== currentKey) {
        try {
          await access(targetPath);
          throw new Error("同名文件或文件夹已存在。");
        } catch (error) {
          if (error instanceof Error && error.message === "同名文件或文件夹已存在。") {
            throw error;
          }
        }
      }

      if (entryType === "file") {
        const { extension } = splitWorkspaceEntryNameForRename(currentName, "file");
        const targetExtension = extname(targetPath);

        if (extension && targetExtension.toLowerCase() !== extension.toLowerCase()) {
          throw new Error("不能修改文件扩展名。");
        }
      }

      if (targetKey === currentKey) {
        const temporaryPath = join(
          dirname(entryPath),
          `.__notedock-rename-${randomUUID()}${extname(entryPath)}`,
        );

        await rename(entryPath, temporaryPath);
        await rename(temporaryPath, targetPath);
      } else {
        await rename(entryPath, targetPath);
      }

      queueSync();

      return {
        entryPath: targetPath,
      };
    },
  );

  ipcMain.handle(
    "workspace:move-entry-to-directory",
    async (
      _,
      payload: {
        queueSync?: boolean;
        sourcePath: string;
        targetDirectoryPath: string;
      },
    ) => {
      const sourcePath = payload.sourcePath;
      const targetDirectoryPath = payload.targetDirectoryPath || app.getPath("desktop");
      const sourceStats = await stat(sourcePath);
      const sourceResolved = resolve(sourcePath);
      const targetDirectoryResolved = resolve(targetDirectoryPath);
      const sourceKey = sourceResolved.toLowerCase();
      const targetDirectoryKey = targetDirectoryResolved.toLowerCase();

      if (!sourceStats.isFile() && !sourceStats.isDirectory()) {
        throw new Error(`Unsupported workspace entry: ${sourcePath}`);
      }

      if (sourceStats.isFile() && !getDocumentFileType(sourcePath)) {
        throw new Error(`Unsupported document file: ${sourcePath}`);
      }

      if (sourceStats.isDirectory()) {
        const sourceWithSeparator = sourceKey.endsWith("\\")
          ? sourceKey
          : `${sourceKey}\\`;

        if (
          targetDirectoryKey === sourceKey ||
          targetDirectoryKey.startsWith(sourceWithSeparator)
        ) {
          throw new Error("不能把文件夹移动到它自身或子文件夹中。");
        }
      }

      await mkdir(targetDirectoryPath, { recursive: true });

      if (resolve(dirname(sourcePath)).toLowerCase() === targetDirectoryKey) {
        return {
          entryPath: sourcePath,
        };
      }

      const targetPath = sourceStats.isFile()
        ? await createUniqueDocumentPath(
            targetDirectoryPath,
            normalizeDocumentName(titleFromFilePath(sourcePath), extname(sourcePath)),
            extname(sourcePath).toLowerCase(),
          )
        : await createUniqueDirectoryPath(targetDirectoryPath, basename(sourcePath));

      try {
        await rename(sourcePath, targetPath);
      } catch (error) {
        if (
          !(
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: string }).code === "EXDEV"
          )
        ) {
          throw error;
        }

        await cp(sourcePath, targetPath, { recursive: sourceStats.isDirectory() });
        await rm(sourcePath, { force: true, recursive: sourceStats.isDirectory() });
      }

      if (sourceStats.isFile()) {
        await copyWorkspaceAssetReferencesForDocumentMove(sourcePath, targetPath);
      }

      if (payload.queueSync !== false) {
        queueSync();
      }

      return {
        entryPath: targetPath,
      };
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
    queueSync();

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
    queueSync();

    return true;
  });

  ipcMain.handle("workspace:delete-workspace-entry", async (_, entryPath: string) => {
    const entryStat = await stat(entryPath);

    if (entryStat.isFile()) {
      if (!getDocumentFileType(entryPath)) {
        throw new Error(`Unsupported document file: ${entryPath}`);
      }

      await rm(entryPath, { force: true });
      queueSync();

      return true;
    }

    if (entryStat.isDirectory()) {
      await rm(entryPath, { force: true, recursive: true });
      queueSync();

      return true;
    }

    throw new Error(`Unsupported workspace entry: ${entryPath}`);
  });

  ipcMain.handle(
    "workspace:copy-entry-to-directory",
    async (
      _,
      payload: {
        queueSync?: boolean;
        sourcePath: string;
        targetDirectoryPath: string;
      },
    ) => {
      const sourceStats = await stat(payload.sourcePath);
      const targetDirectoryPath = payload.targetDirectoryPath || app.getPath("desktop");
      const shouldQueueSync = payload.queueSync !== false;

      await mkdir(targetDirectoryPath, { recursive: true });

      if (sourceStats.isFile()) {
        if (!getDocumentFileType(payload.sourcePath)) {
          throw new Error(`Unsupported document file: ${payload.sourcePath}`);
        }

        const extension = extname(payload.sourcePath).toLowerCase();
        const title = normalizeDocumentName(
          titleFromFilePath(payload.sourcePath),
          extension,
        );
        const targetPath = await createUniqueDocumentPath(
          targetDirectoryPath,
          title,
          extension,
        );

        await copyFile(payload.sourcePath, targetPath);
        await copyWorkspaceAssetReferencesForDocumentMove(
          payload.sourcePath,
          targetPath,
        );
        if (shouldQueueSync) {
          queueSync();
        }

        return {
          copiedCount: 1,
          targetPath,
        };
      }

      if (!sourceStats.isDirectory()) {
        throw new Error(`Unsupported workspace entry: ${payload.sourcePath}`);
      }

      const targetPath = await createUniqueDirectoryPath(
        targetDirectoryPath,
        basename(payload.sourcePath),
      );
      const copiedCount = await copySupportedWorkspaceDirectory(
        payload.sourcePath,
        targetPath,
      );

      if (!copiedCount) {
        await rm(targetPath, { force: true, recursive: true });
      }

      if (shouldQueueSync) {
        queueSync();
      }

      return {
        copiedCount,
        targetPath,
      };
    },
  );

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
      queueSync();

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
      queueSync();

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
    "workspace:read-asset-data-url",
    async (_, payload: ReadWorkspaceAssetPayload) => {
      const assetFilePath = resolveWorkspaceReference(
        payload.documentFilePath,
        payload.reference,
      );
      const mimeType =
        getMediaMimeTypeForExtension(extname(assetFilePath)) ||
        "application/octet-stream";
      const buffer = await readFile(assetFilePath);

      return {
        dataUrl: bufferToDataUrl(buffer, mimeType),
        fileName: basename(assetFilePath),
        mimeType,
      };
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
      queueSync();

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
      queueSync();

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
    await writeDocumentFileWithHistory(payload.filePath, payload.content);
    queueSync();
    return readMarkdownFile(payload.filePath);
  });

  ipcMain.handle("workspace:read-markdown-file", async (_, filePath: string) => {
    return readMarkdownFile(filePath);
  });

  ipcMain.handle(
    "workspace:list-document-history",
    async (_, filePath: string) =>
      listDocumentHistoryVersions({
        filePath,
        historyRootPath: getDocumentHistoryRootPath(),
      }),
  );

  ipcMain.handle(
    "workspace:read-document-history-version",
    async (_, payload: ReadDocumentHistoryVersionPayload) =>
      readDocumentHistoryVersion({
        filePath: payload.filePath,
        historyRootPath: getDocumentHistoryRootPath(),
        versionId: payload.versionId,
      }),
  );

  ipcMain.handle(
    "workspace:create-document-history-version",
    async (_, payload: CreateDocumentHistoryVersionPayload) =>
      createDocumentHistoryVersion({
        content: payload.content,
        filePath: payload.filePath,
        historyRootPath: getDocumentHistoryRootPath(),
        reason: payload.reason ?? "manual",
      }),
  );

  ipcMain.handle(
    "workspace:restore-document-history-version",
    async (_, payload: ReadDocumentHistoryVersionPayload) => {
      const version = await readDocumentHistoryVersion({
        filePath: payload.filePath,
        historyRootPath: getDocumentHistoryRootPath(),
        versionId: payload.versionId,
      });

      if (!version) {
        throw new Error("Document history version not found.");
      }

      const currentContent = await readCurrentDocumentContent(payload.filePath);

      if (currentContent !== version.content && currentContent.trim()) {
        await createDocumentHistoryVersion({
          content: currentContent,
          filePath: payload.filePath,
          historyRootPath: getDocumentHistoryRootPath(),
          reason: "restore",
        });
      }

      await writeFile(payload.filePath, version.content, "utf-8");
      queueSync();

      return readMarkdownFile(payload.filePath);
    },
  );

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

  ipcMain.handle(
    "workspace:read-directory-tree",
    async (
      _,
      directoryPath: string,
      options?: { includeEmptyDirectories?: boolean },
    ) => {
      return readDirectoryTree(
        directoryPath || app.getPath("desktop"),
        0,
        options,
      );
    },
  );

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
  ipcMain.handle("app:get-version", () => app.getVersion());

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
    sendWindowStateChanged(window);
    return nextAlwaysOnTopState;
  });

  ipcMain.handle("window:get-state", (event) => {
    return getWindowStateSnapshot(getSenderWindow(event));
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event)?.close();
  });
}

const singleInstanceLock = allowMultipleInstances || app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  if (!isE2E && !allowMultipleInstances) {
    app.on("second-instance", () => {
      showMainWindow();
    });
  }

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    registerLocalPreviewProtocol();
    await initializeSyncService();
    registerAppStateIpc();
    registerSyncIpc();
    registerFileIpc();
    registerWindowIpc();
    createMainWindow();
    if (!isE2E) {
      createTray();
      globalShortcut.register("CommandOrControl+Alt+N", requestInspirationNote);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
        return;
      }

      showMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isE2E) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (!isE2E) {
    globalShortcut.unregisterAll();
  }
  tray?.destroy();
  tray = null;

  for (const webContentsId of workspaceWatchers.keys()) {
    closeWorkspaceWatcher(webContentsId);
  }
});
