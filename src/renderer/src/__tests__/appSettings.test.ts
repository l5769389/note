import { describe, expect, it } from "vitest";
import {
  appSettingsStorageKey,
  appSettingsVersion,
  appThemeValues,
  defaultAppSettings,
  getEditorCodeFontFamily,
  getEditorContentWidth,
  getEditorFontFamily,
  getEditorFontSize,
  getEditorLineHeight,
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
              editorMode: "split",
              settingsVersion: appSettingsVersion,
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
      editorMode: "split",
      settingsVersion: appSettingsVersion,
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
          editorMode: "raw",
        }),
    } as unknown as Storage;

    expect(loadAppSettings(storage)).toEqual(defaultAppSettings);
  });

  it("migrates legacy default typography to theme-backed defaults", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          editorCodeFontFamily: "mono",
          editorContentWidth: "860px",
          editorFontFamily: "system",
          editorFontSize: "15px",
          editorLineHeight: "1.78",
          editorMode: "typora",
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

  it("resolves theme-backed typography settings to CSS variables", () => {
    expect(getEditorFontFamily("theme")).toBe("var(--theme-editor-font-family)");
    expect(getEditorCodeFontFamily("theme")).toBe(
      "var(--theme-editor-code-font-family)",
    );
    expect(getEditorFontSize("theme")).toBe("var(--theme-editor-font-size)");
    expect(getEditorLineHeight("theme")).toBe("var(--theme-editor-line-height)");
    expect(getEditorContentWidth("theme")).toBe(
      "var(--theme-editor-content-width)",
    );
  });
});
