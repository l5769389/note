export function getWindowIconResourceCandidates(platform: string) {
  return platform === "win32"
    ? ["icon.ico", "icon.png"]
    : ["icon.icns", "icon.png", "icon-128.png", "icon-32.png"];
}

export function getDockIconResourceCandidates(platform: string) {
  return platform === "darwin"
    ? ["icon.png", "icon-256.png", "icon.icns", "icon-128.png", "icon-32.png"]
    : getWindowIconResourceCandidates(platform);
}

export function getTrayIconResourceCandidates(platform: string) {
  return platform === "win32"
    ? ["icon.ico", "icon-32.png"]
    : ["icon-24.png", "icon-32.png", "icon.png"];
}
