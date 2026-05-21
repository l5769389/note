import { describe, expect, it } from "vitest";
import {
  getSelectAllShortcutScope,
  getAppShortcutAction,
  getEditorShortcutAction,
  isAppShortcutModifier,
  isSelectAllShortcut,
  selectAllContentScopeSelector,
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

function shortcutTarget(scope: "content" | "input" | "none") {
  return {
    closest(selector: string) {
      if (scope === "input" && selector.includes("input")) {
        return {};
      }

      if (scope === "content" && selector === selectAllContentScopeSelector) {
        return {};
      }

      return null;
    },
  } as unknown as EventTarget;
}

describe("getEditorShortcutAction", () => {
  it("recognizes application shortcut modifiers", () => {
    expect(isAppShortcutModifier(shortcut({ ctrlKey: true }))).toBe(true);
    expect(isAppShortcutModifier(shortcut({ metaKey: true }))).toBe(true);
    expect(
      isAppShortcutModifier(shortcut({ ctrlKey: true, metaKey: true })),
    ).toBe(false);
  });

  it("recognizes scoped select-all shortcuts", () => {
    expect(isSelectAllShortcut(shortcut({ ctrlKey: true, key: "a" }))).toBe(
      true,
    );
    expect(isSelectAllShortcut(shortcut({ metaKey: true, key: "A" }))).toBe(
      true,
    );
    expect(
      isSelectAllShortcut(shortcut({ ctrlKey: true, key: "a", shiftKey: true })),
    ).toBe(false);
    expect(
      isSelectAllShortcut(shortcut({ ctrlKey: true, isComposing: true, key: "a" })),
    ).toBe(false);
  });

  it("classifies where Ctrl+A may run", () => {
    expect(getSelectAllShortcutScope(shortcutTarget("input"))).toBe("input");
    expect(getSelectAllShortcutScope(shortcutTarget("content"))).toBe("content");
    expect(getSelectAllShortcutScope(shortcutTarget("none"))).toBe("blocked");
    expect(getSelectAllShortcutScope(null)).toBe("blocked");
  });

  it("maps format shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "b" }))).toEqual({
      command: { type: "bold" },
      type: "format",
    });
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "I" }))).toEqual({
      command: { type: "italic" },
      type: "format",
    });
    expect(getEditorShortcutAction(shortcut({ metaKey: true, key: "b" }))).toEqual({
      command: { type: "bold" },
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

  it("maps find and replace shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "f" }))).toEqual({
      type: "find",
    });
    expect(getEditorShortcutAction(shortcut({ ctrlKey: true, key: "H" }))).toEqual({
      replace: true,
      type: "find",
    });
    expect(
      getEditorShortcutAction(shortcut({ ctrlKey: true, key: "F", shiftKey: true })),
    ).toBeNull();
  });

  it("ignores unrelated shortcuts", () => {
    expect(getEditorShortcutAction(shortcut({ key: "b" }))).toBeNull();
    expect(
      getEditorShortcutAction(shortcut({ ctrlKey: true, metaKey: true, key: "b" })),
    ).toBeNull();
  });
});

describe("getAppShortcutAction", () => {
  it.each([
    ["Ctrl+N", { ctrlKey: true, key: "n" }, { command: "newMarkdownDocument", type: "file" }],
    ["Ctrl+Shift+N", { ctrlKey: true, key: "N", shiftKey: true }, { command: "newWindow", type: "file" }],
    ["Ctrl+O", { ctrlKey: true, key: "o" }, { command: "openDocument", type: "file" }],
    ["Ctrl+S", { ctrlKey: true, key: "s" }, { command: "save", type: "file" }],
    ["Ctrl+Shift+S", { ctrlKey: true, key: "S", shiftKey: true }, { command: "saveAs", type: "file" }],
  ] as const)("maps file shortcut %s", (_, event, action) => {
    expect(getAppShortcutAction(shortcut(event))).toEqual(action);
  });

  it("does not expose the settings shortcut", () => {
    expect(
      getAppShortcutAction(shortcut({ code: "Comma", ctrlKey: true, key: "," })),
    ).toBeNull();
  });

  it.each([
    ["F11", { key: "F11" }, { command: "toggleFullScreen", type: "view" }, {}],
    ["Escape in fullscreen", { key: "Escape" }, { command: "exitFullScreen", type: "view" }, { isFullScreen: true }],
    ["Ctrl+Shift+L", { ctrlKey: true, key: "L", shiftKey: true }, { command: "toggleSidebar", type: "view" }, {}],
    ["Ctrl+Shift+1", { code: "Digit1", ctrlKey: true, key: "!", shiftKey: true }, { command: "showOutline", type: "view" }, {}],
    ["Ctrl+Shift+2", { code: "Digit2", ctrlKey: true, key: "@", shiftKey: true }, { command: "showDocuments", type: "view" }, {}],
    ["Ctrl+Shift+3", { code: "Digit3", ctrlKey: true, key: "#", shiftKey: true }, { command: "showFiles", type: "view" }, {}],
    ["Ctrl+Shift+9", { code: "Digit9", ctrlKey: true, key: "(", shiftKey: true }, { command: "resetZoom", type: "view" }, {}],
    ["Ctrl+Shift+=", { code: "Equal", ctrlKey: true, key: "+", shiftKey: true }, { command: "zoomIn", type: "view" }, {}],
    ["Ctrl+Shift+= on layouts reporting =", { code: "Equal", ctrlKey: true, key: "=", shiftKey: true }, { command: "zoomIn", type: "view" }, {}],
    ["Ctrl+NumpadAdd", { code: "NumpadAdd", ctrlKey: true, key: "+" }, { command: "zoomIn", type: "view" }, {}],
    ["Ctrl+Shift+-", { code: "Minus", ctrlKey: true, key: "_", shiftKey: true }, { command: "zoomOut", type: "view" }, {}],
    ["Ctrl+Shift+- on layouts reporting -", { code: "Minus", ctrlKey: true, key: "-", shiftKey: true }, { command: "zoomOut", type: "view" }, {}],
    ["Ctrl+NumpadSubtract", { code: "NumpadSubtract", ctrlKey: true, key: "-" }, { command: "zoomOut", type: "view" }, {}],
    ["Ctrl+Numpad0", { code: "Numpad0", ctrlKey: true, key: "0" }, { command: "resetZoom", type: "view" }, {}],
    ["Ctrl+Shift+F", { ctrlKey: true, key: "F", shiftKey: true }, { command: "workspaceSearch", type: "view" }, {}],
  ] as const)("maps view shortcut %s", (_, event, action, context) => {
    expect(getAppShortcutAction(shortcut(event), context)).toEqual(action);
  });

  it.each([
    ["Ctrl+F", { ctrlKey: true, key: "f" }, { type: "find" }],
    ["Ctrl+H", { ctrlKey: true, key: "h" }, { replace: true, type: "find" }],
  ] as const)("maps document find shortcut %s", (_, event, action) => {
    expect(getAppShortcutAction(shortcut(event))).toEqual(action);
  });

  it.each([
    ["Ctrl+Z", { ctrlKey: true, key: "z" }, { action: { command: "undo", type: "edit" }, type: "editor" }],
    ["Ctrl+Y", { ctrlKey: true, key: "y" }, { action: { command: "redo", type: "edit" }, type: "editor" }],
    ["Ctrl+X", { ctrlKey: true, key: "x" }, { action: { command: "cut", type: "edit" }, type: "editor" }],
    ["Ctrl+C", { ctrlKey: true, key: "c" }, { action: { command: "copy", type: "edit" }, type: "editor" }],
    ["Ctrl+B", { ctrlKey: true, key: "b" }, { action: { command: { type: "bold" }, type: "format" }, type: "editor" }],
    ["Ctrl+I", { ctrlKey: true, key: "i" }, { action: { command: { type: "italic" }, type: "format" }, type: "editor" }],
    ["Ctrl+U", { ctrlKey: true, key: "u" }, { action: { command: { type: "underline" }, type: "format" }, type: "editor" }],
    ["Ctrl+K", { ctrlKey: true, key: "k" }, { action: { type: "createLink" }, type: "editor" }],
    ["Ctrl+\\", { ctrlKey: true, key: "\\" }, { action: { command: { type: "clearStyle" }, type: "format" }, type: "editor" }],
    ["Ctrl+Shift+`", { code: "Backquote", ctrlKey: true, key: "`", shiftKey: true }, { action: { command: { type: "inlineCode" }, type: "format" }, type: "editor" }],
    ["Alt+Shift+5", { altKey: true, code: "Digit5", key: "%", shiftKey: true }, { action: { command: { type: "strikethrough" }, type: "format" }, type: "editor" }],
    ["Alt+ArrowUp", { altKey: true, key: "ArrowUp" }, { action: { command: "moveLineUp", type: "edit" }, type: "editor" }],
    ["Alt+ArrowDown", { altKey: true, key: "ArrowDown" }, { action: { command: "moveLineDown", type: "edit" }, type: "editor" }],
    ["Tab", { key: "Tab" }, { action: { command: { type: "indentList" }, type: "paragraph" }, type: "editor" }],
    ["Shift+Tab", { key: "Tab", shiftKey: true }, { action: { command: { type: "outdentList" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+1", { ctrlKey: true, key: "1" }, { action: { command: { level: 1, type: "heading" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+6", { ctrlKey: true, key: "6" }, { action: { command: { level: 6, type: "heading" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+0", { ctrlKey: true, key: "0" }, { action: { command: { type: "paragraph" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+=", { ctrlKey: true, key: "=" }, { action: { command: { type: "promoteHeading" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+-", { ctrlKey: true, key: "-" }, { action: { command: { type: "demoteHeading" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+M", { ctrlKey: true, key: "M", shiftKey: true }, { action: { command: { type: "mathBlock" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+K", { ctrlKey: true, key: "K", shiftKey: true }, { action: { command: { type: "codeBlock" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+Q", { ctrlKey: true, key: "Q", shiftKey: true }, { action: { command: { type: "blockquote" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+[", { ctrlKey: true, key: "[", shiftKey: true }, { action: { command: { type: "orderedList" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+]", { ctrlKey: true, key: "]", shiftKey: true }, { action: { command: { type: "bulletList" }, type: "paragraph" }, type: "editor" }],
    ["Ctrl+Shift+X", { ctrlKey: true, key: "X", shiftKey: true }, { action: { command: { type: "taskList" }, type: "paragraph" }, type: "editor" }],
  ] as const)("maps editor shortcut %s only in editor context", (_, event, action) => {
    expect(
      getAppShortcutAction(shortcut(event), { isEditorTarget: true }),
    ).toEqual(action);
  });

  it.each([
    ["Ctrl+B", { ctrlKey: true, key: "b" }],
    ["Ctrl+1", { ctrlKey: true, key: "1" }],
    ["Alt+ArrowUp", { altKey: true, key: "ArrowUp" }],
    ["Tab", { key: "Tab" }],
  ] as const)("ignores editor shortcut %s outside editor context", (_, event) => {
    expect(getAppShortcutAction(shortcut(event))).toBeNull();
  });

  it.each([
    ["composing Ctrl+S", { ctrlKey: true, isComposing: true, key: "s" }],
    ["Ctrl+Meta+S", { ctrlKey: true, key: "s", metaKey: true }],
    ["Ctrl+Alt+S", { altKey: true, ctrlKey: true, key: "s" }],
    ["Ctrl+Alt+H", { altKey: true, ctrlKey: true, key: "h" }],
    ["Ctrl+A", { ctrlKey: true, key: "a" }],
    ["Ctrl+V", { ctrlKey: true, key: "v" }],
    ["Escape outside fullscreen", { key: "Escape" }],
    ["Ctrl+Shift+4", { code: "Digit4", ctrlKey: true, key: "$", shiftKey: true }],
  ] as const)("ignores reserved or invalid shortcut %s", (_, event) => {
    expect(
      getAppShortcutAction(shortcut(event), { isEditorTarget: true }),
    ).toBeNull();
  });

  it("prioritizes workspace search over editor find for Ctrl+Shift+F", () => {
    expect(
      getAppShortcutAction(
        shortcut({ ctrlKey: true, key: "F", shiftKey: true }),
        { isEditorTarget: true },
      ),
    ).toEqual({
      command: "workspaceSearch",
      type: "view",
    });
  });
});
