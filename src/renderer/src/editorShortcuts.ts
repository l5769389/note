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
  | { type: "createLink" };

export type EditorShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

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

  if (!event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }

  if (!event.shiftKey && event.key.toLowerCase() === "f") {
    return { type: "find" };
  }

  if (!event.shiftKey && event.key.toLowerCase() === "h") {
    return { replace: true, type: "find" };
  }

  if (event.shiftKey && event.key.toLowerCase() === "f") {
    return { type: "find" };
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
