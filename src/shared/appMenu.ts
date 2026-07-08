export const appMenuThemeValues = [
  "paper",
  "github",
  "newsprint",
  "night",
  "pixyll",
  "whitey",
  "dark",
] as const;

export type AppMenuThemeValue = (typeof appMenuThemeValues)[number];

export type AppMenuEditorMode = "preview" | "source" | "split" | "typora";

export type AppMenuRecentDocument = {
  exists?: boolean;
  id: string;
  label: string;
  pathLabel?: string;
};

export const appMenuCommandIds = [
  "app:about",
  "file:new-markdown",
  "file:new-sheet",
  "file:new-drawing",
  "file:new-window",
  "file:inspiration-note",
  "file:open",
  "file:open-folder",
  "file:history",
  "file:open-recent",
  "file:save",
  "file:close-document",
  "file:save-as",
  "file:export-pdf",
  "file:export-html",
  "file:show-in-folder",
  "file:reveal-sidebar",
  "edit:undo",
  "edit:redo",
  "edit:cut",
  "edit:copy",
  "edit:paste",
  "edit:insert-drawing",
  "edit:insert-sheet",
  "edit:move-line-up",
  "edit:move-line-down",
  "edit:delete",
  "edit:find",
  "edit:replace",
  "paragraph:heading-1",
  "paragraph:heading-2",
  "paragraph:heading-3",
  "paragraph:heading-4",
  "paragraph:heading-5",
  "paragraph:heading-6",
  "paragraph:promote-heading",
  "paragraph:demote-heading",
  "paragraph:table",
  "paragraph:math-block",
  "paragraph:code-block",
  "paragraph:alert-note",
  "paragraph:alert-tip",
  "paragraph:alert-important",
  "paragraph:alert-warning",
  "paragraph:alert-caution",
  "paragraph:blockquote",
  "paragraph:ordered-list",
  "paragraph:bullet-list",
  "paragraph:task-list",
  "paragraph:task-toggle",
  "paragraph:task-completed",
  "paragraph:task-incomplete",
  "paragraph:indent-list",
  "paragraph:outdent-list",
  "paragraph:horizontal-rule",
  "format:bold",
  "format:italic",
  "format:underline",
  "format:inline-code",
  "format:strikethrough",
  "format:comment",
  "format:link",
  "format:image-insert",
  "format:image-align-left",
  "format:image-align-center",
  "format:image-align-right",
  "format:image-reset-size",
  "view:toggle-sidebar",
  "view:workspace-search",
  "view:knowledge-relations",
  "view:settings",
  "view:mode-typora",
  "view:mode-source",
  "view:mode-split",
  "view:mode-preview",
  "view:toggle-fullscreen",
  "view:toggle-always-on-top",
  "view:reset-zoom",
  "view:zoom-in",
  "view:zoom-out",
  "theme:set:paper",
  "theme:set:github",
  "theme:set:newsprint",
  "theme:set:night",
  "theme:set:pixyll",
  "theme:set:whitey",
  "theme:set:dark",
] as const;

export type AppMenuCommandId = (typeof appMenuCommandIds)[number];

export type AppMenuCommand = {
  documentId?: string;
  id: AppMenuCommandId;
};

export type AppMenuState = {
  activeDocument: boolean;
  alwaysOnTop: boolean;
  canOpenHistory: boolean;
  defaultZoom: boolean;
  editorMode: AppMenuEditorMode;
  fullScreen: boolean;
  markdownDocument: boolean;
  recentDocuments: AppMenuRecentDocument[];
  theme: AppMenuThemeValue;
  windowZoomPercent: number;
};

export const defaultAppMenuState: AppMenuState = {
  activeDocument: false,
  alwaysOnTop: false,
  canOpenHistory: false,
  defaultZoom: true,
  editorMode: "typora",
  fullScreen: false,
  markdownDocument: false,
  recentDocuments: [],
  theme: "paper",
  windowZoomPercent: 100,
};

export function getThemeFromAppMenuCommand(
  commandId: AppMenuCommandId,
): AppMenuThemeValue | null {
  const prefix = "theme:set:";

  if (!commandId.startsWith(prefix)) {
    return null;
  }

  const theme = commandId.slice(prefix.length);

  return appMenuThemeValues.includes(theme as AppMenuThemeValue)
    ? (theme as AppMenuThemeValue)
    : null;
}
