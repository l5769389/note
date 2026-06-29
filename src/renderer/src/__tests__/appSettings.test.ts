import { describe, expect, it } from "vitest";
import {
  appSettingsStorageKey,
  appSettingsVersion,
  appThemeValues,
  defaultAppSettings,
  formatEditorFontSizeAdjustment,
  getAdjustedEditorFontSize,
  getEditorCodeFontFamily,
  getEditorContentDensityStyle,
  getEditorContentWidth,
  getEditorFontFamily,
  getEditorFontSize,
  getEditorLineHeight,
  getInitialTheme,
  loadAppSettings,
  normalizeEditorFontSizeAdjustment,
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
              editorContentDensity: "comfortable",
              editorContentWidth: "980px",
              editorFontFamily: "serif",
              editorFontSizeAdjustment: 1.5,
              editorFontSize: "16px",
              editorLineHeight: "2",
              editorMode: "split",
              homeShowNotePanel: false,
              homeShowTodoPanel: false,
              settingsVersion: appSettingsVersion,
              imageUploadEndpoint: "https://example.com/upload",
              remoteServerUrl: "https://example.com/sync",
            })
          : null,
    } as unknown as Storage;

    expect(loadAppSettings(storage)).toEqual({
      editorCodeFontFamily: "consolas",
      editorContentDensity: "comfortable",
      editorContentWidth: "980px",
      editorFontFamily: "serif",
      editorFontSizeAdjustment: 1.5,
      editorFontSize: "16px",
      editorLineHeight: "2",
      editorMode: "split",
      homeShowNotePanel: false,
      homeShowTodoPanel: false,
      settingsVersion: appSettingsVersion,
    });
  });

  it("falls back to defaults for invalid setting values", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          editorCodeFontFamily: "missing",
          editorContentDensity: "dense",
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

  it("infers a content density when migrating older typography settings", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          editorFontSize: "14px",
          editorLineHeight: "1.55",
          editorMode: "typora",
        }),
    } as unknown as Storage;

    expect(loadAppSettings(storage)).toEqual({
      ...defaultAppSettings,
      editorContentDensity: "compact",
      editorFontSizeAdjustment: 0,
      editorFontSize: "14px",
      editorLineHeight: "1.55",
    });
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

  it("returns content density styles for reader size presets", () => {
    expect(getEditorContentDensityStyle("compact").fontSize).toBe(
      "calc(var(--theme-editor-font-size) - 0.5px)",
    );
    expect(getEditorContentDensityStyle("normal").lineHeight).toBe(
      "var(--theme-editor-line-height)",
    );
    expect(getEditorContentDensityStyle("comfortable").contentWidth).toBe("820px");
  });

  it("normalizes and formats custom reader font size adjustments", () => {
    expect(normalizeEditorFontSizeAdjustment(1.26)).toBe(1.5);
    expect(normalizeEditorFontSizeAdjustment(99)).toBe(4);
    expect(normalizeEditorFontSizeAdjustment("bad")).toBe(0);
    expect(formatEditorFontSizeAdjustment(0)).toBe("使用预设");
    expect(formatEditorFontSizeAdjustment(1.5)).toBe("+1.5px");
    expect(getAdjustedEditorFontSize("16px", 1.5)).toBe("calc(16px + 1.5px)");
    expect(getAdjustedEditorFontSize("16px", -1)).toBe("calc(16px - 1px)");
  });
});
