import {
  isDrawingDocument,
  isHtmlDocument,
  isMarkdownDocument,
  isSheetDocument,
} from "./documentModel";
import type { MarkdownDocument } from "./types";
import { normalizeFilePathKey } from "./workspaceDisplay";

export const internalFileWriteGraceMs = 8000;

export type InternalFileWriteSnapshot = {
  content: string;
  expiresAt: number;
};

export function createSavedFileContentByPath(documents: MarkdownDocument[]) {
  return new Map(
    documents
      .filter((document) => document.filePath)
      .map((document) => [document.filePath!, document.content]),
  );
}

export function isWritableTextDocument(document?: MarkdownDocument | null) {
  return (
    isMarkdownDocument(document) ||
    isHtmlDocument(document) ||
    isSheetDocument(document) ||
    isDrawingDocument(document)
  );
}

export function hasUnsavedFileContent(
  document: MarkdownDocument,
  savedFileContentByPath: Map<string, string>,
) {
  return Boolean(
    document.filePath &&
      isWritableTextDocument(document) &&
      savedFileContentByPath.get(document.filePath) !== document.content,
  );
}

export function getWritableDirtyDocuments({
  documents,
  externalConflictPaths,
  savedFileContentByPath,
}: {
  documents: MarkdownDocument[];
  externalConflictPaths: Set<string>;
  savedFileContentByPath: Map<string, string>;
}) {
  return documents.filter(
    (document) =>
      document.filePath &&
      !externalConflictPaths.has(normalizeFilePathKey(document.filePath)) &&
      hasUnsavedFileContent(document, savedFileContentByPath),
  );
}

export function pruneExpiredInternalFileWrites(
  internalFileWrites: Map<string, InternalFileWriteSnapshot>,
  now = Date.now(),
) {
  internalFileWrites.forEach((snapshot, fileKey) => {
    if (snapshot.expiresAt <= now) {
      internalFileWrites.delete(fileKey);
    }
  });
}

export function rememberInternalFileWrite(
  internalFileWrites: Map<string, InternalFileWriteSnapshot>,
  filePath: string,
  content: string,
  now = Date.now(),
) {
  const fileKey = normalizeFilePathKey(filePath);

  if (!fileKey) {
    return;
  }

  pruneExpiredInternalFileWrites(internalFileWrites, now);
  internalFileWrites.set(fileKey, {
    content,
    expiresAt: now + internalFileWriteGraceMs,
  });
}

export function isMatchingInternalFileWrite(
  internalFileWrites: Map<string, InternalFileWriteSnapshot>,
  filePath: string,
  content: string,
  now = Date.now(),
) {
  const fileKey = normalizeFilePathKey(filePath);

  if (!fileKey) {
    return false;
  }

  pruneExpiredInternalFileWrites(internalFileWrites, now);
  return internalFileWrites.get(fileKey)?.content === content;
}

export function acknowledgeSavedFileContent({
  content,
  documents,
  externalConflictPaths,
  filePath,
  savedFileContentByPath,
}: {
  content: string;
  documents: MarkdownDocument[];
  externalConflictPaths: Set<string>;
  filePath: string;
  savedFileContentByPath: Map<string, string>;
}) {
  const fileKey = normalizeFilePathKey(filePath);
  const knownDocumentPath = documents.find(
    (document) => normalizeFilePathKey(document.filePath) === fileKey,
  )?.filePath;

  savedFileContentByPath.set(filePath, content);
  if (knownDocumentPath && knownDocumentPath !== filePath) {
    savedFileContentByPath.set(knownDocumentPath, content);
  }
  externalConflictPaths.delete(fileKey);
}
