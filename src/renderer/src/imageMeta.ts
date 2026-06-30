import type { ImageAlignment, ImageFitMode } from "./editorCommands";

export const minImageWidth = 120;
export const maxImageWidth = 900;

export type ImageMeta = {
  align: ImageAlignment;
  fit: ImageFitMode;
  hasExplicitAlign: boolean;
  hasExplicitFit: boolean;
  titleText: string;
  width?: number;
};

const excalidrawTitlePattern = /(?:^|\s)excalidraw:([^\s"]+)(?=\s|$)/i;
const excalidrawScenePattern = /(?:^|\s)scene=([^\s"]+)(?=\s|$)/i;

export function clampImageWidth(width: number) {
  return Math.max(minImageWidth, Math.min(maxImageWidth, Math.round(width)));
}

export function parseImageMeta(title?: string): ImageMeta {
  let titleText = title?.trim() ?? "";
  const widthMatch = titleText.match(/(?:^|\s)width=(\d{2,4})(?:px)?(?=\s|$)/i);
  const alignMatch = titleText.match(/(?:^|\s)align=(left|center|right)(?=\s|$)/i);
  const fitMatch = titleText.match(/(?:^|\s)fit=(auto|contain|cover)(?=\s|$)/i);
  const width = widthMatch ? clampImageWidth(Number(widthMatch[1])) : undefined;
  const align = (alignMatch?.[1]?.toLowerCase() as ImageAlignment | undefined) ?? "left";
  const fit = (fitMatch?.[1]?.toLowerCase() as ImageFitMode | undefined) ?? "auto";
  const hasExplicitAlign = Boolean(alignMatch);
  const hasExplicitFit = Boolean(fitMatch);

  titleText = titleText
    .replace(/(?:^|\s)width=\d{2,4}(?:px)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)align=(left|center|right)(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)fit=(auto|contain|cover)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { align, fit, hasExplicitAlign, hasExplicitFit, titleText, width };
}

export function serializeImageMeta(meta: ImageMeta) {
  return [
    meta.titleText,
    meta.width ? `width=${clampImageWidth(meta.width)}` : "",
    meta.hasExplicitAlign ? `align=${meta.align}` : "",
    meta.hasExplicitFit && meta.fit !== "auto" ? `fit=${meta.fit}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getExcalidrawDrawingId(title?: string) {
  return parseImageMeta(title).titleText.match(excalidrawTitlePattern)?.[1] ?? null;
}

export function getExcalidrawSceneReference(title?: string) {
  return parseImageMeta(title).titleText.match(excalidrawScenePattern)?.[1] ?? null;
}

export function patchExcalidrawSceneReference(
  title: string | undefined,
  sceneReference: string,
) {
  const currentMeta = parseImageMeta(title);
  const titleText = currentMeta.titleText.match(excalidrawScenePattern)
    ? currentMeta.titleText.replace(excalidrawScenePattern, ` scene=${sceneReference}`)
    : `${currentMeta.titleText} scene=${sceneReference}`;

  return serializeImageMeta({
    ...currentMeta,
    titleText: titleText.replace(/\s+/g, " ").trim(),
  });
}

export function patchImageMetaTitle(
  title: string | undefined,
  patch: Partial<Pick<ImageMeta, "align" | "fit" | "width">>,
) {
  const currentMeta = parseImageMeta(title);
  const hasExplicitAlign = patch.align !== undefined
    ? true
    : currentMeta.hasExplicitAlign;
  const hasExplicitFit = patch.fit !== undefined
    ? patch.fit !== "auto"
    : currentMeta.hasExplicitFit;
  const nextMeta: ImageMeta = {
    ...currentMeta,
    align: patch.align ?? currentMeta.align,
    fit: patch.fit ?? currentMeta.fit,
    hasExplicitAlign,
    hasExplicitFit,
    width: Object.prototype.hasOwnProperty.call(patch, "width")
      ? patch.width === undefined
        ? undefined
        : clampImageWidth(patch.width)
      : currentMeta.width,
  };

  return serializeImageMeta(nextMeta);
}
