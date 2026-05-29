import type {
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "./editorCommands";

export type EditorShortcutAction =
  | { command: TyporaEditCommand; type: "edit" }
  | { replace?: boolean; type: "find" }
  | { command: TyporaFormatCommand; type: "format" }
  | { command: TyporaParagraphCommand; type: "paragraph" }
  | { type: "createLink" }
  | { type: "insertDocumentReference" };

export type EditorShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
> & {
  isComposing?: boolean;
};

export type AppShortcutAction =
  | { command: "newMarkdownDocument" | "newWindow" | "openDocument" | "quickCapture" | "save" | "saveAs"; type: "file" }
  | { command: "exitFullScreen" | "resetZoom" | "showDocuments" | "showFiles" | "showOutline" | "toggleFullScreen" | "toggleSidebar" | "workspaceSearch" | "zoomIn" | "zoomOut"; type: "view" }
  | { replace?: boolean; type: "find" }
  | { action: Exclude<EditorShortcutAction, { type: "find" }>; type: "editor" };

export type AppShortcutContext = {
  isEditorTarget?: boolean;
  isFullScreen?: boolean;
};

export type SelectAllShortcutScope = "blocked" | "content" | "input";

export const selectAllContentScopeSelector = "[data-select-all-scope='content']";

const selectAllInputSelector = "input,textarea,select,[contenteditable='true']";

type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => Element | null;
};

export function isAppShortcutModifier(event: EditorShortcutEvent) {
  return (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey);
}

export function isSelectAllShortcut(event: EditorShortcutEvent) {
  return (
    !event.isComposing &&
    isAppShortcutModifier(event) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "a"
  );
}

function closestShortcutTarget(target: EventTarget | null, selector: string) {
  const candidate = target as ClosestCapableTarget | null;

  return typeof candidate?.closest === "function"
    ? candidate.closest(selector)
    : null;
}

export function getSelectAllContentScope(target: EventTarget | null) {
  return closestShortcutTarget(target, selectAllContentScopeSelector);
}

export function getSelectAllShortcutScope(
  target: EventTarget | null,
): SelectAllShortcutScope {
  if (closestShortcutTarget(target, selectAllInputSelector)) {
    return "input";
  }

  if (getSelectAllContentScope(target)) {
    return "content";
  }

  return "blocked";
}

function hasOnlyAppModifier(event: EditorShortcutEvent, shiftKey = false) {
  return isAppShortcutModifier(event) && !event.altKey && event.shiftKey === shiftKey;
}

function hasNoModifier(event: EditorShortcutEvent) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

function isMainPlusKey(event: EditorShortcutEvent) {
  return event.code === "Equal" || event.key === "+" || event.key === "=";
}

function isMainMinusKey(event: EditorShortcutEvent) {
  return event.code === "Minus" || event.key === "-" || event.key === "_";
}

function getWindowZoomShortcutCommand(
  event: EditorShortcutEvent,
): Extract<AppShortcutAction, { type: "view" }>["command"] | null {
  if (!isAppShortcutModifier(event) || event.altKey) {
    return null;
  }

  const digit = getShortcutDigit(event);

  if (event.shiftKey && digit === "9") {
    return "resetZoom";
  }

  if (event.code === "Numpad0" && !event.shiftKey) {
    return "resetZoom";
  }

  if (event.code === "NumpadAdd" || (event.shiftKey && isMainPlusKey(event))) {
    return "zoomIn";
  }

  if (event.code === "NumpadSubtract" || (event.shiftKey && isMainMinusKey(event))) {
    return "zoomOut";
  }

  return null;
}

export function getShortcutDigit(event: EditorShortcutEvent) {
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice("Digit".length);
  }

  return /^[0-9]$/.test(event.key) ? event.key : "";
}

const shiftedParagraphShortcuts: Record<string, TyporaParagraphCommand> = {
  "[": { type: "orderedList" },
  "]": { type: "bulletList" },
  K: { type: "codeBlock" },
  M: { type: "mathBlock" },
  Q: { type: "blockquote" },
  X: { type: "taskList" },
  k: { type: "codeBlock" },
  m: { type: "mathBlock" },
  q: { type: "blockquote" },
  x: { type: "taskList" },
};

export function getEditorShortcutAction(
  event: EditorShortcutEvent,
): EditorShortcutAction | null {
  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowUp") {
    return { command: "moveLineUp", type: "edit" };
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowDown") {
    return { command: "moveLineDown", type: "edit" };
  }

  if (
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (event.key === "%" || event.code === "Digit5")
  ) {
    return { command: { type: "strikethrough" }, type: "format" };
  }

  if (!isAppShortcutModifier(event) || event.altKey) {
    return null;
  }

  if (!event.shiftKey && event.key.toLowerCase() === "f") {
    return { type: "find" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "h") {
    return { replace: true, type: "find" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "b") {
    return { command: { type: "bold" }, type: "format" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "i") {
    return { command: { type: "italic" }, type: "format" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "u") {
    return { command: { type: "underline" }, type: "format" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "k") {
    return { type: "createLink" };
  }

  if (!event.shiftKey && event.key === "\\") {
    return { command: { type: "clearStyle" }, type: "format" };
  }

  if (event.shiftKey && event.code === "Backquote") {
    return { command: { type: "inlineCode" }, type: "format" };
  }

  if (!event.shiftKey && /^[0-6]$/.test(event.key)) {
    return {
      command:
        event.key === "0"
          ? { type: "paragraph" }
          : { type: "heading", level: Number(event.key) },
      type: "paragraph",
    };
  }

  if (!event.shiftKey && (event.key === "=" || event.key === "+")) {
    return { command: { type: "promoteHeading" }, type: "paragraph" };
  }

  if (!event.shiftKey && event.key === "-") {
    return { command: { type: "demoteHeading" }, type: "paragraph" };
  }

  if (!event.shiftKey) {
    return null;
  }

  const command = shiftedParagraphShortcuts[event.key];

  return command ? { command, type: "paragraph" } : null;
}

export function getAppShortcutAction(
  event: EditorShortcutEvent,
  context: AppShortcutContext = {},
): AppShortcutAction | null {
  if (event.isComposing) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (event.key === "F11" && hasNoModifier(event)) {
    return { command: "toggleFullScreen", type: "view" };
  }

  if (event.key === "Escape" && context.isFullScreen && hasNoModifier(event)) {
    return { command: "exitFullScreen", type: "view" };
  }

  const windowZoomCommand = getWindowZoomShortcutCommand(event);

  if (windowZoomCommand) {
    return { command: windowZoomCommand, type: "view" };
  }

  if (
    isAppShortcutModifier(event) &&
    event.altKey &&
    !event.shiftKey &&
    key === "n"
  ) {
    return { command: "quickCapture", type: "file" };
  }

  if (
    context.isEditorTarget &&
    isAppShortcutModifier(event) &&
    event.altKey &&
    !event.shiftKey &&
    key === "l"
  ) {
    return { action: { type: "insertDocumentReference" }, type: "editor" };
  }

  if (hasOnlyAppModifier(event, true)) {
    const digit = getShortcutDigit(event);

    if (key === "n") {
      return { command: "newWindow", type: "file" };
    }

    if (key === "s") {
      return { command: "saveAs", type: "file" };
    }

    if (key === "l") {
      return { command: "toggleSidebar", type: "view" };
    }

    if (key === "f") {
      return { command: "workspaceSearch", type: "view" };
    }

    if (digit === "1") {
      return { command: "showOutline", type: "view" };
    }

    if (digit === "2") {
      return { command: "showDocuments", type: "view" };
    }

    if (digit === "3") {
      return { command: "showFiles", type: "view" };
    }
  }

  if (hasOnlyAppModifier(event)) {
    if (key === "s") {
      return { command: "save", type: "file" };
    }

    if (key === "n") {
      return { command: "newMarkdownDocument", type: "file" };
    }

    if (key === "o") {
      return { command: "openDocument", type: "file" };
    }

    if (key === "f") {
      return { type: "find" };
    }

    if (key === "h") {
      return { replace: true, type: "find" };
    }

    if (context.isEditorTarget) {
      if (key === "z") {
        return { action: { command: "undo", type: "edit" }, type: "editor" };
      }

      if (key === "y") {
        return { action: { command: "redo", type: "edit" }, type: "editor" };
      }

      if (key === "x") {
        return { action: { command: "cut", type: "edit" }, type: "editor" };
      }

      if (key === "c") {
        return { action: { command: "copy", type: "edit" }, type: "editor" };
      }
    }
  }

  if (
    context.isEditorTarget &&
    event.key === "Tab" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    return {
      action: {
        command: { type: event.shiftKey ? "outdentList" : "indentList" },
        type: "paragraph",
      },
      type: "editor",
    };
  }

  if (!context.isEditorTarget) {
    return null;
  }

  const editorAction = getEditorShortcutAction(event);

  return editorAction && editorAction.type !== "find"
    ? { action: editorAction, type: "editor" }
    : null;
}
