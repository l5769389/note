import {
  getMigratedStorageItem,
  legacyNoteDockStorageKeys,
  noteDockStorageKeys,
} from "./storageKeys";

export const appThemeValues = [
  "paper",
  "github",
  "newsprint",
  "night",
  "pixyll",
  "whitey",
  "dark",
] as const;

export type AppTheme = (typeof appThemeValues)[number];

export type AppSettings = {
  editorCodeFontFamily: string;
  editorContentWidth: string;
  editorFontFamily: string;
  editorFontSize: string;
  editorLineHeight: string;
  editorMode: "typora" | "source" | "split" | "preview";
  settingsVersion: number;
};

export const appSettingsStorageKey = noteDockStorageKeys.appSettings;
export const appThemeStorageKey = noteDockStorageKeys.theme;
export const appSettingsVersion = 2;

const themeValue = "theme";

const legacyDefaultSettings = {
  editorCodeFontFamily: "mono",
  editorContentWidth: "860px",
  editorFontFamily: "system",
  editorFontSize: "15px",
  editorLineHeight: "1.78",
};

export const defaultAppSettings: AppSettings = {
  editorCodeFontFamily: themeValue,
  editorContentWidth: themeValue,
  editorFontFamily: themeValue,
  editorFontSize: themeValue,
  editorLineHeight: themeValue,
  editorMode: "typora",
  settingsVersion: appSettingsVersion,
};

export const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: "Paper", value: "paper" },
  { label: "Github", value: "github" },
  { label: "Newsprint", value: "newsprint" },
  { label: "Night", value: "night" },
  { label: "Pixyll", value: "pixyll" },
  { label: "Whitey", value: "whitey" },
  { label: "Dark", value: "dark" },
];

type SelectOption = {
  label: string;
  value: string;
};

type FontOption = SelectOption & {
  cssFamily: string;
};

export const editorFontOptions: FontOption[] = [
  {
    label: "跟随主题",
    value: themeValue,
    cssFamily: "var(--theme-editor-font-family)",
  },
  {
    label: "系统默认",
    value: "system",
    cssFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "无衬线",
    value: "sans",
    cssFamily:
      '"Inter", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    label: "衬线",
    value: "serif",
    cssFamily: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif',
  },
  {
    label: "宋体",
    value: "songti",
    cssFamily: '"Songti SC", SimSun, "Noto Serif CJK SC", serif',
  },
  {
    label: "楷体",
    value: "kaiti",
    cssFamily: 'KaiTi, "Kaiti SC", STKaiti, serif',
  },
];

export const editorCodeFontOptions: FontOption[] = [
  {
    label: "跟随主题",
    value: themeValue,
    cssFamily: "var(--theme-editor-code-font-family)",
  },
  {
    label: "系统等宽",
    value: "mono",
    cssFamily:
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, ui-monospace, monospace',
  },
  {
    label: "JetBrains Mono",
    value: "jetbrains",
    cssFamily:
      '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
  {
    label: "Consolas",
    value: "consolas",
    cssFamily: 'Consolas, "Liberation Mono", Menlo, ui-monospace, monospace',
  },
  {
    label: "Menlo",
    value: "menlo",
    cssFamily: 'Menlo, Monaco, "SFMono-Regular", Consolas, ui-monospace, monospace',
  },
];

export const editorFontSizeOptions: SelectOption[] = [
  { label: "跟随主题", value: themeValue },
  { label: "小 · 14px", value: "14px" },
  { label: "默认 · 15px", value: "15px" },
  { label: "舒适 · 16px", value: "16px" },
  { label: "大 · 18px", value: "18px" },
];

export const editorLineHeightOptions: SelectOption[] = [
  { label: "跟随主题", value: themeValue },
  { label: "紧凑 · 1.55", value: "1.55" },
  { label: "默认 · 1.78", value: "1.78" },
  { label: "宽松 · 2.0", value: "2" },
];

export const editorContentWidthOptions: SelectOption[] = [
  { label: "跟随主题", value: themeValue },
  { label: "窄 · 760px", value: "760px" },
  { label: "默认 · 860px", value: "860px" },
  { label: "宽 · 980px", value: "980px" },
  { label: "超宽 · 1120px", value: "1120px" },
  { label: "全宽", value: "100%" },
];

const editorModeOptions = [
  { label: "Typora", value: "typora" },
  { label: "Source", value: "source" },
  { label: "Split", value: "split" },
  { label: "Preview", value: "preview" },
] as const;

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function getInitialTheme(storage = getBrowserStorage()): AppTheme {
  const storedTheme = getMigratedStorageItem(
    storage,
    appThemeStorageKey,
    legacyNoteDockStorageKeys.theme,
  );

  return themeOptions.some((option) => option.value === storedTheme)
    ? (storedTheme as AppTheme)
    : "github";
}

function getAllowedValue(
  options: readonly SelectOption[],
  value: unknown,
  fallback: string,
) {
  return options.some((option) => option.value === value) ? String(value) : fallback;
}

function getFontFamily(options: FontOption[], value: string) {
  return (
    options.find((option) => option.value === value)?.cssFamily ??
    options[0].cssFamily
  );
}

export function getEditorFontFamily(value: string) {
  return getFontFamily(editorFontOptions, value);
}

export function getEditorCodeFontFamily(value: string) {
  return getFontFamily(editorCodeFontOptions, value);
}

function getThemeBackedValue(value: string, cssVariable: string) {
  return value === themeValue ? `var(${cssVariable})` : value;
}

export function getEditorFontSize(value: string) {
  return getThemeBackedValue(value, "--theme-editor-font-size");
}

export function getEditorLineHeight(value: string) {
  return getThemeBackedValue(value, "--theme-editor-line-height");
}

export function getEditorContentWidth(value: string) {
  return getThemeBackedValue(value, "--theme-editor-content-width");
}

function normalizeTypographyValue(
  options: readonly SelectOption[],
  value: unknown,
  legacyDefault: string,
) {
  if (value === legacyDefault) {
    return themeValue;
  }

  return getAllowedValue(options, value, themeValue);
}

export function normalizeAppSettings(settings: unknown): AppSettings {
  const source =
    settings && typeof settings === "object"
      ? (settings as Partial<AppSettings>)
      : {};
  const hasCurrentVersion = source.settingsVersion === appSettingsVersion;

  return {
    editorCodeFontFamily: hasCurrentVersion
      ? getAllowedValue(editorCodeFontOptions, source.editorCodeFontFamily, themeValue)
      : normalizeTypographyValue(
          editorCodeFontOptions,
          source.editorCodeFontFamily,
          legacyDefaultSettings.editorCodeFontFamily,
        ),
    editorContentWidth: hasCurrentVersion
      ? getAllowedValue(editorContentWidthOptions, source.editorContentWidth, themeValue)
      : normalizeTypographyValue(
          editorContentWidthOptions,
          source.editorContentWidth,
          legacyDefaultSettings.editorContentWidth,
        ),
    editorFontFamily: hasCurrentVersion
      ? getAllowedValue(editorFontOptions, source.editorFontFamily, themeValue)
      : normalizeTypographyValue(
          editorFontOptions,
          source.editorFontFamily,
          legacyDefaultSettings.editorFontFamily,
        ),
    editorFontSize: hasCurrentVersion
      ? getAllowedValue(editorFontSizeOptions, source.editorFontSize, themeValue)
      : normalizeTypographyValue(
          editorFontSizeOptions,
          source.editorFontSize,
          legacyDefaultSettings.editorFontSize,
        ),
    editorLineHeight: hasCurrentVersion
      ? getAllowedValue(editorLineHeightOptions, source.editorLineHeight, themeValue)
      : normalizeTypographyValue(
          editorLineHeightOptions,
          source.editorLineHeight,
          legacyDefaultSettings.editorLineHeight,
        ),
    editorMode: getAllowedValue(
      editorModeOptions,
      source.editorMode,
      defaultAppSettings.editorMode,
    ) as AppSettings["editorMode"],
    settingsVersion: appSettingsVersion,
  };
}

export function loadAppSettings(storage = getBrowserStorage()): AppSettings {
  try {
    const storedSettings = getMigratedStorageItem(
      storage,
      appSettingsStorageKey,
      legacyNoteDockStorageKeys.appSettings,
    );

    if (!storedSettings) {
      return defaultAppSettings;
    }

    return normalizeAppSettings(JSON.parse(storedSettings));
  } catch {
    return defaultAppSettings;
  }
}
