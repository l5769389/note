import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../appSettings";
import { getEditorCssVariables } from "../editorCssVariables";

describe("editor CSS variable helpers", () => {
  it("uses the reading density width by default instead of a full-width layout", () => {
    expect(getEditorCssVariables(defaultAppSettings)).toMatchObject({
      "--editor-content-width": "820px",
    });
  });

  it("builds the editor variable map from app settings", () => {
    expect(
      getEditorCssVariables({
        ...defaultAppSettings,
        diaryFontFamily: "handwriting",
        diaryFontSize: "19px",
        diaryLineHeight: "2.15",
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
      "--diary-editor-font-family": expect.stringContaining("HanziPen"),
      "--diary-editor-font-size": "19px",
      "--diary-editor-line-height": "2.15",
    });
  });

  it("uses explicit typography values as overrides for the reading preset", () => {
    expect(
      getEditorCssVariables({
        ...defaultAppSettings,
        editorContentDensity: "comfortable",
        editorContentWidth: "1120px",
        editorFontSize: "16px",
        editorLineHeight: "2",
      }),
    ).toMatchObject({
      "--editor-content-width": "1120px",
      "--editor-font-size": "16px",
      "--editor-line-height": "2",
    });
  });
});
