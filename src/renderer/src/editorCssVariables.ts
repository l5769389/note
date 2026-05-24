import { useEffect } from "react";
import {
  getAdjustedEditorFontSize,
  getEditorCodeFontFamily,
  getEditorContentDensityStyle,
  getEditorFontFamily,
  type AppSettings,
} from "./appSettings";

export function getEditorCssVariables(settings: AppSettings) {
  const contentDensity = getEditorContentDensityStyle(
    settings.editorContentDensity,
  );

  return {
    "--editor-block-margin": contentDensity.blockMargin,
    "--editor-code-block-margin": contentDensity.codeBlockMargin,
    "--editor-code-font-family": getEditorCodeFontFamily(
      settings.editorCodeFontFamily,
    ),
    "--editor-content-width": contentDensity.contentWidth,
    "--editor-font-family": getEditorFontFamily(settings.editorFontFamily),
    "--editor-font-size": getAdjustedEditorFontSize(
      contentDensity.fontSize,
      settings.editorFontSizeAdjustment,
    ),
    "--editor-line-height": contentDensity.lineHeight,
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
