import { describe, expect, it } from "vitest";
import {
  isAlwaysAvailableAppShortcutAction,
  shouldBlockAppShortcutAction,
} from "../globalAppShortcuts";
import type { AppShortcutAction } from "../editorShortcuts";

describe("global app shortcut helpers", () => {
  it("keeps fullscreen and zoom shortcuts available above blocking UI", () => {
    const zoom: AppShortcutAction = { command: "zoomIn", type: "view" };
    const save: AppShortcutAction = { command: "save", type: "file" };

    expect(isAlwaysAvailableAppShortcutAction(zoom)).toBe(true);
    expect(isAlwaysAvailableAppShortcutAction(save)).toBe(false);
    expect(
      shouldBlockAppShortcutAction({
        action: zoom,
        isCreateFileOpen: true,
        isSettingsOpen: false,
        shouldIgnoreTarget: true,
      }),
    ).toBe(false);
  });

  it("blocks regular app shortcuts while dialogs or ignored targets are active", () => {
    const action: AppShortcutAction = { command: "save", type: "file" };

    expect(
      shouldBlockAppShortcutAction({
        action,
        isCreateFileOpen: false,
        isSettingsOpen: false,
        shouldIgnoreTarget: false,
      }),
    ).toBe(false);
    expect(
      shouldBlockAppShortcutAction({
        action,
        isCreateFileOpen: true,
        isSettingsOpen: false,
        shouldIgnoreTarget: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockAppShortcutAction({
        action,
        isCreateFileOpen: false,
        isSettingsOpen: true,
        shouldIgnoreTarget: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockAppShortcutAction({
        action,
        isCreateFileOpen: false,
        isSettingsOpen: false,
        shouldIgnoreTarget: true,
      }),
    ).toBe(true);
  });
});
