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
  editorContentDensity: EditorContentDensity;
  editorFontFamily: string;
  editorFontSizeAdjustment: number;
  editorFontSize: string;
  editorLineHeight: string;
  editorMode: "typora" | "source" | "split" | "preview";
  settingsVersion: number;
};

export const appSettingsStorageKey = noteDockStorageKeys.appSettings;
export const appThemeStorageKey = noteDockStorageKeys.theme;
export const appSettingsVersion = 3;

const themeValue = "theme";

export const editorContentDensityValues = [
  "compact",
  "normal",
  "comfortable",
] as const;

export type EditorContentDensity = (typeof editorContentDensityValues)[number];

export const editorFontSizeAdjustmentRange = {
  defaultValue: 0,
  max: 4,
  min: -2,
  step: 0.5,
} as const;

const legacyDefaultSettings = {
  editorCodeFontFamily: "mono",
  editorContentWidth: "860px",
  editorFontFamily: "system",
  editorFontSize: "15px",
  editorLineHeight: "1.78",
};

export const defaultAppSettings: AppSettings = {
  editorCodeFontFamily: themeValue,
  editorContentDensity: "normal",
  editorContentWidth: themeValue,
  editorFontFamily: themeValue,
  editorFontSizeAdjustment: 0,
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

type ContentDensityOption = {
  description: string;
  label: string;
  meta: string;
  value: EditorContentDensity;
};

type ContentDensityStyle = {
  blockMargin: string;
  codeBlockMargin: string;
  contentWidth: string;
  fontSize: string;
  lineHeight: string;
  listMargin: string;
  paragraphMargin: string;
  tableCellPadding: string;
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

export const editorContentDensityOptions: ContentDensityOption[] = [
  {
    description: "更高信息密度，适合长文快速浏览和代码笔记。",
    label: "紧凑",
    meta: "主题 -0.5px / 1.62",
    value: "compact",
  },
  {
    description: "使用当前主题自己的正文基线，作为默认推荐。",
    label: "标准",
    meta: "主题 + 1px",
    value: "normal",
  },
  {
    description: "更大的字号和留白，适合沉浸阅读或投屏查看。",
    label: "舒适",
    meta: "主题 + 2.5px / 1.92",
    value: "comfortable",
  },
];

const editorContentDensityStyles: Record<
  EditorContentDensity,
  ContentDensityStyle
> = {
  compact: {
    blockMargin: "0.92em 0",
    codeBlockMargin: "0.9em 0",
    contentWidth: "980px",
    fontSize: "calc(var(--theme-editor-font-size) - 0.5px)",
    lineHeight: "1.62",
    listMargin: "0.28em 0 0.72em",
    paragraphMargin: "0 0 0.72em",
    tableCellPadding: "6px 10px",
  },
  normal: {
    blockMargin: "var(--theme-block-margin)",
    codeBlockMargin: "var(--theme-code-block-margin)",
    contentWidth: "var(--theme-editor-content-width)",
    fontSize: "calc(var(--theme-editor-font-size) + 1px)",
    lineHeight: "var(--theme-editor-line-height)",
    listMargin: "var(--theme-list-margin)",
    paragraphMargin: "var(--theme-paragraph-margin)",
    tableCellPadding: "8px 12px",
  },
  comfortable: {
    blockMargin: "1.24em 0",
    codeBlockMargin: "1.15em 0",
    contentWidth: "820px",
    fontSize: "calc(var(--theme-editor-font-size) + 2.5px)",
    lineHeight: "1.92",
    listMargin: "0.58em 0 1.08em",
    paragraphMargin: "0 0 1em",
    tableCellPadding: "10px 14px",
  },
};

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

export function getEditorContentDensityStyle(value: EditorContentDensity) {
  return editorContentDensityStyles[value] ?? editorContentDensityStyles.normal;
}

export function normalizeEditorFontSizeAdjustment(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : editorFontSizeAdjustmentRange.defaultValue;

  if (!Number.isFinite(numericValue)) {
    return editorFontSizeAdjustmentRange.defaultValue;
  }

  const { max, min, step } = editorFontSizeAdjustmentRange;
  const steppedValue = Math.round(numericValue / step) * step;
  const clampedValue = Math.min(max, Math.max(min, steppedValue));
  return Number(clampedValue.toFixed(2));
}

export function formatEditorFontSizeAdjustment(value: number) {
  const normalizedValue = normalizeEditorFontSizeAdjustment(value);

  if (normalizedValue === editorFontSizeAdjustmentRange.defaultValue) {
    return "使用预设";
  }

  return `${normalizedValue > 0 ? "+" : ""}${normalizedValue}px`;
}

export function getAdjustedEditorFontSize(
  baseFontSize: string,
  adjustment: number,
) {
  const normalizedAdjustment = normalizeEditorFontSizeAdjustment(adjustment);

  if (normalizedAdjustment === editorFontSizeAdjustmentRange.defaultValue) {
    return baseFontSize;
  }

  const operator = normalizedAdjustment > 0 ? "+" : "-";
  return `calc(${baseFontSize} ${operator} ${Math.abs(normalizedAdjustment)}px)`;
}

function inferContentDensityFromTypography(settings: Partial<AppSettings>) {
  if (
    editorContentDensityOptions.some(
      (option) => option.value === settings.editorContentDensity,
    )
  ) {
    return settings.editorContentDensity as EditorContentDensity;
  }

  if (settings.editorFontSize === "14px" || settings.editorLineHeight === "1.55") {
    return "compact";
  }

  if (
    settings.editorFontSize === "16px" ||
    settings.editorFontSize === "18px" ||
    settings.editorLineHeight === "2"
  ) {
    return "comfortable";
  }

  return defaultAppSettings.editorContentDensity;
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
    editorContentDensity: hasCurrentVersion
      ? (getAllowedValue(
          editorContentDensityOptions,
          source.editorContentDensity,
          defaultAppSettings.editorContentDensity,
        ) as EditorContentDensity)
      : inferContentDensityFromTypography(source),
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
    editorFontSizeAdjustment: normalizeEditorFontSizeAdjustment(
      source.editorFontSizeAdjustment,
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
