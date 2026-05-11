const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const isProductionRenderer =
  app.isPackaged || process.env.ELECTRON_RENDERER_MODE === "production";
const devServerUrl =
  process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5173";

let mainWindow = null;

function isSafeNavigation(url) {
  if (isProductionRenderer) {
    return url.startsWith("file://");
  }

  return url.startsWith(devServerUrl);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f5f6f8",
    autoHideMenuBar: true,
    title: "Markdown Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isSafeNavigation(url)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  if (isProductionRenderer) {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
