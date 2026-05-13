import { describe, expect, it } from "vitest";
import {
  getEditorShortcutAction,
  type EditorShortcutEvent,
} from "../editorShortcuts";

function shortcut(
  overrides: Partial<EditorShortcutEvent>,
): EditorShortcutEvent {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("getEditorShortcutAction", () => {
  it("maps format shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "b" }))).toEqual({
      command: { type: "bold" },
      type: "format",
    });
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "I" }))).toEqual({
      command: { type: "italic" },
      type: "format",
    });
    expect(
      getEditorShortcutAction(
        shortcut({ code: "Backquote", ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      command: { type: "inlineCode" },
      type: "format",
    });
    expect(
      getEditorShortcutAction(
        shortcut({ altKey: true, code: "Digit5", key: "%", shiftKey: true }),
      ),
    ).toEqual({
      command: { type: "strikethrough" },
      type: "format",
    });
  });

  it("maps paragraph shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "2" }))).toEqual({
      command: { level: 2, type: "heading" },
      type: "paragraph",
    });
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "0" }))).toEqual({
      command: { type: "paragraph" },
      type: "paragraph",
    });
    expect(
      getEditorShortcutAction(shortcut({ ctrlKey: true, key: "K", shiftKey: true })),
    ).toEqual({
      command: { type: "codeBlock" },
      type: "paragraph",
    });
    expect(
      getEditorShortcutAction(shortcut({ ctrlKey: true, key: "]", shiftKey: true })),
    ).toEqual({
      command: { type: "bulletList" },
      type: "paragraph",
    });
  });

  it("maps edit and link shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ altKey: true, key: "ArrowUp" }))).toEqual({
      command: "moveLineUp",
      type: "edit",
    });
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "k" }))).toEqual({
      type: "createLink",
    });
  });

  it("ignores unrelated shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ key: "b" }))).toBeNull();
    expect(
      getEditorShortcutAction(shortcut({ ctrlKey: true, metaKey: true, key: "b" })),
    ).toBeNull();
  });
});
