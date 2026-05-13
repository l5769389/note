import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import type { OpenDialogOptions } from "electron";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const appName = "Markdown Studio";
const appUserModelId = "com.local.markdownstudio";

let mainWindow: BrowserWindow | null = null;
const ignoredDirectoryNames = new Set([
  "build",
  "dist",
  "node_modules",
  "out",
  "target",
]);

type DirectoryTreeItem = {
  children?: DirectoryTreeItem[];
  name: string;
  path: string;
  type: "directory" | "file";
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

function titleFromFilePath(filePath: string) {
  return basename(filePath, extname(filePath));
}

async function readMarkdownFile(filePath: string) {
  const fileStat = await stat(filePath);

  return {
    content: await readFile(filePath, "utf-8"),
    createdAt: fileStat.birthtime.toISOString(),
    filePath,
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

async function readDirectoryTree(directoryPath: string, depth = 0): Promise<DirectoryTreeItem> {
  const entries = await readSafeDirectoryEntries(directoryPath);
  const children: DirectoryTreeItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      children.push(
        depth >= 3
          ? { name: entry.name, path: entryPath, type: "directory" }
          : await readDirectoryTree(entryPath, depth + 1),
      );
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      children.push({ name: entry.name, path: entryPath, type: "file" });
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });

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

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
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

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isSafeNavigation(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
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
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
      properties: ["openFile"],
      title: "选择 Markdown 文件",
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? null : readMarkdownFile(result.filePaths[0]);
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

  ipcMain.handle("workspace:write-markdown-file", async (_, payload: { content: string; filePath: string }) => {
    await writeFile(payload.filePath, payload.content, "utf-8");
    return readMarkdownFile(payload.filePath);
  });

  ipcMain.handle("workspace:read-markdown-file", async (_, filePath: string) => {
    return readMarkdownFile(filePath);
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
}

function registerWindowIpc() {
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) {
      return false;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }

    mainWindow.maximize();
    return true;
  });

  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
