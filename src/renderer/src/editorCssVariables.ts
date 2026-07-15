import { useEffect } from "react";
import {
  getAdjustedEditorFontSize,
  getDiaryFontFamily,
  getDiaryFontSize,
  getDiaryLineHeight,
  getEditorCodeFontFamily,
  getEditorContentWidth,
  getEditorContentDensityStyle,
  getEditorFontFamily,
  getEditorFontSize,
  getEditorLineHeight,
  type AppSettings,
} from "./appSettings";

export function getEditorCssVariables(settings: AppSettings) {
  const contentDensity = getEditorContentDensityStyle(
    settings.editorContentDensity,
  );
  const contentWidth =
    settings.editorContentWidth === "theme"
      ? contentDensity.contentWidth
      : getEditorContentWidth(settings.editorContentWidth);
  const fontSize =
    settings.editorFontSize === "theme"
      ? contentDensity.fontSize
      : getEditorFontSize(settings.editorFontSize);
  const lineHeight =
    settings.editorLineHeight === "theme"
      ? contentDensity.lineHeight
      : getEditorLineHeight(settings.editorLineHeight);

  return {
    "--diary-editor-font-family": getDiaryFontFamily(settings.diaryFontFamily),
    "--diary-editor-font-size": getDiaryFontSize(settings.diaryFontSize),
    "--diary-editor-line-height": getDiaryLineHeight(settings.diaryLineHeight),
    "--editor-block-margin": contentDensity.blockMargin,
    "--editor-code-block-margin": contentDensity.codeBlockMargin,
    "--editor-code-font-family": getEditorCodeFontFamily(
      settings.editorCodeFontFamily,
    ),
    "--editor-content-width": contentWidth,
    "--editor-font-family": getEditorFontFamily(settings.editorFontFamily),
    "--editor-font-size": getAdjustedEditorFontSize(
      fontSize,
      settings.editorFontSizeAdjustment,
    ),
    "--editor-line-height": lineHeight,
    "--editor-list-margin": contentDensity.listMargin,
    "--editor-paragraph-margin": contentDensity.paragraphMargin,
    "--editor-table-cell-padding": contentDensity.tableCellPadding,
  };
}

export function applyEditorCssVariables(
  style: CSSStyleDeclaration,
  settings: AppSettings,
) {
  Object.entries(getEditorCssVariables(settings)).forEach(([key, value]) => {
    style.setProperty(key, value);
  });
}

export function useEditorCssVariables(settings: AppSettings) {
  useEffect(() => {
    applyEditorCssVariables(document.documentElement.style, settings);
  }, [settings]);
}
