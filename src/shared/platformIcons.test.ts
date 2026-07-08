import { describe, expect, it } from "vitest";
import {
  getDockIconResourceCandidates,
  getTrayIconResourceCandidates,
  getWindowIconResourceCandidates,
} from "./platformIcons.js";

describe("platform icon resource candidates", () => {
  it("prefers Windows ico resources on Windows", () => {
    expect(getWindowIconResourceCandidates("win32")[0]).toBe("icon.ico");
    expect(getTrayIconResourceCandidates("win32")[0]).toBe("icon.ico");
  });

  it("prefers macOS icns for windows and png for tray icons", () => {
    expect(getWindowIconResourceCandidates("darwin")).toEqual([
      "icon.icns",
      "icon.png",
      "icon-128.png",
      "icon-32.png",
    ]);
    expect(getTrayIconResourceCandidates("darwin")).toEqual([
      "icon-24.png",
      "icon-32.png",
      "icon.png",
    ]);
  });

  it("prefers macOS png resources for the Dock icon", () => {
    expect(getDockIconResourceCandidates("darwin")).toEqual([
      "icon.png",
      "icon-256.png",
      "icon.icns",
      "icon-128.png",
      "icon-32.png",
    ]);
  });
});
