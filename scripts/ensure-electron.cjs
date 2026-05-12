const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const electronMirror = "https://npmmirror.com/mirrors/electron/";
const electronPackageDir = path.dirname(require.resolve("electron/package.json"));
const installScript = path.join(electronPackageDir, "install.js");
const pathFile = path.join(electronPackageDir, "path.txt");

process.env.ELECTRON_MIRROR ||= electronMirror;
process.env.npm_config_electron_mirror ||= electronMirror;

function getInstalledElectronPath() {
  if (!fs.existsSync(pathFile)) {
    return null;
  }

  const executablePath = fs.readFileSync(pathFile, "utf8");
  const installedPath = path.join(electronPackageDir, "dist", executablePath);

  return fs.existsSync(installedPath) ? installedPath : null;
}

if (!getInstalledElectronPath()) {
  console.log("Installing Electron binary from mirror...");
  execFileSync(process.execPath, [installScript], {
    env: process.env,
    stdio: "inherit",
  });
}

const electronPath = require("electron");

if (!fs.existsSync(electronPath)) {
  throw new Error(`Electron binary was not found at ${electronPath}`);
}
