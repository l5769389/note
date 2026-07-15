import {
  isDiaryDocumentContent,
  isPathInsideDiaryRoot,
} from "./diaryModel";
import type { MarkdownDocument } from "./types";
import { normalizeFilePathKey } from "./workspaceDisplay";

export function getRecentDocumentVisibilityKey(document: MarkdownDocument) {
  return document.filePath
    ? `file:${normalizeFilePathKey(document.filePath)}`
    : `document:${document.id}`;
}

export function shouldShowInRecentDocuments(
  document: MarkdownDocument,
  workspacePath: string | undefined,
  hiddenRecentDocumentKeys: ReadonlySet<string>,
) {
  return (
    !hiddenRecentDocumentKeys.has(getRecentDocumentVisibilityKey(document)) &&
    !isPathInsideDiaryRoot(document.filePath, workspacePath) &&
    !isDiaryDocumentContent(document.content)
  );
}
