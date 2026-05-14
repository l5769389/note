import { describe, expect, it } from "vitest";
import {
  appSettingsStorageKey,
  appThemeValues,
  defaultAppSettings,
  getEditorCodeFontFamily,
  getEditorFontFamily,
  getInitialTheme,
  loadAppSettings,
  themeOptions,
} from "../appSettings";

describe("themeOptions", () => {
  it("exposes every registered theme", () => {
    expect(themeOptions.map((option) => option.value)).toEqual(appThemeValues);
  });
});

describe("getInitialTheme", () => {
  it("accepts any exposed theme from storage", () => {
    const storage = {
      getItem: () => "paper",
    } as unknown as Storage;

    expect(getInitialTheme(storage)).toBe("paper");
  });

  it("falls back to github for unknown stored themes", () => {
    const storage = {
      getItem: () => "unknown",
    } as unknown as Storage;

    expect(getInitialTheme(storage)).toBe("github");
  });
});

describe("loadAppSettings", () => {
  it("loads supported editor settings and ignores legacy server settings", () => {
    const storage = {
      getItem: (key: string) =>
        key === appSettingsStorageKey
          ? JSON.stringify({
              editorCodeFontFamily: "consolas",
              editorContentWidth: "980px",
              editorFontFamily: "serif",
              editorFontSize: "16px",
              editorLineHeight: "2",
              imageUploadEndpoint: "https://example.com/upload",
              remoteServerUrl: "https://example.com/sync",
            })
          : null,
    } as unknown as Storage;

    expect(loadAppSettings(storage)).toEqual({
      editorCodeFontFamily: "consolas",
      editorContentWidth: "980px",
      editorFontFamily: "serif",
      editorFontSize: "16px",
      editorLineHeight: "2",
    });
  });

  it("falls back to defaults for invalid setting values", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          editorCodeFontFamily: "missing",
          editorContentWidth: "9999px",
          editorFontFamily: "missing",
          editorFontSize: "3px",
          editorLineHeight: "9",
        }),
    } as unknown as Storage;

    expect(loadAppSettings(storage)).toEqual(defaultAppSettings);
  });
});

describe("editor font helpers", () => {
  it("returns CSS font stacks for editor font settings", () => {
    expect(getEditorFontFamily("serif")).toContain("Georgia");
    expect(getEditorCodeFontFamily("consolas")).toContain("Consolas");
  });
});
