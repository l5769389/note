import {
  getExcalidrawDrawingId,
  getExcalidrawSceneReference,
  parseImageMeta,
  serializeImageMeta,
} from "./imageMeta";
import type { DrawingAsset, MarkdownDocument } from "./types";

export const defaultExcalidrawPreviewWidth = 640;

export type ExcalidrawMarkdownImage = {
  alt: string;
  sceneReference: string | null;
  src: string;
  title?: string;
};

export function createDefaultExcalidrawScene() {
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
        currentItemFontFamily: 1,
      },
      files: {},
    },
    null,
    2,
  );
}

export function createDrawingAssetFromDocument(
  document: MarkdownDocument,
): DrawingAsset {
  return {
    id: document.id,
    name: document.title || "Excalidraw",
    dataUrl: "",
    sceneJSON: document.content || createDefaultExcalidrawScene(),
    createdAt: document.createdAt,
  };
}

export function findExcalidrawMarkdownImage(
  content: string,
  drawingId: string,
): ExcalidrawMarkdownImage | null {
  const imagePattern = /!\[([^\]]*)]\((\S+?)(?:\s+"([^"]*)")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(content))) {
    const title = match[3];

    if (getExcalidrawDrawingId(title) === drawingId) {
      return {
        alt: match[1] ?? "",
        src: match[2] ?? "",
        title,
        sceneReference: getExcalidrawSceneReference(title),
      };
    }
  }

  return null;
}

export function createExcalidrawImageTitle(
  drawingId: string,
  sceneReference: string | null,
  previousTitle?: string,
) {
  const meta = parseImageMeta(previousTitle);
  const titleText = [
    meta.titleText
      .replace(/(?:^|\s)excalidraw:[^\s"]+(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)scene=[^\s"]+(?=\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
    `excalidraw:${drawingId}`,
    sceneReference ? `scene=${sceneReference}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return serializeImageMeta({
    ...meta,
    align: previousTitle ? meta.align : "center",
    titleText,
    width: meta.width ?? defaultExcalidrawPreviewWidth,
  });
}
