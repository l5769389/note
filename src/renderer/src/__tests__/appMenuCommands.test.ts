import { describe, expect, it } from "vitest";
import { getShortcutActionForAppMenuCommand } from "../appMenuCommands";

describe("app menu command routing", () => {
  it("maps core file commands to existing shortcut actions", () => {
    expect(getShortcutActionForAppMenuCommand("file:new-markdown")).toEqual({
      command: "newMarkdownDocument",
      type: "file",
    });
    expect(getShortcutActionForAppMenuCommand("file:open")).toEqual({
      command: "openDocument",
      type: "file",
    });
    expect(getShortcutActionForAppMenuCommand("file:save")).toEqual({
      command: "save",
      type: "file",
    });
  });

  it("maps core edit, paragraph, format, and view commands", () => {
    expect(getShortcutActionForAppMenuCommand("edit:undo")).toEqual({
      action: { command: "undo", type: "edit" },
      type: "editor",
    });
    expect(getShortcutActionForAppMenuCommand("paragraph:heading-2")).toEqual({
      action: { command: { level: 2, type: "heading" }, type: "paragraph" },
      type: "editor",
    });
    expect(getShortcutActionForAppMenuCommand("format:bold")).toEqual({
      action: { command: { type: "bold" }, type: "format" },
      type: "editor",
    });
    expect(getShortcutActionForAppMenuCommand("view:toggle-sidebar")).toEqual({
      command: "toggleSidebar",
      type: "view",
    });
  });

  it("leaves menu-only commands for App.tsx handlers", () => {
    expect(getShortcutActionForAppMenuCommand("app:about")).toBeNull();
    expect(getShortcutActionForAppMenuCommand("file:open-folder")).toBeNull();
    expect(getShortcutActionForAppMenuCommand("theme:set:dark")).toBeNull();
  });
});
