import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../appSettings";
import { getEditorCssVariables } from "../editorCssVariables";

describe("editor CSS variable helpers", () => {
  it("builds the editor variable map from app settings", () => {
    expect(
      getEditorCssVariables({
        ...defaultAppSettings,
        editorCodeFontFamily: "mono",
        editorContentDensity: "compact",
        editorFontFamily: "serif",
        editorFontSizeAdjustment: 2,
      }),
    ).toMatchObject({
      "--editor-code-font-family": expect.stringContaining("Consolas"),
      "--editor-content-width": "980px",
      "--editor-font-family": expect.stringContaining("Georgia"),
      "--editor-font-size": expect.stringContaining("+ 2px"),
    });
  });
});
