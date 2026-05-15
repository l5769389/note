import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  ListTree,
  Minus,
  PanelRight,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  SplitSquareHorizontal,
  Square,
  Table2,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import {
  appSettingsStorageKey,
  editorCodeFontOptions,
  editorContentWidthOptions,
  editorFontOptions,
  editorFontSizeOptions,
  editorLineHeightOptions,
  getEditorCodeFontFamily,
  getEditorFontFamily,
  getInitialTheme,
  loadAppSettings,
  themeOptions,
  type AppSettings,
  type AppTheme,
} from "./appSettings";
import { HtmlDocumentViewer } from "./components/HtmlDocumentViewer";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { MindMapModal } from "./components/MindMapModal";
import { PdfDocumentViewer } from "./components/PdfDocumentViewer";
import { ReactFlowModal } from "./components/ReactFlowModal";
import { UniverSheetPreview } from "./components/UniverSheetPreview";
import { WordDocumentViewer } from "./components/WordDocumentViewer";
import {
  TyporaEditor,
  type TyporaEditorHandle,
} from "./components/TyporaEditor";
import appLogoUrl from "../../../resources/icon.png";
import type {
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "./editorCommands";
import { getEditorShortcutAction } from "./editorShortcuts";
import { createMarkdownExportHtml } from "./exportDocument";
import { createParagraphCommandMarkdown } from "./markdownCommands";
import {
  createClearInlineStyleEdit,
  createMarkdownImageEdit,
  createRemoveMarkdownLinkEdit,
  createWrappedSelectionEdit,
  findMarkdownLinkInRange,
} from "./markdownEditing";
import {
  createDocumentFromLocalFile,
  getDocumentDisplayName,
  getDocumentPathPreview,
  getDocumentType,
  isHtmlDocument,
  isDrawingDocument,
  isMarkdownDocument,
  isPdfDocument,
  isSheetDocument,
  isWordDocument,
  mergeDocumentByFilePath,
  normalizeMarkdownTitle,
  replaceExcalidrawImagePreview,
  updateDocument,
} from "./documentModel";
import { getDirectoryPath } from "./localPreviewUrls";
import { markdownAlertOptions } from "./markdownAlerts";
import {
  createDefaultMindMapDiagram,
  createMindMapHtmlEmbed,
  createMindMapMarkdown,
  parseMindMapDiagramData,
  replaceMindMapHtmlEmbed,
  replaceMindMapMarkdownBlock,
  type MindMapDiagramData,
  type MindMapEditTarget,
} from "./mindMapDocument";
import {
  createDefaultReactFlowDiagram,
  createReactFlowHtmlEmbed,
  createReactFlowMarkdown,
  parseReactFlowDiagramData,
  replaceReactFlowHtmlEmbed,
  replaceReactFlowMarkdownBlock,
  type ReactFlowDiagramData,
  type ReactFlowEditTarget,
} from "./reactFlowDocument";
import {
  createDefaultUniverSheetData,
  createUniverSheetMarkdown,
  parseUniverSheetData,
  replaceUniverSheetMarkdownBlock,
  serializeUniverSheetData,
  type UniverSheetData,
  type UniverSheetEditTarget,
} from "./univerSheetDocument";
import {
  countMarkdownWords,
  getMarkdownOutline,
} from "./markdownStructure";
import { fileToDataUrl } from "./services/imageUpload";
import {
  createDocument,
  loadWorkspace,
  renameFromMarkdown,
  saveWorkspace,
} from "./storage";
import type {
  DirectoryTreeItem,
  DrawingAsset,
  EditorMode,
  MarkdownDocument,
  SaveState,
  LocalMarkdownFile,
} from "./types";
import {
  findMarkdownSearchMatches,
  getMatchOccurrenceIndex,
  getWorkspaceSearchGroups,
  getWorkspaceSearchMatchCount,
  isDocumentInsideWorkspace,
  type MarkdownSearchMatch,
  type WorkspaceSearchGroup,
} from "./workspaceSearch";

const DrawingModal = lazy(() =>
  import("./components/DrawingModal").then((module) => ({
    default: module.DrawingModal,
  })),
);

const UniverSheetModal = lazy(() =>
  import("./components/UniverSheetModal").then((module) => ({
    default: module.UniverSheetModal,
  })),
);

const editorModeOptions: Array<{
  value: EditorMode;
  label: string;
  icon: ReactNode;
}> = [
  { value: "typora", label: "实时渲染", icon: <BookOpenText size={16} /> },
  { value: "source", label: "源码", icon: <Code2 size={16} /> },
  { value: "split", label: "分栏", icon: <SplitSquareHorizontal size={16} /> },
  { value: "preview", label: "预览", icon: <PanelRight size={16} /> },
];

type MenubarMenu = "file" | "edit" | "paragraph" | "format" | "view" | "theme" | "help";
type TopMenu = MenubarMenu | null;
type SidebarTab = "files" | "current" | "search";
type FileExplorerView = "tree" | "list";

const defaultSidebarWidth = 334;
const minSidebarWidth = 236;
const maxSidebarWidth = 560;
const homeRecentDocumentLimit = 3;
const sidebarRecentDirectoryLimit = 5;
const storedRecentDirectoryLimit = 12;
const recentDirectoryStorageKey = "typora-like-editor:recent-directories:v1";

type FindPanelMode = "find" | "replace";

type WorkspaceSearchReveal = {
  filePath: string;
  match: MarkdownSearchMatch;
  query: string;
};

type RevealDocumentRangeOptions = {
  content?: string;
  occurrenceIndex?: number;
  preserveRendered?: boolean;
  query?: string;
};

function createDefaultExcalidrawScene() {
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

function createDrawingAssetFromDocument(document: MarkdownDocument): DrawingAsset {
  return {
    id: document.id,
    name: document.title || "Excalidraw",
    dataUrl: "",
    sceneJSON: document.content || createDefaultExcalidrawScene(),
    createdAt: document.createdAt,
  };
}

const menubarItems: Array<{ key: MenubarMenu; label: string }> = [
  { key: "file", label: "文件(F)" },
  { key: "edit", label: "编辑(E)" },
  { key: "paragraph", label: "段落(P)" },
  { key: "format", label: "格式(O)" },
  { key: "view", label: "视图(V)" },
  { key: "theme", label: "主题(T)" },
  { key: "help", label: "帮助(H)" },
];

const now = () => new Date().toISOString();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type TableSize = {
  columns: number;
  rows: number;
};

function readFileInput(fileInput: HTMLInputElement | null) {
  fileInput?.click();
}

function createMarkdownTable({ columns, rows }: TableSize) {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const emptyRow = Array.from({ length: safeColumns }, () => " ");
  const separatorRow = Array.from({ length: safeColumns }, () => "---");
  const bodyRows = Array.from({ length: Math.max(safeRows - 1, 0) }, () =>
    `| ${emptyRow.join(" | ")} |`,
  );

  return [
    "",
    `| ${emptyRow.join(" | ")} |`,
    `| ${separatorRow.join(" | ")} |`,
    ...bodyRows,
    "",
  ].join("\n");
}

function getLineColumnAtOffset(content: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, content.length));
  const before = content.slice(0, safeOffset);
  const lines = before.split("\n");

  return {
    column: lines.at(-1)?.length ?? 0,
    lineIndex: lines.length - 1,
  };
}

function HighlightedSearchSnippet({
  query,
  text,
}: {
  query: string;
  text: string;
}) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return <>{text}</>;
  }

  const normalizedText = text.toLocaleLowerCase();
  const normalizedNeedle = normalizedQuery.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = normalizedText.indexOf(normalizedNeedle, cursor);

    if (index < 0) {
      parts.push(text.slice(cursor));
      break;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + normalizedNeedle.length)}</mark>);
    cursor = index + normalizedNeedle.length;
  }

  return <>{parts}</>;
}

function getTextareaLineHeight(textarea: HTMLTextAreaElement) {
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight);

  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(computedStyle.fontSize);

  return Number.isFinite(fontSize) ? fontSize * 1.8 : 24;
}

function centerTextareaRangeInView(
  textarea: HTMLTextAreaElement,
  start: number,
  content: string,
) {
  const { lineIndex } = getLineColumnAtOffset(content, start);
  const computedStyle = window.getComputedStyle(textarea);
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
  const lineHeight = getTextareaLineHeight(textarea);
  const targetCenter = paddingTop + lineIndex * lineHeight + lineHeight / 2;
  const nextTop = targetCenter - textarea.clientHeight / 2;

  textarea.scrollTo({
    behavior: "smooth",
    top: Math.max(0, nextTop),
  });
}

function MenuSeparator() {
  return <div className="menubar-dropdown-separator" role="separator" />;
}

function MenuItem({
  checked,
  disabled,
  label,
  onSelect,
  shortcut,
  submenu,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: ReactNode;
  onSelect?: () => void;
  shortcut?: string;
  submenu?: boolean;
}) {
  const role = checked === undefined ? "menuitem" : "menuitemcheckbox";

  return (
    <button
      aria-checked={checked === undefined ? undefined : checked}
      className={[
        "menubar-dropdown-item",
        checked ? "menubar-dropdown-item-checked" : "",
        disabled ? "menubar-dropdown-item-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onSelect}
      role={role}
      type="button"
    >
      <span className="menubar-dropdown-check">{checked ? <Check size={17} /> : null}</span>
      <span className="menubar-dropdown-label">{label}</span>
      <span className="menubar-dropdown-shortcut">{shortcut ? <kbd>{shortcut}</kbd> : null}</span>
      {submenu && <ChevronRight className="menubar-dropdown-arrow" size={18} />}
    </button>
  );
}

function MenuSubmenu({
  children,
  label,
  panelClassName,
}: {
  children: ReactNode;
  label: ReactNode;
  panelClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
      setIsOpen(false);
    }
  }

  return (
    <div
      className={["menubar-submenu", isOpen ? "menubar-submenu-open" : ""]
        .filter(Boolean)
        .join(" ")}
      onBlur={closeWhenFocusLeaves}
      onFocus={() => setIsOpen(true)}
      onPointerEnter={() => setIsOpen(true)}
      onPointerLeave={() => setIsOpen(false)}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="menubar-dropdown-item"
        role="menuitem"
        type="button"
      >
        <span className="menubar-dropdown-check" />
        <span className="menubar-dropdown-label">{label}</span>
        <span className="menubar-dropdown-shortcut" />
        <ChevronRight className="menubar-dropdown-arrow" size={18} />
      </button>
      <div
        className={["menubar-submenu-panel", panelClassName ?? ""]
          .filter(Boolean)
          .join(" ")}
        role="menu"
      >
        {children}
      </div>
    </div>
  );
}

function RecentFileMenuItem({
  document,
  exists,
  onOpen,
}: {
  document: MarkdownDocument;
  exists?: boolean;
  onOpen: (document: MarkdownDocument) => void;
}) {
  const isMissing = exists === false;
  const displayName = getDocumentDisplayName(document);
  const pathLabel = isMissing
    ? "文件不存在"
    : document.filePath
      ? getDocumentPathPreview(document)
      : "未保存到本地";
  const timeLabel = isMissing ? "不存在" : formatRecentTimestamp(document.updatedAt);

  return (
    <button
      className={[
        "menubar-dropdown-item",
        "recent-file-menu-button",
        isMissing ? "recent-file-menu-button-missing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isMissing}
      onClick={() => onOpen(document)}
      role="menuitem"
      title={`${displayName}\n${pathLabel}`}
      type="button"
    >
      <FileText className="recent-file-menu-icon" size={16} />
      <span className="recent-file-menu-entry">
        <strong>{displayName}</strong>
        <small>{pathLabel}</small>
      </span>
      <span className="recent-file-menu-time">{timeLabel}</span>
    </button>
  );
}

function formatRecentTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (date.toDateString() === today.toDateString()) {
    return `今天 ${time}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${time}`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPathLabel(path?: string) {
  if (!path) {
    return "Desktop";
  }

  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

function normalizeDirectoryKey(path?: string) {
  return path?.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() ?? "";
}

function loadRecentDirectoryPaths() {
  try {
    const raw = window.localStorage.getItem(recentDirectoryStorageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === "string")
      : [];
  } catch {
    return [];
  }
}

function collectDirectoryPaths(item: DirectoryTreeItem): string[] {
  if (item.type !== "directory") {
    return [];
  }

  return [
    item.path,
    ...(item.children ?? []).flatMap((child) => collectDirectoryPaths(child)),
  ];
}

function DirectoryTree({
  activeDirectoryPath,
  activeFilePath,
  expandedPaths,
  item,
  level = 0,
  onOpenFile,
  onToggleDirectory,
}: {
  activeDirectoryPath?: string;
  activeFilePath?: string;
  expandedPaths: Set<string>;
  item: DirectoryTreeItem;
  level?: number;
  onOpenFile: (filePath: string) => void;
  onToggleDirectory: (directoryPath: string) => void;
}) {
  const isRoot = level === 0;
  const isCurrentDirectory = item.path === activeDirectoryPath;
  const hasChildren = Boolean(item.children?.length);
  const isExpanded = expandedPaths.has(item.path);

  return (
    <div className={isRoot ? "directory-tree-root" : "directory-tree-branch"}>
      <button
        className={
          isCurrentDirectory
            ? "directory-tree-folder directory-tree-folder-active"
            : "directory-tree-folder"
        }
        style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
        type="button"
        onClick={() => onToggleDirectory(item.path)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="directory-tree-caret" size={14} />
          ) : (
            <ChevronRight className="directory-tree-caret" size={14} />
          )
        ) : (
          <span className="directory-tree-caret-placeholder" />
        )}
        {isRoot ? <FolderOpen size={18} /> : <Folder size={18} />}
        <span>{item.name}</span>
      </button>
      {isExpanded ? (
        <DirectoryTreeItems
          activeDirectoryPath={activeDirectoryPath}
          activeFilePath={activeFilePath}
          expandedPaths={expandedPaths}
          items={item.children ?? []}
          level={level + 1}
          onOpenFile={onOpenFile}
          onToggleDirectory={onToggleDirectory}
        />
      ) : null}
    </div>
  );
}

function DirectoryTreeItems({
  activeDirectoryPath,
  activeFilePath,
  expandedPaths,
  items,
  level,
  onOpenFile,
  onToggleDirectory,
}: {
  activeDirectoryPath?: string;
  activeFilePath?: string;
  expandedPaths: Set<string>;
  items: DirectoryTreeItem[];
  level: number;
  onOpenFile: (filePath: string) => void;
  onToggleDirectory: (directoryPath: string) => void;
}) {
  return (
    <>
      {items.map((child) =>
        child.type === "directory" ? (
          <DirectoryTree
            activeDirectoryPath={activeDirectoryPath}
            activeFilePath={activeFilePath}
            expandedPaths={expandedPaths}
            item={child}
            key={child.path}
            level={level}
            onOpenFile={onOpenFile}
            onToggleDirectory={onToggleDirectory}
          />
        ) : (
          <button
            className={
              child.path === activeFilePath
                ? "directory-tree-file directory-tree-file-active"
                : "directory-tree-file"
            }
            key={child.path}
            style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
            type="button"
            onClick={() => onOpenFile(child.path)}
          >
            <span className="directory-tree-caret-placeholder" />
            <FileText size={17} />
            <span>{child.name}</span>
          </button>
        ),
      )}
    </>
  );
}

type DirectoryFileListItem = {
  directoryLabel: string;
  document?: MarkdownDocument;
  name: string;
  path: string;
};

function normalizeFilePathKey(filePath?: string) {
  return filePath?.replace(/\\/g, "/").toLowerCase() ?? "";
}

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

  if (isSheetDocument(document)) {
    return "在线表格 · 可打开编辑";
  }

  if (isDrawingDocument(document)) {
    return "Excalidraw 画板 · 可打开编辑";
  }

  const preview = stripMarkdownForFilePreview(document.content);

  return preview || "空白文档";
}

function getDirectoryDisplayPath(filePath: string, workspacePath?: string) {
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

  return items
    .flatMap((item): DirectoryFileListItem[] =>
      item.type === "directory"
        ? collectDirectoryFiles(documents, item.children ?? [], workspacePath)
        : [
            {
              directoryLabel: getDirectoryDisplayPath(item.path, workspacePath),
              document: documentsByPath.get(normalizeFilePathKey(item.path)),
              name: item.name,
              path: item.path,
            },
          ],
    )
    .sort((left, right) =>
      `${left.directoryLabel}/${left.name}`.localeCompare(
        `${right.directoryLabel}/${right.name}`,
        "zh-CN",
        { numeric: true },
      ),
    );
}

function DirectoryFileList({
  activeFilePath,
  documents,
  items,
  onOpenFile,
  workspacePath,
}: {
  activeFilePath?: string;
  documents: MarkdownDocument[];
  items: DirectoryTreeItem[];
  onOpenFile: (filePath: string) => void;
  workspacePath?: string;
}) {
  const files = useMemo(
    () => collectDirectoryFiles(documents, items, workspacePath),
    [documents, items, workspacePath],
  );

  if (!files.length) {
    return <div className="directory-tree-empty">当前目录中没有文件</div>;
  }

  return (
    <div className="directory-file-list">
      {files.map((file) => (
        <button
          className={
            file.path === activeFilePath
              ? "directory-file-list-item directory-file-list-item-active"
              : "directory-file-list-item"
          }
          key={file.path}
          type="button"
          onClick={() => onOpenFile(file.path)}
        >
          <FileText size={17} />
          <span className="directory-file-list-text">
            <span className="directory-file-list-title">{file.name}</span>
            <span className="directory-file-list-meta">
              {file.directoryLabel || getPathLabel(workspacePath)}
            </span>
            <span className="directory-file-list-preview">
              {getFileListPreview(file.document)}
            </span>
          </span>
          {file.document?.updatedAt ? (
            <time dateTime={file.document.updatedAt}>
              {formatRecentTimestamp(file.document.updatedAt)}
            </time>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function WorkspaceSearchPanel({
  groups,
  inputRef,
  matchCount,
  onClose,
  onOpenMatch,
  onQueryChange,
  query,
  workspacePath,
}: {
  groups: WorkspaceSearchGroup[];
  inputRef: RefObject<HTMLInputElement>;
  matchCount: number;
  onClose: () => void;
  onOpenMatch: (document: MarkdownDocument, match: MarkdownSearchMatch) => void;
  onQueryChange: (value: string) => void;
  query: string;
  workspacePath?: string;
}) {
  const trimmedQuery = query.trim();

  return (
    <div className="workspace-search-panel">
      <div className="workspace-search-input-row">
        <Search size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
          placeholder="查找"
        />
        <div className="workspace-search-toggles" aria-hidden="true">
          <span>Aa</span>
          <span>W</span>
          <span>.*</span>
        </div>
        {query && (
          <button type="button" aria-label="清空查找" onClick={() => onQueryChange("")}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="workspace-search-meta">
        {trimmedQuery
          ? matchCount
            ? `在 ${groups.length} 个文件中找到 ${matchCount} 处`
            : "没有找到匹配内容"
          : workspacePath
            ? "输入关键词后搜索当前文件夹"
            : "先打开一个本地文件夹"}
      </div>

      <div className="workspace-search-results">
        {!trimmedQuery ? (
          <div className="workspace-search-empty">
            输入内容后会在当前文件夹内搜索 .md 和 .html 文件。
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <section
              className="workspace-search-group"
              key={group.document.filePath ?? group.document.id}
            >
              <div className="workspace-search-file">
                <FileText size={15} />
                <strong>{getDocumentDisplayName(group.document)}</strong>
                <span>{group.matches.length}</span>
              </div>
              {group.matches.map((match) => (
                <button
                  className="workspace-search-match"
                  key={`${group.document.filePath ?? group.document.id}-${match.start}`}
                  type="button"
                  onClick={() => onOpenMatch(group.document, match)}
                >
                  <span className="workspace-search-line">{match.line}</span>
                  <span className="workspace-search-snippet">
                    <HighlightedSearchSnippet
                      query={trimmedQuery}
                      text={match.snippet || "空白行"}
                    />
                  </span>
                </button>
              ))}
            </section>
          ))
        ) : (
          <div className="workspace-search-empty">没有匹配结果。</div>
        )}
      </div>
    </div>
  );
}

function WelcomeIllustration() {
  return (
    <div className="welcome-illustration" aria-hidden="true">
      <div className="welcome-sheet welcome-sheet-back">
        <span />
      </div>
      <div className="welcome-sheet">
        <strong>#</strong>
        <span />
        <span />
        <span />
      </div>
      <div className="welcome-markdown-badge">M↓</div>
      <div className="welcome-code-badge">{"</>"}</div>
      <div className="welcome-pen" />
    </div>
  );
}

export function App() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [mode, setMode] = useState<EditorMode>("typora");
  const [topMenu, setTopMenu] = useState<TopMenu>(null);
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [isHomeOpen, setIsHomeOpen] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const [, setSaveState] = useState<SaveState>("idle");
  const [, setBackupMessage] = useState("本地自动保存已启用");
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);
  const [reactFlowEditorState, setReactFlowEditorState] = useState<{
    initialData: ReactFlowDiagramData;
    target: ReactFlowEditTarget;
  } | null>(null);
  const [mindMapEditorState, setMindMapEditorState] = useState<{
    initialData: MindMapDiagramData;
    target: MindMapEditTarget;
  } | null>(null);
  const [univerSheetEditorState, setUniverSheetEditorState] = useState<{
    initialData: UniverSheetData;
    target: UniverSheetEditTarget;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findPanelMode, setFindPanelMode] = useState<FindPanelMode>("find");
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [workspaceSearchGroups, setWorkspaceSearchGroups] = useState<
    WorkspaceSearchGroup[]
  >([]);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [fileExplorerView, setFileExplorerView] =
    useState<FileExplorerView>("tree");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedWidth = Number(window.localStorage.getItem("typora-like-sidebar-width"));

    return Number.isFinite(storedWidth)
      ? clamp(storedWidth, minSidebarWidth, maxSidebarWidth)
      : defaultSidebarWidth;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [newFileName, setNewFileName] = useState("Untitled");
  const [directoryTree, setDirectoryTree] = useState<DirectoryTreeItem | null>(
    null,
  );
  const [recentFileAvailability, setRecentFileAvailability] = useState<
    Record<string, boolean>
  >({});
  const [recentDirectoryPaths, setRecentDirectoryPaths] = useState(
    loadRecentDirectoryPaths,
  );
  const [expandedDirectoryPaths, setExpandedDirectoryPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeEditorLineIndex, setActiveEditorLineIndex] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
  const workspaceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingWorkspaceSearchRevealRef = useRef<WorkspaceSearchReveal | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const savedFileContentByPathRef = useRef(
    new Map(
      workspace.documents
        .filter((document) => document.filePath)
        .map((document) => [document.filePath!, document.content]),
    ),
  );

  const activeDocument = useMemo(
    () =>
      workspace.documents.find((item) => item.id === workspace.activeDocumentId) ?? null,
    [workspace.activeDocumentId, workspace.documents],
  );
  const editingDrawingAsset = useMemo(
    () =>
      activeDocument && isDrawingDocument(activeDocument)
        ? createDrawingAssetFromDocument(activeDocument)
        : activeDocument && editingDrawingId
          ? activeDocument.drawings[editingDrawingId] ?? null
          : null,
    [activeDocument, editingDrawingId],
  );
  const workspaceLabel = getPathLabel(workspace.workspacePath);
  const recentDocuments = useMemo(
    () =>
      [...workspace.documents]
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
        ),
    [workspace.documents],
  );
  const recentDirectories = useMemo(() => {
    const currentDirectoryKey = normalizeDirectoryKey(workspace.workspacePath);
    const seen = new Set<string>();
    const entries: Array<{ isCurrent: boolean; label: string; path: string }> = [];
    const pushDirectory = (path?: string) => {
      const key = normalizeDirectoryKey(path);

      if (!path || !key || seen.has(key)) {
        return;
      }

      seen.add(key);
      entries.push({
        path,
        label: getPathLabel(path),
        isCurrent: Boolean(currentDirectoryKey && key === currentDirectoryKey),
      });
    };

    pushDirectory(workspace.workspacePath);
    recentDirectoryPaths.forEach(pushDirectory);
    recentDocuments.forEach((document) => pushDirectory(getDirectoryPath(document.filePath)));

    return entries.slice(0, sidebarRecentDirectoryLimit);
  }, [recentDirectoryPaths, recentDocuments, workspace.workspacePath]);
  const hasMoreRecentDocuments = recentDocuments.length > homeRecentDocumentLimit;
  const visibleRecentDocuments = useMemo(
    () =>
      isRecentExpanded
        ? recentDocuments
        : recentDocuments.slice(0, homeRecentDocumentLimit),
    [isRecentExpanded, recentDocuments],
  );
  const activeDocumentOutline = useMemo(
    () =>
      isMarkdownDocument(activeDocument)
        ? getMarkdownOutline(activeDocument!.content)
        : [],
    [activeDocument],
  );
  const activeDocumentWordCount = useMemo(
    () =>
      isMarkdownDocument(activeDocument)
        ? countMarkdownWords(activeDocument!.content)
        : 0,
    [activeDocument],
  );
  const workspaceSearchMatchCount = useMemo(
    () => getWorkspaceSearchMatchCount(workspaceSearchGroups),
    [workspaceSearchGroups],
  );
  const isWorkspaceSearchTabVisible =
    sidebarTab === "search" || workspaceSearchQuery.trim().length > 0;
  const findMatches = useMemo(
    () =>
      findMarkdownSearchMatches(
        activeDocument?.content ?? "",
        findQuery,
        activeDocument ? getDocumentType(activeDocument) : "markdown",
      ),
    [activeDocument, activeDocument?.content, findQuery],
  );
  const activeFindMatch = findMatches[findMatchIndex] ?? null;
  const visibleFindResultStart = Math.max(
    0,
    Math.min(Math.max(findMatchIndex - 3, 0), Math.max(findMatches.length - 8, 0)),
  );
  const visibleFindResults = findMatches.slice(
    visibleFindResultStart,
    visibleFindResultStart + 8,
  );

  useEffect(() => {
    if (!hasMoreRecentDocuments && isRecentExpanded) {
      setIsRecentExpanded(false);
    }
  }, [hasMoreRecentDocuments, isRecentExpanded]);

  useEffect(() => {
    if (!workspaceSearchQuery.trim()) {
      setWorkspaceSearchGroups([]);
      return;
    }

    setWorkspaceSearchGroups(
      getWorkspaceSearchGroups(
        workspace.documents,
        workspaceSearchQuery,
        workspace.workspacePath,
      ),
    );
  }, [workspace.workspacePath, workspaceSearchQuery]);

  useEffect(() => {
    const filePaths = recentDocuments
      .map((document) => document.filePath)
      .filter((filePath): filePath is string => Boolean(filePath));

    if (!filePaths.length || !window.desktop?.pathExists) {
      setRecentFileAvailability({});
      return;
    }

    let isStale = false;

    void Promise.all(
      filePaths.map(async (filePath) => [
        filePath,
        await window.desktop!.pathExists(filePath),
      ] as const),
    ).then((entries) => {
      if (isStale) {
        return;
      }

      setRecentFileAvailability(Object.fromEntries(entries));
    });

    return () => {
      isStale = true;
    };
  }, [recentDocuments]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("typora-like-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(appSettingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty(
      "--editor-font-family",
      getEditorFontFamily(settings.editorFontFamily),
    );
    style.setProperty(
      "--editor-code-font-family",
      getEditorCodeFontFamily(settings.editorCodeFontFamily),
    );
    style.setProperty("--editor-font-size", settings.editorFontSize);
    style.setProperty("--editor-line-height", settings.editorLineHeight);
    style.setProperty("--editor-content-width", settings.editorContentWidth);
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem("typora-like-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    setFindMatchIndex((current) => {
      if (!findMatches.length) {
        return 0;
      }

      return Math.min(current, findMatches.length - 1);
    });
  }, [findMatches.length]);

  useEffect(() => {
    setFindMatchIndex(0);
  }, [activeDocument?.id, findQuery]);

  useEffect(() => {
    if (!isFindReplaceOpen || !findQuery || !findMatches.length) {
      clearFindHighlight();
    }
  }, [findMatches.length, findQuery, isFindReplaceOpen]);

  function updateSetting(key: keyof AppSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsSidebarResizing(true);

    function resizeSidebar(pointerEvent: PointerEvent) {
      const nextWidth = pointerEvent.clientX;

      if (nextWidth < minSidebarWidth) {
        setIsSidebarCollapsed(true);
        return;
      }

      setIsSidebarCollapsed(false);
      setSidebarWidth(clamp(nextWidth, minSidebarWidth, maxSidebarWidth));
    }

    function stopSidebarResize(pointerEvent: PointerEvent) {
      resizeSidebar(pointerEvent);
      setIsSidebarResizing(false);
      window.removeEventListener("pointermove", resizeSidebar);
      window.removeEventListener("pointerup", stopSidebarResize);
      window.removeEventListener("pointercancel", stopSidebarResize);
    }

    window.addEventListener("pointermove", resizeSidebar);
    window.addEventListener("pointerup", stopSidebarResize);
    window.addEventListener("pointercancel", stopSidebarResize);
  }

  async function loadDirectoryTree(directoryPath = workspace.workspacePath) {
    if (!directoryPath || !window.desktop?.readDirectoryTree) {
      setDirectoryTree(null);
      return;
    }

    try {
      const tree = await window.desktop.readDirectoryTree(directoryPath);

      setDirectoryTree(tree);
      setExpandedDirectoryPaths((current) => {
        const next = new Set(current);
        next.add(tree.path);
        return next;
      });
    } catch {
      setDirectoryTree(null);
      setSaveState("failed");
    }
  }

  function rememberRecentDirectory(path?: string) {
    const key = normalizeDirectoryKey(path);

    if (!path || !key) {
      return;
    }

    setRecentDirectoryPaths((current) => [
      path,
      ...current.filter((item) => normalizeDirectoryKey(item) !== key),
    ].slice(0, storedRecentDirectoryLimit));
  }

  useEffect(() => {
    window.localStorage.setItem(
      recentDirectoryStorageKey,
      JSON.stringify(recentDirectoryPaths),
    );
  }, [recentDirectoryPaths]);

  useEffect(() => {
    if (workspace.workspacePath || !window.desktop?.getDefaultWorkspaceDirectory) {
      return;
    }

    void window.desktop.getDefaultWorkspaceDirectory().then((workspacePath) => {
      setWorkspace((current) =>
        current.workspacePath ? current : { ...current, workspacePath },
      );
    });
  }, [workspace.workspacePath]);

  useEffect(() => {
    if (!workspace.workspacePath) {
      return;
    }

    void loadDirectoryTree(workspace.workspacePath);
  }, [workspace.workspacePath]);

  useEffect(() => {
    if (!topMenu && !isActionsOpen) {
      return;
    }

    function closeFloatingMenus(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (
        topMenu &&
        !event.target.closest(".menubar-trigger") &&
        !event.target.closest(".menubar-dropdown")
      ) {
        setTopMenu(null);
      }

      if (
        isActionsOpen &&
        !event.target.closest(".sidebar-actions-popover") &&
        !event.target.closest("[data-sidebar-actions-trigger]")
      ) {
        setIsActionsOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeFloatingMenus);

    return () => {
      window.removeEventListener("pointerdown", closeFloatingMenus);
    };
  }, [isActionsOpen, topMenu]);

  useEffect(() => {
    function isFormControl(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement
      );
    }

    function handleGlobalEditShortcuts(event: KeyboardEvent) {
      if (isCreateFileOpen || isSettingsOpen || isFormControl(event.target)) {
        return;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openNewWindow();
        return;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveDocumentAs();
        return;
      }

      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
        return;
      }

      const action = getEditorShortcutAction(event);

      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action.type) {
        case "createLink":
          createLinkFromPrompt();
          break;
        case "edit":
          void runEditCommand(action.command);
          break;
        case "find":
          openFindReplaceDialog(Boolean(action.replace));
          break;
        case "format":
          runFormatCommand(action.command);
          break;
        case "paragraph":
          runParagraphCommand(action.command);
          break;
      }
    }

    window.addEventListener("keydown", handleGlobalEditShortcuts);

    return () => {
      window.removeEventListener("keydown", handleGlobalEditShortcuts);
    };
  }, [activeDocument, isCreateFileOpen, isSettingsOpen, mode]);

  useEffect(() => {
    setActiveEditorLineIndex(0);
  }, [activeDocument?.id]);

  useEffect(() => {
    if (sidebarTab !== "search" || isSidebarCollapsed) {
      return;
    }

    requestAnimationFrame(() => {
      workspaceSearchInputRef.current?.focus();
      workspaceSearchInputRef.current?.select();
    });
  }, [isSidebarCollapsed, sidebarTab]);

  useEffect(() => {
    const pendingReveal = pendingWorkspaceSearchRevealRef.current;

    if (!pendingReveal || activeDocument?.filePath !== pendingReveal.filePath) {
      return;
    }

    pendingWorkspaceSearchRevealRef.current = null;

    if (!isMarkdownDocument(activeDocument)) {
      return;
    }

    requestAnimationFrame(() => {
      revealWorkspaceSearchMatch(
        activeDocument,
        pendingReveal.match,
        pendingReveal.query,
      );
    });
  }, [activeDocument?.content, activeDocument?.filePath, activeDocument?.id, mode]);

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        saveWorkspace(workspace);
        const writableDocuments = workspace.documents.filter(
          (document) =>
            isWritableTextDocument(document) &&
            document.filePath &&
            savedFileContentByPathRef.current.get(document.filePath) !== document.content,
        );

        if (!writableDocuments.length || !window.desktop?.writeMarkdownFile) {
          setSaveState("saved");
          return;
        }

        void Promise.all(
          writableDocuments.map((document) =>
            window.desktop!.writeMarkdownFile({
              content: document.content,
              filePath: document.filePath!,
            }),
          ),
        )
          .then(() => {
            writableDocuments.forEach((document) => {
              savedFileContentByPathRef.current.set(document.filePath!, document.content);
            });
            setSaveState("saved");
            void loadDirectoryTree();
          })
          .catch(() => setSaveState("failed"));
      } catch {
        setSaveState("failed");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [workspace]);

  function setActiveDocument(documentId: string) {
    setIsHomeOpen(false);
    setWorkspace((current) => ({
      ...current,
      activeDocumentId: documentId,
    }));
  }

  function toggleDirectoryPath(directoryPath: string) {
    setExpandedDirectoryPaths((current) => {
      const next = new Set(current);

      if (next.has(directoryPath)) {
        next.delete(directoryPath);
      } else {
        next.add(directoryPath);
      }

      return next;
    });
  }

  function createNewDocument() {
    setNewFileName(`Untitled ${workspace.documents.length + 1}`);
    setIsCreateFileOpen(true);
    setIsActionsOpen(false);
    setTopMenu(null);
  }

  async function confirmCreateNewDocument() {
    const title = normalizeMarkdownTitle(newFileName);
    try {
      const directoryPath =
        workspace.workspacePath ||
        (await window.desktop?.getDefaultWorkspaceDirectory?.()) ||
        "";
      const localFile =
        directoryPath && window.desktop?.createMarkdownFile
          ? await window.desktop.createMarkdownFile({ directoryPath, title })
          : null;
      const document = localFile
        ? createDocumentFromLocalFile(localFile)
        : createDocument(title, `# ${title}\n\n`);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) => ({
        ...current,
        activeDocumentId: document.id,
        documents: mergeDocumentByFilePath(current.documents, document),
        workspacePath: directoryPath || current.workspacePath,
      }));
      setIsCreateFileOpen(false);
      setIsHomeOpen(false);
      setNewFileName("Untitled");

      if (directoryPath) {
        await loadDirectoryTree(directoryPath);
      }
    } catch {
      setSaveState("failed");
    }
  }

  async function getCreationDirectory() {
    return (
      workspace.workspacePath ||
      (await window.desktop?.getDefaultWorkspaceDirectory?.()) ||
      ""
    );
  }

  function activateCreatedDocument(document: MarkdownDocument, directoryPath?: string) {
    if (document.filePath) {
      savedFileContentByPathRef.current.set(document.filePath, document.content);
    }

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: document.id,
      documents: mergeDocumentByFilePath(current.documents, document),
      workspacePath: directoryPath || current.workspacePath,
    }));
    setIsHomeOpen(false);
    setIsActionsOpen(false);
    setTopMenu(null);
  }

  async function createStandaloneSheetDocument() {
    const data = createDefaultUniverSheetData();
    const title = data.title || "Online Sheet";
    const content = serializeUniverSheetData(data);

    try {
      const directoryPath = await getCreationDirectory();
      const localFile =
        directoryPath && window.desktop?.createDocumentFile
          ? await window.desktop.createDocumentFile({
              content,
              directoryPath,
              extension: ".univer",
              title,
            })
          : null;
      const document = localFile
        ? createDocumentFromLocalFile(localFile)
        : createDocument(title, content, undefined, "sheet", ".univer");

      activateCreatedDocument(document, directoryPath);
      openUniverSheetEditor({ kind: "document" }, document.content);

      if (directoryPath) {
        await loadDirectoryTree(directoryPath);
      }
    } catch {
      setSaveState("failed");
    }
  }

  async function createStandaloneDrawingDocument() {
    const title = "Excalidraw";
    const content = createDefaultExcalidrawScene();

    try {
      const directoryPath = await getCreationDirectory();
      const localFile =
        directoryPath && window.desktop?.createDocumentFile
          ? await window.desktop.createDocumentFile({
              content,
              directoryPath,
              extension: ".excalidraw",
              title,
            })
          : null;
      const document = localFile
        ? createDocumentFromLocalFile(localFile)
        : createDocument(title, content, undefined, "drawing", ".excalidraw");

      activateCreatedDocument(document, directoryPath);
      window.setTimeout(() => setDrawingDialogOpen(true), 0);

      if (directoryPath) {
        await loadDirectoryTree(directoryPath);
      }
    } catch {
      setSaveState("failed");
    }
  }

  function applyWorkspaceDirectory(
    directoryPath: string,
    localFiles: LocalMarkdownFile[],
    tree: DirectoryTreeItem | null,
  ) {
    const localDocuments = localFiles.map(createDocumentFromLocalFile);
    const fallbackDocument = createDocument("Untitled", "# Untitled\n\n");
    const nextDocuments = localDocuments.length ? localDocuments : [fallbackDocument];

    localDocuments.forEach((document) => {
      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }
    });

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: "",
      documents: nextDocuments,
      workspacePath: directoryPath,
    }));
    setDirectoryTree(tree);
    setExpandedDirectoryPaths(new Set(tree ? collectDirectoryPaths(tree) : []));
    setIsHomeOpen(true);
    setIsActionsOpen(false);
    setTopMenu(null);
    setSaveState("saved");
    rememberRecentDirectory(directoryPath);
  }

  async function openWorkspaceDirectoryPath(directoryPath: string) {
    if (!directoryPath) {
      return;
    }

    try {
      if (window.desktop?.pathExists && !(await window.desktop.pathExists(directoryPath))) {
        window.alert(`无法打开最近目录：\n${directoryPath}`);
        return;
      }

      const [localFiles, tree] = await Promise.all([
        window.desktop?.listMarkdownFiles
          ? window.desktop.listMarkdownFiles(directoryPath)
          : Promise.resolve([]),
        window.desktop?.readDirectoryTree
          ? window.desktop.readDirectoryTree(directoryPath)
          : Promise.resolve(null),
      ]);

      applyWorkspaceDirectory(directoryPath, localFiles, tree);
    } catch (error) {
      console.error("Failed to open recent workspace folder", error);
      setSaveState("failed");
    }
  }

  async function openWorkspaceFolder() {
    try {
      const openedWorkspace = await window.desktop?.openWorkspaceDirectory?.();
      let directoryPath: string | undefined = openedWorkspace?.directoryPath;
      let localFiles = openedWorkspace?.files ?? [];
      let tree = openedWorkspace?.tree ?? null;

      if (!openedWorkspace && !window.desktop?.openWorkspaceDirectory) {
        directoryPath =
          (await window.desktop?.selectWorkspaceDirectory?.()) ?? undefined;

        if (directoryPath) {
          [localFiles, tree] = await Promise.all([
            window.desktop?.listMarkdownFiles
              ? window.desktop.listMarkdownFiles(directoryPath)
              : Promise.resolve([]),
            window.desktop?.readDirectoryTree
              ? window.desktop.readDirectoryTree(directoryPath)
              : Promise.resolve(null),
          ]);
        }
      }

      if (!directoryPath) {
        return;
      }

      applyWorkspaceDirectory(directoryPath, localFiles, tree);
    } catch (error) {
      console.error("Failed to open workspace folder", error);
      setSaveState("failed");
    }
  }

  async function openFileFromTree(filePath: string) {
    const existingDocument = workspace.documents.find(
      (document) => document.filePath === filePath,
    );

    if (existingDocument) {
      setActiveDocument(existingDocument.id);
      setIsHomeOpen(false);
      return;
    }

    const localFile = await window.desktop?.readMarkdownFile?.(filePath);

    if (!localFile) {
      return;
    }

    const document = createDocumentFromLocalFile(localFile);

    if (document.filePath) {
      savedFileContentByPathRef.current.set(document.filePath, document.content);
    }

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: document.id,
      documents: mergeDocumentByFilePath(current.documents, document),
      workspacePath: current.workspacePath || filePath.split(/[\\/]/).slice(0, -1).join("\\"),
    }));
    rememberRecentDirectory(getDirectoryPath(document.filePath));
    setIsHomeOpen(false);
  }

  async function showWorkspaceInFolder() {
    const targetPath = workspace.workspacePath || activeDocument?.filePath;

    if (!targetPath) {
      return;
    }

    await window.desktop?.showInFolder?.(targetPath);
    setIsActionsOpen(false);
  }

  function patchActiveDocument(patch: Partial<MarkdownDocument>) {
    setWorkspace((current) => {
      const currentDocument =
        current.documents.find((item) => item.id === current.activeDocumentId) ?? null;

      if (!currentDocument) {
        return current;
      }

      const nextDocument = {
        ...currentDocument,
        ...patch,
        updatedAt: now(),
      };

      return updateDocument(current, nextDocument);
    });
  }

  function updateMarkdown(content: string) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    patchActiveDocument({
      content,
      title: renameFromMarkdown(content, activeDocument.title),
    });
  }

  function openNewWindow() {
    void window.desktop?.newWindow?.();
  }

  async function openRecentDocument(document: MarkdownDocument) {
    if (!document.filePath) {
      setActiveDocument(document.id);
      return;
    }

    const exists = window.desktop?.pathExists
      ? await window.desktop.pathExists(document.filePath)
      : true;

    setRecentFileAvailability((current) => ({
      ...current,
      [document.filePath!]: exists,
    }));

    if (!exists) {
      window.alert(`文件不存在：\n${document.filePath}`);
      return;
    }

    try {
      const localFile = await window.desktop?.readMarkdownFile?.(document.filePath);

      if (!localFile) {
        setActiveDocument(document.id);
        return;
      }

      const nextDocument = createDocumentFromLocalFile(localFile);

      savedFileContentByPathRef.current.set(nextDocument.filePath!, nextDocument.content);
      rememberRecentDirectory(getDirectoryPath(nextDocument.filePath));
      setWorkspace((current) => ({
        ...current,
        activeDocumentId: document.id,
        documents: mergeDocumentByFilePath(current.documents, nextDocument),
        workspacePath:
          current.workspacePath ||
          getDirectoryPath(nextDocument.filePath) ||
          current.workspacePath,
      }));
      setIsHomeOpen(false);
    } catch {
      setRecentFileAvailability((current) => ({
        ...current,
        [document.filePath!]: false,
      }));
      window.alert(`无法打开最近文件：\n${document.filePath}`);
    }
  }

  async function reloadDocumentFromDisk(document?: MarkdownDocument | null) {
    if (!document?.filePath) {
      return;
    }

    const localFile = await window.desktop?.readMarkdownFile?.(document.filePath);

    if (!localFile) {
      throw new Error("无法读取磁盘上的文件。");
    }

    const nextDocument = createDocumentFromLocalFile(localFile);

    if (nextDocument.filePath) {
      savedFileContentByPathRef.current.set(nextDocument.filePath, nextDocument.content);
    }
    rememberRecentDirectory(getDirectoryPath(nextDocument.filePath));

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: document.id,
      documents: mergeDocumentByFilePath(current.documents, nextDocument),
      workspacePath:
        current.workspacePath ||
        getDirectoryPath(nextDocument.filePath) ||
        current.workspacePath,
    }));
  }

  function setDrawingDialogOpen(open: boolean) {
    setIsDrawingOpen(open);

    if (!open) {
      setEditingDrawingId(null);
    }
  }

  function openNewDrawing() {
    if (!isMarkdownDocument(activeDocument)) {
      void createStandaloneDrawingDocument();
      return;
    }

    setEditingDrawingId(null);
    setIsDrawingOpen(true);
  }

  function openDrawingEditor(drawingId: string) {
    if (!isMarkdownDocument(activeDocument) || !activeDocument?.drawings[drawingId]) {
      return;
    }

    setEditingDrawingId(drawingId);
    setIsDrawingOpen(true);
  }

  function isWritableTextDocument(document?: MarkdownDocument | null) {
    return (
      isMarkdownDocument(document) ||
      isHtmlDocument(document) ||
      isSheetDocument(document) ||
      isDrawingDocument(document)
    );
  }

  function openReactFlowEditor(target: ReactFlowEditTarget, code?: string) {
    let initialData = createDefaultReactFlowDiagram();

    if (code) {
      try {
        initialData = parseReactFlowDiagramData(code);
      } catch {
        initialData = createDefaultReactFlowDiagram();
      }
    }

    setReactFlowEditorState({ initialData, target });
  }

  function saveReactFlowDiagram(data: ReactFlowDiagramData) {
    if (!activeDocument || !reactFlowEditorState) {
      return;
    }

    const { target } = reactFlowEditorState;

    if (target.kind === "markdown" && isMarkdownDocument(activeDocument)) {
      updateMarkdown(
        replaceReactFlowMarkdownBlock(activeDocument.content, target.code, data),
      );
      return;
    }

    if (target.kind === "html" && isHtmlDocument(activeDocument)) {
      patchActiveDocument({
        content: replaceReactFlowHtmlEmbed(activeDocument.content, target.index, data),
      });
      return;
    }

    if (target.kind === "insert") {
      if (isHtmlDocument(activeDocument)) {
        patchActiveDocument({
          content: `${activeDocument.content}\n${createReactFlowHtmlEmbed(data)}\n`,
        });
        return;
      }

      if (isMarkdownDocument(activeDocument)) {
        insertMarkdown(createReactFlowMarkdown(data));
      }
    }
  }

  function openMindMapEditor(target: MindMapEditTarget, code?: string) {
    let initialData = createDefaultMindMapDiagram();

    if (code) {
      try {
        initialData = parseMindMapDiagramData(code);
      } catch {
        initialData = createDefaultMindMapDiagram();
      }
    }

    setMindMapEditorState({ initialData, target });
  }

  function saveMindMapDiagram(data: MindMapDiagramData) {
    if (!activeDocument || !mindMapEditorState) {
      return;
    }

    const { target } = mindMapEditorState;

    if (target.kind === "markdown" && isMarkdownDocument(activeDocument)) {
      updateMarkdown(
        replaceMindMapMarkdownBlock(activeDocument.content, target.code, data),
      );
      return;
    }

    if (target.kind === "html" && isHtmlDocument(activeDocument)) {
      patchActiveDocument({
        content: replaceMindMapHtmlEmbed(activeDocument.content, target.index, data),
      });
      return;
    }

    if (target.kind === "insert") {
      if (isHtmlDocument(activeDocument)) {
        patchActiveDocument({
          content: `${activeDocument.content}\n${createMindMapHtmlEmbed(data)}\n`,
        });
        return;
      }

      if (isMarkdownDocument(activeDocument)) {
        insertMarkdown(createMindMapMarkdown(data));
      }
    }
  }

  function openUniverSheetEditor(target: UniverSheetEditTarget, code?: string) {
    let initialData = createDefaultUniverSheetData();

    if (code) {
      try {
        initialData = parseUniverSheetData(code);
      } catch {
        initialData = createDefaultUniverSheetData();
      }
    }

    setUniverSheetEditorState({ initialData, target });
  }

  function openNewUniverSheet() {
    if (!isMarkdownDocument(activeDocument)) {
      void createStandaloneSheetDocument();
      return;
    }

    openUniverSheetEditor({ kind: "insert" });
  }

  function saveUniverSheet(data: UniverSheetData) {
    if (!activeDocument || !univerSheetEditorState) {
      return;
    }

    const { target } = univerSheetEditorState;

    if (target.kind === "markdown" && isMarkdownDocument(activeDocument)) {
      updateMarkdown(
        replaceUniverSheetMarkdownBlock(activeDocument.content, target.code, data),
      );
      return;
    }

    if (target.kind === "insert" && isMarkdownDocument(activeDocument)) {
      insertMarkdown(createUniverSheetMarkdown(data));
      return;
    }

    if (target.kind === "document" && isSheetDocument(activeDocument)) {
      patchActiveDocument({
        content: serializeUniverSheetData(data),
        title: data.title || activeDocument.title,
      });
    }
  }

  function clearFindHighlight() {
    typoraEditorRef.current?.clearSearchHighlight();

    const editor = editorRef.current;

    if (!editor || editor.selectionStart === editor.selectionEnd) {
      return;
    }

    const cursor = editor.selectionEnd;
    editor.setSelectionRange(cursor, cursor);
  }

  function setFindReplaceDialogOpen(open: boolean) {
    if (!open) {
      clearFindHighlight();
    }

    setIsFindReplaceOpen(open);
  }

  function getSelectedTextForFind() {
    const editor = editorRef.current;

    if (!editor || editor.selectionStart === editor.selectionEnd) {
      return "";
    }

    const selectedText = editor.value.slice(editor.selectionStart, editor.selectionEnd);

    return selectedText.includes("\n") ? "" : selectedText;
  }

  function openFindReplaceDialog(replace = false) {
    const selectedText = getSelectedTextForFind();

    if (selectedText) {
      setFindQuery(selectedText);
    }

    setFindPanelMode(replace ? "replace" : "find");
    setFindMatchIndex(0);
    setFindReplaceDialogOpen(true);
    setTopMenu(null);
  }

  function openWorkspaceSearch() {
    setSidebarTab("search");
    setIsSidebarCollapsed(false);
    setIsActionsOpen(false);
    setTopMenu(null);
    void refreshWorkspaceSearchDocuments();
  }

  function closeWorkspaceSearch() {
    setWorkspaceSearchQuery("");
    setSidebarTab("current");
  }

  async function refreshWorkspaceSearchDocuments() {
    if (!workspace.workspacePath || !window.desktop?.listMarkdownFiles) {
      return;
    }

    const targetWorkspacePath = workspace.workspacePath;

    try {
      const localFiles = await window.desktop.listMarkdownFiles(targetWorkspacePath);
      const localDocuments = localFiles.map(createDocumentFromLocalFile);

      setWorkspace((current) => {
        if (current.workspacePath !== targetWorkspacePath) {
          return current;
        }

        const currentByPath = new Map(
          current.documents
            .filter((document) => document.filePath)
            .map((document) => [document.filePath!, document]),
        );
        const nextLocalDocuments = localDocuments.map((document) => {
          const currentDocument = currentByPath.get(document.filePath!);

          if (!currentDocument) {
            savedFileContentByPathRef.current.set(document.filePath!, document.content);
            return document;
          }

          const savedContent = savedFileContentByPathRef.current.get(
            currentDocument.filePath!,
          );
          const hasUnsavedChanges =
            savedContent !== undefined && savedContent !== currentDocument.content;

          if (hasUnsavedChanges) {
            return currentDocument;
          }

          savedFileContentByPathRef.current.set(document.filePath!, document.content);
          return {
            ...document,
            drawings: currentDocument.drawings,
            id: currentDocument.id,
          };
        });
        const externalDocuments = current.documents.filter(
          (document) => !isDocumentInsideWorkspace(document, targetWorkspacePath),
        );
        const nextDocuments = [...nextLocalDocuments, ...externalDocuments];

        if (workspaceSearchQuery.trim()) {
          setWorkspaceSearchGroups(
            getWorkspaceSearchGroups(
              nextDocuments,
              workspaceSearchQuery,
              targetWorkspacePath,
            ),
          );
        }

        return {
          ...current,
          documents: nextDocuments,
        };
      });
    } catch {
      setSaveState("failed");
    }
  }

  function revealDocumentRange(
    start: number,
    end: number,
    options: RevealDocumentRangeOptions = {},
  ) {
    const content = options.content ?? activeDocument?.content ?? "";
    const query = options.query ?? content.slice(start, end);
    const occurrenceIndex = options.occurrenceIndex ?? findMatchIndex;
    const { lineIndex } = getLineColumnAtOffset(content, start);
    const didRevealInTypora =
      mode === "typora" &&
      typoraEditorRef.current?.revealSearchResult({
        occurrenceIndex,
        preserveRendered: options.preserveRendered,
        query,
      });

    if (didRevealInTypora) {
      typoraEditorRef.current?.scrollToLine(lineIndex);
      return;
    }

    const editor = editorRef.current;

    if (!editor) {
      typoraEditorRef.current?.scrollToLine(lineIndex);
      return;
    }

    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, end);
      centerTextareaRangeInView(editor, start, content);
    });
  }

  function revealWorkspaceSearchMatch(
    document: MarkdownDocument,
    match: MarkdownSearchMatch,
    query: string,
  ) {
    setIsHomeOpen(false);

    if (!isMarkdownDocument(document)) {
      return;
    }

    const occurrenceIndex = getMatchOccurrenceIndex(document, query, match);
    const targetMatch =
      findMarkdownSearchMatches(
        document.content,
        query,
        getDocumentType(document),
      )[occurrenceIndex] ?? match;

    revealDocumentRange(targetMatch.start, targetMatch.end, {
      content: document.content,
      occurrenceIndex,
      preserveRendered: sidebarTab === "search",
      query,
    });
  }

  async function openWorkspaceSearchMatch(
    document: MarkdownDocument,
    match: MarkdownSearchMatch,
  ) {
    const query = workspaceSearchQuery.trim();

    if (!query) {
      return;
    }

    setFindQuery(query);

    if (!document.filePath || activeDocument?.filePath === document.filePath) {
      setActiveDocument(document.id);
      requestAnimationFrame(() => revealWorkspaceSearchMatch(document, match, query));
      return;
    }

    pendingWorkspaceSearchRevealRef.current = {
      filePath: document.filePath,
      match,
      query,
    };
    await openFileFromTree(document.filePath);
  }

  function goToFindMatch(nextIndex: number) {
    const match = findMatches[nextIndex];

    if (!match) {
      return;
    }

    setFindMatchIndex(nextIndex);
    revealDocumentRange(match.start, match.end, {
      occurrenceIndex: nextIndex,
      query: findQuery,
    });
  }

  function moveFindMatch(direction: -1 | 1) {
    if (!findMatches.length) {
      return;
    }

    const nextIndex =
      (findMatchIndex + direction + findMatches.length) % findMatches.length;

    goToFindMatch(nextIndex);
  }

  function replaceCurrentFindMatch() {
    if (
      !activeDocument ||
      !isMarkdownDocument(activeDocument) ||
      !activeFindMatch ||
      !findQuery
    ) {
      return;
    }

    const nextContent =
      activeDocument.content.slice(0, activeFindMatch.start) +
      replaceQuery +
      activeDocument.content.slice(activeFindMatch.end);
    const replacementEnd = activeFindMatch.start + replaceQuery.length;

    updateMarkdown(nextContent);
    setFindMatchIndex((current) => Math.max(0, current));
    requestAnimationFrame(() => {
      revealDocumentRange(activeFindMatch.start, replacementEnd, {
        content: nextContent,
        occurrenceIndex: findMatchIndex,
        query: replaceQuery,
      });
    });
  }

  function replaceAllFindMatches() {
    if (!activeDocument || !isMarkdownDocument(activeDocument) || !findMatches.length || !findQuery) {
      return;
    }

    let cursor = 0;
    let nextContent = "";

    findMatches.forEach((match) => {
      nextContent += activeDocument.content.slice(cursor, match.start);
      nextContent += replaceQuery;
      cursor = match.end;
    });

    nextContent += activeDocument.content.slice(cursor);
    updateMarkdown(nextContent);
    setFindMatchIndex(0);

    const firstMatch = findMatches[0];

    if (firstMatch) {
      requestAnimationFrame(() => {
        revealDocumentRange(
          firstMatch.start,
          firstMatch.start + replaceQuery.length,
          {
            content: nextContent,
            occurrenceIndex: 0,
            query: replaceQuery,
          },
        );
      });
    }
  }

  async function openMarkdownFile() {
    try {
      const localFile = await window.desktop?.selectMarkdownFile?.();

      if (!localFile) {
        return;
      }

      const document = createDocumentFromLocalFile(localFile);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) => ({
        ...current,
        activeDocumentId: document.id,
        documents: mergeDocumentByFilePath(current.documents, document),
        workspacePath: current.workspacePath || getDirectoryPath(document.filePath),
      }));
      setIsHomeOpen(false);
      setTopMenu(null);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  function insertMarkdown(markdown: string) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.insertMarkdown(markdown);
      return;
    }

    const editor = editorRef.current;
    const content = activeDocument.content;

    if (!editor) {
      updateMarkdown(`${content}\n${markdown}`);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextContent = `${content.slice(0, start)}${markdown}${content.slice(end)}`;

    updateMarkdown(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + markdown.length;
      editor.setSelectionRange(cursor, cursor);
    });
  }

  function getSelectedEditorText() {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return "";
    }

    return activeDocument.content.slice(editor.selectionStart, editor.selectionEnd);
  }

  function wrapTextareaSelection(prefix: string, suffix: string, placeholder: string) {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      insertMarkdown(`${prefix}${placeholder}${suffix}`);
      return;
    }

    const edit = createWrappedSelectionEdit(
      activeDocument.content,
      editor.selectionStart,
      editor.selectionEnd,
      prefix,
      suffix,
      placeholder,
    );

    setTextareaContent(editor, edit.content, edit.selectionStart, edit.selectionEnd);
  }

  function clearTextareaInlineStyle() {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return;
    }

    const edit = createClearInlineStyleEdit(getSelectedTextareaLineRange(editor));

    setTextareaContent(
      editor,
      edit.content,
      edit.selectionStart,
      edit.selectionEnd,
    );
  }

  function getTextareaLinkRange() {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return null;
    }

    return findMarkdownLinkInRange(getSelectedTextareaLineRange(editor));
  }

  function removeTextareaLink() {
    const editor = editorRef.current;
    const link = getTextareaLinkRange();

    if (!editor || !activeDocument || !link) {
      return;
    }

    const edit = createRemoveMarkdownLinkEdit(activeDocument.content, link);

    setTextareaContent(
      editor,
      edit.content,
      edit.selectionStart,
      edit.selectionEnd,
    );
  }

  function updateTextareaImage(command: TyporaFormatCommand) {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return false;
    }

    const edit = createMarkdownImageEdit(getSelectedTextareaLineRange(editor), {
      align: command.type === "imageAlign" ? command.align : undefined,
      resetWidth: command.type === "imageResetSize",
    });

    if (!edit) {
      return false;
    }

    setTextareaContent(editor, edit.content, edit.selectionStart, edit.selectionEnd);
    return true;
  }

  function runFormatCommand(command: TyporaFormatCommand) {
    if (
      (!activeDocument || !isMarkdownDocument(activeDocument)) &&
      command.type !== "copyLink" &&
      command.type !== "openLink"
    ) {
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.runFormatCommand(command);
      return;
    }

    switch (command.type) {
      case "bold":
        wrapTextareaSelection("**", "**", "加粗文本");
        break;
      case "italic":
        wrapTextareaSelection("*", "*", "斜体文本");
        break;
      case "underline":
        wrapTextareaSelection("<u>", "</u>", "下划线文本");
        break;
      case "inlineCode":
        wrapTextareaSelection("`", "`", "code");
        break;
      case "strikethrough":
        wrapTextareaSelection("~~", "~~", "删除线文本");
        break;
      case "comment":
        wrapTextareaSelection("<!-- ", " -->", "注释");
        break;
      case "link":
        wrapTextareaSelection("[", `](${command.href.trim() || "https://"})`, "链接文本");
        break;
      case "removeLink":
        removeTextareaLink();
        break;
      case "copyLink": {
        const href = getTextareaLinkRange()?.href;

        if (href) {
          void navigator.clipboard?.writeText(href);
        }
        break;
      }
      case "openLink": {
        const href = getTextareaLinkRange()?.href;

        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
        break;
      }
      case "clearStyle":
        clearTextareaInlineStyle();
        break;
      case "imageAlign":
      case "imageResetSize":
        updateTextareaImage(command);
        break;
    }
  }

  function createLinkFromPrompt() {
    const selectedText = getSelectedEditorText().trim();
    const defaultHref = /^https?:\/\//i.test(selectedText) ? selectedText : "https://";
    const href = window.prompt("链接地址", defaultHref);

    if (href === null) {
      return;
    }

    runFormatCommand({ type: "link", href });
  }

  function insertTable(size: TableSize) {
    insertMarkdown(createMarkdownTable(size));
  }

  async function handleImageFile(file: File) {
    if (!isMarkdownDocument(activeDocument)) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      insertMarkdown(`![${file.name}](${dataUrl} "align=left") `);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );

    if (!image) {
      return;
    }

    event.preventDefault();
    await handleImageFile(image);
  }

  async function saveNow() {
    try {
      saveWorkspace(workspace);

      if (
        isWritableTextDocument(activeDocument) &&
        activeDocument?.filePath &&
        window.desktop?.writeMarkdownFile
      ) {
        await window.desktop.writeMarkdownFile({
          content: activeDocument.content,
          filePath: activeDocument.filePath,
        });
        savedFileContentByPathRef.current.set(
          activeDocument.filePath,
          activeDocument.content,
        );
      }

      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  async function saveActiveDocumentAs() {
    if (!activeDocument) {
      return;
    }

    if (!isMarkdownDocument(activeDocument)) {
      window.alert("This file type is preview-only.");
      return;
    }

    try {
      const savedFile = await window.desktop?.saveMarkdownFileAs?.({
        content: activeDocument.content,
        filePath: activeDocument.filePath,
        title: activeDocument.title,
      });

      if (!savedFile) {
        return;
      }

      const document = {
        ...activeDocument,
        content: savedFile.content,
        documentType: savedFile.documentType,
        fileExtension: savedFile.fileExtension,
        filePath: savedFile.filePath,
        title: savedFile.title,
        updatedAt: savedFile.updatedAt,
      };

      savedFileContentByPathRef.current.set(savedFile.filePath, savedFile.content);
      rememberRecentDirectory(getDirectoryPath(savedFile.filePath));
      setWorkspace((current) => ({
        ...updateDocument(current, document),
        activeDocumentId: document.id,
        workspacePath:
          current.workspacePath ||
          getDirectoryPath(savedFile.filePath) ||
          current.workspacePath,
      }));
      setSaveState("saved");
      await loadDirectoryTree(getDirectoryPath(savedFile.filePath));
    } catch {
      setSaveState("failed");
      window.alert("另存为失败，请确认目标路径可写。");
    }
  }

  async function exportActiveDocument(format: "html" | "pdf") {
    if (!activeDocument) {
      return;
    }

    if (!isMarkdownDocument(activeDocument)) {
      window.alert("This file type is preview-only and cannot be exported from Markdown mode.");
      return;
    }

    if (!window.desktop?.exportHtmlFile || !window.desktop.exportPdfFile) {
      window.alert("当前运行环境不支持导出。");
      return;
    }

    try {
      const html = await createMarkdownExportHtml({
        document: activeDocument,
        theme,
      });
      const exportedFilePath =
        format === "pdf"
          ? await window.desktop.exportPdfFile({
              filePath: activeDocument.filePath,
              html,
              title: activeDocument.title,
            })
          : await window.desktop.exportHtmlFile({
              filePath: activeDocument.filePath,
              html,
              title: activeDocument.title,
            });

      if (exportedFilePath) {
        await window.desktop.showInFolder?.(exportedFilePath);
      }
    } catch {
      window.alert(format === "pdf" ? "导出 PDF 失败。" : "导出 HTML 失败。");
    }
  }

  async function saveAllNow() {
    try {
      saveWorkspace(workspace);

      const writableDocuments = workspace.documents.filter(
        (document) => isWritableTextDocument(document) && document.filePath,
      );

      if (window.desktop?.writeMarkdownFile) {
        await Promise.all(
          writableDocuments.map((document) =>
            window.desktop!.writeMarkdownFile({
              content: document.content,
              filePath: document.filePath!,
            }),
          ),
        );
        writableDocuments.forEach((document) => {
          savedFileContentByPathRef.current.set(document.filePath!, document.content);
        });
      }

      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  function getSelectedTextareaLineRange(textarea: HTMLTextAreaElement) {
    const content = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const lineStart = content.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
    const rawLineEnd = content.indexOf("\n", selectionEnd);
    const lineEnd =
      rawLineEnd < 0 ? content.length : Math.min(rawLineEnd + 1, content.length);

    return { content, lineEnd, lineStart, selectionEnd, selectionStart };
  }

  function setTextareaContent(
    textarea: HTMLTextAreaElement,
    content: string,
    selectionStart: number,
    selectionEnd = selectionStart,
  ) {
    updateMarkdown(content);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function moveTextareaLines(direction: "down" | "up") {
    const textarea = editorRef.current;

    if (!textarea || !activeDocument) {
      return;
    }

    const { content, lineEnd, lineStart } = getSelectedTextareaLineRange(textarea);
    const selectedText = content.slice(lineStart, lineEnd);

    if (direction === "up") {
      if (lineStart === 0) {
        return;
      }

      const previousLineStart = content.lastIndexOf("\n", lineStart - 2) + 1;
      const previousText = content.slice(previousLineStart, lineStart);
      const nextContent =
        content.slice(0, previousLineStart) +
        selectedText +
        previousText +
        content.slice(lineEnd);

      setTextareaContent(
        textarea,
        nextContent,
        previousLineStart,
        previousLineStart + selectedText.length,
      );
      return;
    }

    if (lineEnd >= content.length) {
      return;
    }

    const nextLineEndIndex = content.indexOf("\n", lineEnd);
    const nextLineEnd =
      nextLineEndIndex < 0 ? content.length : Math.min(nextLineEndIndex + 1, content.length);
    const nextText = content.slice(lineEnd, nextLineEnd);
    const nextContent =
      content.slice(0, lineStart) +
      nextText +
      selectedText +
      content.slice(nextLineEnd);

    setTextareaContent(
      textarea,
      nextContent,
      lineStart + nextText.length,
      lineStart + nextText.length + selectedText.length,
    );
  }

  function deleteTextareaSelectionOrLine() {
    const textarea = editorRef.current;

    if (!textarea || !activeDocument) {
      return;
    }

    const content = textarea.value;

    if (textarea.selectionStart !== textarea.selectionEnd) {
      const nextContent =
        content.slice(0, textarea.selectionStart) + content.slice(textarea.selectionEnd);
      setTextareaContent(textarea, nextContent, textarea.selectionStart);
      return;
    }

    const { lineEnd, lineStart } = getSelectedTextareaLineRange(textarea);
    const nextContent = content.slice(0, lineStart) + content.slice(lineEnd);

    setTextareaContent(textarea, nextContent, lineStart);
  }

  async function runEditCommand(command: TyporaEditCommand) {
    if (!activeDocument && command !== "copy") {
      return;
    }

    if (activeDocument && !isMarkdownDocument(activeDocument)) {
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.runEditCommand(command);
      return;
    }

    const textarea = editorRef.current;

    if (textarea) {
      textarea.focus();
    }

    switch (command) {
      case "moveLineUp":
        moveTextareaLines("up");
        break;
      case "moveLineDown":
        moveTextareaLines("down");
        break;
      case "delete":
        if (textarea) {
          deleteTextareaSelectionOrLine();
        } else {
          document.execCommand("delete");
        }
        break;
      case "paste":
        if (!document.execCommand("paste") && textarea && navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          const nextContent =
            textarea.value.slice(0, textarea.selectionStart) +
            text +
            textarea.value.slice(textarea.selectionEnd);
          const cursor = textarea.selectionStart + text.length;
          setTextareaContent(textarea, nextContent, cursor);
        }
        break;
      case "copy":
      case "cut":
      case "undo":
      case "redo":
        document.execCommand(command);
        break;
    }
  }

  function runParagraphCommand(command: TyporaParagraphCommand) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.runParagraphCommand(command);
      return;
    }

    const markdown = createParagraphCommandMarkdown(
      command,
      activeDocument?.content ?? "",
    );

    if (markdown) {
      insertMarkdown(markdown);
    }
  }

  function runTopMenuAction(action: () => void) {
    action();
    setTopMenu(null);
  }

  function renderMenubarDropdown(menu: MenubarMenu) {
    switch (menu) {
      case "file":
        return (
          <>
            <MenuSubmenu label="新建">
              <MenuItem label="Markdown 文件" shortcut="Ctrl+N" onSelect={() => runTopMenuAction(createNewDocument)} />
              <MenuItem label="在线表格文件" onSelect={() => runTopMenuAction(() => void createStandaloneSheetDocument())} />
              <MenuItem label="Excalidraw 文件" onSelect={() => runTopMenuAction(() => void createStandaloneDrawingDocument())} />
            </MenuSubmenu>
            <MenuItem label="新建窗口" shortcut="Ctrl+Shift+N" onSelect={() => runTopMenuAction(openNewWindow)} />
            <MenuSeparator />
            <MenuItem label="打开..." shortcut="Ctrl+O" onSelect={() => runTopMenuAction(() => void openMarkdownFile())} />
            <MenuItem label="打开文件夹..." onSelect={() => runTopMenuAction(() => void openWorkspaceFolder())} />
            <MenuSeparator />
            <MenuSubmenu label="打开最近文件" panelClassName="recent-file-submenu-panel">
              {recentDocuments.length ? (
                recentDocuments.map((document) => (
                  <RecentFileMenuItem
                    document={document}
                    exists={
                      document.filePath
                        ? recentFileAvailability[document.filePath]
                        : true
                    }
                    key={document.id}
                    onOpen={(recentDocument) =>
                      runTopMenuAction(() => void openRecentDocument(recentDocument))
                    }
                  />
                ))
              ) : (
                <MenuItem label="没有最近文件" disabled />
              )}
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem label="保存" shortcut="Ctrl+S" onSelect={() => runTopMenuAction(() => void saveNow())} />
            <MenuItem
              label="另存为..."
              shortcut="Ctrl+Shift+S"
              disabled={!isMarkdownDocument(activeDocument)}
              onSelect={() => runTopMenuAction(() => void saveActiveDocumentAs())}
            />
            <MenuItem label="保存全部打开的文件..." onSelect={() => runTopMenuAction(() => void saveAllNow())} />
            <MenuSeparator />
            <MenuSubmenu label="导出">
              <MenuItem
                label="导出为 PDF..."
                disabled={!isMarkdownDocument(activeDocument)}
                onSelect={() => runTopMenuAction(() => void exportActiveDocument("pdf"))}
              />
              <MenuItem
                label="导出为 HTML..."
                disabled={!isMarkdownDocument(activeDocument)}
                onSelect={() => runTopMenuAction(() => void exportActiveDocument("html"))}
              />
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem label="打开文件位置..." onSelect={() => runTopMenuAction(() => void showWorkspaceInFolder())} />
            <MenuItem label="在侧边栏中显示" onSelect={() => runTopMenuAction(() => {
              setIsSidebarCollapsed(false);
              setSidebarTab("files");
            })} />
            <MenuSeparator />
            <MenuItem label="偏好设置..." shortcut="Ctrl+逗号" onSelect={() => runTopMenuAction(() => setIsSettingsOpen(true))} />
          </>
        );
      case "edit":
        return (
          <>
            <MenuItem label="撤消" shortcut="Ctrl+Z" onSelect={() => runTopMenuAction(() => void runEditCommand("undo"))} />
            <MenuItem label="重做" shortcut="Ctrl+Y" onSelect={() => runTopMenuAction(() => void runEditCommand("redo"))} />
            <MenuSeparator />
            <MenuItem label="剪切" shortcut="Ctrl+X" onSelect={() => runTopMenuAction(() => void runEditCommand("cut"))} />
            <MenuItem label="复制" shortcut="Ctrl+C" onSelect={() => runTopMenuAction(() => void runEditCommand("copy"))} />
            <MenuItem label="拷贝图片" disabled />
            <MenuItem label="粘贴" shortcut="Ctrl+V" onSelect={() => runTopMenuAction(() => void runEditCommand("paste"))} />
            <MenuSeparator />
            <MenuItem label="插入 Excalidraw 流程图..." onSelect={() => runTopMenuAction(openNewDrawing)} />
            <MenuItem
              label="插入在线表格..."
              onSelect={() => runTopMenuAction(openNewUniverSheet)}
            />
            <MenuSeparator />
            <MenuItem label="复制为纯文本" disabled />
            <MenuItem label="复制为 Markdown" shortcut="Ctrl+Shift+C" disabled />
            <MenuItem label="复制为 HTML 代码" disabled />
            <MenuItem label="复制内容并简化格式" disabled />
            <MenuSeparator />
            <MenuItem label="粘贴为纯文本" shortcut="Ctrl+Shift+V" disabled />
            <MenuItem label="上移该行" shortcut="Alt+向上箭头" onSelect={() => runTopMenuAction(() => void runEditCommand("moveLineUp"))} />
            <MenuItem label="下移该行" shortcut="Alt+向下箭头" onSelect={() => runTopMenuAction(() => void runEditCommand("moveLineDown"))} />
            <MenuSeparator />
            <MenuItem label="删除" shortcut="Delete" onSelect={() => runTopMenuAction(() => void runEditCommand("delete"))} />
            <MenuSeparator />
            <MenuSubmenu label="查找和替换">
              <MenuItem label="查找..." shortcut="Ctrl+F" onSelect={() => runTopMenuAction(() => openFindReplaceDialog(false))} />
              <MenuItem label="替换..." shortcut="Ctrl+H" onSelect={() => runTopMenuAction(() => openFindReplaceDialog(true))} />
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem label="表情与符号" shortcut="Win 键+句号" disabled />
          </>
        );
      case "paragraph":
        return (
          <>
            <MenuItem label="一级标题" shortcut="Ctrl+1" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 1 }))} />
            <MenuItem label="二级标题" shortcut="Ctrl+2" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 2 }))} />
            <MenuItem label="三级标题" shortcut="Ctrl+3" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 3 }))} />
            <MenuItem label="四级标题" shortcut="Ctrl+4" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 4 }))} />
            <MenuItem label="五级标题" shortcut="Ctrl+5" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 5 }))} />
            <MenuItem label="六级标题" shortcut="Ctrl+6" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "heading", level: 6 }))} />
            <MenuSeparator />
            <MenuItem label="提升标题级别" shortcut="Ctrl+=" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "promoteHeading" }))} />
            <MenuItem label="降低标题级别" shortcut="Ctrl+-" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "demoteHeading" }))} />
            <MenuSeparator />
            <MenuItem label="表格" onSelect={() => runTopMenuAction(() => insertTable({ columns: 3, rows: 3 }))} />
            <MenuItem label="公式块" shortcut="Ctrl+Shift+M" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "mathBlock" }))} />
            <MenuItem label="代码块" shortcut="Ctrl+Shift+K" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "codeBlock" }))} />
            <MenuItem label="代码工具" submenu disabled />
            <MenuSubmenu label="警告框">
              {markdownAlertOptions.map((option) => (
                <MenuItem
                  key={option.kind}
                  label={option.contentLabel}
                  onSelect={() =>
                    runTopMenuAction(() =>
                      runParagraphCommand({ type: "alert", kind: option.kind }),
                    )
                  }
                />
              ))}
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem label="引用" shortcut="Ctrl+Shift+Q" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "blockquote" }))} />
            <MenuSeparator />
            <MenuItem label="有序列表" shortcut="Ctrl+Shift+[" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "orderedList" }))} />
            <MenuItem label="无序列表" shortcut="Ctrl+Shift+]" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "bulletList" }))} />
            <MenuItem label="任务列表" shortcut="Ctrl+Shift+X" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "taskList" }))} />
            <MenuItem label="任务状态" submenu disabled />
            <MenuItem label="增加列表缩进" shortcut="Tab" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "indentList" }))} />
            <MenuItem label="减少列表缩进" shortcut="Shift+Tab" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "outdentList" }))} />
            <MenuSeparator />
            <MenuItem label="在上方插入段落" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "insertParagraphBefore" }))} />
            <MenuItem label="在下方插入段落" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "insertParagraphAfter" }))} />
            <MenuSeparator />
            <MenuItem label="链接引用" disabled />
            <MenuItem label="脚注" disabled />
            <MenuSeparator />
            <MenuItem label="水平分割线" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "horizontalRule" }))} />
            <MenuItem label="内容目录" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "toc" }))} />
            <MenuItem label="YAML Front Matter" disabled />
          </>
        );
      case "format":
        return (
          <>
            <MenuItem label="加粗" shortcut="Ctrl+B" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "bold" }))} />
            <MenuItem label="斜体" shortcut="Ctrl+I" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "italic" }))} />
            <MenuItem label="下划线" shortcut="Ctrl+U" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "underline" }))} />
            <MenuItem label="代码" shortcut="Ctrl+Shift+`" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "inlineCode" }))} />
            <MenuSeparator />
            <MenuItem label="删除线" shortcut="Alt+Shift+5" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "strikethrough" }))} />
            <MenuItem label="注释" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "comment" }))} />
            <MenuSeparator />
            <MenuItem label="超链接" shortcut="Ctrl+K" onSelect={() => runTopMenuAction(createLinkFromPrompt)} />
            <MenuSubmenu label="链接操作">
              <MenuItem label="打开链接" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "openLink" }))} />
              <MenuItem label="复制链接" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "copyLink" }))} />
              <MenuItem label="移除链接" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "removeLink" }))} />
            </MenuSubmenu>
            <MenuSubmenu label="图像">
              <MenuItem label="插入本地图片..." onSelect={() => runTopMenuAction(() => readFileInput(imageInputRef.current))} />
              <MenuSeparator />
              <MenuItem label="左对齐" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "left" }))} />
              <MenuItem label="居中" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "center" }))} />
              <MenuItem label="右对齐" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "right" }))} />
              <MenuItem label="恢复原始大小" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageResetSize" }))} />
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem label="清除样式" shortcut="Ctrl+\\" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "clearStyle" }))} />
          </>
        );
      case "view":
        return (
          <>
            <MenuItem label="显示 / 隐藏侧边栏" shortcut="Ctrl+Shift+L" onSelect={() => runTopMenuAction(() => setIsSidebarCollapsed((current) => !current))} />
            <MenuItem label="大纲" shortcut="Ctrl+Shift+1" onSelect={() => runTopMenuAction(() => setSidebarTab("current"))} />
            <MenuItem label="文档列表" shortcut="Ctrl+Shift+2" onSelect={() => runTopMenuAction(() => setIsHomeOpen(true))} />
            <MenuItem label="文件树" shortcut="Ctrl+Shift+3" onSelect={() => runTopMenuAction(() => setSidebarTab("files"))} />
            <MenuItem label="搜索" shortcut="Ctrl+Shift+F" onSelect={() => runTopMenuAction(() => openFindReplaceDialog(false))} />
            <MenuSeparator />
            <MenuItem label="显示状态栏" checked disabled />
            <MenuItem label="字数统计窗口" disabled />
            <MenuSeparator />
            <MenuItem label="切换全屏" shortcut="F11" disabled />
            <MenuItem label="保持窗口在最前端" disabled />
            <MenuSeparator />
            <MenuItem label="实际大小" shortcut="Ctrl+Shift+9" checked disabled />
            <MenuItem label="放大" shortcut="Ctrl+Shift+=" disabled />
            <MenuItem label="缩小" shortcut="Ctrl+Shift+-" disabled />
            <MenuSeparator />
            <MenuItem label="应用内窗口切换" shortcut="Ctrl+Tab 键" disabled />
          </>
        );
      case "theme":
        return (
          <>
            {themeOptions.map((option) => (
              <MenuItem
                checked={theme === option.value}
                key={option.value}
                label={option.label}
                onSelect={() => runTopMenuAction(() => setTheme(option.value))}
              />
            ))}
          </>
        );
      case "help":
        return (
          <>
            <MenuItem
              label="关于 Typora Like"
              onSelect={() =>
                runTopMenuAction(() => {
                  setBackupMessage("Markdown 编辑器 · Electron + Milkdown");
                })
              }
            />
            <MenuItem label="打开设置" onSelect={() => runTopMenuAction(() => setIsSettingsOpen(true))} />
          </>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <main
        className={
          isSidebarCollapsed
            ? "app-shell app-shell-sidebar-collapsed"
            : "app-shell"
        }
        style={
          {
            "--sidebar-width": `${isSidebarCollapsed ? 0 : sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <header className="app-menubar">
          <div className="menubar-left">
            <button
              className="app-logo-button"
              type="button"
              aria-label="返回首页"
              onClick={() => setIsHomeOpen(true)}
            >
              <img className="app-logo-image" src={appLogoUrl} alt="" draggable={false} />
            </button>
            <nav className="menubar-menu" aria-label="应用菜单">
              {menubarItems.map((item) => (
                <div className="menubar-item" key={item.key}>
                  <button
                    className={
                      topMenu === item.key
                        ? "menubar-trigger menubar-trigger-active"
                        : "menubar-trigger"
                    }
                    type="button"
                    aria-expanded={topMenu === item.key}
                    onMouseEnter={() => {
                      if (topMenu) {
                        setTopMenu(item.key);
                      }
                    }}
                    onClick={() =>
                      setTopMenu((current) => (current === item.key ? null : item.key))
                    }
                  >
                    {item.label}
                  </button>
                  {topMenu === item.key && (
                    <div
                      className={`menubar-dropdown menubar-dropdown-${item.key}`}
                      role="menu"
                      aria-label={item.label}
                      onPointerDown={(event) => {
                        if (
                          event.target instanceof Element &&
                          !event.target.closest("button")
                        ) {
                          setTopMenu(null);
                        }
                      }}
                    >
                      {renderMenubarDropdown(item.key)}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          <div className="window-controls" aria-label="窗口控制">
            <button
              className="window-control-button"
              type="button"
              aria-label="最小化"
              onClick={() => void window.desktop?.windowControl?.("minimize")}
            >
              <Minus size={15} />
            </button>
            <button
              className="window-control-button"
              type="button"
              aria-label="最大化"
              onClick={() => void window.desktop?.windowControl?.("maximize")}
            >
              <Square size={12} />
            </button>
            <button
              className="window-control-button window-control-close"
              type="button"
              aria-label="关闭"
              onClick={() => void window.desktop?.windowControl?.("close")}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <aside className="sidebar explorer-sidebar" aria-hidden={isSidebarCollapsed}>
          <div className="explorer-tabs" role="tablist" aria-label="侧边栏视图">
            <button
              className={sidebarTab === "files" ? "explorer-tab explorer-tab-active" : "explorer-tab"}
              type="button"
              role="tab"
              aria-selected={sidebarTab === "files"}
              onClick={() => setSidebarTab("files")}
            >
              文件
            </button>
            <button
              className={
                sidebarTab === "current" || sidebarTab === "search"
                  ? "explorer-tab explorer-tab-active"
                  : "explorer-tab"
              }
              type="button"
              role="tab"
              aria-selected={sidebarTab === "current" || sidebarTab === "search"}
              onClick={() =>
                setSidebarTab(isWorkspaceSearchTabVisible ? "search" : "current")
              }
            >
              {isWorkspaceSearchTabVisible ? "查找" : "当前文件"}
            </button>
          </div>

          <div
            className="explorer-tree"
            aria-label={
              sidebarTab === "files"
                ? "文件目录"
                : sidebarTab === "search"
                  ? "查找"
                  : "当前文件"
            }
          >
            {sidebarTab === "files" ? (
              directoryTree ? (
                directoryTree.children?.length ? (
                  fileExplorerView === "tree" ? (
                    <div className="directory-tree-root">
                      <DirectoryTreeItems
                        activeDirectoryPath={getDirectoryPath(activeDocument?.filePath)}
                        activeFilePath={activeDocument?.filePath}
                        expandedPaths={expandedDirectoryPaths}
                        items={directoryTree.children ?? []}
                        level={0}
                        onOpenFile={(filePath) => {
                          void openFileFromTree(filePath);
                        }}
                        onToggleDirectory={toggleDirectoryPath}
                      />
                    </div>
                  ) : (
                    <DirectoryFileList
                      activeFilePath={activeDocument?.filePath}
                      documents={workspace.documents}
                      items={directoryTree.children ?? []}
                      workspacePath={workspace.workspacePath}
                      onOpenFile={(filePath) => {
                        void openFileFromTree(filePath);
                      }}
                    />
                  )
                ) : (
                  <div className="explorer-empty">
                    <FolderOpen size={24} />
                    <strong>{workspaceLabel}</strong>
                  <span>当前文件夹中没有找到可打开的文档</span>
                    <button type="button" onClick={createNewDocument}>
                      新建 Markdown 文件
                    </button>
                  </div>
                )
              ) : (
                <div className="explorer-empty">
                  <FolderOpen size={24} />
                  <strong>选择本地文件夹</strong>
                  <span>打开目录后，会递归读取并显示其中的 .md、.html、.pdf、.docx、.univer、.excalidraw 文件</span>
                  <button type="button" onClick={() => void openWorkspaceFolder()}>
                    打开文件夹
                  </button>
                </div>
              )
            ) : sidebarTab === "search" ? (
              <WorkspaceSearchPanel
                groups={workspaceSearchGroups}
                inputRef={workspaceSearchInputRef}
                matchCount={workspaceSearchMatchCount}
                query={workspaceSearchQuery}
                workspacePath={workspace.workspacePath}
                onClose={closeWorkspaceSearch}
                onOpenMatch={(document, match) => {
                  void openWorkspaceSearchMatch(document, match);
                }}
                onQueryChange={setWorkspaceSearchQuery}
              />
            ) : activeDocument && activeDocumentOutline.length ? (
              <div className="outline-tree">
                {activeDocumentOutline.map((entry) => (
                  <button
                    className={
                      activeEditorLineIndex === entry.lineIndex
                        ? "outline-item outline-item-active"
                        : "outline-item"
                    }
                    key={entry.id}
                    style={
                      {
                        "--outline-depth": `${Math.max(entry.level - 1, 0) * 14}px`,
                      } as CSSProperties
                    }
                    type="button"
                    onClick={() => {
                      setIsHomeOpen(false);
                      typoraEditorRef.current?.scrollToLine(entry.lineIndex);
                      setActiveEditorLineIndex(entry.lineIndex);
                    }}
                  >
                    <span>{entry.title}</span>
                  </button>
                ))}
              </div>
            ) : activeDocument ? (
              <div className="outline-empty">当前文件没有可显示的标题</div>
            ) : (
              <div className="outline-empty" aria-label="当前文件为空" />
            )}
          </div>

          {isActionsOpen && (
            <div className="sidebar-actions-popover" role="dialog" aria-label="操作">
              <div className="sidebar-popover-header">
                <span>操作</span>
                <button
                  className="sidebar-popover-close"
                  type="button"
                  aria-label="关闭"
                  onClick={() => setIsActionsOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <button type="button" onClick={createNewDocument}>
                <FilePlus2 size={16} />
                新建文件
              </button>
              <button type="button" onClick={() => void createStandaloneSheetDocument()}>
                <Table2 size={16} />
                新建在线表格
              </button>
              <button type="button" onClick={() => void createStandaloneDrawingDocument()}>
                <FileText size={16} />
                新建 Excalidraw
              </button>
              <button type="button" onClick={openWorkspaceSearch}>
                <Search size={16} />
                搜索
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActionsOpen(false);
                  void loadDirectoryTree();
                }}
              >
                <RefreshCw size={16} />
                刷新
              </button>
              <button
                type="button"
                onClick={() => {
                  void showWorkspaceInFolder();
                }}
              >
                <ExternalLink size={16} />
                在资源管理器中显示
              </button>
              <button
                type="button"
                onClick={() => {
                  void openWorkspaceFolder();
                }}
              >
                <FolderOpen size={16} />
                打开文件夹...
              </button>
              {recentDirectories.length ? (
                <div className="sidebar-popover-section sidebar-recent-directories">
                  <span>最近使用的目录</span>
                  {recentDirectories.map((directory) => (
                    <button
                      type="button"
                      key={directory.path}
                      title={directory.path}
                      onClick={() => {
                        void openWorkspaceDirectoryPath(directory.path);
                      }}
                    >
                      <Folder size={16} />
                      <span className="sidebar-recent-directory-label">
                        {directory.label}
                      </span>
                      {directory.isCurrent ? (
                        <span
                          className="sidebar-recent-directory-current"
                          aria-label="当前目录"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="explorer-header explorer-footer-bar">
            <button
              className="explorer-footer-icon-button"
              type="button"
              aria-label="新建文件"
              title="新建文件"
              onClick={createNewDocument}
            >
              <Plus size={17} />
            </button>
            <button
              className="explorer-footer-folder"
              title={workspace.workspacePath || workspaceLabel}
              type="button"
              aria-expanded={isActionsOpen}
              data-sidebar-actions-trigger
              onClick={() => setIsActionsOpen((current) => !current)}
            >
              {workspaceLabel}
            </button>
            <button
              className="explorer-footer-icon-button"
              type="button"
              aria-label={fileExplorerView === "tree" ? "切换到文件列表" : "切换到树状图"}
              title={fileExplorerView === "tree" ? "切换到文件列表" : "切换到树状图"}
              onClick={() => {
                setSidebarTab("files");
                setFileExplorerView((current) => (current === "tree" ? "list" : "tree"));
              }}
            >
              {fileExplorerView === "tree" ? <Rows3 size={17} /> : <ListTree size={17} />}
            </button>
          </div>
        </aside>

        <div
          className={[
            "sidebar-resizer",
            isSidebarCollapsed ? "sidebar-resizer-collapsed" : "",
            isSidebarResizing ? "sidebar-resizer-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onDoubleClick={() => setIsSidebarCollapsed((current) => !current)}
          onPointerDown={startSidebarResize}
        />

        <section className="workspace">
          {isHomeOpen || !activeDocument ? (
            <section className="welcome-home">
              <div className="welcome-hero">
                <div className="welcome-logo">
                  <img src={appLogoUrl} alt="" draggable={false} />
                </div>
                <h1>
                  欢迎使用 <span>Markdown</span> 编辑器
                </h1>
                <p>专注于写作与思考，让 Markdown 创作更高效优雅。</p>
                <WelcomeIllustration />
              </div>

              <section
                className={
                  isRecentExpanded
                    ? "recent-documents recent-documents-expanded"
                    : "recent-documents"
                }
              >
                <div className="recent-header">
                  <h2>最近文档</h2>
                  {hasMoreRecentDocuments && (
                    <button
                      type="button"
                      aria-expanded={isRecentExpanded}
                      onClick={() => setIsRecentExpanded((current) => !current)}
                    >
                      {isRecentExpanded ? "收起" : "更多"}
                      <ChevronRight
                        className={isRecentExpanded ? "recent-more-icon-expanded" : undefined}
                        size={16}
                      />
                    </button>
                  )}
                </div>
                <div
                  className={
                    isRecentExpanded ? "recent-list recent-list-expanded" : "recent-list"
                  }
                >
                  {visibleRecentDocuments.map((document) => (
                    <button
                      className="recent-row"
                      key={document.id}
                      type="button"
                      onClick={() => void openRecentDocument(document)}
                    >
                      <FileText size={16} />
                      <strong>{getDocumentDisplayName(document)}</strong>
                      <span>{getDocumentPathPreview(document, workspace.workspacePath)}</span>
                      <time dateTime={document.updatedAt}>
                        {formatRecentTimestamp(document.updatedAt)}
                      </time>
                    </button>
                  ))}
                </div>
                <p className="welcome-tip">
                  提示：您可以通过拖拽文件或文件夹到侧边栏来快速导入
                </p>
              </section>
            </section>
          ) : (
            <section className="editor-workspace">
              {isHtmlDocument(activeDocument) ? (
                <HtmlDocumentViewer
                  document={activeDocument}
                  onEditMindMap={({ code, index }) =>
                    openMindMapEditor({ index, kind: "html" }, code)
                  }
                  onEditReactFlow={({ code, index }) =>
                    openReactFlowEditor({ index, kind: "html" }, code)
                  }
                />
              ) : isPdfDocument(activeDocument) ? (
                <PdfDocumentViewer
                  document={activeDocument}
                  onReload={() => void reloadDocumentFromDisk(activeDocument)}
                />
              ) : isWordDocument(activeDocument) ? (
                <WordDocumentViewer document={activeDocument} />
              ) : isSheetDocument(activeDocument) ? (
                <section className="standalone-document-viewer standalone-sheet-viewer">
                  <UniverSheetPreview
                    code={activeDocument.content}
                    onEdit={(code) =>
                      openUniverSheetEditor({ kind: "document" }, code)
                    }
                  />
                </section>
              ) : isDrawingDocument(activeDocument) ? (
                <section className="standalone-document-viewer standalone-drawing-viewer">
                  <div className="standalone-document-card">
                    <FileText size={26} />
                    <div>
                      <h2>{getDocumentDisplayName(activeDocument)}</h2>
                      <p>Excalidraw drawing file</p>
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => setDrawingDialogOpen(true)}
                    >
                      编辑画板
                    </button>
                  </div>
                </section>
              ) : (
                <div className={`editor-layout editor-layout-${mode}`}>
                  {mode === "typora" && (
                    <TyporaEditor
                      ref={typoraEditorRef}
                      documentId={activeDocument.id}
                      filePath={activeDocument.filePath}
                      value={activeDocument.content}
                      onChange={updateMarkdown}
                      onActiveLineChange={setActiveEditorLineIndex}
                      onEditDrawing={openDrawingEditor}
                      onEditUniverSheet={(code) =>
                        openUniverSheetEditor({ code, kind: "markdown" }, code)
                      }
                      onPaste={handlePaste}
                    />
                  )}

                  {(mode === "source" || mode === "split") && (
                    <textarea
                      ref={editorRef}
                      className="markdown-input"
                      spellCheck={false}
                      value={activeDocument.content}
                      onChange={(event) => updateMarkdown(event.target.value)}
                      onPaste={handlePaste}
                    />
                  )}

                  {(mode === "split" || mode === "preview") && (
                    <article className="markdown-preview">
                      <MarkdownRenderer
                        filePath={activeDocument.filePath}
                        onEditMindMap={(code) =>
                          openMindMapEditor({ code, kind: "markdown" }, code)
                        }
                        onEditReactFlow={(code) =>
                          openReactFlowEditor({ code, kind: "markdown" }, code)
                        }
                        onEditUniverSheet={(code) =>
                          openUniverSheetEditor({ code, kind: "markdown" }, code)
                        }
                      >
                        {activeDocument.content}
                      </MarkdownRenderer>
                    </article>
                  )}
                </div>
              )}
            </section>
          )}
          <footer className="workspace-statusbar">
            <button
              className="workspace-status-button"
              type="button"
              aria-label={isSidebarCollapsed ? "展开左侧栏" : "折叠左侧栏"}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              {isSidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <span className="workspace-status-spacer" />
            <span className="workspace-word-count">
              {isHtmlDocument(activeDocument)
                ? "HTML preview"
                : isPdfDocument(activeDocument)
                  ? "PDF preview"
                  : isWordDocument(activeDocument)
                    ? "Word preview"
                    : isSheetDocument(activeDocument)
                      ? "Sheet"
                      : isDrawingDocument(activeDocument)
                        ? "Excalidraw"
                        : `${activeDocument ? activeDocumentWordCount : 0} 词`}
            </span>
          </footer>
        </section>

        <input
          ref={imageInputRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void handleImageFile(file);
            }
          }}
        />

        <Dialog.Root open={isDrawingOpen} onOpenChange={setDrawingDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="drawing-dialog">
              <Dialog.Title className="sr-only">Excalidraw 流程图</Dialog.Title>
              <Suspense
                fallback={
                  <section className="drawing-modal drawing-loading">
                    正在加载画板
                  </section>
                }
              >
                {activeDocument &&
                  (isMarkdownDocument(activeDocument) ||
                    isDrawingDocument(activeDocument)) && (
                  <DrawingModal
                    key={editingDrawingAsset?.id ?? "new-drawing"}
                    assetIndex={Object.keys(activeDocument.drawings).length + 1}
                    initialAsset={editingDrawingAsset ?? undefined}
                    onClose={() => setDrawingDialogOpen(false)}
                    onInsert={(asset: DrawingAsset) => {
                      if (isDrawingDocument(activeDocument)) {
                        patchActiveDocument({
                          content: asset.sceneJSON,
                          title: asset.name || activeDocument.title,
                        });
                        return;
                      }

                      const shouldUpdatePreview = Boolean(editingDrawingAsset);
                      const nextContent = shouldUpdatePreview
                        ? replaceExcalidrawImagePreview(activeDocument.content, asset)
                        : activeDocument.content;

                      patchActiveDocument({
                        content: nextContent,
                        drawings: {
                          ...activeDocument.drawings,
                          [asset.id]: asset,
                        },
                        title: renameFromMarkdown(nextContent, activeDocument.title),
                      });
                      if (!shouldUpdatePreview) {
                        insertMarkdown(
                          `![${asset.name}](${asset.dataUrl} "excalidraw:${asset.id} align=left") `,
                        );
                      }
                    }}
                  />
                )}
              </Suspense>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          modal={false}
          open={isFindReplaceOpen}
          onOpenChange={setFindReplaceDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Content className="find-dialog">
              <div className="find-dialog-header">
                <div>
                  <Dialog.Title className="find-dialog-title">
                    {findPanelMode === "replace" ? "查找和替换" : "查找"}
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    搜索当前文档中的对应内容
                  </Dialog.Description>
                  <div className="find-dialog-subtitle">
                    {findQuery
                      ? findMatches.length
                        ? `第 ${Math.min(findMatchIndex + 1, findMatches.length)} / ${findMatches.length} 个结果`
                        : "未找到匹配内容"
                      : "搜索当前文档"}
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭查找">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="find-dialog-body">
                <label className="find-field">
                  <span>查找</span>
                  <input
                    autoFocus
                    value={findQuery}
                    onChange={(event) => setFindQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        moveFindMatch(event.shiftKey ? -1 : 1);
                      }
                    }}
                    placeholder="输入关键词"
                  />
                </label>

                {findPanelMode === "replace" && (
                  <label className="find-field">
                    <span>替换为</span>
                    <input
                      value={replaceQuery}
                      onChange={(event) => setReplaceQuery(event.target.value)}
                      placeholder="替换文本"
                    />
                  </label>
                )}

                <div className="find-dialog-toolbar">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!findMatches.length}
                    onClick={() => moveFindMatch(-1)}
                  >
                    上一个
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!findMatches.length}
                    onClick={() => moveFindMatch(1)}
                  >
                    下一个
                  </button>
                  {findPanelMode === "find" ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setFindPanelMode("replace")}
                    >
                      替换
                    </button>
                  ) : (
                    <>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!activeFindMatch}
                        onClick={replaceCurrentFindMatch}
                      >
                        替换当前
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!findMatches.length}
                        onClick={replaceAllFindMatches}
                      >
                        全部替换
                      </button>
                    </>
                  )}
                </div>

                <div className="find-results" role="list">
                  {visibleFindResultStart > 0 && (
                    <div className="find-results-more">
                      上方还有 {visibleFindResultStart} 个结果
                    </div>
                  )}
                  {visibleFindResults.map((match, offset) => {
                    const index = visibleFindResultStart + offset;

                    return (
                      <button
                        key={`${match.start}-${match.end}`}
                        className={
                          index === findMatchIndex
                            ? "find-result find-result-active"
                            : "find-result"
                        }
                        type="button"
                        onClick={() => goToFindMatch(index)}
                      >
                        <span>
                          第 {index + 1} 个，位于第 {match.line} 行，第 {match.column + 1} 列
                        </span>
                        <strong>{match.snippet || findQuery}</strong>
                      </button>
                    );
                  })}
                  {visibleFindResultStart + visibleFindResults.length < findMatches.length && (
                    <div className="find-results-more">
                      下方还有{" "}
                      {findMatches.length -
                        visibleFindResultStart -
                        visibleFindResults.length}{" "}
                      个结果
                    </div>
                  )}
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={isCreateFileOpen} onOpenChange={setIsCreateFileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="create-file-dialog">
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon">
                    <FilePlus2 size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      新建 Markdown 文件
                    </Dialog.Title>
                    <p>在当前工作区创建一个新的笔记文件</p>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <form
                className="create-file-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmCreateNewDocument();
                }}
              >
                <label htmlFor="new-file-name">文件名</label>
                <div className="create-file-input-row">
                  <input
                    id="new-file-name"
                    autoFocus
                    value={newFileName}
                    onChange={(event) => setNewFileName(event.target.value)}
                  />
                  <span>.md</span>
                </div>
                <div className="create-file-path" title={workspace.workspacePath}>
                  {workspace.workspacePath || workspaceLabel}
                </div>
                <div className="dialog-actions">
                  <Dialog.Close asChild>
                    <button className="secondary-button" type="button">
                      <X size={16} />
                      取消
                    </button>
                  </Dialog.Close>
                  <button className="primary-button" type="submit">
                    <Check size={16} />
                    确定
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          open={Boolean(reactFlowEditorState)}
          onOpenChange={(open) => {
            if (!open) {
              setReactFlowEditorState(null);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="drawing-dialog react-flow-dialog">
              <Dialog.Title className="sr-only">React Flow 图</Dialog.Title>
              {reactFlowEditorState && (
                <ReactFlowModal
                  initialData={reactFlowEditorState.initialData}
                  onClose={() => setReactFlowEditorState(null)}
                  onSave={saveReactFlowDiagram}
                />
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          open={Boolean(mindMapEditorState)}
          onOpenChange={(open) => {
            if (!open) {
              setMindMapEditorState(null);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="drawing-dialog mindmap-dialog">
              <Dialog.Title className="sr-only">思维导图</Dialog.Title>
              {mindMapEditorState && (
                <MindMapModal
                  initialData={mindMapEditorState.initialData}
                  onClose={() => setMindMapEditorState(null)}
                  onSave={saveMindMapDiagram}
                />
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          open={Boolean(univerSheetEditorState)}
          onOpenChange={(open) => {
            if (!open) {
              setUniverSheetEditorState(null);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="drawing-dialog univer-sheet-dialog">
              <Dialog.Title className="sr-only">在线表格</Dialog.Title>
              {univerSheetEditorState && (
                <Suspense fallback={<div className="drawing-loading">正在加载在线表格...</div>}>
                  <UniverSheetModal
                    initialData={univerSheetEditorState.initialData}
                    onClose={() => setUniverSheetEditorState(null)}
                    onSave={saveUniverSheet}
                  />
                </Suspense>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog">
              <div className="settings-header">
                <Dialog.Title className="settings-title">设置</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭设置">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <section className="settings-section">
                <div className="settings-section-title">编辑模式</div>
                <ToggleGroup.Root
                  className="settings-mode-grid"
                  type="single"
                  value={mode}
                  aria-label="编辑模式"
                  onValueChange={(nextMode) => {
                    if (nextMode) {
                      setMode(nextMode as EditorMode);
                    }
                  }}
                >
                  {editorModeOptions.map((option) => (
                    <ToggleGroup.Item
                      className="settings-mode-item"
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </ToggleGroup.Item>
                  ))}
                </ToggleGroup.Root>
              </section>
              <section className="settings-section settings-form-section">
                <div className="settings-section-title">字体与排版</div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span>正文字体</span>
                    <select
                      value={settings.editorFontFamily}
                      onChange={(event) =>
                        updateSetting("editorFontFamily", event.target.value)
                      }
                    >
                      {editorFontOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>代码字体</span>
                    <select
                      value={settings.editorCodeFontFamily}
                      onChange={(event) =>
                        updateSetting("editorCodeFontFamily", event.target.value)
                      }
                    >
                      {editorCodeFontOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span>字号</span>
                    <select
                      value={settings.editorFontSize}
                      onChange={(event) =>
                        updateSetting("editorFontSize", event.target.value)
                      }
                    >
                      {editorFontSizeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>行高</span>
                    <select
                      value={settings.editorLineHeight}
                      onChange={(event) =>
                        updateSetting("editorLineHeight", event.target.value)
                      }
                    >
                      {editorLineHeightOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="settings-field">
                  <span>内容宽度</span>
                  <select
                    value={settings.editorContentWidth}
                    onChange={(event) =>
                      updateSetting("editorContentWidth", event.target.value)
                    }
                  >
                    {editorContentWidthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </>
  );
}
