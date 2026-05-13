import type { ImageAlignment } from "./editorCommands";

export const minImageWidth = 120;
export const maxImageWidth = 900;

export type ImageMeta = {
  align: ImageAlignment;
  titleText: string;
  width?: number;
};

export function clampImageWidth(width: number) {
  return Math.max(minImageWidth, Math.min(maxImageWidth, Math.round(width)));
}

export function parseImageMeta(title?: string): ImageMeta {
  let titleText = title?.trim() ?? "";
  const widthMatch = titleText.match(/(?:^|\s)width=(\d{2,4})(?:px)?(?=\s|$)/i);
  const alignMatch = titleText.match(/(?:^|\s)align=(left|center|right)(?=\s|$)/i);
  const width = widthMatch ? clampImageWidth(Number(widthMatch[1])) : undefined;
  const align = (alignMatch?.[1]?.toLowerCase() as ImageAlignment | undefined) ?? "left";

  titleText = titleText
    .replace(/(?:^|\s)width=\d{2,4}(?:px)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)align=(left|center|right)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { align, titleText, width };
}

export function serializeImageMeta(meta: ImageMeta) {
  return [
    meta.titleText,
    meta.width ? `width=${clampImageWidth(meta.width)}` : "",
    `align=${meta.align}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function patchImageMetaTitle(
  title: string | undefined,
  patch: Partial<Pick<ImageMeta, "align" | "width">>,
) {
  const currentMeta = parseImageMeta(title);
  const nextMeta: ImageMeta = {
    ...currentMeta,
    align: patch.align ?? currentMeta.align,
    width: Object.prototype.hasOwnProperty.call(patch, "width")
      ? patch.width === undefined
        ? undefined
        : clampImageWidth(patch.width)
      : currentMeta.width,
  };

  return serializeImageMeta(nextMeta);
}
