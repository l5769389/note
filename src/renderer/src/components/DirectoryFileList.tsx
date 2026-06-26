import {
  useMemo,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { splitWorkspaceEntryNameForRename } from "../../../shared/workspaceRename";
import { DocumentFileIcon } from "./DocumentFileIcon";
import {
  getDocumentFileExtension,
  getDocumentTypeFromPath,
  isHtmlDocument,
  isMarkdownDocument,
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

const textPreviewLimit = 80;

function stripMarkdownForFilePreview(content: string) {
  return content
    .replace(/^---\s*[\s\S]*?\n---\s*/m, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/<\s*(?:img|video|source|iframe|object|embed)\b[^>]*>/gi, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^|\]]+)\|([^\]]+)]]/g, "$2")
    .replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/gm, " ")
    .replace(/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|avi|excalidraw|univer)(?:[?#][^\s)]*)?/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlForFilePreview(content: string) {
  return content
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*(?:img|video|source|iframe|object|embed)\b[^>]*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\S+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|avi)(?:[?#][^\s)]*)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncatePreview(value: string) {
  return value.length > textPreviewLimit
    ? `${value.slice(0, textPreviewLimit)}...`
    : value;
}

function getDocumentKindLabel(document?: MarkdownDocument, path?: string) {
  const documentType = document?.documentType ?? getDocumentTypeFromPath(path);

  switch (documentType) {
    case "html":
      return "HTML 文档";
    case "pdf":
      return "PDF 文档";
    case "word":
      return "Word 文档";
    case "excel":
      return "Excel 表格";
    case "sheet":
      return "在线表格";
    case "drawing":
      return "Excalidraw 画板";
    case "markdown":
    default:
      return "Markdown";
  }
}

function splitFileName(name: string, document?: MarkdownDocument) {
  const extension =
    document ? getDocumentFileExtension(document) : name.match(/(\.[^.]+)$/)?.[1] ?? "";

  if (!extension || !name.toLowerCase().endsWith(extension.toLowerCase())) {
    return { baseName: name, extension: "" };
  }

  return {
    baseName: name.slice(0, -extension.length) || name,
    extension,
  };
}

export function getFileListPreview(document?: MarkdownDocument) {
  if (!document) {
    return "";
  }

  if (isMarkdownDocument(document)) {
    return truncatePreview(stripMarkdownForFilePreview(document.content));
  }

  if (isHtmlDocument(document)) {
    return truncatePreview(stripHtmlForFilePreview(document.content));
  }

  return "";
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
  isSelectionMode?: boolean;
  items: DirectoryTreeItem[];
  onFileContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    filePath: string,
  ) => void;
  onFileDragStart?: (
    event: ReactDragEvent<HTMLButtonElement>,
    filePath: string,
  ) => void;
  onCancelRename?: (entryPath: string) => void;
  onCommitRename?: (entryPath: string) => void;
  onOpenFile: (filePath: string) => void;
  onQuickLinkFile?: (filePath: string) => void;
  onRenameDraftChange?: (value: string) => void;
  onToggleEntrySelection?: (item: DirectoryTreeItem) => void;
  renameDraft?: string;
  renamingEntryPath?: string;
  selectedEntryPaths?: Set<string>;
  workspacePath?: string;
};

export function DirectoryFileList({
  activeFilePath,
  documents,
  emptyLabel = "当前目录中没有文件",
  items,
  isSelectionMode = false,
  onFileContextMenu,
  onFileDragStart,
  onCancelRename,
  onCommitRename,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  renameDraft,
  renamingEntryPath,
  selectedEntryPaths,
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
        const selectionItem: DirectoryTreeItem = {
          name: file.name,
          path: file.path,
          type: "file",
        };
        const preview = getFileListPreview(file.document);
        const kindLabel = getDocumentKindLabel(file.document, file.path);
        const displayDetail = preview || kindLabel;
        const { baseName, extension } = splitFileName(file.name, file.document);
        const timestamp = file.document?.updatedAt || file.document?.createdAt;
        const isRenaming = renamingEntryPath === file.path;

        if (isRenaming) {
          const renameParts = splitWorkspaceEntryNameForRename(file.name, "file");
          const renameInputValue =
            renameDraft !== undefined ? renameDraft : renameParts.editableName;
          const handleRenameKeyDown = (
            event: ReactKeyboardEvent<HTMLInputElement>,
          ) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommitRename?.(file.path);
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename?.(file.path);
            }
          };

          return (
            <div
              className={
                file.path === activeFilePath
                  ? "directory-file-list-item directory-file-list-item-active directory-file-list-item-renaming"
                  : "directory-file-list-item directory-file-list-item-renaming"
              }
              key={file.path}
              title={file.name}
            >
              {isSelectionMode ? (
                <input
                  aria-label={`选择 ${file.name}`}
                  checked={selectedEntryPaths?.has(file.path) ?? false}
                  className="directory-entry-checkbox"
                  type="checkbox"
                  onChange={() => onToggleEntrySelection?.(selectionItem)}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              ) : null}
              <DocumentFileIcon filePath={file.path} size={17} />
              <span className="directory-file-list-text">
                <span className="directory-file-list-meta-row">
                  {file.directoryLabel ? (
                    <span className="directory-file-list-meta">
                      {file.directoryLabel}
                    </span>
                  ) : (
                    <span />
                  )}
                  {timestamp ? (
                    <time dateTime={timestamp}>
                      {formatRecentTimestamp(timestamp)}
                    </time>
                  ) : null}
                </span>
                <span className="directory-entry-rename directory-file-list-rename">
                  <input
                    aria-label="重命名文件"
                    autoFocus
                    value={renameInputValue}
                    onBlur={() => onCommitRename?.(file.path)}
                    onChange={(event) =>
                      onRenameDraftChange?.(event.target.value)
                    }
                    onClick={(event) => event.stopPropagation()}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={handleRenameKeyDown}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                  {renameParts.extension ? <em>{renameParts.extension}</em> : null}
                </span>
                {displayDetail ? (
                  <span className="directory-file-list-preview">
                    {displayDetail}
                  </span>
                ) : null}
              </span>
            </div>
          );
        }

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
            draggable={Boolean(onFileDragStart)}
            onDragStart={(event) => onFileDragStart?.(event, file.path)}
            onClick={() => onOpenFile(file.path)}
            onContextMenu={(event) => onFileContextMenu?.(event, file.path)}
            onMouseDown={(event) => {
              if (event.detail > 1) {
                event.preventDefault();
              }
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenFile(file.path);
            }}
            onKeyDown={(event) => {
              if (!isQuickDocumentLinkShortcut(event)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              onQuickLinkFile?.(file.path);
            }}
          >
            {isSelectionMode ? (
              <input
                aria-label={`选择 ${file.name}`}
                checked={selectedEntryPaths?.has(file.path) ?? false}
                className="directory-entry-checkbox"
                type="checkbox"
                onChange={() => onToggleEntrySelection?.(selectionItem)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : null}
            <DocumentFileIcon filePath={file.path} size={17} />
            <span className="directory-file-list-text">
              <span className="directory-file-list-meta-row">
                {file.directoryLabel ? (
                  <span className="directory-file-list-meta">
                    {file.directoryLabel}
                  </span>
                ) : (
                  <span />
                )}
                {timestamp ? (
                  <time dateTime={timestamp}>
                    {formatRecentTimestamp(timestamp)}
                  </time>
                ) : null}
              </span>
              <span className="directory-file-list-title">
                <strong>{baseName}</strong>
                {extension ? <em>{extension}</em> : null}
              </span>
              {displayDetail ? (
                <span className="directory-file-list-preview">
                  {displayDetail}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
