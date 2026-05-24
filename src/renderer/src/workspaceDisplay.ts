import { getDocumentType } from "./documentModel";
import { getDirectoryPath } from "./localPreviewUrls";
import type { MarkdownDocument } from "./types";

const recentTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
});
const recentDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatRecentTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = recentTimeFormatter.format(date);

  if (date.toDateString() === today.toDateString()) {
    return `今天 ${time}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${time}`;
  }

  return recentDateFormatter.format(date);
}

export function normalizeFilePathKey(filePath?: string) {
  return filePath?.replace(/\\/g, "/").toLowerCase() ?? "";
}

export function getDirectoryDisplayPath(filePath: string, workspacePath?: string) {
  const directoryPath = getDirectoryPath(filePath);

  if (!directoryPath) {
    return "";
  }

  const normalizedDirectoryPath = directoryPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedWorkspacePath = workspacePath?.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!normalizedWorkspacePath) {
    return normalizedDirectoryPath;
  }

  const lowerDirectoryPath = normalizedDirectoryPath.toLowerCase();
  const lowerWorkspacePath = normalizedWorkspacePath.toLowerCase();

  if (lowerDirectoryPath === lowerWorkspacePath) {
    return "";
  }

  if (lowerDirectoryPath.startsWith(`${lowerWorkspacePath}/`)) {
    return normalizedDirectoryPath.slice(normalizedWorkspacePath.length + 1);
  }

  return normalizedDirectoryPath;
}

export function getPathLabel(path?: string) {
  if (!path) {
    return "Desktop";
  }

  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

export function getDocumentTypeName(type: MarkdownDocument["documentType"]) {
  switch (type) {
    case "drawing":
      return "Excalidraw";
    case "excel":
      return "Excel";
    case "html":
      return "HTML";
    case "pdf":
      return "PDF";
    case "sheet":
      return "在线表格";
    case "word":
      return "Word";
    case "markdown":
    default:
      return "Markdown";
  }
}

export function getDocumentTypeLabel(document: MarkdownDocument) {
  return getDocumentTypeName(getDocumentType(document));
}
