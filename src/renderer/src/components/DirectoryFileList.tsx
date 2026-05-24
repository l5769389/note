import { FileText } from "lucide-react";
import { useMemo, type MouseEvent as ReactMouseEvent } from "react";
import {
  isDrawingDocument,
  isExcelDocument,
  isPdfDocument,
  isSheetDocument,
  isWordDocument,
} from "../documentModel";
import type { DirectoryTreeItem, MarkdownDocument } from "../types";
import {
  formatRecentTimestamp,
  getDirectoryDisplayPath,
  normalizeFilePathKey,
} from "../workspaceDisplay";
import { isQuickDocumentLinkShortcut } from "../workspaceShortcuts";

type DirectoryFileListItem = {
  directoryLabel: string;
  document?: MarkdownDocument;
  name: string;
  path: string;
};

function stripMarkdownForFilePreview(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFileListPreview(document?: MarkdownDocument) {
  if (!document) {
    return "";
  }

  if (isPdfDocument(document)) {
    return "PDF 文档 · 只读预览";
  }

  if (isWordDocument(document)) {
    return "Word 文档 · 只读预览";
  }

  if (isExcelDocument(document)) {
    return "Excel 表格 · 只读预览";
  }

  if (isSheetDocument(document)) {
    return "在线表格 · 可打开编辑";
  }

  if (isDrawingDocument(document)) {
    return "Excalidraw 画板 · 可打开编辑";
  }

  return stripMarkdownForFilePreview(document.content);
}

function collectDirectoryFiles(
  documents: MarkdownDocument[],
  items: DirectoryTreeItem[],
  workspacePath?: string,
): DirectoryFileListItem[] {
  const documentsByPath = new Map(
    documents
      .filter((document) => document.filePath)
      .map((document) => [normalizeFilePathKey(document.filePath), document]),
  );

  return collectDirectoryFilesWithDocumentMap(
    documentsByPath,
    items,
    workspacePath,
  ).sort((left, right) =>
    `${left.directoryLabel}/${left.name}`.localeCompare(
      `${right.directoryLabel}/${right.name}`,
      "zh-CN",
      { numeric: true },
    ),
  );
}

function collectDirectoryFilesWithDocumentMap(
  documentsByPath: Map<string, MarkdownDocument>,
  items: DirectoryTreeItem[],
  workspacePath?: string,
): DirectoryFileListItem[] {
  return items.flatMap((item): DirectoryFileListItem[] =>
    item.type === "directory"
      ? collectDirectoryFilesWithDocumentMap(
          documentsByPath,
          item.children ?? [],
          workspacePath,
        )
      : [
          {
            directoryLabel: getDirectoryDisplayPath(item.path, workspacePath),
            document: documentsByPath.get(normalizeFilePathKey(item.path)),
            name: item.name,
            path: item.path,
          },
        ],
  );
}

type DirectoryFileListProps = {
  activeFilePath?: string;
  documents: MarkdownDocument[];
  emptyLabel?: string;
  items: DirectoryTreeItem[];
  onFileContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    filePath: string,
  ) => void;
  onOpenFile: (filePath: string) => void;
  onQuickLinkFile?: (filePath: string) => void;
  workspacePath?: string;
};

export function DirectoryFileList({
  activeFilePath,
  documents,
  emptyLabel = "当前目录中没有文件",
  items,
  onFileContextMenu,
  onOpenFile,
  onQuickLinkFile,
  workspacePath,
}: DirectoryFileListProps) {
  const files = useMemo(
    () => collectDirectoryFiles(documents, items, workspacePath),
    [documents, items, workspacePath],
  );

  if (!files.length) {
    return <div className="directory-tree-empty">{emptyLabel}</div>;
  }

  return (
    <div className="directory-file-list">
      {files.map((file) => {
        const preview = getFileListPreview(file.document);

        return (
          <button
            className={
              file.path === activeFilePath
                ? "directory-file-list-item directory-file-list-item-active"
                : "directory-file-list-item"
            }
            key={file.path}
            title={file.name}
            type="button"
            onClick={() => onOpenFile(file.path)}
            onContextMenu={(event) => onFileContextMenu?.(event, file.path)}
            onKeyDown={(event) => {
              if (!isQuickDocumentLinkShortcut(event)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              onQuickLinkFile?.(file.path);
            }}
          >
            <FileText size={17} />
            <span className="directory-file-list-text">
              <span className="directory-file-list-title">{file.name}</span>
              {file.directoryLabel ? (
                <span className="directory-file-list-meta">
                  {file.directoryLabel}
                </span>
              ) : null}
              {preview ? (
                <span className="directory-file-list-preview">{preview}</span>
              ) : null}
            </span>
            {file.document?.updatedAt ? (
              <time dateTime={file.document.updatedAt}>
                {formatRecentTimestamp(file.document.updatedAt)}
              </time>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
