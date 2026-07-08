import type { AppMenuCommandId } from "../../shared/appMenu";
import type { AppShortcutAction } from "./editorShortcuts";

export function getShortcutActionForAppMenuCommand(
  commandId: AppMenuCommandId,
): AppShortcutAction | null {
  switch (commandId) {
    case "file:new-markdown":
      return { command: "newMarkdownDocument", type: "file" };
    case "file:new-window":
      return { command: "newWindow", type: "file" };
    case "file:inspiration-note":
      return { command: "inspirationNote", type: "file" };
    case "file:open":
      return { command: "openDocument", type: "file" };
    case "file:save":
      return { command: "save", type: "file" };
    case "file:close-document":
      return { command: "closeDocument", type: "file" };
    case "file:save-as":
      return { command: "saveAs", type: "file" };
    case "edit:undo":
      return { action: { command: "undo", type: "edit" }, type: "editor" };
    case "edit:redo":
      return { action: { command: "redo", type: "edit" }, type: "editor" };
    case "edit:cut":
      return { action: { command: "cut", type: "edit" }, type: "editor" };
    case "edit:copy":
      return { action: { command: "copy", type: "edit" }, type: "editor" };
    case "edit:paste":
      return { action: { command: "paste", type: "edit" }, type: "editor" };
    case "edit:move-line-up":
      return { action: { command: "moveLineUp", type: "edit" }, type: "editor" };
    case "edit:move-line-down":
      return { action: { command: "moveLineDown", type: "edit" }, type: "editor" };
    case "edit:delete":
      return { action: { command: "delete", type: "edit" }, type: "editor" };
    case "edit:find":
      return { type: "find" };
    case "edit:replace":
      return { replace: true, type: "find" };
    case "paragraph:heading-1":
      return { action: { command: { level: 1, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:heading-2":
      return { action: { command: { level: 2, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:heading-3":
      return { action: { command: { level: 3, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:heading-4":
      return { action: { command: { level: 4, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:heading-5":
      return { action: { command: { level: 5, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:heading-6":
      return { action: { command: { level: 6, type: "heading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:promote-heading":
      return { action: { command: { type: "promoteHeading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:demote-heading":
      return { action: { command: { type: "demoteHeading" }, type: "paragraph" }, type: "editor" };
    case "paragraph:math-block":
      return { action: { command: { type: "mathBlock" }, type: "paragraph" }, type: "editor" };
    case "paragraph:code-block":
      return { action: { command: { type: "codeBlock" }, type: "paragraph" }, type: "editor" };
    case "paragraph:alert-note":
      return { action: { command: { kind: "note", type: "alert" }, type: "paragraph" }, type: "editor" };
    case "paragraph:alert-tip":
      return { action: { command: { kind: "tip", type: "alert" }, type: "paragraph" }, type: "editor" };
    case "paragraph:alert-important":
      return { action: { command: { kind: "important", type: "alert" }, type: "paragraph" }, type: "editor" };
    case "paragraph:alert-warning":
      return { action: { command: { kind: "warning", type: "alert" }, type: "paragraph" }, type: "editor" };
    case "paragraph:alert-caution":
      return { action: { command: { kind: "caution", type: "alert" }, type: "paragraph" }, type: "editor" };
    case "paragraph:blockquote":
      return { action: { command: { type: "blockquote" }, type: "paragraph" }, type: "editor" };
    case "paragraph:ordered-list":
      return { action: { command: { type: "orderedList" }, type: "paragraph" }, type: "editor" };
    case "paragraph:bullet-list":
      return { action: { command: { type: "bulletList" }, type: "paragraph" }, type: "editor" };
    case "paragraph:task-list":
      return { action: { command: { type: "taskList" }, type: "paragraph" }, type: "editor" };
    case "paragraph:task-toggle":
      return { action: { command: { status: "toggle", type: "taskStatus" }, type: "paragraph" }, type: "editor" };
    case "paragraph:task-completed":
      return { action: { command: { status: "completed", type: "taskStatus" }, type: "paragraph" }, type: "editor" };
    case "paragraph:task-incomplete":
      return { action: { command: { status: "incomplete", type: "taskStatus" }, type: "paragraph" }, type: "editor" };
    case "paragraph:indent-list":
      return { action: { command: { type: "indentList" }, type: "paragraph" }, type: "editor" };
    case "paragraph:outdent-list":
      return { action: { command: { type: "outdentList" }, type: "paragraph" }, type: "editor" };
    case "paragraph:horizontal-rule":
      return { action: { command: { type: "horizontalRule" }, type: "paragraph" }, type: "editor" };
    case "format:bold":
      return { action: { command: { type: "bold" }, type: "format" }, type: "editor" };
    case "format:italic":
      return { action: { command: { type: "italic" }, type: "format" }, type: "editor" };
    case "format:underline":
      return { action: { command: { type: "underline" }, type: "format" }, type: "editor" };
    case "format:inline-code":
      return { action: { command: { type: "inlineCode" }, type: "format" }, type: "editor" };
    case "format:strikethrough":
      return { action: { command: { type: "strikethrough" }, type: "format" }, type: "editor" };
    case "format:comment":
      return { action: { command: { type: "comment" }, type: "format" }, type: "editor" };
    case "format:link":
      return { action: { type: "createLink" }, type: "editor" };
    case "format:image-align-left":
      return { action: { command: { align: "left", type: "imageAlign" }, type: "format" }, type: "editor" };
    case "format:image-align-center":
      return { action: { command: { align: "center", type: "imageAlign" }, type: "format" }, type: "editor" };
    case "format:image-align-right":
      return { action: { command: { align: "right", type: "imageAlign" }, type: "format" }, type: "editor" };
    case "format:image-reset-size":
      return { action: { command: { type: "imageResetSize" }, type: "format" }, type: "editor" };
    case "view:toggle-sidebar":
      return { command: "toggleSidebar", type: "view" };
    case "view:workspace-search":
      return { command: "workspaceSearch", type: "view" };
    case "view:toggle-fullscreen":
      return { command: "toggleFullScreen", type: "view" };
    case "view:reset-zoom":
      return { command: "resetZoom", type: "view" };
    case "view:zoom-in":
      return { command: "zoomIn", type: "view" };
    case "view:zoom-out":
      return { command: "zoomOut", type: "view" };
    default:
      return null;
  }
}
