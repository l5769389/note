import { getExcalidrawDrawingId } from "./imageMeta";
import { getDirectoryPath } from "./localPreviewUrls";
import { createDocument } from "./storage";
import type {
  DocumentType,
  DrawingAsset,
  LocalMarkdownFile,
  MarkdownDocument,
  WorkspaceSnapshot,
} from "./types";

export function updateDocument(
  snapshot: WorkspaceSnapshot,
  document: MarkdownDocument,
): WorkspaceSnapshot {
  return {
    ...snapshot,
    documents: snapshot.documents.map((item) =>
      item.id === document.id ? document : item,
    ),
  };
}

export function replaceExcalidrawImagePreview(
  content: string,
  asset: DrawingAsset,
) {
  const imagePattern = /!\[([^\]]*)]\((\S+?)(?:\s+"([^"]*)")?\)/g;

  return content.replace(imagePattern, (match, alt: string, _src: string, title?: string) => {
    if (getExcalidrawDrawingId(title) !== asset.id) {
      return match;
    }

    const nextTitle = title?.trim() || `excalidraw:${asset.id} align=left`;

    return `![${alt || asset.name}](${asset.dataUrl} "${nextTitle}")`;
  });
}

export function getDocumentPathPreview(
  document: MarkdownDocument,
  workspacePath?: string,
) {
  const directoryPath = getDirectoryPath(document.filePath) || workspacePath || "D:";
  const normalizedPath = directoryPath.replace(/\\/g, "/");

  return normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
}

export function getFileExtension(filePath?: string) {
  return filePath?.match(/\.([^.\\/]+)$/)?.[0]?.toLowerCase();
}

export function getDocumentTypeFromPath(filePath?: string): DocumentType {
  if (filePath && /\.html?$/i.test(filePath)) {
    return "html";
  }

  if (filePath && /\.pdf$/i.test(filePath)) {
    return "pdf";
  }

  if (filePath && /\.docx$/i.test(filePath)) {
    return "word";
  }

  if (filePath && /\.univer$/i.test(filePath)) {
    return "sheet";
  }

  if (filePath && /\.excalidraw$/i.test(filePath)) {
    return "drawing";
  }

  return "markdown";
}

export function getDocumentType(
  document?: MarkdownDocument | null,
): DocumentType {
  return document?.documentType ?? getDocumentTypeFromPath(document?.filePath);
}

export function isMarkdownDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "markdown";
}

export function isHtmlDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "html";
}

export function isPdfDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "pdf";
}

export function isWordDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "word";
}

export function isSheetDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "sheet";
}

export function isDrawingDocument(document?: MarkdownDocument | null) {
  return Boolean(document) && getDocumentType(document) === "drawing";
}

export function getDocumentFileExtension(document: MarkdownDocument) {
  return (
    document.fileExtension ??
    getFileExtension(document.filePath) ??
    (isHtmlDocument(document)
      ? ".html"
      : isPdfDocument(document)
        ? ".pdf"
        : isWordDocument(document)
          ? ".docx"
          : isSheetDocument(document)
            ? ".univer"
            : isDrawingDocument(document)
              ? ".excalidraw"
              : ".md")
  );
}

export function getDocumentDisplayName(document: MarkdownDocument) {
  const extension = getDocumentFileExtension(document);
  const title = document.title || "Untitled";

  return title.toLowerCase().endsWith(extension.toLowerCase())
    ? title
    : `${title}${extension}`;
}

export function normalizeMarkdownTitle(value: string) {
  return value.trim().replace(/\.md$/i, "") || "Untitled";
}

export function createDocumentFromLocalFile(
  file: LocalMarkdownFile,
): MarkdownDocument {
  return {
    ...createDocument(
      file.title,
      file.content,
      file.filePath,
      file.documentType ?? getDocumentTypeFromPath(file.filePath),
      file.fileExtension ?? getFileExtension(file.filePath),
    ),
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export function mergeDocumentByFilePath(
  documents: MarkdownDocument[],
  document: MarkdownDocument,
) {
  const existingIndex = document.filePath
    ? documents.findIndex((item) => item.filePath === document.filePath)
    : -1;

  if (existingIndex < 0) {
    return [document, ...documents];
  }

  return documents.map((item, index) =>
    index === existingIndex ? { ...item, ...document, id: item.id } : item,
  );
}
