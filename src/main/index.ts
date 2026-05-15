import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions, SaveDialogOptions } from "electron";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const appName = "Markdown Studio";
const appUserModelId = "com.local.markdownstudio";
const localPreviewProtocol = "typora-local";
const require = createRequire(import.meta.url);
const mammoth = require("mammoth") as {
  convertToHtml: (
    input: { path: string },
    options?: {
      convertImage?: unknown;
      includeDefaultStyleMap?: boolean;
      styleMap?: string[];
    },
  ) => Promise<{ messages: Array<{ message: string; type: string }>; value: string }>;
  images: {
    imgElement: (
      callback: (image: {
        contentType: string;
        read: (encoding: string) => Promise<string>;
      }) => Promise<{ src: string }>,
    ) => unknown;
  };
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
const sheetExtensions = new Set([".univer"]);
const drawingExtensions = new Set([".excalidraw"]);
const maxDirectoryTreeDepth = 8;

type DocumentFileType = "markdown" | "html" | "pdf" | "word" | "sheet" | "drawing";

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

async function renderWordDocument(filePath: string) {
  if (!wordExtensions.has(extname(filePath).toLowerCase())) {
    throw new Error(`Unsupported Word document: ${filePath}`);
  }

  const result = await mammoth.convertToHtml(
    { path: filePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`,
      })),
      includeDefaultStyleMap: true,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => p.subtitle:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    },
  );

  return {
    html: result.value,
    messages: result.messages.map((message) => ({
      message: message.message,
      type: message.type,
    })),
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
        { name: "Documents", extensions: ["md", "markdown", "mdown", "html", "htm", "pdf", "docx", "univer", "excalidraw"] },
        { name: "Markdown", extensions: ["md", "markdown", "mdown"] },
        { name: "HTML", extensions: ["html", "htm"] },
        { name: "PDF", extensions: ["pdf"] },
        { name: "Word", extensions: ["docx"] },
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
    const content = `# ${title}\n\n`;

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

  ipcMain.handle("workspace:write-markdown-file", async (_, payload: { content: string; filePath: string }) => {
    await writeFile(payload.filePath, payload.content, "utf-8");
    return readMarkdownFile(payload.filePath);
  });

  ipcMain.handle("workspace:read-markdown-file", async (_, filePath: string) => {
    return readMarkdownFile(filePath);
  });

  ipcMain.handle("workspace:render-word-document", async (_, filePath: string) => {
    return renderWordDocument(filePath);
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
