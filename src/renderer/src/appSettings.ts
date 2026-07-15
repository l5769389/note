import {
  getMigratedStorageItem,
  legacyNoteDockStorageKeys,
  noteDockStorageKeys,
} from "./storageKeys";
import {
  normalizeDiaryTemplateId,
  type DiaryTemplateId,
} from "./diaryModel";

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

export const sidebarTabOrderValues = ["diary", "files", "current"] as const;

export type SidebarTabOrderItem = (typeof sidebarTabOrderValues)[number];

export const diaryFontFamilyValues = [
  "theme",
  "handwriting",
  "kaiti",
  "xingkai",
  "serif",
] as const;

export type DiaryFontFamily = (typeof diaryFontFamilyValues)[number];

export type AppSettings = {
  diaryDefaultTemplate: DiaryTemplateId;
  diaryFontFamily: DiaryFontFamily;
  diaryFontSize: string;
  diaryLineHeight: string;
  editorCodeFontFamily: string;
  editorContentWidth: string;
  editorContentDensity: EditorContentDensity;
  editorFontFamily: string;
  editorFontSizeAdjustment: number;
  editorFontSize: string;
  editorLineHeight: string;
  editorMode: "typora" | "source" | "split" | "preview";
  homeShowDiaryPanel: boolean;
  homeShowNotePanel: boolean;
  homeShowTodoPanel: boolean;
  settingsVersion: number;
  sidebarTabOrder: SidebarTabOrderItem[];
};

export const appSettingsStorageKey = noteDockStorageKeys.appSettings;
export const appThemeStorageKey = noteDockStorageKeys.theme;
export const appSettingsVersion = 9;

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
  diaryDefaultTemplate: "blank",
  diaryFontFamily: themeValue,
  diaryFontSize: "18px",
  diaryLineHeight: "2",
  editorCodeFontFamily: themeValue,
  editorContentDensity: "comfortable",
  editorContentWidth: themeValue,
  editorFontFamily: themeValue,
  editorFontSizeAdjustment: 0,
  editorFontSize: themeValue,
  editorLineHeight: themeValue,
  editorMode: "typora",
  homeShowDiaryPanel: true,
  homeShowNotePanel: true,
  homeShowTodoPanel: true,
  settingsVersion: appSettingsVersion,
  sidebarTabOrder: [...sidebarTabOrderValues],
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

export const diaryFontOptions: FontOption[] = [
  {
    label: "跟随笔记",
    value: themeValue,
    cssFamily: "var(--editor-font-family)",
  },
  {
    label: "手写感",
    value: "handwriting",
    cssFamily:
      '"Hannotate SC", "HanziPen SC", "Xingkai SC", "STXingkai", "Kaiti SC", KaiTi, "Segoe Print", "Bradley Hand", cursive',
  },
  {
    label: "楷体",
    value: "kaiti",
    cssFamily: 'KaiTi, "Kaiti SC", STKaiti, serif',
  },
  {
    label: "行楷",
    value: "xingkai",
    cssFamily:
      '"Xingkai SC", "STXingkai", "HanziPen SC", "Kaiti SC", KaiTi, cursive',
  },
  {
    label: "柔和衬线",
    value: "serif",
    cssFamily:
      'Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
  },
];

export const diaryFontSizeOptions: SelectOption[] = [
  { label: "跟随笔记", value: themeValue },
  { label: "标准 · 17px", value: "17px" },
  { label: "舒适 · 18px", value: "18px" },
  { label: "宽松 · 19px", value: "19px" },
  { label: "大字 · 20px", value: "20px" },
];

export const diaryLineHeightOptions: SelectOption[] = [
  { label: "跟随笔记", value: themeValue },
  { label: "舒适 · 1.9", value: "1.9" },
  { label: "日记 · 2.0", value: "2" },
  { label: "宽松 · 2.15", value: "2.15" },
];

export const editorFontSizeOptions: SelectOption[] = [
  { label: "跟随阅读预设", value: themeValue },
  { label: "小 · 14px", value: "14px" },
  { label: "默认 · 15px", value: "15px" },
  { label: "舒适 · 16px", value: "16px" },
  { label: "大 · 18px", value: "18px" },
];

export const editorLineHeightOptions: SelectOption[] = [
  { label: "跟随阅读预设", value: themeValue },
  { label: "紧凑 · 1.55", value: "1.55" },
  { label: "默认 · 1.78", value: "1.78" },
  { label: "宽松 · 2.0", value: "2" },
];

export const editorContentWidthOptions: SelectOption[] = [
  { label: "跟随阅读预设", value: themeValue },
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
    contentWidth: "900px",
    fontSize: "calc(var(--theme-editor-font-size) + 0.5px)",
    lineHeight: "1.76",
    listMargin: "var(--theme-list-margin)",
    paragraphMargin: "var(--theme-paragraph-margin)",
    tableCellPadding: "8px 12px",
  },
  comfortable: {
    blockMargin: "1.24em 0",
    codeBlockMargin: "1.15em 0",
    contentWidth: "820px",
    fontSize: "calc(var(--theme-editor-font-size) + 1px)",
    lineHeight: "1.86",
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

export function getDiaryFontFamily(value: string) {
  return getFontFamily(diaryFontOptions, value);
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

export function getDiaryFontSize(value: string) {
  return value === themeValue ? "var(--editor-font-size)" : value;
}

export function getDiaryLineHeight(value: string) {
  return value === themeValue ? "var(--editor-line-height)" : value;
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

function normalizeBooleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSidebarTabOrder(value: unknown): SidebarTabOrderItem[] {
  const result: SidebarTabOrderItem[] = [];
  const source = Array.isArray(value) ? value : [];

  for (const item of source) {
    const allowedValue = sidebarTabOrderValues.find((tab) => tab === item);

    if (allowedValue && !result.includes(allowedValue)) {
      result.push(allowedValue);
    }
  }

  for (const item of sidebarTabOrderValues) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }

  return result;
}

export function normalizeAppSettings(settings: unknown): AppSettings {
  const source =
    settings && typeof settings === "object"
      ? (settings as Partial<AppSettings>)
      : {};
  const hasCurrentVersion = source.settingsVersion === appSettingsVersion;

  return {
    diaryDefaultTemplate: normalizeDiaryTemplateId(
      source.diaryDefaultTemplate,
    ),
    diaryFontFamily: getAllowedValue(
      diaryFontOptions,
      source.diaryFontFamily,
      defaultAppSettings.diaryFontFamily,
    ) as DiaryFontFamily,
    diaryFontSize: getAllowedValue(
      diaryFontSizeOptions,
      source.diaryFontSize,
      defaultAppSettings.diaryFontSize,
    ),
    diaryLineHeight: getAllowedValue(
      diaryLineHeightOptions,
      source.diaryLineHeight,
      defaultAppSettings.diaryLineHeight,
    ),
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
      : "comfortable",
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
    editorFontSizeAdjustment: hasCurrentVersion
      ? normalizeEditorFontSizeAdjustment(source.editorFontSizeAdjustment)
      : 0,
    editorFontSize: hasCurrentVersion
      ? getAllowedValue(editorFontSizeOptions, source.editorFontSize, themeValue)
      : themeValue,
    editorLineHeight: hasCurrentVersion
      ? getAllowedValue(editorLineHeightOptions, source.editorLineHeight, themeValue)
      : themeValue,
    editorMode: getAllowedValue(
      editorModeOptions,
      source.editorMode,
      defaultAppSettings.editorMode,
    ) as AppSettings["editorMode"],
    homeShowDiaryPanel: normalizeBooleanSetting(
      source.homeShowDiaryPanel,
      defaultAppSettings.homeShowDiaryPanel,
    ),
    homeShowNotePanel: normalizeBooleanSetting(
      source.homeShowNotePanel,
      defaultAppSettings.homeShowNotePanel,
    ),
    homeShowTodoPanel: normalizeBooleanSetting(
      source.homeShowTodoPanel,
      defaultAppSettings.homeShowTodoPanel,
    ),
    settingsVersion: appSettingsVersion,
    sidebarTabOrder: normalizeSidebarTabOrder(source.sidebarTabOrder),
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
