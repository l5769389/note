export const appThemeValues = [
  "light",
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
};

export const appSettingsStorageKey = "typora-like-settings";

export const defaultAppSettings: AppSettings = {
  editorCodeFontFamily: "mono",
  editorContentWidth: "860px",
  editorFontFamily: "system",
  editorFontSize: "15px",
  editorLineHeight: "1.78",
};

export const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: "Light", value: "light" },
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
  { label: "小 · 14px", value: "14px" },
  { label: "默认 · 15px", value: "15px" },
  { label: "舒适 · 16px", value: "16px" },
  { label: "大 · 18px", value: "18px" },
];

export const editorLineHeightOptions: SelectOption[] = [
  { label: "紧凑 · 1.55", value: "1.55" },
  { label: "默认 · 1.78", value: "1.78" },
  { label: "宽松 · 2.0", value: "2" },
];

export const editorContentWidthOptions: SelectOption[] = [
  { label: "窄 · 760px", value: "760px" },
  { label: "默认 · 860px", value: "860px" },
  { label: "宽 · 980px", value: "980px" },
  { label: "超宽 · 1120px", value: "1120px" },
  { label: "全宽", value: "100%" },
];

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function getInitialTheme(storage = getBrowserStorage()): AppTheme {
  const storedTheme = storage?.getItem("typora-like-theme");

  return themeOptions.some((option) => option.value === storedTheme)
    ? (storedTheme as AppTheme)
    : "github";
}

function getAllowedValue(
  options: SelectOption[],
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

export function normalizeAppSettings(settings: unknown): AppSettings {
  const source =
    settings && typeof settings === "object"
      ? (settings as Partial<AppSettings>)
      : {};

  return {
    editorCodeFontFamily: getAllowedValue(
      editorCodeFontOptions,
      source.editorCodeFontFamily,
      defaultAppSettings.editorCodeFontFamily,
    ),
    editorContentWidth: getAllowedValue(
      editorContentWidthOptions,
      source.editorContentWidth,
      defaultAppSettings.editorContentWidth,
    ),
    editorFontFamily: getAllowedValue(
      editorFontOptions,
      source.editorFontFamily,
      defaultAppSettings.editorFontFamily,
    ),
    editorFontSize: getAllowedValue(
      editorFontSizeOptions,
      source.editorFontSize,
      defaultAppSettings.editorFontSize,
    ),
    editorLineHeight: getAllowedValue(
      editorLineHeightOptions,
      source.editorLineHeight,
      defaultAppSettings.editorLineHeight,
    ),
  };
}

export function loadAppSettings(storage = getBrowserStorage()): AppSettings {
  try {
    const storedSettings = storage?.getItem(appSettingsStorageKey);

    if (!storedSettings) {
      return defaultAppSettings;
    }

    return normalizeAppSettings(JSON.parse(storedSettings));
  } catch {
    return defaultAppSettings;
  }
}
