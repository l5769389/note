import * as Dialog from "@radix-ui/react-dialog";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BookOpenText,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Code2,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileClock,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Italic,
  ListChecks,
  ListTree,
  LogOut,
  Maximize2,
  PencilLine,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Search,
  Scissors,
  Settings2,
  Square,
  Table2,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  defaultAppSettings,
  diaryFontOptions,
  editorCodeFontOptions,
  editorContentDensityOptions,
  editorFontOptions,
  themeOptions,
  type AppSettings,
  type AppTheme,
  type SidebarTabOrderItem,
} from "./appSettings";
import {
  createPersistedAppState,
  defaultSidebarWidth,
  loadPersistedAppHydration,
  migrateLegacyPersistedAppHydration,
  maxSidebarWidth,
  minSidebarWidth,
  savePersistedAppState,
} from "./appPersistence";
import { usePersistedAppStateWriter } from "./appPersistenceHooks";
import { createAssetFileName } from "./assetManager";
import { DirectoryFileList } from "./components/DirectoryFileList";
import { DirectoryTreeItems } from "./components/DirectoryTree";
import { DrawingDocumentViewer } from "./components/DrawingDocumentViewer";
import {
  AppConfirmationDialog,
  AboutDialog,
  DocumentLoadingIndicator,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  RecentFileMenuItem,
} from "./components/AppChrome";
import type {
  RelationPanelFilter,
  WorkspaceRelationItem,
} from "./components/KnowledgeRelationsPanel";
import { HomeWorkspace } from "./features/home/HomeWorkspace";
import type { DiaryWorkspaceHandle } from "./features/diary/DiaryWorkspace";
import type { DocumentMetadataSuggestionField } from "./components/DocumentKnowledgeBar";
import { WorkspaceStatusBar } from "./components/WorkspaceStatusBar";
import { ZoomableImagePreview } from "./components/ZoomableImagePreview";
import type { HtmlDocumentViewerHandle } from "./components/HtmlDocumentViewer";
import type {
  TyporaClipboardImage,
  TyporaEditorHandle,
} from "./components/TyporaEditor";
import appLogoUrl from "../../../resources/icon.png";
import type {
  ImageAlignment,
  ImageFitMode,
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "./editorCommands";
import {
  createDefaultSyncConfiguration,
  createInitialSyncStatus,
  type SyncStatusSnapshot,
} from "../../shared/sync";
import { remoteSyncFeatureEnabled } from "../../shared/featureFlags";
import {
  parseTableClipboardPayload,
  type TableClipboardPayload,
} from "../../shared/tableClipboard";
import {
  getThemeFromAppMenuCommand,
  type AppMenuCommand,
  type AppMenuState,
} from "../../shared/appMenu";
import { getShortcutActionForAppMenuCommand } from "./appMenuCommands";
import { useFindMatchStateMaintenance } from "./findMatchState";
import {
  getEditorCssVariables,
  useEditorCssVariables,
} from "./editorCssVariables";
import { useGlobalAppShortcuts } from "./globalAppShortcuts";
import {
  collectClipboardImageTokens,
  getSingleClipboardImageToken,
  writeMarkdownRichClipboard,
} from "./richClipboard";
import {
  getImmersiveModeFromWindowFullScreen,
  useImmersiveModeState,
} from "./immersiveModeState";
import {
  getSelectAllContentScope,
  getAppShortcutAction,
  type AppShortcutAction,
} from "./editorShortcuts";
import {
  createMarkdownTable,
  type TableSize,
} from "./markdownCommands";
import { normalizeMarkdownHtmlBreaks } from "./markdownBreaks";
import {
  getLineColumnAtOffset,
} from "./markdownEditing";
import {
  COMPACT_IMAGE_TITLE,
  createMarkdownImageToken,
} from "./markdownImages";
import {
  createDiaryDocument,
  createDiaryInitialContent,
  diaryMoodValues,
  diaryTemplateOptions,
  enrichDiaryEntryWithContent,
  applyDiaryTemplateWithCarryover,
  getDiaryBody,
  getDiaryDateKey,
  getDiaryEntriesFromTree,
  getDiaryFilePath,
  getDiaryMonthDirectoryPath,
  getDiaryRootPath,
  getDiaryMetadata,
  isDiaryDocumentContent,
  groupDiaryEntries,
  isPathInsideDiaryRoot,
  updateDiaryMetadata,
  type DiaryMood,
  removeDiaryRootFromDirectoryTree,
  type DiaryEntry,
  type DiaryTemplateId,
} from "./diaryModel";
import {
  createSourceEditCommandEdit,
  createSourceFormatCommandEdit,
  createSourceParagraphCommandAction,
  findSourceFormatCommandLink,
  getSourceTextareaContextMenuInfo,
  getSourceFormatWrap,
} from "./sourceEditorCommands";
import {
  createDocumentFromLocalFile,
  getDocumentDisplayName,
  getDocumentPathPreview,
  getDocumentType,
  getDocumentTypeFromPath,
  isExcelDocument,
  isHtmlDocument,
  isDrawingDocument,
  isMarkdownDocument,
  isPdfDocument,
  isSheetDocument,
  isWordDocument,
  normalizeMarkdownTitle,
  replaceExcalidrawImagePreview,
  updateDocument,
} from "./documentModel";
import {
  createDefaultExcalidrawScene,
  createDrawingAssetFromDocument,
  createExcalidrawImageTitle,
  findExcalidrawMarkdownImage,
} from "./drawingDocument";
import { getDefaultImageFitMode } from "./imageMeta";
import {
  acknowledgeSavedFileContent as acknowledgeFileContent,
  createSavedFileContentByPath,
  getWritableDirtyDocuments,
  hasUnsavedFileContent,
  isMatchingInternalFileWrite as matchesInternalFileWrite,
  rememberInternalFileWrite as trackInternalFileWrite,
  type InternalFileWriteSnapshot,
} from "./filePersistence";
import {
  addOpenedDocumentToWorkspace,
  addCreatedDocumentToWorkspace,
  applySavedDocumentToWorkspace,
  createDocumentFromSavedFile,
  exportMarkdownDocument,
  getExportFailedAlert,
  getExportReadonlyAlert,
  getExportUnsupportedAlert,
  getSaveAsFailedAlert,
  getSaveAsReadonlyAlert,
  writeExistingDocumentIfNeeded,
  type ExportDocumentFormat,
} from "./documentFileActions";
import {
  getDirectoryPath,
  isRelativeResourceUrl,
  resolveDocumentResourceUrl,
} from "./localPreviewUrls";
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
  createUniverSheetAssetMarkdown,
  createUniverSheetMarkdown,
  parseUniverSheetAssetReference,
  parseUniverSheetData,
  replaceUniverSheetMarkdownBlockWithContent,
  serializeUniverSheetData,
  type UniverSheetData,
  type UniverSheetEditTarget,
} from "./univerSheetDocument";
import {
  countMarkdownWords,
  getMarkdownOutline,
} from "./markdownStructure";
import {
  createMarkdownNoteContent,
  createWorkspaceKnowledge,
  getMarkdownBodyWithoutFrontmatter,
  getWikiLinkTitle,
  normalizePropertyKey,
  normalizeTagName,
  normalizeWikiLinkTarget,
  replaceMarkdownBodyPreservingFrontmatter,
} from "./noteKnowledge";
import { normalizeDocumentMetadata } from "./documentMetadata";
import { getHtmlOutline } from "./htmlStructure";
import {
  dataTransferHasFiles,
  createMediaImportPlaceholder,
  createTimestampedImageName,
  createVideoMarkdown,
  createTimestampedVideoName,
  getClipboardDirectMediaAction,
  getClipboardMediaMimeType,
  getDroppedMediaImportActions,
  normalizeDataUrlMimeType,
  readBrowserClipboardMedia,
  readClipboardMediaFallbackAction,
  replaceMediaImportPlaceholderContent,
  shouldTryClipboardMediaFallback,
  type MediaImportAction,
} from "./mediaImport";
import { fileToDataUrl } from "./services/imageUpload";
import { createDocument, renameFromMarkdown } from "./storage";
import type {
  DirectoryTreeItem,
  DocumentHistoryVersion,
  DocumentHistoryVersionWithContent,
  DocumentLinkReference,
  DocumentMetadata,
  DrawingAsset,
  EditorMode,
  LocalWorkspaceDirectory,
  MarkdownDocument,
  SaveState,
  LocalMarkdownFile,
  WorkspaceSource,
  WorkspaceSnapshot,
} from "./types";
import {
  findMarkdownSearchMatches,
  getMatchOccurrenceIndex,
  getWorkspaceSearchGroups,
  getWorkspaceSearchMatchCount,
  isDocumentInsideWorkspace,
  type MarkdownSearchMatch,
} from "./workspaceSearch";
import {
  usePendingWorkspaceSearchReveal,
  type WorkspaceSearchReveal,
} from "./workspaceSearchReveal";
import { quickDocumentLinkShortcut } from "./workspaceShortcuts";
import { useAppDialog } from "./useAppDialog";
import { useDocumentLoading } from "./useDocumentLoading";
import { useMissingDocumentAssetReferences } from "./missingAssetReferences";
import {
  consumeInternalFileDelete,
  getDiskChangeDecision,
  getExternalDeleteAlert,
  getWorkspaceFileChangeContext,
  mergeDiskDocumentIntoWorkspace,
  shouldMergeInternalWriteBack,
  type WorkspaceFileChangePayload,
} from "./workspaceFileChanges";
import {
  normalizeDirectoryKey,
  rememberRecentDirectoryPath,
  shouldShowInRecentDirectories,
} from "./recentDirectories";
import {
  getRecentDocumentVisibilityKey,
  shouldShowInRecentDocuments,
} from "./recentDocuments";
import { useRecentFileAvailability } from "./recentFileAvailability";
import { useWindowChromeState } from "./windowChromeState";
import { useWorkspaceDirectoryWatcher } from "./workspaceDirectoryWatcher";
import { useWorkspaceDirectoryTree } from "./workspaceDirectoryTree";
import {
  useWorkspaceAutosave,
  writeWorkspaceDirtyDocuments,
} from "./workspaceAutosave";
import {
  useActiveDocumentUiReset,
  useInspirationNoteBridge,
  useWorkspaceSearchAutoFocus,
} from "./workspaceUiEffects";
import {
  getRecentDocumentTimestamp,
  getDocumentTypeLabel,
  getDocumentTypeName,
  getPathLabel,
  normalizeFilePathKey,
} from "./workspaceDisplay";
import {
  collectWorkspaceEntryPaths,
  toggleWorkspaceEntrySelection,
} from "./workspaceSelection";
import {
  splitWorkspaceEntryNameForRename,
  validateWorkspaceRenameBaseName,
} from "../../shared/workspaceRename";
import {
  type MenubarMenu,
  type TopMenu,
} from "./features/app-shell/appShellModel";
import { AppMenubar } from "./features/app-shell/AppMenubar";

const DrawingModal = lazy(() =>
  import("./components/DrawingModal").then((module) => ({
    default: module.DrawingModal,
  })),
);

const ExcelDocumentViewer = lazy(() =>
  import("./components/ExcelDocumentViewer").then((module) => ({
    default: module.ExcelDocumentViewer,
  })),
);

const HtmlDocumentViewer = lazy(() =>
  import("./components/HtmlDocumentViewer").then((module) => ({
    default: module.HtmlDocumentViewer,
  })),
);

const MarkdownRenderer = lazy(() =>
  import("./components/MarkdownRenderer").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

const TyporaEditor = lazy(() =>
  import("./components/TyporaEditor").then((module) => ({
    default: module.TyporaEditor,
  })),
);
const DiaryWorkspace = lazy(() =>
  import("./features/diary/DiaryWorkspace").then((module) => ({
    default: module.DiaryWorkspace,
  })),
);
const DiarySidebarPanel = lazy(() =>
  import("./features/diary/DiaryWorkspace").then((module) => ({
    default: module.DiarySidebarPanel,
  })),
);

type IdleCallbackHandle = number;

type WindowWithIdleCallback = typeof window & {
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => IdleCallbackHandle;
};

function scheduleRuntimePreload(callback: () => void, delayMs: number) {
  const runtimeWindow = window as WindowWithIdleCallback;
  let idleHandle: IdleCallbackHandle | null = null;

  const timeoutHandle = window.setTimeout(() => {
    if (runtimeWindow.requestIdleCallback) {
      idleHandle = runtimeWindow.requestIdleCallback(callback, { timeout: 1800 });
      return;
    }

    callback();
  }, delayMs);

  return () => {
    window.clearTimeout(timeoutHandle);

    if (idleHandle !== null) {
      runtimeWindow.cancelIdleCallback?.(idleHandle);
    }
  };
}

function preloadMarkdownPreviewRuntime() {
  void import("./components/MarkdownRenderer");
}

function preloadMarkdownEditorRuntime() {
  void import("./components/TyporaEditor");
}

const MindMapModal = lazy(() =>
  import("./components/MindMapModal").then((module) => ({
    default: module.MindMapModal,
  })),
);

const KnowledgeGraphModal = lazy(() =>
  import("./components/KnowledgeGraphModal").then((module) => ({
    default: module.KnowledgeGraphModal,
  })),
);

const DocumentKnowledgeBar = lazy(() =>
  import("./components/DocumentKnowledgeBar").then((module) => ({
    default: module.DocumentKnowledgeBar,
  })),
);

const KnowledgeRelationsPanel = lazy(() =>
  import("./components/KnowledgeRelationsPanel").then((module) => ({
    default: module.KnowledgeRelationsPanel,
  })),
);

const PdfDocumentViewer = lazy(() =>
  import("./components/PdfDocumentViewer").then((module) => ({
    default: module.PdfDocumentViewer,
  })),
);

const ReactFlowModal = lazy(() =>
  import("./components/ReactFlowModal").then((module) => ({
    default: module.ReactFlowModal,
  })),
);

const DocumentInspectorSidebar = lazy(() =>
  import("./components/DocumentInspectorSidebar").then((module) => ({
    default: module.DocumentInspectorSidebar,
  })),
);

const DocumentHistoryPanel = lazy(() =>
  import("./components/DocumentHistoryPanel").then((module) => ({
    default: module.DocumentHistoryPanel,
  })),
);

const WorkspaceSearchPanel = lazy(() =>
  import("./components/WorkspaceSearchPanel").then((module) => ({
    default: module.WorkspaceSearchPanel,
  })),
);

const UniverSheetModal = lazy(() =>
  import("./components/UniverSheetModal").then((module) => ({
    default: module.UniverSheetModal,
  })),
);

const UniverSheetPreview = lazy(() =>
  import("./components/UniverSheetPreview").then((module) => ({
    default: module.UniverSheetPreview,
  })),
);

const WordDocumentViewer = lazy(() =>
  import("./components/WordDocumentViewer").then((module) => ({
    default: module.WordDocumentViewer,
  })),
);

type ImmersiveRevealEdge = "top";
type SidebarTab = SidebarTabOrderItem | "search";
type FileExplorerView = "tree" | "list";
type DocumentLinkPickerMode = "metadata" | "insertReference";

const sidebarRecentDirectoryLimit = 5;
const immersiveRevealHitSlop = 44;
const defaultWindowZoomFactor = 1;
const sidebarTabDragThreshold = 6;
const storageSplitRatioStorageKey = "notedock.storageSplitRatio.v1";
const defaultStorageSplitRatio = 0.55;
const minStorageSectionHeight = 160;

function readStoredStorageSplitRatio() {
  if (typeof window === "undefined") {
    return defaultStorageSplitRatio;
  }

  const value = Number(window.localStorage.getItem(storageSplitRatioStorageKey));

  return Number.isFinite(value) ? clamp(value, 0.25, 0.75) : defaultStorageSplitRatio;
}

type FindPanelMode = "find" | "replace";

type RevealDocumentRangeOptions = {
  content?: string;
  occurrenceIndex?: number;
  preserveRendered?: boolean;
  query?: string;
};

type AppContextMenuItem =
  | {
      type: "separator";
    }
  | {
      actions: Array<{
        active?: boolean;
        icon: ReactNode;
        label: string;
        onSelect: () => void | Promise<void>;
      }>;
      label: string;
      type: "iconGroup";
    }
  | {
      icon?: ReactNode;
      label: string;
      type: "label";
    }
  | {
      danger?: boolean;
      disabled?: boolean;
      icon?: ReactNode;
      label: string;
      onSelect: () => void | Promise<void>;
      shortcut?: string;
      type?: "item";
    };

type AppContextMenuState = {
  items: AppContextMenuItem[];
  width: number;
  x: number;
  y: number;
};

type WorkspaceContentAction = {
  disabled?: boolean;
  group?: "document" | "export" | "location";
  icon: ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
};

type EditorContextMenuInfo = {
  canPaste: boolean;
  documentReference?: {
    display: string;
    raw: string;
    target: string;
  };
  hasSelection: boolean;
  imageAlign?: ImageAlignment;
  imageFit?: ImageFitMode;
  isDocumentReference: boolean;
  isImage: boolean;
  isEditable: boolean;
  isListItem: boolean;
  isTaskListItem: boolean;
  isVideo: boolean;
  linkHref?: string;
  mediaAlt?: string;
  mediaKind?: "image" | "video";
  mediaSource?: string;
  taskChecked?: boolean;
};

const now = () => new Date().toISOString();
const defaultInspectorWidth = 360;
const minInspectorWidth = 300;
const maxInspectorWidth = 620;
const contentSelectionAreaSelector = [
  "input",
  "textarea",
  '[contenteditable="true"]',
  ".markdown-input",
  ".markdown-preview",
  ".typora-editor",
  ".typora-milkdown-content",
  ".typora-mdx-content",
  ".html-document-viewer-body",
  ".word-document-body",
  ".excel-table-scroll",
].join(",");
const uiSelectionScopeSelector = [
  ".recent-row",
  ".directory-file-list-item",
  ".recent-file-menu-button",
  ".directory-tree-folder",
  ".directory-tree-file",
  ".tree-file",
  ".outline-item",
  ".sidebar-recent-directories button",
  ".home-stat-card",
  ".home-section-header",
  ".home-saved-note",
  ".workspace-autosave-status",
  ".workspace-asset-warning",
  ".workspace-word-count",
].join(",");

function getSelectionElement(node: Node | null) {
  if (node instanceof Element) {
    return node;
  }

  return node?.parentElement ?? null;
}

function isContentSelectionArea(element: Element | null) {
  return Boolean(element?.closest(contentSelectionAreaSelector));
}

function getUiSelectionScope(node: Node | null, root: HTMLElement) {
  const element = getSelectionElement(node);

  if (!element || !root.contains(element) || isContentSelectionArea(element)) {
    return null;
  }

  return element.closest<HTMLElement>(uiSelectionScopeSelector);
}

function clearCrossScopeUiSelection(
  root: HTMLElement,
  activeScope: HTMLElement | null,
) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return;
  }

  const anchorElement = getSelectionElement(selection.anchorNode);
  const focusElement = getSelectionElement(selection.focusNode);

  if (
    isContentSelectionArea(anchorElement) ||
    isContentSelectionArea(focusElement)
  ) {
    return;
  }

  const anchorScope = getUiSelectionScope(selection.anchorNode, root);
  const focusScope = getUiSelectionScope(selection.focusNode, root);
  const expectedScope = activeScope ?? anchorScope;

  if (
    expectedScope &&
    (anchorScope !== expectedScope || focusScope !== expectedScope)
  ) {
    selection.removeAllRanges();
  }
}

function getRecentDocumentTime(document: MarkdownDocument) {
  const timestamp = new Date(getRecentDocumentTimestamp(document)).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function markDocumentOpened(
  document: MarkdownDocument,
  openedAt = now(),
): MarkdownDocument {
  return {
    ...document,
    lastOpenedAt: openedAt,
  };
}

function markWorkspaceDocumentOpened(
  workspace: WorkspaceSnapshot,
  documentId: string,
  openedAt = now(),
): WorkspaceSnapshot {
  return {
    ...workspace,
    activeDocumentId: documentId,
    documents: workspace.documents.map((document) =>
      document.id === documentId
        ? markDocumentOpened(document, openedAt)
        : document,
    ),
  };
}

function findWorkspaceDocumentByFilePath(
  documents: MarkdownDocument[],
  filePath?: string,
) {
  const fileKey = normalizeFilePathKey(filePath);

  return fileKey
    ? documents.find(
        (document) => normalizeFilePathKey(document.filePath) === fileKey,
      )
    : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSidebarResizeTarget(pointerX: number) {
  const nextWidth = clamp(pointerX, 0, maxSidebarWidth);

  if (nextWidth < minSidebarWidth) {
    return {
      isCollapsed: true,
      previewX: 0,
      width: 0,
    };
  }

  return {
    isCollapsed: false,
    previewX: nextWidth,
    width: nextWidth,
  };
}

function getInspectorResizeTarget(pointerX: number) {
  return clamp(window.innerWidth - pointerX, minInspectorWidth, maxInspectorWidth);
}

function getFileNameFromPath(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function getDocumentTitleFromFilePath(filePath: string) {
  return splitWorkspaceEntryNameForRename(getFileNameFromPath(filePath), "file")
    .editableName;
}

function replaceWorkspaceEntryPath(
  filePath: string,
  currentEntryPath: string,
  nextEntryPath: string,
) {
  const normalizedCurrentPath = currentEntryPath
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  const normalizedFilePath = filePath.replace(/\\/g, "/");
  const currentKey = normalizedCurrentPath.toLowerCase();
  const fileKey = normalizedFilePath.toLowerCase();

  if (!currentKey || fileKey === currentKey) {
    return fileKey === currentKey ? nextEntryPath : filePath;
  }

  if (!fileKey.startsWith(`${currentKey}/`)) {
    return filePath;
  }

  const separator = currentEntryPath.includes("\\") ? "\\" : "/";
  const suffix = normalizedFilePath
    .slice(normalizedCurrentPath.length)
    .replace(/\//g, separator);
  return nextEntryPath.replace(/[\\/]+$/, "") + suffix;
}

function readFileInput(fileInput: HTMLInputElement | null) {
  fileInput?.click();
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
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

function createStartupWorkspace(): WorkspaceSnapshot {
  return {
    activeDocumentId: "",
    documents: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

function isCloudWorkspaceSource(
  source?: WorkspaceSource,
): source is Extract<WorkspaceSource, { kind: "cloud" }> {
  return remoteSyncFeatureEnabled && source?.kind === "cloud";
}

function getWorkspaceDisplayLabel(workspace: WorkspaceSnapshot) {
  return isCloudWorkspaceSource(workspace.source)
    ? workspace.source.workspaceName || "云端笔记"
    : getPathLabel(workspace.workspacePath);
}

type SettingsSectionId = "app" | "notes" | "code" | "diary" | "sync";

const settingsDirectoryItems: readonly {
  description: string;
  icon: LucideIcon;
  id: SettingsSectionId;
  label: string;
}[] = [
  {
    description: "主题与首页模块",
    icon: Settings2,
    id: "app",
    label: "通用",
  },
  {
    description: "阅读密度与字体",
    icon: BookOpenText,
    id: "notes",
    label: "笔记",
  },
  {
    description: "代码字体",
    icon: Code2,
    id: "code",
    label: "代码",
  },
  {
    description: "日记模板与字体",
    icon: PencilLine,
    id: "diary",
    label: "日记",
  },
  ...(remoteSyncFeatureEnabled
    ? [
        {
          description: "服务器与账号登录",
          icon: Cloud,
          id: "sync" as const,
          label: "同步",
        },
      ]
    : []),
];

type SyncLoginMessageTone = "error" | "info" | "success";
type SidebarStorageKind = "local" | "cloud";

type SidebarDragPayload = {
  entryType: DirectoryTreeItem["type"];
  path: string;
  source: SidebarStorageKind;
};

type CloudSidebarWorkspace = {
  directoryPath: string;
  documents: MarkdownDocument[];
  source: Extract<WorkspaceSource, { kind: "cloud" }>;
  tree: DirectoryTreeItem | null;
  workspaceId: string;
  workspaceName: string;
};

type CloudWorkspaceDirectory = LocalWorkspaceDirectory & {
  appState?: unknown;
  workspaceId: string;
  workspaceName: string;
};

function collectDirectoryEntryMap(
  item: DirectoryTreeItem | null | undefined,
  entries = new Map<string, DirectoryTreeItem>(),
) {
  if (!item) {
    return entries;
  }

  entries.set(normalizeFilePathKey(item.path), item);

  for (const child of item.children ?? []) {
    collectDirectoryEntryMap(child, entries);
  }

  return entries;
}

function isPathInsideDirectoryPath(childPath: string, directoryPath: string) {
  const childKey = normalizeFilePathKey(childPath).replace(/\/+$/, "");
  const directoryKey = normalizeFilePathKey(directoryPath).replace(/\/+$/, "");

  return childKey === directoryKey || childKey.startsWith(`${directoryKey}/`);
}

function getTopLevelWorkspaceEntries(entries: DirectoryTreeItem[]) {
  const sortedEntries = [...entries].sort(
    (left, right) => left.path.length - right.path.length,
  );
  const selectedDirectories: DirectoryTreeItem[] = [];

  return sortedEntries.filter((entry) => {
    const isCoveredByDirectory = selectedDirectories.some((directory) =>
      isPathInsideDirectoryPath(entry.path, directory.path),
    );

    if (isCoveredByDirectory) {
      return false;
    }

    if (entry.type === "directory") {
      selectedDirectories.push(entry);
    }

    return true;
  });
}

const defaultSyncServerUrl =
  import.meta.env.VITE_NOTEDOCK_SYNC_SERVER_URL?.trim() ||
  "https://sync.zhaolin.online";
const defaultSyncConfiguration =
  createDefaultSyncConfiguration(defaultSyncServerUrl);
const defaultSyncLoginUsername = "admin";
const defaultSyncLoginPassword = "123";
const editorModeOptions: Array<{ label: string; value: EditorMode }> = [
  { label: "实时预览", value: "typora" },
  { label: "源码", value: "source" },
  { label: "分栏", value: "split" },
  { label: "阅读", value: "preview" },
];

const diaryComfortOptions = [
  {
    description: "更接近普通笔记，适合短句快速记录。",
    fontSize: "17px",
    label: "标准",
    lineHeight: "1.9",
    value: "standard",
  },
  {
    description: "默认推荐，给长段回顾留下更自然的呼吸感。",
    fontSize: "18px",
    label: "舒适",
    lineHeight: "2",
    value: "comfortable",
  },
  {
    description: "更大字距与行距，适合慢写和复盘。",
    fontSize: "19px",
    label: "宽松",
    lineHeight: "2.15",
    value: "spacious",
  },
] as const;

function getDiaryComfortValue(settings: AppSettings) {
  return (
    diaryComfortOptions.find(
      (option) =>
        option.fontSize === settings.diaryFontSize &&
        option.lineHeight === settings.diaryLineHeight,
    )?.value ?? ""
  );
}

function getSettingsSliderProgress(index: number, optionCount: number) {
  if (optionCount <= 1) {
    return 0;
  }

  return (index / (optionCount - 1)) * 100;
}

function normalizeSyncServerUrlInput(serverUrl: string): string {
  const trimmedServerUrl = serverUrl.trim();

  if (!trimmedServerUrl) {
    return defaultSyncServerUrl;
  }

  if (/^https?:\/\//i.test(trimmedServerUrl)) {
    return trimmedServerUrl.replace(/\/+$/, "");
  }

  return `https://${trimmedServerUrl.replace(/\/+$/, "")}`;
}

export function App() {
  const desktopPlatform = window.desktop?.platform ?? "web";
  const isMac = desktopPlatform === "darwin";
  const appMenuCommandHandlerRef = useRef<(command: AppMenuCommand) => void>(
    () => {},
  );

  useEffect(() => {
    const cancelPreviewPreload = scheduleRuntimePreload(
      preloadMarkdownPreviewRuntime,
      450,
    );
    const cancelEditorPreload = scheduleRuntimePreload(
      preloadMarkdownEditorRuntime,
      1800,
    );

    return () => {
      cancelPreviewPreload();
      cancelEditorPreload();
    };
  }, []);

  const [workspace, setWorkspace] = useState(createStartupWorkspace);
  const [mode, setMode] = useState<EditorMode>(defaultAppSettings.editorMode);
  const [topMenu, setTopMenu] = useState<TopMenu>(null);
  const [theme, setTheme] = useState<AppTheme>("github");
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const diaryComfortValue = getDiaryComfortValue(settings);
  const editorContentDensityIndex = Math.max(
    0,
    editorContentDensityOptions.findIndex(
      (option) => option.value === settings.editorContentDensity,
    ),
  );
  const selectedEditorContentDensity =
    editorContentDensityOptions[editorContentDensityIndex] ??
    editorContentDensityOptions[0];
  const rawDiaryComfortIndex = diaryComfortOptions.findIndex(
    (option) => option.value === diaryComfortValue,
  );
  const diaryComfortIndex =
    rawDiaryComfortIndex >= 0 ? rawDiaryComfortIndex : 1;
  const selectedDiaryComfort =
    diaryComfortOptions[diaryComfortIndex] ?? diaryComfortOptions[1];
  const selectedDiaryTemplateOption =
    diaryTemplateOptions.find(
      (option) => option.value === settings.diaryDefaultTemplate,
    ) ?? diaryTemplateOptions[0];
  const settingsPreviewStyle = useMemo(
    () => getEditorCssVariables(settings) as CSSProperties,
    [settings],
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(
    createInitialSyncStatus(defaultSyncConfiguration),
  );
  const [syncEnabledDraft, setSyncEnabledDraft] = useState(false);
  const [syncServerUrlDraft, setSyncServerUrlDraft] =
    useState(defaultSyncServerUrl);
  const [syncLoginUsernameDraft, setSyncLoginUsernameDraft] = useState(
    defaultSyncLoginUsername,
  );
  const [syncLoginPasswordDraft, setSyncLoginPasswordDraft] = useState(
    defaultSyncLoginPassword,
  );
  const [syncLoginMessage, setSyncLoginMessage] = useState("");
  const [syncLoginMessageTone, setSyncLoginMessageTone] =
    useState<SyncLoginMessageTone>("info");
  const [isSyncLoginRunning, setIsSyncLoginRunning] = useState(false);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [windowZoomFactor, setWindowZoomFactor] = useState(defaultWindowZoomFactor);
  const [isHomeOpen, setIsHomeOpen] = useState(true);
  const [homeNoteDialogRequestId, setHomeNoteDialogRequestId] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryDocument, setDiaryDocument] = useState<MarkdownDocument | null>(null);
  const [diarySaveState, setDiarySaveState] = useState<SaveState>("saved");
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
  const {
    appDialog,
    closeAppDialog,
    showAppAlert,
    showAppConfirm,
  } = useAppDialog();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("1.0.5");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDefaultDiaryTemplateDialogOpen, setIsDefaultDiaryTemplateDialogOpen] =
    useState(false);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("app");
  const [documentImagePreview, setDocumentImagePreview] = useState<{
    alt: string;
    src: string;
  } | null>(null);
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [isTableInsertDialogOpen, setIsTableInsertDialogOpen] = useState(false);
  const [tableInsertRows, setTableInsertRows] = useState("3");
  const [tableInsertColumns, setTableInsertColumns] = useState("3");
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isDocumentInspectorOpen, setIsDocumentInspectorOpen] = useState(false);
  const [isDocumentHistoryDialogOpen, setIsDocumentHistoryDialogOpen] =
    useState(false);
  const [historyBrowserDocumentPath, setHistoryBrowserDocumentPath] =
    useState<string | null>(null);
  const [historyBrowserVersions, setHistoryBrowserVersions] = useState<
    DocumentHistoryVersion[]
  >([]);
  const [selectedHistoryBrowserVersion, setSelectedHistoryBrowserVersion] =
    useState<DocumentHistoryVersionWithContent | null>(null);
  const [isHistoryBrowserLoading, setIsHistoryBrowserLoading] =
    useState(false);
  const [isHistoryBrowserRestoring, setIsHistoryBrowserRestoring] =
    useState(false);
  const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<AppContextMenuState | null>(null);
  const [findPanelMode, setFindPanelMode] = useState<FindPanelMode>("find");
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [relationPanelQuery, setRelationPanelQuery] = useState("");
  const [relationPanelFilter, setRelationPanelFilter] =
    useState<RelationPanelFilter>("all");
  const [newTagName, setNewTagName] = useState("");
  const [propertyKeyDraft, setPropertyKeyDraft] = useState("");
  const [propertyValueDraft, setPropertyValueDraft] = useState("");
  const [activeMetadataSuggestion, setActiveMetadataSuggestion] =
    useState<DocumentMetadataSuggestionField | null>(null);
  const [wikiLinkTargetDraft, setWikiLinkTargetDraft] = useState("");
  const [isDocumentLinkPickerOpen, setIsDocumentLinkPickerOpen] = useState(false);
  const [documentLinkPickerMode, setDocumentLinkPickerMode] =
    useState<DocumentLinkPickerMode>("metadata");
  const [documentLinkQuery, setDocumentLinkQuery] = useState("");
  const [documentLinkSourceDocumentId, setDocumentLinkSourceDocumentId] =
    useState<string | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [sidebarTabDrag, setSidebarTabDrag] = useState<{
    draggedTab: SidebarTabOrderItem;
    isDragging: boolean;
    pointerId: number;
    startX: number;
    targetIndex: number;
  } | null>(null);
  const [fileExplorerView, setFileExplorerView] =
    useState<FileExplorerView>("tree");
  const [cloudSidebarWorkspace, setCloudSidebarWorkspace] =
    useState<CloudSidebarWorkspace | null>(null);
  const [isCloudImporting, setIsCloudImporting] = useState(false);
  const [isCloudExporting, setIsCloudExporting] = useState(false);
  const [isCloudDirectoryCreating, setIsCloudDirectoryCreating] = useState(false);
  const [isCloudMultiSelectEnabled, setIsCloudMultiSelectEnabled] =
    useState(false);
  const [selectedCloudEntryPaths, setSelectedCloudEntryPaths] = useState<
    Set<string>
  >(() => new Set());
  const [storageSplitRatio, setStorageSplitRatio] = useState(
    readStoredStorageSplitRatio,
  );
  const [isStorageSplitResizing, setIsStorageSplitResizing] = useState(false);
  const [expandedCloudDirectoryPaths, setExpandedCloudDirectoryPaths] =
    useState<Set<string>>(() => new Set());
  const [sidebarDropTarget, setSidebarDropTarget] =
    useState<SidebarStorageKind | null>(null);
  const [sidebarDirectoryDropTargetPath, setSidebarDirectoryDropTargetPath] =
    useState<string | null>(null);
  const [sidebarDirectoryDragPreview, setSidebarDirectoryDragPreview] =
    useState<{
      entryType: DirectoryTreeItem["type"];
      name: string;
      path: string;
    } | null>(null);
  const [renamingEntryPath, setRenamingEntryPath] = useState<string | null>(null);
  const [renamingEntryType, setRenamingEntryType] = useState<
    DirectoryTreeItem["type"] | null
  >(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingOpenAfterRenameEntryPath, setPendingOpenAfterRenameEntryPath] =
    useState<string | null>(null);
  const cloudDirectoryCreateInFlightRef = useRef(false);
  const renameCommitInFlightRef = useRef(false);
  const [workspaceToast, setWorkspaceToast] = useState<{
    id: number;
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const { clearDocumentLoading, documentLoadingState, showDocumentLoading } =
    useDocumentLoading();
  const cloudSidebarEntryMap = useMemo(
    () => collectDirectoryEntryMap(cloudSidebarWorkspace?.tree),
    [cloudSidebarWorkspace?.tree],
  );
  const cloudSelectableEntryPaths = useMemo(
    () =>
      (cloudSidebarWorkspace?.tree?.children ?? []).flatMap((item) =>
        collectWorkspaceEntryPaths(item),
      ),
    [cloudSidebarWorkspace?.tree],
  );
  const areAllCloudEntriesSelected = useMemo(() => {
    if (!cloudSelectableEntryPaths.length) {
      return false;
    }

    const selectedKeys = new Set(
      Array.from(selectedCloudEntryPaths, (path) => normalizeFilePathKey(path)),
    );

    return cloudSelectableEntryPaths.every((path) =>
      selectedKeys.has(normalizeFilePathKey(path)),
    );
  }, [cloudSelectableEntryPaths, selectedCloudEntryPaths]);
  const activeSidebarDragPayloadRef = useRef<SidebarDragPayload | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [inspectorWidth, setInspectorWidth] = useState(defaultInspectorWidth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [sidebarResizePreviewX, setSidebarResizePreviewX] = useState<
    number | null
  >(null);
  const [isInspectorResizing, setIsInspectorResizing] = useState(false);
  const [inspectorResizePreviewX, setInspectorResizePreviewX] = useState<
    number | null
  >(null);
  const [isEditorDraggingMedia, setIsEditorDraggingMedia] = useState(false);
  const [isImmersiveSidebarOpen, setIsImmersiveSidebarOpen] = useState(false);
  const appShellRef = useRef<HTMLElement | null>(null);
  const storageSectionsRef = useRef<HTMLDivElement | null>(null);
  const uiSelectionScopeRef = useRef<HTMLElement | null>(null);
  const [newFileName, setNewFileName] = useState("Untitled");
  const {
    applyDirectoryTree,
    directoryTree,
    expandedDirectoryPaths,
    loadDirectoryTree,
    setExpandedDirectoryPaths,
  } = useWorkspaceDirectoryTree({
    onLoadFailure: () => setSaveState("failed"),
    readDirectoryTree: window.desktop?.readDirectoryTree,
    workspacePath: workspace.workspacePath,
  });
  const isImmersiveMode = getImmersiveModeFromWindowFullScreen(isFullScreen);
  const [immersiveRevealEdge, setImmersiveRevealEdge] =
    useState<ImmersiveRevealEdge | null>(null);
  const isSidebarHidden = isImmersiveMode
    ? !isImmersiveSidebarOpen
    : isSidebarCollapsed;
  const [hiddenRecentDocumentKeys, setHiddenRecentDocumentKeys] = useState<
    string[]
  >([]);
  const [recentDirectoryPaths, setRecentDirectoryPaths] = useState<string[]>([]);
  const [activeEditorLineIndex, setActiveEditorLineIndex] = useState(0);
  const [activeHtmlOutlineId, setActiveHtmlOutlineId] = useState<string | null>(
    null,
  );
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSourceEditorViewportRef = useRef<{
    documentId: string;
    hadFocus: boolean;
    selectionEnd: number;
    selectionStart: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
  const diaryWorkspaceRef = useRef<DiaryWorkspaceHandle | null>(null);
  const htmlDocumentViewerRef = useRef<HtmlDocumentViewerHandle | null>(null);
  const diarySaveTimerRef = useRef<number | null>(null);
  const mediaImportIdRef = useRef(0);
  const workspaceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const wikiLinkInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarTabButtonRefs = useRef(
    new Map<SidebarTabOrderItem, HTMLButtonElement>(),
  );
  const suppressNextSidebarTabClickRef = useRef(false);
  const pendingWorkspaceSearchRevealRef = useRef<WorkspaceSearchReveal | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const externalConflictPathsRef = useRef(new Set<string>());
  const internalFileDeletesRef = useRef(new Set<string>());
  const savedFileContentByPathRef = useRef(
    createSavedFileContentByPath(workspace.documents),
  );
  const internalFileWritesRef = useRef(
    new Map<string, InternalFileWriteSnapshot>(),
  );

  useEffect(() => {
    let isStale = false;

    window.desktop?.getAppVersion?.()
      .then((version) => {
        if (!isStale && version) {
          setAppVersion(version);
        }
      })
      .catch(() => {
        // The packaged app version is cosmetic in the renderer.
      });

    return () => {
      isStale = true;
    };
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const root = appShellRef.current;

      if (!root) {
        return;
      }

      clearCrossScopeUiSelection(root, uiSelectionScopeRef.current);
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    let isStale = false;

    async function hydratePersistedState() {
      const hydration = await loadPersistedAppHydration(
        window.desktop?.loadAppState,
      );

      if (isStale) {
        return;
      }

      savedFileContentByPathRef.current = createSavedFileContentByPath(
        hydration.workspace.documents,
      );
      setWorkspace(hydration.workspace);
      setSettings(hydration.settings);
      setMode(hydration.settings.editorMode);
      setTheme(hydration.theme);
      setSidebarWidth(hydration.sidebarWidth);
      setHiddenRecentDocumentKeys(hydration.hiddenRecentDocumentKeys);
      setRecentDirectoryPaths(hydration.recentDirectories);
      setIsPersistenceReady(true);

      void migrateLegacyPersistedAppHydration(
        hydration,
        window.desktop?.saveAppState,
      ).catch(() => undefined);
    }

    void hydratePersistedState();

    return () => {
      isStale = true;
    };
  }, []);

  useEffect(() => {
    if (!remoteSyncFeatureEnabled) {
      setSyncStatus(createInitialSyncStatus(defaultSyncConfiguration));
      setCloudSidebarWorkspace(null);
      setIsCloudMultiSelectEnabled(false);
      setSelectedCloudEntryPaths(new Set());
      return;
    }

    let isStale = false;

    void window.desktop?.getSyncStatus?.().then((status) => {
      if (!isStale && status) {
        setSyncStatus(status);
      }
    });

    const unsubscribe = window.desktop?.onSyncStatusChanged?.((status) => {
      setSyncStatus(status);
    });

    return () => {
      isStale = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!remoteSyncFeatureEnabled || !isSettingsOpen) {
      return;
    }

    setSyncEnabledDraft(
      syncStatus.configuration.tokenConfigured &&
        syncStatus.configuration.enabled,
    );
    setSyncServerUrlDraft(
      normalizeSyncServerUrlInput(
        syncStatus.configuration.serverUrl || defaultSyncServerUrl,
      ),
    );
    setSyncLoginUsernameDraft(defaultSyncLoginUsername);
    setSyncLoginPasswordDraft(
      syncStatus.configuration.tokenConfigured ? "" : defaultSyncLoginPassword,
    );
    setSyncLoginMessage("");
    setSyncLoginMessageTone("info");
  }, [
    isSettingsOpen,
    syncStatus.configuration.enabled,
    syncStatus.configuration.serverUrl,
    syncStatus.configuration.tokenConfigured,
  ]);

  useEffect(() => {
    if (!remoteSyncFeatureEnabled) {
      setCloudSidebarWorkspace(null);
      setIsCloudMultiSelectEnabled(false);
      setSelectedCloudEntryPaths(new Set());
      return;
    }

    if (
      !syncStatus.configuration.enabled ||
      !syncStatus.configuration.tokenConfigured
    ) {
      setCloudSidebarWorkspace(null);
      setIsCloudMultiSelectEnabled(false);
      setSelectedCloudEntryPaths(new Set());
      return;
    }

    void refreshCloudSidebarWorkspace();
  }, [
    syncStatus.configuration.enabled,
    syncStatus.configuration.tokenConfigured,
    syncStatus.configuration.workspaceId,
  ]);

  useImmersiveModeState({
    immersiveRevealEdge,
    isImmersiveMode,
    isImmersiveSidebarOpen,
    setImmersiveRevealEdge,
    setIsImmersiveSidebarOpen,
  });

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);

    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);

    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  const activeDocument = useMemo(
    () =>
      workspace.documents.find((item) => item.id === workspace.activeDocumentId) ?? null,
    [workspace.activeDocumentId, workspace.documents],
  );
  const missingAssetReferences = useMissingDocumentAssetReferences(
    activeDocument,
    window.desktop?.checkAssetReferences,
  );
  const workspaceKnowledge = useMemo(
    () => createWorkspaceKnowledge(workspace.documents),
    [workspace.documents],
  );
  const activeDocumentKnowledge = activeDocument
    ? workspaceKnowledge.metadataByDocumentId.get(activeDocument.id) ?? null
    : null;
  const activeMarkdownBody =
    activeDocument && isMarkdownDocument(activeDocument)
      ? getMarkdownBodyWithoutFrontmatter(activeDocument.content)
      : "";
  const diaryGroups = useMemo(
    () => groupDiaryEntries(diaryEntries),
    [diaryEntries],
  );
  const diaryMetadata = useMemo(
    () =>
      diaryDocument
        ? getDiaryMetadata(diaryDocument.content, diaryDocument.title)
        : null,
    [diaryDocument?.content, diaryDocument?.title],
  );
  const shouldShowWorkspaceDocumentActions =
    isDiaryOpen || (!isHomeOpen && Boolean(activeDocument));
  const workspaceActionDocument = isDiaryOpen ? diaryDocument : activeDocument;
  const workspaceActionFilePath = workspaceActionDocument?.filePath ?? "";
  const canUseActiveMarkdownActions =
    !isDiaryOpen && Boolean(activeDocument) && isMarkdownDocument(activeDocument);
  const canShowWorkspaceDocumentHistory =
    Boolean(workspaceActionFilePath && window.desktop?.listDocumentHistory) &&
    /\.(?:md|markdown|mdown)$/i.test(workspaceActionFilePath);
  const workspaceContentActions: WorkspaceContentAction[] = [
    ...(canUseActiveMarkdownActions
      ? [
          {
            group: "document" as const,
            icon: <Save size={18} />,
            key: "save",
            label: "保存",
            onSelect: () => void saveNow(),
          },
        ]
      : []),
    ...(canUseActiveMarkdownActions
      ? [
          {
            group: "document" as const,
            icon: <FileText size={18} />,
            key: "save-as",
            label: "另存为",
            onSelect: () => void saveActiveDocumentAs(),
          },
        ]
      : []),
    ...(canShowWorkspaceDocumentHistory
      ? [
          {
            group: "document" as const,
            icon: <FileClock size={18} />,
            key: "history",
            label: "历史记录",
            onSelect: () => openDocumentHistoryDialog(workspaceActionFilePath),
          },
        ]
      : []),
    ...(workspaceActionFilePath
      ? [
          {
            disabled: !window.desktop?.showInFolder,
            group: "location" as const,
            icon: <FolderOpen size={18} />,
            key: "show-in-folder",
            label: "所在位置",
            onSelect: () => void window.desktop?.showInFolder?.(workspaceActionFilePath),
          },
          {
            group: "location" as const,
            icon: <Copy size={18} />,
            key: "copy-path",
            label: "复制路径",
            onSelect: () => void copyTextToClipboard(workspaceActionFilePath),
          },
        ]
      : []),
    ...(canUseActiveMarkdownActions
      ? [
          {
            group: "export" as const,
            icon: <Download size={18} />,
            key: "export-pdf",
            label: "导出 PDF",
            onSelect: () => void exportActiveDocument("pdf"),
          },
        ]
      : []),
  ];
  const workspaceContentDirty = Boolean(
    workspaceActionDocument?.filePath &&
      hasUnsavedFileContent(
        workspaceActionDocument,
        savedFileContentByPathRef.current,
      ),
  );
  const menubarContentTitle = isDiaryOpen
    ? diaryMetadata?.dateKey
      ? `日记 · ${diaryMetadata.dateKey}`
      : "日记"
    : shouldShowWorkspaceDocumentActions && activeDocument
      ? getDocumentDisplayName(activeDocument)
      : undefined;
  const menubarContentKind = isDiaryOpen
    ? ("diary" as const)
    : activeDocument && !isMarkdownDocument(activeDocument)
      ? ("viewer" as const)
      : ("document" as const);
  const activeOutgoingLinks = activeDocument
    ? workspaceKnowledge.outgoingLinksByDocumentId.get(activeDocument.id) ?? []
    : [];
  const activeBacklinks = activeDocument
    ? workspaceKnowledge.backlinksByDocumentId.get(activeDocument.id) ?? []
    : [];
  const activeMissingLinks = activeOutgoingLinks.filter(
    (link) => !link.targetDocument,
  );
  const activeRelatedDocuments = useMemo(
    () =>
      activeDocument
        ? normalizeDocumentMetadata(activeDocument.metadata).documentLinks.map((link) => ({
            document: resolveDocumentLinkReference(link),
            link,
          }))
        : [],
    [activeDocument?.metadata, activeDocument?.id, workspace.documents],
  );
  const workspaceRelationItems = useMemo<WorkspaceRelationItem[]>(() => {
    const items: WorkspaceRelationItem[] = [];

    workspace.documents.forEach((sourceDocument) => {
      const sourceTitle = getDocumentDisplayName(sourceDocument);

      normalizeDocumentMetadata(sourceDocument.metadata).documentLinks.forEach(
        (reference) => {
          const targetDocument = resolveDocumentLinkReference(reference);
          const targetTitle =
            targetDocument ? getDocumentDisplayName(targetDocument) : reference.title;
          const targetPath = targetDocument?.filePath ?? reference.filePath;

          items.push({
            id: `document:${sourceDocument.id}:${normalizeFilePathKey(reference.filePath)}`,
            kind: "document",
            reference,
            searchText: [
              sourceTitle,
              sourceDocument.filePath,
              targetTitle,
              targetPath,
              getDocumentTypeName(reference.documentType),
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(),
            sourceDocument,
            status: targetDocument ? "linked" : "missing",
            targetDocument,
            targetPath,
            title: targetTitle,
          });
        },
      );

      const outgoingLinks = isMarkdownDocument(sourceDocument)
        ? workspaceKnowledge.outgoingLinksByDocumentId.get(sourceDocument.id) ?? []
        : [];

      outgoingLinks.forEach((link) => {
        const targetTitle =
          link.targetDocument ? getDocumentDisplayName(link.targetDocument) : link.display;
        const targetPath = link.targetDocument?.filePath ?? link.target;

        items.push({
          id: `content:${sourceDocument.id}:${link.index}:${link.raw}`,
          kind: "content",
          link,
          searchText: [
            sourceTitle,
            sourceDocument.filePath,
            targetTitle,
            targetPath,
            link.raw,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(),
          sourceDocument,
          status: link.targetDocument ? "linked" : "missing",
          targetDocument: link.targetDocument,
          targetPath,
          title: targetTitle,
        });
      });
    });

    return items.sort((left, right) => {
      const sourceOrder = getDocumentDisplayName(left.sourceDocument).localeCompare(
        getDocumentDisplayName(right.sourceDocument),
        "zh-CN",
        { numeric: true },
      );

      if (sourceOrder !== 0) {
        return sourceOrder;
      }

      return left.title.localeCompare(right.title, "zh-CN", { numeric: true });
    });
  }, [workspace.documents, workspaceKnowledge]);
  const visibleWorkspaceRelationItems = useMemo(() => {
    const linkedItems = workspaceRelationItems.filter(
      (item) => item.status === "linked",
    );

    if (!activeDocument) {
      return linkedItems;
    }

    return linkedItems.filter(
      (item) =>
        item.sourceDocument.id === activeDocument.id ||
        item.targetDocument?.id === activeDocument.id,
    );
  }, [activeDocument?.id, workspaceRelationItems]);
  const workspaceRelationStats = useMemo(() => {
    const documentCount = visibleWorkspaceRelationItems.filter(
      (item) => item.kind === "document",
    ).length;
    const contentCount = visibleWorkspaceRelationItems.filter(
      (item) => item.kind === "content",
    ).length;
    const sourceCount = new Set(
      visibleWorkspaceRelationItems.map((item) => item.sourceDocument.id),
    ).size;

    return {
      contentCount,
      documentCount,
      sourceCount,
      totalCount: visibleWorkspaceRelationItems.length,
    };
  }, [visibleWorkspaceRelationItems]);
  const filteredWorkspaceRelationItems = useMemo(() => {
    const query = relationPanelQuery.trim().toLocaleLowerCase();

    return visibleWorkspaceRelationItems.filter((item) => {
      const matchesFilter =
        relationPanelFilter === "all" ||
        (relationPanelFilter === "document" && item.kind === "document") ||
        (relationPanelFilter === "content" && item.kind === "content");

      return matchesFilter && (!query || item.searchText.includes(query));
    });
  }, [relationPanelFilter, relationPanelQuery, visibleWorkspaceRelationItems]);
  const documentLinkPickerSourceDocument = useMemo(() => {
    const sourceDocument = documentLinkSourceDocumentId
      ? workspace.documents.find((document) => document.id === documentLinkSourceDocumentId) ??
        null
      : activeDocument;

    return sourceDocument ?? null;
  }, [activeDocument, documentLinkSourceDocumentId, workspace.documents]);
  const documentLinkPickerRelatedKeys = useMemo(() => {
    if (!documentLinkPickerSourceDocument) {
      return new Set<string>();
    }

    return new Set(
      normalizeDocumentMetadata(documentLinkPickerSourceDocument.metadata).documentLinks.map(
        (link) => normalizeFilePathKey(link.filePath),
      ),
    );
  }, [
    documentLinkPickerSourceDocument?.id,
    documentLinkPickerSourceDocument?.metadata,
  ]);
  const linkableDocuments = useMemo(
    () =>
      workspace.documents
        .filter(
          (document) =>
            document.filePath &&
            normalizeFilePathKey(document.filePath) !==
              normalizeFilePathKey(documentLinkPickerSourceDocument?.filePath),
        )
        .sort((left, right) =>
          getDocumentDisplayName(left).localeCompare(
            getDocumentDisplayName(right),
            "zh-CN",
            { numeric: true },
          ),
        ),
    [documentLinkPickerSourceDocument?.filePath, workspace.documents],
  );
  const filteredLinkableDocuments = useMemo(() => {
    const query = documentLinkQuery.trim().toLocaleLowerCase();

    if (!query) {
      return linkableDocuments;
    }

    return linkableDocuments.filter((document) => {
      const haystack = [
        getDocumentDisplayName(document),
        document.filePath,
        getDocumentTypeLabel(document),
      ]
        .join(" ")
        .toLocaleLowerCase();

      return haystack.includes(query);
    });
  }, [documentLinkQuery, linkableDocuments]);
  const tagSuggestions = useMemo(
    () => workspaceKnowledge.tagSummaries.map((summary) => summary.tag),
    [workspaceKnowledge],
  );
  const propertyKeySuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];

    workspaceKnowledge.metadataByDocumentId.forEach((knowledge) => {
      knowledge.properties.forEach((property) => {
        const key = property.key.trim();
        const normalizedKey = key.toLocaleLowerCase();

        if (!key || seen.has(normalizedKey)) {
          return;
        }

        seen.add(normalizedKey);
        suggestions.push(key);
      });
    });

    return suggestions.sort((left, right) =>
      left.localeCompare(right, "zh-CN", { numeric: true }),
    );
  }, [workspaceKnowledge]);
  const propertyValueSuggestions = useMemo(() => {
    const selectedKey = normalizePropertyKey(propertyKeyDraft).toLocaleLowerCase();

    if (!selectedKey) {
      return [];
    }

    const seen = new Set<string>();
    const suggestions: string[] = [];

    workspaceKnowledge.metadataByDocumentId.forEach((knowledge) => {
      knowledge.properties.forEach((property) => {
        if (property.key.toLocaleLowerCase() !== selectedKey) {
          return;
        }

        const value = property.value.trim();
        const normalizedValue = value.toLocaleLowerCase();

        if (!value || seen.has(normalizedValue)) {
          return;
        }

        seen.add(normalizedValue);
        suggestions.push(value);
      });
    });

    return suggestions.sort((left, right) =>
      left.localeCompare(right, "zh-CN", { numeric: true }),
    );
  }, [propertyKeyDraft, workspaceKnowledge]);
  useEffect(() => {
    setActiveHtmlOutlineId(null);
  }, [activeDocument?.content, activeDocument?.id]);

  const editingDrawingAsset = useMemo(
    () =>
      activeDocument && isDrawingDocument(activeDocument)
        ? createDrawingAssetFromDocument(activeDocument)
        : activeDocument && editingDrawingId
          ? activeDocument.drawings[editingDrawingId] ?? null
          : null,
    [activeDocument, editingDrawingId],
  );
  const isCloudWorkspace = isCloudWorkspaceSource(workspace.source);
  const workspaceLabel = getWorkspaceDisplayLabel(workspace);
  const allRecentDocuments = useMemo(
    () =>
      [...workspace.documents]
        .sort(
          (first, second) =>
            getRecentDocumentTime(second) - getRecentDocumentTime(first),
        ),
    [workspace.documents],
  );
  const hiddenRecentDocumentKeySet = useMemo(
    () => new Set(hiddenRecentDocumentKeys),
    [hiddenRecentDocumentKeys],
  );
  const recentDocuments = useMemo(
    () =>
      allRecentDocuments.filter(
        (document) =>
          shouldShowInRecentDocuments(
            document,
            workspace.workspacePath,
            hiddenRecentDocumentKeySet,
          ),
      ),
    [allRecentDocuments, hiddenRecentDocumentKeySet, workspace.workspacePath],
  );
  const historyBrowserDocuments = useMemo(
    () =>
      recentDocuments
        .filter((document) => document.filePath && isMarkdownDocument(document))
        .slice(0, 10),
    [recentDocuments],
  );
  const historyBrowserDocument = useMemo(
    () =>
      historyBrowserDocuments.find(
        (document) =>
          document.filePath &&
          historyBrowserDocumentPath &&
          normalizeFilePathKey(document.filePath) ===
            normalizeFilePathKey(historyBrowserDocumentPath),
      ) ??
      historyBrowserDocuments[0] ??
      null,
    [historyBrowserDocumentPath, historyBrowserDocuments],
  );
  const recentDocumentFilePaths = useMemo(
    () =>
      Array.from(
        new Set(
          recentDocuments
            .map((document) => document.filePath)
            .filter((filePath): filePath is string => Boolean(filePath)),
        ),
      ),
    [recentDocuments],
  );
  const [recentFileAvailability, setRecentFileAvailability] =
    useRecentFileAvailability(
      recentDocumentFilePaths,
      window.desktop?.pathExists,
    );
  const recentDirectories = useMemo(() => {
    const currentDirectoryKey = normalizeDirectoryKey(workspace.workspacePath);
    const seen = new Set<string>();
    const entries: Array<{ isCurrent: boolean; label: string; path: string }> = [];
    const pushDirectory = (path?: string) => {
      const key = normalizeDirectoryKey(path);

      if (
        !path ||
        !key ||
        seen.has(key) ||
        !shouldShowInRecentDirectories(path, workspace.workspacePath)
      ) {
        return;
      }

      seen.add(key);
      entries.push({
        path,
        label: getPathLabel(path),
        isCurrent: Boolean(currentDirectoryKey && key === currentDirectoryKey),
      });
    };

    if (!isCloudWorkspace) {
      pushDirectory(workspace.workspacePath);
    }
    recentDirectoryPaths.forEach(pushDirectory);
    recentDocuments.forEach((document) => pushDirectory(getDirectoryPath(document.filePath)));

    return entries.slice(0, sidebarRecentDirectoryLimit);
  }, [isCloudWorkspace, recentDirectoryPaths, recentDocuments, workspace.workspacePath]);
  const activeMarkdownOutline = useMemo(
    () =>
      isMarkdownDocument(activeDocument)
        ? getMarkdownOutline(activeDocument!.content)
        : [],
    [activeDocument],
  );
  const activeHtmlOutline = useMemo(
    () =>
      isHtmlDocument(activeDocument)
        ? getHtmlOutline(activeDocument!.content)
        : [],
    [activeDocument],
  );
  const activeDocumentOutline = isHtmlDocument(activeDocument)
    ? activeHtmlOutline
    : activeMarkdownOutline;
  const activeDocumentWordCount = useMemo(
    () =>
      isMarkdownDocument(activeDocument)
        ? countMarkdownWords(activeDocument!.content)
        : 0,
    [activeDocument],
  );
  const diaryDocumentWordCount = useMemo(
    () =>
      isMarkdownDocument(diaryDocument)
        ? countMarkdownWords(getDiaryBody(diaryDocument!.content))
        : 0,
    [diaryDocument],
  );
  const diaryMarkdownOutline = useMemo(
    () =>
      isMarkdownDocument(diaryDocument)
        ? getMarkdownOutline(getDiaryBody(diaryDocument!.content))
        : [],
    [diaryDocument],
  );
  const deferredWorkspaceSearchQuery = useDeferredValue(workspaceSearchQuery);
  const workspaceSearchGroups = useMemo(
    () =>
      getWorkspaceSearchGroups(
        workspace.documents,
        deferredWorkspaceSearchQuery,
        workspace.workspacePath,
      ),
    [workspace.documents, workspace.workspacePath, deferredWorkspaceSearchQuery],
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

  useWorkspaceDirectoryWatcher(
    workspace.workspacePath,
    window.desktop?.watchWorkspaceDirectory,
    window.desktop?.unwatchWorkspaceDirectory,
  );

  useEffect(() => {
    if (!window.desktop?.onWorkspaceFileChanged) {
      return;
    }

    return window.desktop.onWorkspaceFileChanged((payload) => {
      void handleWorkspaceFileChange(payload);
    });
  }, [activeDocument, workspace.documents, workspace.workspacePath]);

  useLayoutEffect(() => {
    const snapshot = pendingSourceEditorViewportRef.current;
    const editor = editorRef.current;

    if (!snapshot || !editor || snapshot.documentId !== activeDocument?.id) {
      return;
    }

    pendingSourceEditorViewportRef.current = null;
    const maxPosition = editor.value.length;
    const selectionStart = Math.min(snapshot.selectionStart, maxPosition);
    const selectionEnd = Math.min(
      Math.max(snapshot.selectionEnd, selectionStart),
      maxPosition,
    );

    editor.scrollTop = snapshot.scrollTop;
    editor.scrollLeft = snapshot.scrollLeft;
    editor.setSelectionRange(selectionStart, selectionEnd);
    if (snapshot.hadFocus) {
      editor.focus({ preventScroll: true });
      editor.scrollTop = snapshot.scrollTop;
      editor.scrollLeft = snapshot.scrollLeft;
    }
  }, [activeDocument?.content, activeDocument?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useWindowChromeState({
    getWindowState: window.desktop?.getWindowState,
    getZoomFactor: window.desktop?.getZoomFactor,
    onWindowStateChanged: window.desktop?.onWindowStateChanged,
    setIsAlwaysOnTop,
    setIsFullScreen,
    setIsMaximized,
    setWindowZoomFactor,
  });

  useEffect(() => {
    if (!workspaceToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWorkspaceToast((current) =>
        current?.id === workspaceToast.id ? null : current,
      );
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [workspaceToast]);

  useEffect(
    () => () => {
      if (diarySaveTimerRef.current !== null) {
        window.clearTimeout(diarySaveTimerRef.current);
      }
    },
    [],
  );

  useEditorCssVariables(settings);

  usePersistedAppStateWriter({
    hiddenRecentDocumentKeys,
    isReady: isPersistenceReady,
    recentDirectories: recentDirectoryPaths,
    settings,
    sidebarWidth,
    theme,
    workspace,
  });

  useEffect(() => {
    window.localStorage.setItem(
      storageSplitRatioStorageKey,
      String(storageSplitRatio),
    );
  }, [storageSplitRatio]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveState("idle");
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [saveState]);

  useEffect(() => {
    void refreshDiaryEntries(workspace.workspacePath);
  }, [workspace.workspacePath]);

  useEffect(() => {
    const filePath = diaryDocument?.filePath;

    if (!filePath || !window.desktop?.writeMarkdownFile) {
      return;
    }

    if (savedFileContentByPathRef.current.get(filePath) === diaryDocument.content) {
      setDiarySaveState("saved");
      return;
    }

    setDiarySaveState("saving");

    if (diarySaveTimerRef.current !== null) {
      window.clearTimeout(diarySaveTimerRef.current);
    }

    const content = diaryDocument.content;
    diarySaveTimerRef.current = window.setTimeout(() => {
      diarySaveTimerRef.current = null;
      rememberInternalFileWrite(filePath, content);
      window.desktop?.writeMarkdownFile?.({
        content,
        filePath,
      })
        .then((savedFile) => {
          const savedContent =
            typeof savedFile?.content === "string" ? savedFile.content : content;
          acknowledgeSavedFileContent(filePath, savedContent);
          setDiaryDocument((current) =>
            current?.filePath === filePath
              ? {
                  ...current,
                  content: savedContent,
                  title: savedFile?.title || current.title,
                  updatedAt: savedFile?.updatedAt || current.updatedAt,
                }
              : current,
          );
          setDiarySaveState("saved");
          void refreshDiaryEntries(workspace.workspacePath);
          if (workspace.workspacePath) {
            void loadDirectoryTree(workspace.workspacePath);
          }
        })
        .catch(() => {
          setDiarySaveState("failed");
        });
    }, 700);

    return () => {
      if (diarySaveTimerRef.current !== null) {
        window.clearTimeout(diarySaveTimerRef.current);
        diarySaveTimerRef.current = null;
      }
    };
  }, [diaryDocument?.content, diaryDocument?.filePath, workspace.workspacePath]);

  useFindMatchStateMaintenance({
    activeDocumentId: activeDocument?.id,
    clearFindHighlight,
    findQuery,
    isFindReplaceOpen,
    matchCount: findMatches.length,
    setFindMatchIndex,
  });

  function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setDiaryFeatureEnabled(enabled: boolean) {
    updateSetting("homeShowDiaryPanel", enabled);

    if (enabled) {
      return;
    }

    if (sidebarTab === "diary") {
      setSidebarTab("files");
    }

    if (isDiaryOpen) {
      setIsDiaryOpen(false);
      setDiaryDocument(null);
      setWorkspace((current) =>
        current.activeDocumentId
          ? { ...current, activeDocumentId: "" }
          : current,
      );
      setIsHomeOpen(true);
    }
  }

  function mergeVisibleSidebarTabOrder(
    fullOrder: SidebarTabOrderItem[],
    visibleOrder: SidebarTabOrderItem[],
  ) {
    const visibleTabs = new Set(visibleOrder);
    let visibleIndex = 0;

    return fullOrder.map((tab) =>
      visibleTabs.has(tab) ? visibleOrder[visibleIndex++]! : tab,
    );
  }

  function getReorderedSidebarTabOrder(
    order: SidebarTabOrderItem[],
    draggedTab: SidebarTabOrderItem,
    targetIndex: number,
  ) {
    const remainingTabs = order.filter((tab) => tab !== draggedTab);
    const safeIndex = clamp(targetIndex, 0, remainingTabs.length);

    return [
      ...remainingTabs.slice(0, safeIndex),
      draggedTab,
      ...remainingTabs.slice(safeIndex),
    ];
  }

  function areSidebarTabOrdersEqual(
    left: SidebarTabOrderItem[],
    right: SidebarTabOrderItem[],
  ) {
    return (
      left.length === right.length &&
      left.every((tab, index) => tab === right[index])
    );
  }

  function getSidebarTabDropIndex(
    draggedTab: SidebarTabOrderItem,
    pointerX: number,
    renderOrder: SidebarTabOrderItem[],
  ) {
    const remainingTabs = renderOrder.filter((tab) => tab !== draggedTab);
    let nextIndex = 0;

    remainingTabs.forEach((tab) => {
      const button = sidebarTabButtonRefs.current.get(tab);
      const rect = button?.getBoundingClientRect();

      if (rect && pointerX > rect.left + rect.width / 2) {
        nextIndex += 1;
      }
    });

    return nextIndex;
  }

  function setSidebarTabButtonRef(
    tab: SidebarTabOrderItem,
    node: HTMLButtonElement | null,
  ) {
    if (node) {
      sidebarTabButtonRefs.current.set(tab, node);
      return;
    }

    sidebarTabButtonRefs.current.delete(tab);
  }

  function getSidebarTabLabel(tab: SidebarTabOrderItem) {
    if (tab === "diary") {
      return "日记";
    }

    if (tab === "files") {
      return "文件";
    }

    return isWorkspaceSearchTabVisible ? "查找" : "当前文件";
  }

  function activateSidebarTab(tab: SidebarTabOrderItem) {
    if (suppressNextSidebarTabClickRef.current) {
      suppressNextSidebarTabClickRef.current = false;
      return;
    }

    if (tab === "diary") {
      void openDiaryWorkspace();
      return;
    }

    if (tab === "files") {
      setSidebarTab("files");
      return;
    }

    setSidebarTab(isWorkspaceSearchTabVisible ? "search" : "current");
  }

  function startSidebarTabDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    tab: SidebarTabOrderItem,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setSidebarTabDrag({
      draggedTab: tab,
      isDragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      targetIndex: sidebarTabRenderOrder.indexOf(tab),
    });
  }

  function moveSidebarTabDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!sidebarTabDrag || event.pointerId !== sidebarTabDrag.pointerId) {
      return;
    }

    const isDragging =
      sidebarTabDrag.isDragging ||
      Math.abs(event.clientX - sidebarTabDrag.startX) > sidebarTabDragThreshold;

    if (!isDragging) {
      return;
    }

    event.preventDefault();

    const renderOrder = sidebarTabDrag.isDragging
      ? getReorderedSidebarTabOrder(
          sidebarTabRenderOrder,
          sidebarTabDrag.draggedTab,
          sidebarTabDrag.targetIndex,
        )
      : sidebarTabRenderOrder;
    const targetIndex = getSidebarTabDropIndex(
      sidebarTabDrag.draggedTab,
      event.clientX,
      renderOrder,
    );

    setSidebarTabDrag({
      ...sidebarTabDrag,
      isDragging: true,
      targetIndex,
    });
  }

  function finishSidebarTabDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!sidebarTabDrag || event.pointerId !== sidebarTabDrag.pointerId) {
      return;
    }

    if (sidebarTabDrag.isDragging) {
      const nextVisibleOrder = getReorderedSidebarTabOrder(
        sidebarTabRenderOrder,
        sidebarTabDrag.draggedTab,
        sidebarTabDrag.targetIndex,
      );
      const nextOrder = mergeVisibleSidebarTabOrder(
        settings.sidebarTabOrder,
        nextVisibleOrder,
      );

      suppressNextSidebarTabClickRef.current = true;
      window.setTimeout(() => {
        suppressNextSidebarTabClickRef.current = false;
      }, 0);

      if (!areSidebarTabOrdersEqual(settings.sidebarTabOrder, nextOrder)) {
        updateSetting("sidebarTabOrder", nextOrder);
      }
    }

    setSidebarTabDrag(null);
  }

  function cancelSidebarTabDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!sidebarTabDrag || event.pointerId !== sidebarTabDrag.pointerId) {
      return;
    }

    setSidebarTabDrag(null);
  }

  function updateEditorMode(nextMode: EditorMode) {
    setMode(nextMode);
    updateSetting("editorMode", nextMode);
  }

  async function persistCurrentAppStateSnapshot() {
    await savePersistedAppState(
      createPersistedAppState({
        hiddenRecentDocumentKeys,
        recentDirectories: recentDirectoryPaths,
        settings,
        sidebarWidth,
        theme,
        workspace,
      }),
    );
  }

  async function flushWorkspaceBeforeSync() {
    await persistCurrentAppStateSnapshot();

    const writableDocuments = getWritableDirtyDocuments({
      documents: workspace.documents,
      externalConflictPaths: externalConflictPathsRef.current,
      savedFileContentByPath: savedFileContentByPathRef.current,
    });

    if (!writableDocuments.length) {
      return;
    }

    await writeWorkspaceDirtyDocuments({
      acknowledgeSavedFileContent,
      documents: writableDocuments,
      rememberInternalFileWrite,
      writeMarkdownFile: window.desktop?.writeMarkdownFile,
    });
  }

  async function refreshHistoryBrowser(filePath = historyBrowserDocument?.filePath) {
    if (!filePath || !window.desktop?.listDocumentHistory) {
      setHistoryBrowserVersions([]);
      setSelectedHistoryBrowserVersion(null);
      return;
    }

    setIsHistoryBrowserLoading(true);

    try {
      const versions = await window.desktop.listDocumentHistory(filePath);
      setHistoryBrowserVersions(versions);

      const selectedVersionId = selectedHistoryBrowserVersion?.id;
      const nextVersion =
        versions.find((version) => version.id === selectedVersionId) ?? versions[0];

      if (nextVersion) {
        const versionWithContent = await window.desktop.readDocumentHistoryVersion?.({
          filePath,
          versionId: nextVersion.id,
        });

        setSelectedHistoryBrowserVersion(versionWithContent ?? null);
      } else {
        setSelectedHistoryBrowserVersion(null);
      }
    } catch {
      setHistoryBrowserVersions([]);
      setSelectedHistoryBrowserVersion(null);
    } finally {
      setIsHistoryBrowserLoading(false);
    }
  }

  async function selectHistoryBrowserVersion(
    version: DocumentHistoryVersion,
    filePath = historyBrowserDocument?.filePath,
  ) {
    if (!filePath || !window.desktop?.readDocumentHistoryVersion) {
      return;
    }

    setIsHistoryBrowserLoading(true);

    try {
      const versionWithContent = await window.desktop.readDocumentHistoryVersion({
        filePath,
        versionId: version.id,
      });

      setSelectedHistoryBrowserVersion(versionWithContent);
    } finally {
      setIsHistoryBrowserLoading(false);
    }
  }

  async function clearHistoryBrowserDocumentHistory() {
    const filePath = historyBrowserDocument?.filePath;

    if (!filePath || !window.desktop?.clearDocumentHistory) {
      return;
    }

    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "清空历史",
      description: "只会清空这个文档的历史版本，不会删除文档本身。",
      title: "清空该文档历史？",
      tone: "warning",
    });

    if (!confirmed) {
      return;
    }

    await window.desktop.clearDocumentHistory(filePath);
    setHistoryBrowserVersions([]);
    setSelectedHistoryBrowserVersion(null);
  }

  async function restoreHistoryBrowserVersion(
    version: DocumentHistoryVersionWithContent,
  ) {
    if (!historyBrowserDocument?.filePath || !window.desktop?.restoreDocumentHistoryVersion) {
      return;
    }

    setIsHistoryBrowserRestoring(true);

    try {
      const savedFile = await window.desktop.restoreDocumentHistoryVersion({
        filePath: historyBrowserDocument.filePath,
        versionId: version.id,
      });
      const restoredDocument = createDocumentFromSavedFile(
        historyBrowserDocument,
        savedFile,
      );

      rememberInternalFileWrite(savedFile.filePath, savedFile.content);
      acknowledgeSavedFileContent(savedFile.filePath, savedFile.content);
      setWorkspace((current) =>
        applySavedDocumentToWorkspace(current, restoredDocument),
      );
      setSaveState("saved");
      await refreshHistoryBrowser(savedFile.filePath);
    } finally {
      setIsHistoryBrowserRestoring(false);
    }
  }

  function openDocumentHistoryDialog(filePath?: string) {
    setHistoryBrowserDocumentPath(
      filePath ?? activeDocument?.filePath ?? historyBrowserDocuments[0]?.filePath ?? null,
    );
    setIsDocumentHistoryDialogOpen(true);
  }

  function openSettings(section: SettingsSectionId = "app") {
    setActiveSettingsSection(
      section === "sync" && !remoteSyncFeatureEnabled ? "app" : section,
    );
    setIsSettingsOpen(true);
  }

  async function loginAndConfigureSync() {
    if (!remoteSyncFeatureEnabled) {
      return;
    }

    if (isSyncLoginRunning) {
      return;
    }

    const normalizedServerUrl = normalizeSyncServerUrlInput(syncServerUrlDraft);

    if (
      !normalizedServerUrl ||
      !syncLoginUsernameDraft.trim() ||
      !syncLoginPasswordDraft
    ) {
      setSyncLoginMessageTone("error");
      setSyncLoginMessage("请填写服务器地址、用户名和密码。");
      return;
    }

    setIsSyncLoginRunning(true);
    setSyncServerUrlDraft(normalizedServerUrl);
    setSyncLoginMessageTone("info");
    setSyncLoginMessage("正在登录云同步...");

    try {
      const result = await window.desktop?.syncCreateAccessToken?.({
        password: syncLoginPasswordDraft,
        serverUrl: normalizedServerUrl,
        username: syncLoginUsernameDraft,
      });

      if (!result) {
        throw new Error("当前环境不支持同步登录。");
      }

      const status = await window.desktop?.syncConfigure?.({
        enabled: true,
        serverUrl: normalizedServerUrl,
        token: result.token,
        workspaceId: result.workspaceId,
      });

      setSyncEnabledDraft(true);
      setSyncLoginPasswordDraft("");
      setSyncLoginMessageTone("success");
      setSyncLoginMessage("云同步已启用。");

      if (status) {
        setSyncStatus(status);
      }

      await refreshCloudSidebarWorkspace({ showErrors: true });
    } catch (error) {
      setSyncLoginMessageTone("error");
      setSyncLoginMessage(
        error instanceof Error ? error.message : "同步登录失败。",
      );
    } finally {
      setIsSyncLoginRunning(false);
    }
  }

  async function syncNow() {
    if (!remoteSyncFeatureEnabled) {
      return;
    }

    try {
      await flushWorkspaceBeforeSync();
      const status = await window.desktop?.syncNow?.();

      if (status) {
        setSyncStatus(status);
      }
    } catch {
      setSyncStatus((current) => ({
        ...current,
        message: "同步前保存本地更改失败。",
        state: "failed",
      }));
    }
  }

  async function refreshCurrentLocalWorkspace() {
    if (!workspace.workspacePath || isCloudWorkspace) {
      return;
    }

    await Promise.all([
      loadDirectoryTree(workspace.workspacePath),
      refreshWorkspaceSearchDocuments(),
    ]);
  }

  function closeCloudDocumentsAfterLogout(cloudRootPath?: string) {
    const activeDocumentIsCloud =
      isCloudWorkspaceSource(workspace.source) ||
      Boolean(
        activeDocument?.filePath &&
          cloudRootPath &&
          isPathInsideDirectoryPath(activeDocument.filePath, cloudRootPath),
      );

    setWorkspace((current) => {
      const currentWorkspaceIsCloud = isCloudWorkspaceSource(current.source);
      const documents = currentWorkspaceIsCloud
        ? []
        : current.documents.filter((document) => {
            if (!document.filePath || !cloudRootPath) {
              return true;
            }

            return !isPathInsideDirectoryPath(document.filePath, cloudRootPath);
          });
      const activeDocumentId = documents.some(
        (document) => document.id === current.activeDocumentId,
      )
        ? current.activeDocumentId
        : "";

      return {
        ...current,
        activeDocumentId,
        documents,
        source: currentWorkspaceIsCloud ? undefined : current.source,
        updatedAt: now(),
        workspacePath: currentWorkspaceIsCloud ? undefined : current.workspacePath,
      };
    });

    if (activeDocumentIsCloud) {
      setIsHomeOpen(true);
    }
  }

  async function logoutSync() {
    if (!remoteSyncFeatureEnabled) {
      return;
    }

    const cloudRootPath = cloudSidebarWorkspace?.directoryPath;
    const status = await window.desktop?.syncConfigure?.({
      enabled: false,
      serverUrl: syncServerUrlDraft || syncStatus.configuration.serverUrl,
      token: "",
      workspaceId: syncStatus.configuration.workspaceId,
    });

    setSyncEnabledDraft(false);
    setSyncLoginPasswordDraft(defaultSyncLoginPassword);
    setSyncLoginMessageTone("info");
    setSyncLoginMessage("已退出云同步账号。");
    closeCloudDocumentsAfterLogout(cloudRootPath);
    setCloudSidebarWorkspace(null);
    setIsCloudMultiSelectEnabled(false);
    setSelectedCloudEntryPaths(new Set());

    if (status) {
      setSyncStatus(status);
    }
  }

  function openSyncStatusMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!remoteSyncFeatureEnabled) {
      return;
    }

    openContextMenu(
      event,
      [
        {
          icon: <RefreshCw size={15} />,
          label: "立即同步",
          onSelect: () => void syncNow(),
        },
        {
          icon: <Settings2 size={15} />,
          label: "云同步设置",
          onSelect: () => openSettings("sync"),
        },
        { type: "separator" },
        {
          danger: true,
          icon: <LogOut size={15} />,
          label: "退出登录",
          onSelect: () => void logoutSync(),
        },
      ],
      220,
    );
  }

  async function toggleFullScreen() {
    const nextFullScreenState = await window.desktop?.toggleFullScreen?.();

    if (typeof nextFullScreenState === "boolean") {
      setIsFullScreen(nextFullScreenState);
      setTopMenu(null);
      setIsActionsOpen(false);
      setContextMenu(null);
    }
  }

  async function toggleAlwaysOnTop() {
    const nextAlwaysOnTopState = await window.desktop?.toggleAlwaysOnTop?.();

    if (typeof nextAlwaysOnTopState === "boolean") {
      setIsAlwaysOnTop(nextAlwaysOnTopState);
    }
  }

  function revealZoomIndicator(nextFactor: number) {
    setWindowZoomFactor(nextFactor);
  }

  async function runWindowZoomCommand(command: "reset" | "zoomIn" | "zoomOut") {
    const nextZoomFactor =
      command === "reset"
        ? await window.desktop?.resetZoom?.()
        : command === "zoomIn"
          ? await window.desktop?.zoomIn?.()
          : await window.desktop?.zoomOut?.();

    if (typeof nextZoomFactor !== "number" || !Number.isFinite(nextZoomFactor)) {
      return;
    }

    revealZoomIndicator(nextZoomFactor);
    setTopMenu(null);
    setIsActionsOpen(false);
    setContextMenu(null);
  }

  useEffect(() => {
    return window.desktop?.onZoomFactorChanged?.((factor) => {
      if (typeof factor === "number" && Number.isFinite(factor)) {
        revealZoomIndicator(factor);
      }
    });
  }, []);

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsSidebarResizing(true);
    setSidebarResizePreviewX(getSidebarResizeTarget(event.clientX).previewX);

    function previewSidebarResize(pointerEvent: PointerEvent) {
      setSidebarResizePreviewX(
        getSidebarResizeTarget(pointerEvent.clientX).previewX,
      );
    }

    function commitSidebarResize(pointerX: number) {
      const resizeTarget = getSidebarResizeTarget(pointerX);

      setIsSidebarCollapsed(resizeTarget.isCollapsed);

      if (!resizeTarget.isCollapsed) {
        setSidebarWidth(resizeTarget.width);
      }
    }

    function stopSidebarResize(pointerEvent: PointerEvent) {
      commitSidebarResize(pointerEvent.clientX);
      setIsSidebarResizing(false);
      setSidebarResizePreviewX(null);
      window.removeEventListener("pointermove", previewSidebarResize);
      window.removeEventListener("pointerup", stopSidebarResize);
      window.removeEventListener("pointercancel", stopSidebarResize);
    }

    window.addEventListener("pointermove", previewSidebarResize);
    window.addEventListener("pointerup", stopSidebarResize);
    window.addEventListener("pointercancel", stopSidebarResize);
  }

  function startInspectorResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInspectorResizing(true);
    setInspectorResizePreviewX(event.clientX);

    function previewInspectorResize(pointerEvent: PointerEvent) {
      setInspectorResizePreviewX(
        window.innerWidth - getInspectorResizeTarget(pointerEvent.clientX),
      );
    }

    function commitInspectorResize(pointerX: number) {
      setInspectorWidth(getInspectorResizeTarget(pointerX));
    }

    function stopInspectorResize(pointerEvent: PointerEvent) {
      commitInspectorResize(pointerEvent.clientX);
      setIsInspectorResizing(false);
      setInspectorResizePreviewX(null);
      window.removeEventListener("pointermove", previewInspectorResize);
      window.removeEventListener("pointerup", stopInspectorResize);
      window.removeEventListener("pointercancel", stopInspectorResize);
    }

    window.addEventListener("pointermove", previewInspectorResize);
    window.addEventListener("pointerup", stopInspectorResize);
    window.addEventListener("pointercancel", stopInspectorResize);
  }

  function getStorageSplitRatioFromPointer(pointerY: number) {
    const rect = storageSectionsRef.current?.getBoundingClientRect();

    if (!rect || rect.height <= 0) {
      return storageSplitRatio;
    }

    const minRatio = clamp(minStorageSectionHeight / rect.height, 0.18, 0.48);
    const maxRatio = 1 - minRatio;

    return clamp((pointerY - rect.top) / rect.height, minRatio, maxRatio);
  }

  function startStorageSplitResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsStorageSplitResizing(true);
    setStorageSplitRatio(getStorageSplitRatioFromPointer(event.clientY));

    function previewStorageSplitResize(pointerEvent: PointerEvent) {
      setStorageSplitRatio(getStorageSplitRatioFromPointer(pointerEvent.clientY));
    }

    function stopStorageSplitResize(pointerEvent: PointerEvent) {
      setStorageSplitRatio(getStorageSplitRatioFromPointer(pointerEvent.clientY));
      setIsStorageSplitResizing(false);
      window.removeEventListener("pointermove", previewStorageSplitResize);
      window.removeEventListener("pointerup", stopStorageSplitResize);
      window.removeEventListener("pointercancel", stopStorageSplitResize);
    }

    window.addEventListener("pointermove", previewStorageSplitResize);
    window.addEventListener("pointerup", stopStorageSplitResize);
    window.addEventListener("pointercancel", stopStorageSplitResize);
  }

  function rememberRecentDirectory(path?: string) {
    if (!shouldShowInRecentDirectories(path, workspace.workspacePath)) {
      return;
    }

    setRecentDirectoryPaths((current) =>
      rememberRecentDirectoryPath(current, path),
    );
  }

  function revealRecentDocument(document?: MarkdownDocument | null) {
    if (!document) {
      return;
    }

    const key = getRecentDocumentVisibilityKey(document);
    setHiddenRecentDocumentKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : current,
    );
  }

  function clearRecentDocuments() {
    if (!recentDocuments.length) {
      return;
    }

    const keys = recentDocuments.map(getRecentDocumentVisibilityKey);

    setHiddenRecentDocumentKeys((current) =>
      Array.from(new Set([...current, ...keys])),
    );
  }

  useEffect(() => {
    if (
      !isPersistenceReady ||
      workspace.workspacePath ||
      !window.desktop?.getDefaultWorkspaceDirectory
    ) {
      return;
    }

    void window.desktop.getDefaultWorkspaceDirectory().then((workspacePath) => {
      setWorkspace((current) =>
        current.workspacePath ? current : { ...current, workspacePath },
      );
    });
  }, [isPersistenceReady, workspace.workspacePath]);

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

  useGlobalAppShortcuts({
    editorRef,
    isCreateFileOpen,
    isFullScreen,
    isSettingsOpen,
    onAction: runAppShortcutAction,
  });

  useEffect(() => {
    appMenuCommandHandlerRef.current = runAppMenuCommand;
  });

  useEffect(() => {
    return window.desktop?.onAppMenuCommand?.((command) => {
      appMenuCommandHandlerRef.current(command);
    });
  }, []);

  useActiveDocumentUiReset({
    activeDocumentId: activeDocument?.id,
    resetActiveEditorLine: () => setActiveEditorLineIndex(0),
    resetWikiLinkDraft: () => setWikiLinkTargetDraft(""),
  });

  useWorkspaceSearchAutoFocus({
    inputRef: workspaceSearchInputRef,
    isSidebarHidden,
    sidebarTab,
  });

  useInspirationNoteBridge(window.desktop?.onInspirationNote, openInspirationNote);

  usePendingWorkspaceSearchReveal({
    activeDocument,
    onReveal: revealWorkspaceSearchMatch,
    pendingRevealRef: pendingWorkspaceSearchRevealRef,
    revealKey: mode,
  });

  useWorkspaceAutosave({
    acknowledgeSavedFileContent,
    externalConflictPaths: externalConflictPathsRef.current,
    loadDirectoryTree,
    rememberInternalFileWrite,
    savedFileContentByPath: savedFileContentByPathRef.current,
    setSaveState,
    workspace,
    writeMarkdownFile: window.desktop?.writeMarkdownFile,
  });

  useEffect(() => {
    if (
      isDocumentHistoryDialogOpen &&
      !historyBrowserDocumentPath &&
      historyBrowserDocuments[0]?.filePath
    ) {
      setHistoryBrowserDocumentPath(historyBrowserDocuments[0].filePath);
    }
  }, [
    historyBrowserDocumentPath,
    historyBrowserDocuments,
    isDocumentHistoryDialogOpen,
  ]);

  useEffect(() => {
    if (!isDocumentHistoryDialogOpen || !historyBrowserDocument?.filePath) {
      return;
    }

    void refreshHistoryBrowser(historyBrowserDocument.filePath);
  }, [
    historyBrowserDocument?.filePath,
    isDocumentHistoryDialogOpen,
  ]);

  function setActiveDocument(documentId: string) {
    const document = workspace.documents.find((item) => item.id === documentId);

    revealRecentDocument(document);
    setIsDiaryOpen(false);
    setIsHomeOpen(false);
    setWorkspace((current) => markWorkspaceDocumentOpened(current, documentId));
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
    void createLocalMarkdownDocument();
  }

  async function createLocalMarkdownDocument(targetDirectoryPath?: string) {
    setIsActionsOpen(false);
    setTopMenu(null);

    const directoryPath =
      targetDirectoryPath ||
      workspace.workspacePath ||
      (await window.desktop?.getDefaultWorkspaceDirectory?.()) ||
      "";

    if (!directoryPath || !window.desktop?.createMarkdownFile) {
      setNewFileName(`Untitled ${workspace.documents.length + 1}`);
      setIsCreateFileOpen(true);
      return;
    }

    try {
      const localFile = await window.desktop.createMarkdownFile({
        directoryPath,
        title: "Untitled",
      });

      setPendingOpenAfterRenameEntryPath(localFile.filePath);
      setExpandedDirectoryPaths((current) => {
        const next = new Set(current);
        next.add(directoryPath);
        return next;
      });
      await loadDirectoryTree(workspace.workspacePath || directoryPath);
      startRenamingEntry(localFile.filePath, "file");
    } catch {
      setSaveState("failed");
    }
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
        : createDocument(title, "");

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) =>
        addCreatedDocumentToWorkspace(
          current,
          markDocumentOpened(document),
          directoryPath,
        ),
      );
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

  async function createLocalDirectory(targetDirectoryPath?: string) {
    const directoryPath =
      targetDirectoryPath ||
      workspace.workspacePath ||
      (await window.desktop?.getDefaultWorkspaceDirectory?.()) ||
      "";

    if (!directoryPath || !window.desktop?.createWorkspaceDirectory) {
      await showAppAlert({
        confirmLabel: "知道了",
        description: "需要先打开本地文档目录，才能新建文件夹。",
        title: "无法新建文件夹",
        tone: "warning",
      });
      return;
    }

    try {
      const result = await window.desktop.createWorkspaceDirectory({
        directoryPath,
        name: "新建文件夹",
      });

      setFileExplorerView("tree");
      setExpandedDirectoryPaths((current) => {
        const next = new Set(current);
        next.add(directoryPath);
        next.add(result.directoryPath);
        return next;
      });
      await loadDirectoryTree(workspace.workspacePath || directoryPath);
      startRenamingEntry(result.directoryPath, "directory");
    } catch (error) {
      await showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error ? error.message : "新建本地文件夹失败。",
        detail: directoryPath,
        title: "新建失败",
        tone: "danger",
      });
    }
  }

  async function getCreationDirectory(targetDirectoryPath?: string) {
    return (
      targetDirectoryPath ||
      workspace.workspacePath ||
      (await window.desktop?.getDefaultWorkspaceDirectory?.()) ||
      ""
    );
  }

  function activateCreatedDocument(document: MarkdownDocument, directoryPath?: string) {
    if (document.filePath) {
      savedFileContentByPathRef.current.set(document.filePath, document.content);
    }

    setWorkspace((current) =>
      addCreatedDocumentToWorkspace(
        current,
        markDocumentOpened(document),
        directoryPath,
      ),
    );
    setIsHomeOpen(false);
    setIsActionsOpen(false);
    setTopMenu(null);
  }

  async function createStandaloneSheetDocument(targetDirectoryPath?: string) {
    const data = createDefaultUniverSheetData();
    const title = data.title || "Online Sheet";
    const content = serializeUniverSheetData(data);

    try {
      const directoryPath = await getCreationDirectory(targetDirectoryPath);
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
      void openUniverSheetEditor({ kind: "document" }, document.content);

      if (directoryPath) {
        setExpandedDirectoryPaths((current) => {
          const next = new Set(current);
          next.add(directoryPath);
          return next;
        });
        await loadDirectoryTree(workspace.workspacePath || directoryPath);
      }
    } catch {
      setSaveState("failed");
    }
  }

  async function createStandaloneDrawingDocument(targetDirectoryPath?: string) {
    const title = "Excalidraw";
    const content = createDefaultExcalidrawScene();

    try {
      const directoryPath = await getCreationDirectory(targetDirectoryPath);
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
        setExpandedDirectoryPaths((current) => {
          const next = new Set(current);
          next.add(directoryPath);
          return next;
        });
        await loadDirectoryTree(workspace.workspacePath || directoryPath);
      }
    } catch {
      setSaveState("failed");
    }
  }

  function applyWorkspaceDirectory(
    directoryPath: string,
    localFiles: LocalMarkdownFile[],
    tree: DirectoryTreeItem | null,
    source: WorkspaceSource = {
      directoryPath,
      kind: "local",
    },
  ) {
    const localDocuments = localFiles.map(createDocumentFromLocalFile);
    const fallbackDocument = createDocument("Untitled", "");
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
      source,
      workspacePath: directoryPath,
    }));
    applyDirectoryTree(tree);
    setIsDiaryOpen(false);
    setIsHomeOpen(true);
    setIsActionsOpen(false);
    setTopMenu(null);
    setSaveState("idle");
    if (source.kind === "local") {
      rememberRecentDirectory(directoryPath);
    }
  }

  async function openWorkspaceDirectoryPath(directoryPath: string) {
    if (!directoryPath) {
      return;
    }

    try {
      if (window.desktop?.pathExists && !(await window.desktop.pathExists(directoryPath))) {
        void showAppAlert({
          confirmLabel: "知道了",
          description: "这个最近目录已经不存在，或当前应用没有权限访问。",
          detail: directoryPath,
          title: "无法打开最近目录",
          tone: "warning",
        });
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

  function createCloudSidebarWorkspace(
    openedWorkspace: CloudWorkspaceDirectory,
  ): CloudSidebarWorkspace {
    const source =
      openedWorkspace.source?.kind === "cloud"
        ? openedWorkspace.source
        : {
            cachePath: openedWorkspace.directoryPath,
            kind: "cloud" as const,
            workspaceId: openedWorkspace.workspaceId,
            workspaceName: openedWorkspace.workspaceName || "云端笔记",
          };

    return {
      directoryPath: openedWorkspace.directoryPath,
      documents: (openedWorkspace.files ?? []).map(createDocumentFromLocalFile),
      source,
      tree: openedWorkspace.tree ?? null,
      workspaceId: openedWorkspace.workspaceId,
      workspaceName: openedWorkspace.workspaceName || "云端笔记",
    };
  }

  function applyCloudSidebarWorkspace(openedWorkspace: CloudWorkspaceDirectory) {
    const nextCloudWorkspace = createCloudSidebarWorkspace(openedWorkspace);
    const nextEntryMap = collectDirectoryEntryMap(nextCloudWorkspace.tree);

    setCloudSidebarWorkspace(nextCloudWorkspace);
    setSelectedCloudEntryPaths((current) => {
      const next = new Set<string>();

      for (const entryPath of current) {
        if (nextEntryMap.has(normalizeFilePathKey(entryPath))) {
          next.add(entryPath);
        }
      }

      return next;
    });
    setExpandedCloudDirectoryPaths((current) => {
      const next = new Set(current);

      if (nextCloudWorkspace.tree?.path) {
        next.add(nextCloudWorkspace.tree.path);
      }

      return next;
    });
  }

  function isCloudSidebarEntryPath(filePath: string) {
    if (!remoteSyncFeatureEnabled) {
      return false;
    }

    const cloudRootPath =
      cloudSidebarWorkspace?.directoryPath ||
      (isCloudWorkspaceSource(workspace.source) ? workspace.source.cachePath : "");

    if (!cloudRootPath) {
      return false;
    }

    const fileKey = normalizeFilePathKey(filePath);
    const cloudRootKey = normalizeFilePathKey(cloudRootPath).replace(/\/+$/, "");

    return fileKey === cloudRootKey || fileKey.startsWith(`${cloudRootKey}/`);
  }

  function getCloudDocumentDisplayPath(filePath?: string) {
    const cloudRootPath =
      cloudSidebarWorkspace?.directoryPath ||
      (isCloudWorkspaceSource(workspace.source) ? workspace.source.cachePath : "");

    if (!filePath || !cloudRootPath) {
      return "云端文档/";
    }

    const normalizedRoot = cloudRootPath.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = filePath.replace(/\\/g, "/");
    const rootKey = normalizedRoot.toLocaleLowerCase();
    const pathKey = normalizedPath.toLocaleLowerCase();

    if (pathKey === rootKey) {
      return "云端文档/";
    }

    if (!pathKey.startsWith(`${rootKey}/`)) {
      return "云端文档/";
    }

    const relativePath = normalizedPath.slice(normalizedRoot.length + 1);
    const relativeDirectory = getDirectoryPath(relativePath).replace(/\\/g, "/");

    return relativeDirectory ? `云端文档/${relativeDirectory}/` : "云端文档/";
  }

  function getDocumentDisplayPath(document: MarkdownDocument) {
    const cloudRootPath =
      cloudSidebarWorkspace?.directoryPath ||
      (isCloudWorkspaceSource(workspace.source) ? workspace.source.cachePath : "");
    const normalizedRoot = cloudRootPath
      ? normalizeFilePathKey(cloudRootPath).replace(/\/+$/, "")
      : "";
    const normalizedPath = document.filePath
      ? normalizeFilePathKey(document.filePath)
      : "";
    const isCloudDocument =
      Boolean(normalizedRoot && normalizedPath) &&
      (normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(`${normalizedRoot}/`));

    if (document.filePath && isCloudDocument) {
      return getCloudDocumentDisplayPath(document.filePath);
    }

    return getDocumentPathPreview(document, workspace.workspacePath);
  }

  function toggleCloudMultiSelect() {
    setIsCloudMultiSelectEnabled((current) => {
      if (current) {
        setSelectedCloudEntryPaths(new Set());
      }

      return !current;
    });
  }

  function toggleCloudEntrySelection(item: DirectoryTreeItem) {
    setSelectedCloudEntryPaths((current) => {
      return toggleWorkspaceEntrySelection(current, item, cloudSidebarEntryMap);
    });
  }

  async function refreshCloudSidebarWorkspace(
    options: { showErrors?: boolean } = {},
  ) {
    if (!syncStatus.configuration.enabled) {
      setCloudSidebarWorkspace(null);
      setIsCloudMultiSelectEnabled(false);
      setSelectedCloudEntryPaths(new Set());
      return null;
    }

    try {
      const openedWorkspace = await window.desktop?.openCloudWorkspace?.();

      if (!openedWorkspace) {
        return null;
      }

      applyCloudSidebarWorkspace(openedWorkspace);
      return openedWorkspace;
    } catch (error) {
      if (options.showErrors) {
        setSyncLoginMessageTone("error");
        setSyncLoginMessage(
          error instanceof Error ? error.message : "打开云端笔记失败。",
        );
      }

      return null;
    }
  }

  async function refreshCloudSidebarWorkspaceFromCache() {
    const directoryPath = cloudSidebarWorkspace?.directoryPath;

    if (!directoryPath) {
      return null;
    }

    try {
      const [localFiles, tree] = await Promise.all([
        window.desktop?.listMarkdownFiles
          ? window.desktop.listMarkdownFiles(directoryPath)
          : Promise.resolve([]),
        window.desktop?.readDirectoryTree
          ? window.desktop.readDirectoryTree(directoryPath, {
              includeEmptyDirectories: true,
            })
          : Promise.resolve(null),
      ]);

      const nextWorkspace: CloudWorkspaceDirectory = {
        directoryPath,
        files: localFiles,
        source: cloudSidebarWorkspace.source,
        tree: tree ?? {
          children: [],
          name: getPathLabel(directoryPath),
          path: directoryPath,
          type: "directory",
        },
        workspaceId: cloudSidebarWorkspace.workspaceId,
        workspaceName: cloudSidebarWorkspace.workspaceName,
      };

      applyCloudSidebarWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch {
      return null;
    }
  }

  function getCloudTargetDirectoryPath(targetDirectoryPath?: string) {
    return targetDirectoryPath || cloudSidebarWorkspace?.directoryPath || "";
  }

  async function createCloudMarkdownDocument(targetDirectoryPath?: string) {
    const directoryPath = getCloudTargetDirectoryPath(targetDirectoryPath);

    if (!directoryPath || !window.desktop?.createMarkdownFile) {
      await showAppAlert({
        confirmLabel: "知道了",
        description: "需要先启用并打开云端文档区域，才能在云端新建 Markdown 文件。",
        title: "无法新建云端文件",
        tone: "warning",
      });
      return;
    }

    try {
      const localFile = await window.desktop.createMarkdownFile({
        directoryPath,
        title: "Untitled",
      });

      setExpandedCloudDirectoryPaths((current) => {
        const next = new Set(current);
        next.add(directoryPath);
        return next;
      });
      setPendingOpenAfterRenameEntryPath(localFile.filePath);
      await refreshCloudSidebarWorkspaceFromCache();
      startRenamingEntry(localFile.filePath, "file");
    } catch (error) {
      await showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error ? error.message : "新建云端 Markdown 文件失败。",
        detail: directoryPath,
        title: "新建失败",
        tone: "danger",
      });
    }
  }

  async function createCloudDirectory(targetDirectoryPath?: string) {
    if (cloudDirectoryCreateInFlightRef.current) {
      return;
    }

    const directoryPath = getCloudTargetDirectoryPath(targetDirectoryPath);

    if (!directoryPath || !window.desktop?.createWorkspaceDirectory) {
      await showAppAlert({
        confirmLabel: "知道了",
        description: "需要先启用并打开云端文档区域，才能在云端新建文件夹。",
        title: "无法新建云端文件夹",
        tone: "warning",
      });
      return;
    }

    cloudDirectoryCreateInFlightRef.current = true;
    setIsCloudDirectoryCreating(true);

    try {
      const result = await window.desktop.createWorkspaceDirectory({
        directoryPath,
        name: "新建文件夹",
      });

      setExpandedCloudDirectoryPaths((current) => {
        const next = new Set(current);
        next.add(directoryPath);
        next.add(result.directoryPath);
        return next;
      });
      await refreshCloudSidebarWorkspaceFromCache();
      startRenamingEntry(result.directoryPath, "directory");
    } catch (error) {
      await showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error ? error.message : "新建云端文件夹失败。",
        detail: directoryPath,
        title: "新建失败",
        tone: "danger",
      });
    } finally {
      cloudDirectoryCreateInFlightRef.current = false;
      setIsCloudDirectoryCreating(false);
    }
  }

  async function importLocalDirectoryToCloud(sourcePath?: string) {
    setIsCloudImporting(true);

    try {
      const importedWorkspace =
        await window.desktop?.importLocalDirectoryToCloud?.(sourcePath);

      if (!importedWorkspace) {
        return;
      }

      applyCloudSidebarWorkspace(importedWorkspace);
      setSyncEnabledDraft(true);
      setSyncLoginMessageTone("success");
      setSyncLoginMessage(
        `已导入 ${importedWorkspace.importedCount} 个文件，跳过 ${importedWorkspace.skippedCount} 个同名文件。`,
      );
    } catch (error) {
      setSyncLoginMessageTone("error");
      setSyncLoginMessage(
        error instanceof Error ? error.message : "导入本地文件夹失败。",
      );
    } finally {
      setIsCloudImporting(false);
    }
  }

  function toggleCloudDirectoryPath(directoryPath: string) {
    setExpandedCloudDirectoryPaths((current) => {
      const next = new Set(current);

      if (next.has(directoryPath)) {
        next.delete(directoryPath);
      } else {
        next.add(directoryPath);
      }

      return next;
    });
  }

  function startSidebarEntryDrag(
    event: ReactDragEvent<HTMLButtonElement>,
    payload: SidebarDragPayload,
  ) {
    activeSidebarDragPayloadRef.current = payload;
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(
      "application/x-notedock-sidebar-entry",
      JSON.stringify(payload),
    );
    event.dataTransfer.setData("text/plain", payload.path);
  }

  function clearSidebarDragState() {
    activeSidebarDragPayloadRef.current = null;
    setSidebarDropTarget(null);
    setSidebarDirectoryDropTargetPath(null);
    setSidebarDirectoryDragPreview(null);
  }

  function expandSidebarDirectoryForDropPreview(
    directoryPath: string,
    target: SidebarStorageKind,
  ) {
    const expandPath = (current: Set<string>) => {
      if (current.has(directoryPath)) {
        return current;
      }

      const next = new Set(current);
      next.add(directoryPath);
      return next;
    };

    if (target === "cloud") {
      setExpandedCloudDirectoryPaths(expandPath);
      return;
    }

    setExpandedDirectoryPaths(expandPath);
  }

  function readSidebarDragPayload(event: ReactDragEvent<HTMLElement>) {
    if (activeSidebarDragPayloadRef.current) {
      return activeSidebarDragPayloadRef.current;
    }

    const raw = event.dataTransfer.getData("application/x-notedock-sidebar-entry");

    if (!raw) {
      return null;
    }

    try {
      const payload = JSON.parse(raw) as SidebarDragPayload;

      if (
        (payload.source === "local" || payload.source === "cloud") &&
        (payload.entryType === "file" || payload.entryType === "directory") &&
        payload.path
      ) {
        return payload;
      }
    } catch {
      return null;
    }

    return null;
  }

  function canDropSidebarEntryOnDirectory(
    payload: SidebarDragPayload | null,
    targetDirectoryPath: string,
    target?: SidebarStorageKind,
  ) {
    if (!payload || !targetDirectoryPath) {
      return false;
    }

    if (
      target &&
      payload.source === target &&
      normalizeFilePathKey(getDirectoryPath(payload.path)) ===
        normalizeFilePathKey(targetDirectoryPath)
    ) {
      return false;
    }

    if (normalizeFilePathKey(payload.path) === normalizeFilePathKey(targetDirectoryPath)) {
      return false;
    }

    if (
      payload.entryType === "directory" &&
      isPathInsideDirectoryPath(targetDirectoryPath, payload.path)
    ) {
      return false;
    }

    return true;
  }

  function getSidebarStorageRootPath(target: SidebarStorageKind) {
    return target === "cloud"
      ? cloudSidebarWorkspace?.directoryPath || ""
      : workspace.workspacePath || "";
  }

  function canDropSidebarEntryOnStorageRoot(
    payload: SidebarDragPayload | null,
    target: SidebarStorageKind,
    targetRootDirectoryPath: string,
  ) {
    if (!payload) {
      return false;
    }

    if (payload.source !== target) {
      return true;
    }

    if (!targetRootDirectoryPath) {
      return false;
    }

    if (
      normalizeFilePathKey(getDirectoryPath(payload.path)) ===
      normalizeFilePathKey(targetRootDirectoryPath)
    ) {
      return false;
    }

    if (
      payload.entryType === "directory" &&
      isPathInsideDirectoryPath(targetRootDirectoryPath, payload.path)
    ) {
      return false;
    }

    return true;
  }

  function createSidebarDragPreview(payload: SidebarDragPayload | null) {
    return payload
      ? {
          entryType: payload.entryType,
          name: getFileNameFromPath(payload.path),
          path: payload.path,
        }
      : null;
  }

  function handleSidebarDirectoryDragOver(
    event: ReactDragEvent<HTMLElement>,
    targetDirectory: DirectoryTreeItem,
    target: SidebarStorageKind,
  ) {
    const payload = readSidebarDragPayload(event);

    if (!canDropSidebarEntryOnDirectory(payload, targetDirectory.path, target)) {
      setSidebarDropTarget(null);
      setSidebarDirectoryDropTargetPath(null);
      setSidebarDirectoryDragPreview(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = payload?.source === target ? "move" : "copy";
    setSidebarDropTarget(null);
    setSidebarDirectoryDropTargetPath(targetDirectory.path);
    expandSidebarDirectoryForDropPreview(targetDirectory.path, target);
    setSidebarDirectoryDragPreview(createSidebarDragPreview(payload));
  }

  function handleSidebarStorageDragOver(
    event: ReactDragEvent<HTMLElement>,
    target: SidebarStorageKind,
  ) {
    if (!event.dataTransfer.types.includes("application/x-notedock-sidebar-entry")) {
      return;
    }

    const payload = readSidebarDragPayload(event);
    const targetRootDirectoryPath = getSidebarStorageRootPath(target);

    if (
      !canDropSidebarEntryOnStorageRoot(
        payload,
        target,
        targetRootDirectoryPath,
      )
    ) {
      if (sidebarDropTarget === target) {
        setSidebarDropTarget(null);
      }
      setSidebarDirectoryDropTargetPath(null);
      setSidebarDirectoryDragPreview(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = payload?.source === target ? "move" : "copy";
    setSidebarDirectoryDropTargetPath(null);
    setSidebarDirectoryDragPreview(createSidebarDragPreview(payload));
    setSidebarDropTarget(target);
  }

  function handleSidebarStorageDragLeave(event: ReactDragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    clearSidebarDragState();
  }

  async function dropSidebarEntryToDirectory(
    event: ReactDragEvent<HTMLElement>,
    targetDirectoryPath: string,
    target: SidebarStorageKind,
  ) {
    const payload = readSidebarDragPayload(event);
    clearSidebarDragState();

    if (!canDropSidebarEntryOnDirectory(payload, targetDirectoryPath, target)) {
      return;
    }

    if (!payload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      if (payload.source === target) {
        if (!window.desktop?.moveEntryToDirectory) {
          throw new Error("当前环境不支持移动文件。");
        }

        const result = await window.desktop.moveEntryToDirectory({
          queueSync: target === "cloud",
          sourcePath: payload.path,
          targetDirectoryPath,
        });

        updateWorkspaceEntryPathReferences(
          payload.path,
          result.entryPath,
          payload.entryType,
        );
      } else {
        if (!window.desktop?.copyEntryToDirectory) {
          throw new Error("当前环境不支持复制文件。");
        }

        await window.desktop.copyEntryToDirectory({
          queueSync: target === "cloud",
          sourcePath: payload.path,
          targetDirectoryPath,
        });
      }

      if (target === "cloud" || payload.source === "cloud") {
        setExpandedCloudDirectoryPaths((current) => {
          const next = new Set(current);
          next.add(targetDirectoryPath);
          return next;
        });
        await refreshCloudSidebarWorkspaceFromCache();
      }

      if (target === "local" || payload.source === "local") {
        setExpandedDirectoryPaths((current) => {
          const next = new Set(current);
          next.add(targetDirectoryPath);
          return next;
        });
        await loadDirectoryTree(workspace.workspacePath || getDirectoryPath(targetDirectoryPath));
      }
    } catch (error) {
      showWorkspaceToast(
        error instanceof Error ? error.message : "移动文件失败。",
        "error",
      );
    }
  }

  async function dropSidebarEntryToStorage(
    event: ReactDragEvent<HTMLElement>,
    target: SidebarStorageKind,
  ) {
    const payload = readSidebarDragPayload(event);
    const targetRootDirectoryPath = getSidebarStorageRootPath(target);
    clearSidebarDragState();

    if (
      !canDropSidebarEntryOnStorageRoot(
        payload,
        target,
        targetRootDirectoryPath,
      )
    ) {
      return;
    }

    if (!payload) {
      return;
    }

    event.preventDefault();

    if (payload.source === target) {
      if (!targetRootDirectoryPath) {
        return;
      }

      try {
        if (!window.desktop?.moveEntryToDirectory) {
          throw new Error("当前环境不支持移动文件。");
        }

        const result = await window.desktop.moveEntryToDirectory({
          queueSync: target === "cloud",
          sourcePath: payload.path,
          targetDirectoryPath: targetRootDirectoryPath,
        });

        updateWorkspaceEntryPathReferences(
          payload.path,
          result.entryPath,
          payload.entryType,
        );

        if (target === "cloud") {
          await refreshCloudSidebarWorkspaceFromCache();
        } else {
          await loadDirectoryTree(targetRootDirectoryPath);
        }
      } catch (error) {
        showWorkspaceToast(
          error instanceof Error ? error.message : "移动文件失败。",
          "error",
        );
      }
      return;
    }

    if (target === "cloud") {
      if (
        !syncStatus.configuration.enabled ||
        !syncStatus.configuration.tokenConfigured
      ) {
        await showAppAlert({
          confirmLabel: "知道了",
          description: "需要先在设置中登录并启用云同步，然后才能导入云端文档。",
          title: "云同步尚未启用",
          tone: "info",
        });
        return;
      }

      await importLocalDirectoryToCloud(payload.path);
      return;
    }

    if (!workspace.workspacePath || isCloudWorkspace) {
      await showAppAlert({
        confirmLabel: "知道了",
        description: "需要先打开一个本地文件夹，才能把云端文档复制到本地。",
        title: "没有本地文件夹",
        tone: "info",
      });
      return;
    }

    try {
      const result = await window.desktop?.copyEntryToDirectory?.({
        sourcePath: payload.path,
        targetDirectoryPath: workspace.workspacePath,
        queueSync: false,
      });

      await loadDirectoryTree(workspace.workspacePath);

      if (result) {
        setSyncLoginMessageTone("success");
        setSyncLoginMessage(`已复制 ${result.copiedCount} 个文件到本地文件夹。`);
      }
    } catch (error) {
      setSyncLoginMessageTone("error");
      setSyncLoginMessage(
        error instanceof Error ? error.message : "复制云端文档失败。",
      );
    }
  }

  function toggleSelectAllCloudEntries() {
    setIsCloudMultiSelectEnabled(true);
    setSelectedCloudEntryPaths(() =>
      areAllCloudEntriesSelected
        ? new Set()
        : new Set(cloudSelectableEntryPaths),
    );
  }

  async function exportCloudEntriesToLocal(entryPaths?: string[]) {
    if (!window.desktop?.exportCloudEntries) {
      await showAppAlert({
        confirmLabel: "知道了",
        description: "当前运行环境不支持导出云端文档。",
        title: "无法导出",
        tone: "warning",
      });
      return;
    }

    setIsCloudExporting(true);

    try {
      const result = await window.desktop.exportCloudEntries({
        entryPaths:
          entryPaths && entryPaths.length > 0
            ? entryPaths
            : selectedCloudEntryPaths.size > 0
              ? Array.from(selectedCloudEntryPaths)
              : undefined,
      });

      if (!result) {
        return;
      }

      await refreshCloudSidebarWorkspaceFromCache();

      if (workspace.workspacePath && !isCloudWorkspace) {
        await loadDirectoryTree(workspace.workspacePath);
      }

      await showAppAlert({
        confirmLabel: "完成",
        description: `已导出 ${result.exportedCount} 个文件。`,
        detail: result.targetDirectoryPath,
        title: "云端文档已导出",
        tone: "info",
      });
    } catch (error) {
      await showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error ? error.message : "导出云端文档失败。",
        title: "导出失败",
        tone: "danger",
      });
    } finally {
      setIsCloudExporting(false);
    }
  }

  async function exportCloudEntryToLocal(entryPath: string) {
    await exportCloudEntriesToLocal([entryPath]);
  }

  async function openFileFromTree(filePath: string) {
    const existingDocument = findWorkspaceDocumentByFilePath(
      workspace.documents,
      filePath,
    );
    const shouldShowLoading = getDocumentTypeFromPath(filePath) !== "markdown";
    const isDiaryPath = isPathInsideDiaryRoot(filePath, workspace.workspacePath);

    if (!isDiaryPath && existingDocument && !isDiaryDocumentContent(existingDocument.content)) {
      setActiveDocument(existingDocument.id);
      setIsHomeOpen(false);
      return;
    }

    if (shouldShowLoading) {
      showDocumentLoading("正在打开文档", getFileNameFromPath(filePath));
    }

    try {
      const localFile = await window.desktop?.readMarkdownFile?.(filePath);

      if (!localFile) {
        return;
      }

      if (await openLocalFileAsDiaryIfNeeded(localFile)) {
        return;
      }

      const document = createDocumentFromLocalFile(localFile);
      revealRecentDocument(document);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) =>
        addOpenedDocumentToWorkspace(current, markDocumentOpened(document)),
      );
      rememberRecentDirectory(getDirectoryPath(document.filePath));
      setIsHomeOpen(false);
    } catch {
      setSaveState("failed");
    } finally {
      if (shouldShowLoading) {
        clearDocumentLoading();
      }
    }
  }

  async function duplicateDocumentFile(filePath: string) {
    if (!window.desktop?.duplicateDocumentFile) {
      await copyTextToClipboard(filePath);
      return;
    }

    try {
      const localFile = await window.desktop.duplicateDocumentFile(filePath);
      const document = createDocumentFromLocalFile(localFile);
      revealRecentDocument(document);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) =>
        addOpenedDocumentToWorkspace(current, markDocumentOpened(document)),
      );
      rememberRecentDirectory(getDirectoryPath(document.filePath));
      setIsHomeOpen(false);
      await loadDirectoryTree(getDirectoryPath(document.filePath));
    } catch {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "复制文件时发生错误，请确认文件仍然存在且当前目录可写。",
        detail: filePath,
        title: "复制失败",
        tone: "danger",
      });
    }
  }

  function showWorkspaceToast(
    message: string,
    tone: "error" | "success" = "success",
  ) {
    setWorkspaceToast({
      id: Date.now(),
      message,
      tone,
    });
  }

  function startRenamingEntry(
    entryPath: string,
    entryType: DirectoryTreeItem["type"],
  ) {
    const { editableName } = splitWorkspaceEntryNameForRename(
      getPathLabel(entryPath),
      entryType,
    );

    setRenamingEntryPath(entryPath);
    setRenamingEntryType(entryType);
    setRenameDraft(editableName);
  }

  function cancelRenamingEntry() {
    setRenamingEntryPath(null);
    setRenamingEntryType(null);
    setRenameDraft("");
    setPendingOpenAfterRenameEntryPath(null);
  }

  function updateWorkspaceEntryPathReferences(
    previousEntryPath: string,
    nextEntryPath: string,
    entryType: DirectoryTreeItem["type"],
  ) {
    if (nextEntryPath === previousEntryPath) {
      return;
    }

    setWorkspace((current) => ({
      ...current,
      documents: current.documents.map((document) => {
        if (!document.filePath) {
          return document;
        }

        const nextFilePath = replaceWorkspaceEntryPath(
          document.filePath,
          previousEntryPath,
          nextEntryPath,
        );

        if (nextFilePath === document.filePath) {
          return document;
        }

        return {
          ...document,
          filePath: nextFilePath,
          title:
            entryType === "file"
              ? getDocumentTitleFromFilePath(nextFilePath)
              : document.title,
        };
      }),
    }));

    for (const [savedPath, content] of [
      ...savedFileContentByPathRef.current.entries(),
    ]) {
      const nextSavedPath = replaceWorkspaceEntryPath(
        savedPath,
        previousEntryPath,
        nextEntryPath,
      );

      if (nextSavedPath !== savedPath) {
        savedFileContentByPathRef.current.delete(savedPath);
        savedFileContentByPathRef.current.set(nextSavedPath, content);
      }
    }

    setRecentDirectoryPaths((current) =>
      current.map((path) =>
        replaceWorkspaceEntryPath(path, previousEntryPath, nextEntryPath),
      ),
    );
  }

  async function commitRenamingEntry(entryPath = renamingEntryPath ?? "") {
    if (
      !entryPath ||
      !renamingEntryPath ||
      !renamingEntryType ||
      entryPath !== renamingEntryPath ||
      renameCommitInFlightRef.current
    ) {
      return;
    }

    const validationError = validateWorkspaceRenameBaseName(renameDraft);

    if (validationError) {
      cancelRenamingEntry();
      showWorkspaceToast(validationError, "error");
      return;
    }

    const { editableName } = splitWorkspaceEntryNameForRename(
      getPathLabel(renamingEntryPath),
      renamingEntryType,
    );
    const shouldOpenAfterRename =
      renamingEntryType === "file" &&
      Boolean(pendingOpenAfterRenameEntryPath) &&
      normalizeFilePathKey(pendingOpenAfterRenameEntryPath ?? "") ===
        normalizeFilePathKey(renamingEntryPath);

    if (renameDraft.trim() === editableName) {
      const filePathToOpen = shouldOpenAfterRename ? renamingEntryPath : null;
      cancelRenamingEntry();
      if (filePathToOpen) {
        await openFileFromTree(filePathToOpen);
      }
      return;
    }

    if (!window.desktop?.renameWorkspaceEntry) {
      cancelRenamingEntry();
      showWorkspaceToast("当前环境不支持重命名。", "error");
      return;
    }

    renameCommitInFlightRef.current = true;
    const previousEntryPath = renamingEntryPath;
    const previousEntryType = renamingEntryType;
    const isCloudEntry = isCloudSidebarEntryPath(previousEntryPath);

    try {
      const result = await window.desktop.renameWorkspaceEntry({
        entryPath: previousEntryPath,
        nextBaseName: renameDraft,
      });
      const nextEntryPath = result.entryPath;

      if (nextEntryPath !== previousEntryPath) {
        setWorkspace((current) => ({
          ...current,
          documents: current.documents.map((document) => {
            if (!document.filePath) {
              return document;
            }

            const nextFilePath = replaceWorkspaceEntryPath(
              document.filePath,
              previousEntryPath,
              nextEntryPath,
            );

            if (nextFilePath === document.filePath) {
              return document;
            }

            return {
              ...document,
              filePath: nextFilePath,
              title:
                previousEntryType === "file"
                  ? getDocumentTitleFromFilePath(nextFilePath)
                  : document.title,
            };
          }),
        }));

        for (const [savedPath, content] of [
          ...savedFileContentByPathRef.current.entries(),
        ]) {
          const nextSavedPath = replaceWorkspaceEntryPath(
            savedPath,
            previousEntryPath,
            nextEntryPath,
          );

          if (nextSavedPath !== savedPath) {
            savedFileContentByPathRef.current.delete(savedPath);
            savedFileContentByPathRef.current.set(nextSavedPath, content);
          }
        }

        setRecentDirectoryPaths((current) =>
          current.map((path) =>
            replaceWorkspaceEntryPath(path, previousEntryPath, nextEntryPath),
          ),
        );
      }

      cancelRenamingEntry();

      if (isCloudEntry) {
        await refreshCloudSidebarWorkspaceFromCache();
      } else {
        await loadDirectoryTree(getDirectoryPath(nextEntryPath));
      }

      if (shouldOpenAfterRename) {
        await openFileFromTree(nextEntryPath);
      }

      showWorkspaceToast("已重命名");
    } catch (error) {
      cancelRenamingEntry();
      showWorkspaceToast(
        error instanceof Error ? error.message : "重命名失败，已恢复原名称。",
        "error",
      );
    } finally {
      renameCommitInFlightRef.current = false;
    }
  }

  async function deleteWorkspaceEntry(
    entryPath: string,
    entryType: DirectoryTreeItem["type"] = "file",
  ) {
    const isCloudEntry = isCloudSidebarEntryPath(entryPath);
    const entryName = getPathLabel(entryPath);
    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除",
      description: isCloudEntry
        ? entryType === "directory"
          ? "文件夹会从云端文档中删除，此操作无法撤销。"
          : "文件会从云端文档中删除，此操作无法撤销。"
        : entryType === "directory"
          ? "文件夹会从磁盘中删除，此操作无法撤销。"
          : "文件会从磁盘中删除，此操作无法撤销。",
      detail: isCloudEntry ? entryName : entryPath,
      title: entryType === "directory" ? "删除这个文件夹？" : "删除这个文件？",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const entryKey = normalizeFilePathKey(entryPath).replace(/\/+$/, "");
    const isDeletedPath = (path: string) => {
      const pathKey = normalizeFilePathKey(path);

      return entryType === "directory"
        ? pathKey === entryKey || pathKey.startsWith(`${entryKey}/`)
        : pathKey === entryKey;
    };

    try {
      internalFileDeletesRef.current.add(entryKey);
      workspace.documents.forEach((document) => {
        if (document.filePath && isDeletedPath(document.filePath)) {
          internalFileDeletesRef.current.add(normalizeFilePathKey(document.filePath));
        }
      });

      if (window.desktop?.deleteWorkspaceEntry) {
        await window.desktop.deleteWorkspaceEntry(entryPath);
      } else if (entryType === "file") {
        await window.desktop?.deleteDocumentFile?.(entryPath);
      }

      for (const savedPath of savedFileContentByPathRef.current.keys()) {
        if (isDeletedPath(savedPath)) {
          savedFileContentByPathRef.current.delete(savedPath);
        }
      }

      for (const conflictKey of externalConflictPathsRef.current) {
        if (
          conflictKey === entryKey ||
          (entryType === "directory" && conflictKey.startsWith(`${entryKey}/`))
        ) {
          externalConflictPathsRef.current.delete(conflictKey);
        }
      }

      const activeDocumentDeleted = activeDocument?.filePath
        ? isDeletedPath(activeDocument.filePath)
        : false;

      setWorkspace((current) => {
        const documents = current.documents.filter(
          (document) =>
            !document.filePath || !isDeletedPath(document.filePath),
        );
        const activeDocumentStillExists = documents.some(
          (document) => document.id === current.activeDocumentId,
        );

        return {
          ...current,
          activeDocumentId: activeDocumentStillExists ? current.activeDocumentId : "",
          documents,
        };
      });

      if (isCloudEntry) {
        await refreshCloudSidebarWorkspaceFromCache();
      } else {
        await loadDirectoryTree(getDirectoryPath(entryPath));
      }

      if (activeDocumentDeleted) {
        setIsHomeOpen(true);
      }
    } catch {
      internalFileDeletesRef.current.delete(entryKey);
      void showAppAlert({
        confirmLabel: "知道了",
        description:
          entryType === "directory"
            ? "删除文件夹时发生错误，请确认文件夹仍然存在且当前目录可写。"
            : "删除文件时发生错误，请确认文件仍然存在且当前目录可写。",
        detail: isCloudEntry ? entryName : entryPath,
        title: "删除失败",
        tone: "danger",
      });
    }
  }

  async function deleteSelectedCloudEntries() {
    if (!window.desktop?.deleteWorkspaceEntry || selectedCloudEntryPaths.size === 0) {
      return;
    }

    const selectedEntries = Array.from(selectedCloudEntryPaths)
      .map((entryPath) => cloudSidebarEntryMap.get(normalizeFilePathKey(entryPath)))
      .filter((entry): entry is DirectoryTreeItem => Boolean(entry));
    const deleteEntries = getTopLevelWorkspaceEntries(selectedEntries);

    if (!deleteEntries.length) {
      setSelectedCloudEntryPaths(new Set());
      return;
    }

    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除",
      description: `将从云端文档中删除选中的 ${deleteEntries.length} 项。此操作无法撤销。`,
      title: "删除选中的云端文档？",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const isDeletedPath = (path: string) =>
      deleteEntries.some((entry) =>
        entry.type === "directory"
          ? isPathInsideDirectoryPath(path, entry.path)
          : normalizeFilePathKey(path) === normalizeFilePathKey(entry.path),
      );

    try {
      for (const entry of deleteEntries) {
        const entryKey = normalizeFilePathKey(entry.path).replace(/\/+$/, "");
        internalFileDeletesRef.current.add(entryKey);
      }

      workspace.documents.forEach((document) => {
        if (document.filePath && isDeletedPath(document.filePath)) {
          internalFileDeletesRef.current.add(normalizeFilePathKey(document.filePath));
        }
      });

      for (const entry of deleteEntries) {
        await window.desktop.deleteWorkspaceEntry(entry.path);
      }

      for (const savedPath of savedFileContentByPathRef.current.keys()) {
        if (isDeletedPath(savedPath)) {
          savedFileContentByPathRef.current.delete(savedPath);
        }
      }

      for (const conflictKey of externalConflictPathsRef.current) {
        if (deleteEntries.some((entry) => isPathInsideDirectoryPath(conflictKey, entry.path))) {
          externalConflictPathsRef.current.delete(conflictKey);
        }
      }

      const activeDocumentDeleted = activeDocument?.filePath
        ? isDeletedPath(activeDocument.filePath)
        : false;

      setWorkspace((current) => {
        const documents = current.documents.filter(
          (document) =>
            !document.filePath || !isDeletedPath(document.filePath),
        );
        const activeDocumentStillExists = documents.some(
          (document) => document.id === current.activeDocumentId,
        );

        return {
          ...current,
          activeDocumentId: activeDocumentStillExists ? current.activeDocumentId : "",
          documents,
        };
      });

      setSelectedCloudEntryPaths(new Set());
      setIsCloudMultiSelectEnabled(false);
      await refreshCloudSidebarWorkspaceFromCache();

      if (activeDocumentDeleted) {
        setIsHomeOpen(true);
      }
    } catch (error) {
      void showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error ? error.message : "删除云端文档时发生错误。",
        title: "删除失败",
        tone: "danger",
      });
    }
  }

  async function deleteDocumentFile(filePath: string) {
    await deleteWorkspaceEntry(filePath, "file");
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
    setWorkspace((current) => {
      const currentDocument =
        current.documents.find((item) => item.id === current.activeDocumentId) ?? null;

      if (!currentDocument || !isMarkdownDocument(currentDocument)) {
        return current;
      }

      const nextContent =
        mode === "typora"
          ? replaceMarkdownBodyPreservingFrontmatter(
              currentDocument.content,
              normalizeMarkdownHtmlBreaks(content),
            )
          : content;

      return updateDocument(current, {
        ...currentDocument,
        content: nextContent,
        title:
          currentDocument.filePath
            ? getDocumentTitleFromFilePath(currentDocument.filePath)
            : renameFromMarkdown(nextContent, currentDocument.title),
        updatedAt: now(),
      });
    });
  }

  function updateDocumentMetadata(
    documentId: string,
    updater: (metadata: DocumentMetadata) => DocumentMetadata,
  ) {
    setWorkspace((current) => {
      const document = current.documents.find((item) => item.id === documentId);

      if (!document) {
        return current;
      }

      return updateDocument(current, {
        ...document,
        metadata: normalizeDocumentMetadata(
          updater(normalizeDocumentMetadata(document.metadata)),
        ),
        updatedAt: now(),
      });
    });
  }

  function updateActiveDocumentMetadata(
    updater: (metadata: DocumentMetadata) => DocumentMetadata,
  ) {
    if (!activeDocument) {
      return;
    }

    updateDocumentMetadata(activeDocument.id, updater);
  }

  function addActiveDocumentTag() {
    if (!activeDocument) {
      return;
    }

    const tag = normalizeTagName(newTagName);

    if (!tag) {
      return;
    }

    updateActiveDocumentMetadata((metadata) => ({
      ...metadata,
      tags: [...metadata.tags, tag],
    }));
    setNewTagName("");
    setActiveMetadataSuggestion(null);
  }

  function removeActiveDocumentTag(tag: string) {
    if (!activeDocument) {
      return;
    }

    const normalizedTag = normalizeTagName(tag).toLocaleLowerCase();

    updateActiveDocumentMetadata((metadata) => ({
      ...metadata,
      tags: metadata.tags.filter(
        (item) => item.toLocaleLowerCase() !== normalizedTag,
      ),
    }));
  }

  function saveActiveDocumentProperty() {
    if (!activeDocument) {
      return;
    }

    const key = normalizePropertyKey(propertyKeyDraft);

    if (!key) {
      return;
    }

    const value = propertyValueDraft.trim();

    updateActiveDocumentMetadata((metadata) => {
      const nextProperties = metadata.properties.filter(
        (property) => property.key.toLocaleLowerCase() !== key.toLocaleLowerCase(),
      );

      if (value) {
        nextProperties.push({ key, value });
      }

      return {
        ...metadata,
        properties: nextProperties,
      };
    });
    setPropertyKeyDraft("");
    setPropertyValueDraft("");
    setActiveMetadataSuggestion(null);
  }

  function removeActiveDocumentProperty(key: string) {
    if (!activeDocument) {
      return;
    }

    const propertyKey = normalizePropertyKey(key).toLocaleLowerCase();

    updateActiveDocumentMetadata((metadata) => ({
      ...metadata,
      properties: metadata.properties.filter(
        (property) => property.key.toLocaleLowerCase() !== propertyKey,
      ),
    }));
  }

  function openRelationDocument(document: MarkdownDocument) {
    setActiveDocument(document.id);
    setIsHomeOpen(false);
    setSidebarTab("current");
  }

  function openKnowledgeDocument(document: MarkdownDocument) {
    setActiveDocument(document.id);
    setIsHomeOpen(false);
    setSidebarTab("current");
  }

  async function createMarkdownDocumentWithContent(title: string, content: string) {
    const directoryPath = await getCreationDirectory();
    const localFile =
      directoryPath && window.desktop?.createDocumentFile
        ? await window.desktop.createDocumentFile({
            content,
            directoryPath,
            extension: ".md",
            title,
          })
        : null;
    const document = localFile
      ? createDocumentFromLocalFile(localFile)
      : createDocument(title, content);

    activateCreatedDocument(document, directoryPath);

    if (directoryPath) {
      await loadDirectoryTree(directoryPath);
    }

    return document;
  }

  async function createDocumentFromMissingWikiLink(
    target: string,
    sourceDocument = activeDocument,
  ) {
    const title = normalizeMarkdownTitle(getWikiLinkTitle(target) || target);
    const content = createMarkdownNoteContent({
      body: sourceDocument ? `来自 [[${sourceDocument.title}]]` : "",
      properties: { created: new Date().toISOString() },
      title,
    });

    try {
      const document = await createMarkdownDocumentWithContent(title, content);
      setSidebarTab("current");
      return document;
    } catch {
      setSaveState("failed");
      return null;
    }
  }

  async function openWikiLinkTarget(target: string) {
    const document = workspaceKnowledge.documentByLinkKey.get(
      normalizeWikiLinkTarget(target),
    );

    if (document) {
      openKnowledgeDocument(document);
      return;
    }

    await createDocumentFromMissingWikiLink(target);
  }

  async function openDocumentReferenceTarget(target: string) {
    const trimmedTarget = target.trim();

    if (!trimmedTarget) {
      return;
    }

    const documentByPath = getDocumentByFilePath(trimmedTarget);

    if (documentByPath) {
      setActiveDocument(documentByPath.id);
      setSidebarTab("current");
      return;
    }

    const documentByLinkKey = workspaceKnowledge.documentByLinkKey.get(
      normalizeWikiLinkTarget(trimmedTarget),
    );

    if (documentByLinkKey) {
      setActiveDocument(documentByLinkKey.id);
      setSidebarTab("current");
      return;
    }

    await openWikiLinkTarget(trimmedTarget);
  }

  function openWikiLinkInsertForm() {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const selectedText = getSelectedEditorText().trim();
    setWikiLinkTargetDraft(selectedText);
    setIsDocumentInspectorOpen(true);
    window.requestAnimationFrame(() => wikiLinkInputRef.current?.focus());
  }

  function insertWikiLinkFromDraft() {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const target = wikiLinkTargetDraft.trim();

    if (!target) {
      return;
    }

    insertDocumentReference(target);
    setWikiLinkTargetDraft("");
  }

  function getDocumentByFilePath(filePath?: string) {
    const fileKey = normalizeFilePathKey(filePath);

    if (!fileKey) {
      return undefined;
    }

    return workspace.documents.find(
      (document) => normalizeFilePathKey(document.filePath) === fileKey,
    );
  }

  function resolveDocumentLinkReference(reference: DocumentLinkReference) {
    return getDocumentByFilePath(reference.filePath);
  }

  function createDocumentLinkReference(
    document: MarkdownDocument,
  ): DocumentLinkReference | null {
    if (!document.filePath) {
      return null;
    }

    return {
      createdAt: now(),
      documentType: getDocumentType(document),
      filePath: document.filePath,
      title: getDocumentDisplayName(document),
    };
  }

  function addDocumentLinkToDocument(
    sourceDocument: MarkdownDocument | null | undefined,
    reference: DocumentLinkReference,
  ) {
    if (!sourceDocument) {
      void showAppAlert({
        confirmLabel: "知道了",
        description:
          "需要先打开或右键选择一个文档，再把目录中的文件添加为相关文档。",
        title: "没有可编辑的文档",
        tone: "info",
      });
      return;
    }

    if (
      normalizeFilePathKey(sourceDocument.filePath) ===
      normalizeFilePathKey(reference.filePath)
    ) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "当前文档不需要关联到自己，可以选择目录中的其他文档。",
        title: "已是当前文档",
        tone: "info",
      });
      return;
    }

    const metadata = normalizeDocumentMetadata(sourceDocument.metadata);
    const referenceKey = normalizeFilePathKey(reference.filePath);
    const isLinked = metadata.documentLinks.some(
      (link) => normalizeFilePathKey(link.filePath) === referenceKey,
    );

    if (isLinked) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "这个文件已经在该文档的相关文档里。",
        title: "已经添加过",
        tone: "info",
      });
      return;
    }

    updateDocumentMetadata(sourceDocument.id, (currentMetadata) => ({
      ...currentMetadata,
      documentLinks: [...currentMetadata.documentLinks, reference],
    }));
  }

  function addPickerDocumentLink(reference: DocumentLinkReference) {
    addDocumentLinkToDocument(documentLinkPickerSourceDocument, reference);
  }

  function removeDocumentLinkFromDocument(documentId: string, filePath: string) {
    const targetKey = normalizeFilePathKey(filePath);

    updateDocumentMetadata(documentId, (metadata) => ({
      ...metadata,
      documentLinks: metadata.documentLinks.filter(
        (link) => normalizeFilePathKey(link.filePath) !== targetKey,
      ),
    }));
  }

  function removeActiveDocumentLink(filePath: string) {
    if (!activeDocument) {
      return;
    }

    const targetKey = normalizeFilePathKey(filePath);

    removeDocumentLinkFromDocument(activeDocument.id, targetKey);
  }

  function openDocumentLinkPicker(
    sourceDocument?: MarkdownDocument | null,
    mode: DocumentLinkPickerMode = "metadata",
  ) {
    const pickerSource = sourceDocument ?? activeDocument ?? null;

    if (!pickerSource) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "需要先打开或右键选择一个文档，再选择要添加为相关文档的文件。",
        title: "没有可编辑的文档",
        tone: "info",
      });
      return;
    }

    if (mode === "insertReference") {
      typoraEditorRef.current?.rememberDocumentReferenceInsertionPoint();
    } else {
      typoraEditorRef.current?.clearDocumentReferenceInsertionPoint();
    }

    setDocumentLinkPickerMode(mode);
    setDocumentLinkSourceDocumentId(pickerSource.id);
    setDocumentLinkQuery("");
    if (mode === "metadata" && pickerSource.id === activeDocument?.id) {
      setIsDocumentInspectorOpen(true);
    }
    setIsDocumentLinkPickerOpen(true);
  }

  function closeDocumentLinkPicker() {
    setIsDocumentLinkPickerOpen(false);
    setDocumentLinkSourceDocumentId(null);
    setDocumentLinkQuery("");
    setDocumentLinkPickerMode("metadata");
    typoraEditorRef.current?.clearDocumentReferenceInsertionPoint();
  }

  function openDocumentReferencePicker() {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "需要先打开一个 Markdown 文档，才能在正文中插入引用文档。",
        title: "没有可插入的位置",
        tone: "info",
      });
      return;
    }

    openDocumentLinkPicker(activeDocument, "insertReference");
  }

  function insertDocumentReferenceFromDocument(document: MarkdownDocument) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const referenceText = getDocumentDisplayName(document).trim();
    const referenceTarget = document.filePath?.trim() || referenceText;

    if (!referenceText || !referenceTarget) {
      return;
    }

    insertDocumentReference(referenceTarget, referenceText);
    setIsDocumentLinkPickerOpen(false);
    setDocumentLinkSourceDocumentId(null);
    setDocumentLinkQuery("");
    setDocumentLinkPickerMode("metadata");
  }

  async function openRelatedDocument(reference: DocumentLinkReference) {
    const document = resolveDocumentLinkReference(reference);

    if (document) {
      openKnowledgeDocument(document);
      return;
    }

    if (reference.filePath) {
      await openFileFromTree(reference.filePath);
    }
  }

  function openInspirationNote() {
    setIsDiaryOpen(false);
    setIsHomeOpen(true);
    setHomeNoteDialogRequestId((requestId) => requestId + 1);
    setTopMenu(null);
    setIsActionsOpen(false);
  }

  async function saveDataUrlAssetForDocument(
    document: MarkdownDocument,
    fileName: string,
    dataUrl: string,
  ) {
    if (!document.filePath || !window.desktop?.saveAsset) {
      return dataUrl;
    }

    const savedAsset = await window.desktop.saveAsset({
      content: dataUrl,
      documentFilePath: document.filePath,
      encoding: "dataUrl",
      fileName: createAssetFileName(fileName, "asset"),
    });

    return savedAsset.reference;
  }

  async function saveTextAssetForDocument(
    document: MarkdownDocument,
    fileName: string,
    content: string,
    existingReference?: string,
  ) {
    if (!document.filePath || !window.desktop?.saveAsset) {
      return null;
    }

    if (existingReference && window.desktop.writeTextAsset) {
      const savedAsset = await window.desktop.writeTextAsset({
        content,
        documentFilePath: document.filePath,
        reference: existingReference,
      });

      return savedAsset.reference;
    }

    const savedAsset = await window.desktop.saveAsset({
      content,
      documentFilePath: document.filePath,
      encoding: "utf-8",
      fileName: createAssetFileName(fileName, "asset.json"),
    });

    return savedAsset.reference;
  }

  function openNewWindow() {
    void window.desktop?.newWindow?.();
  }

  async function openRecentDocument(document: MarkdownDocument) {
    if (!document.filePath) {
      setActiveDocument(document.id);
      return;
    }

    showDocumentLoading("正在打开文档", getDocumentDisplayName(document));

    try {
      const exists = window.desktop?.pathExists
      ? await window.desktop.pathExists(document.filePath)
      : true;

    setRecentFileAvailability((current) => ({
      ...current,
      [document.filePath!]: exists,
    }));

    if (!exists) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "这个最近文件已经不在原来的位置。",
        detail: document.filePath,
        title: "文件不存在",
        tone: "warning",
      });
      return;
    }

    const cachedDocument = findWorkspaceDocumentByFilePath(
      workspace.documents,
      document.filePath,
    );

    if (cachedDocument) {
      const cachedLocalFile = createLocalFileFromDocument(cachedDocument);

      if (cachedLocalFile && (await openLocalFileAsDiaryIfNeeded(cachedLocalFile))) {
        return;
      }

      setActiveDocument(cachedDocument.id);
      rememberRecentDirectory(getDirectoryPath(cachedDocument.filePath));
      setIsHomeOpen(false);
      return;
    }

    try {
      const localFile = await window.desktop?.readMarkdownFile?.(document.filePath);

      if (!localFile) {
        setActiveDocument(document.id);
        return;
      }

      if (await openLocalFileAsDiaryIfNeeded(localFile)) {
        return;
      }

      const nextDocument = createDocumentFromLocalFile(localFile);

      savedFileContentByPathRef.current.set(nextDocument.filePath!, nextDocument.content);
      rememberRecentDirectory(getDirectoryPath(nextDocument.filePath));
      setWorkspace((current) =>
        addOpenedDocumentToWorkspace(
          current,
          markDocumentOpened(nextDocument),
          document.id,
        ),
      );
      setIsHomeOpen(false);
    } catch {
      setRecentFileAvailability((current) => ({
        ...current,
        [document.filePath!]: false,
      }));
      void showAppAlert({
        confirmLabel: "知道了",
        description: "读取这个最近文件时发生错误，可以从文件菜单重新打开。",
        detail: document.filePath,
        title: "无法打开最近文件",
        tone: "danger",
      });
    }
    } finally {
      clearDocumentLoading();
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

    setWorkspace((current) =>
      addOpenedDocumentToWorkspace(
        current,
        markDocumentOpened(nextDocument),
        document.id,
      ),
    );
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

  async function openDrawingEditor(drawingId: string) {
    const document = activeDocument;

    if (!document || !isMarkdownDocument(document)) {
      return;
    }

    if (!document.drawings[drawingId]) {
      const image = findExcalidrawMarkdownImage(document.content, drawingId);

      if (!image?.sceneReference || !document.filePath || !window.desktop?.readTextAsset) {
        return;
      }

      try {
        const sceneJSON = await window.desktop.readTextAsset({
          documentFilePath: document.filePath,
          reference: image.sceneReference,
        });
        patchActiveDocument({
          drawings: {
            ...document.drawings,
            [drawingId]: {
              id: drawingId,
              name: image.alt || "Excalidraw",
              dataUrl: image.src,
              sceneJSON,
              createdAt: now(),
            },
          },
        });
      } catch {
        return;
      }
    }

    setEditingDrawingId(drawingId);
    setIsDrawingOpen(true);
  }

  function rememberInternalFileWrite(filePath: string, content: string) {
    trackInternalFileWrite(internalFileWritesRef.current, filePath, content);
  }

  function isMatchingInternalFileWrite(filePath: string, content: string) {
    return matchesInternalFileWrite(
      internalFileWritesRef.current,
      filePath,
      content,
    );
  }

  function acknowledgeSavedFileContent(filePath: string, content: string) {
    acknowledgeFileContent({
      content,
      documents: workspace.documents,
      externalConflictPaths: externalConflictPathsRef.current,
      filePath,
      savedFileContentByPath: savedFileContentByPathRef.current,
    });
  }

  function openContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    items: AppContextMenuItem[],
    width = 236,
  ) {
    event.preventDefault();
    event.stopPropagation();
    openContextMenuAt(event.clientX, event.clientY, items, width);
  }

  function openContextMenuAt(
    clientX: number,
    clientY: number,
    items: AppContextMenuItem[],
    width = 236,
  ) {
    const visibleRows = items.filter((item) => item.type !== "separator").length;
    const separators = items.length - visibleRows;
    const estimatedHeight = Math.min(
      Math.max(160, window.innerHeight - 16),
      visibleRows * 36 + separators * 11 + 12,
    );
    const x = clamp(clientX, 8, Math.max(8, window.innerWidth - width - 8));
    const y = clamp(
      clientY,
      8,
      Math.max(8, window.innerHeight - estimatedHeight - 8),
    );

    setTopMenu(null);
    setIsActionsOpen(false);
    setContextMenu({ items, width, x, y });
  }

  function runContextMenuItem(item: AppContextMenuItem) {
    if (
      item.type === "separator" ||
      item.type === "label" ||
      item.type === "iconGroup"
    ) {
      return;
    }

    if (item.disabled) {
      return;
    }

    setContextMenu(null);
    void item.onSelect();
  }

  function runContextMenuIconAction(
    action: Extract<AppContextMenuItem, { type: "iconGroup" }>["actions"][number],
  ) {
    setContextMenu(null);
    void action.onSelect();
  }

  async function copyTextToClipboard(text: string) {
    if (!text) {
      return;
    }

    await navigator.clipboard?.writeText(text);
  }

  function getLocalFilePathFromPreviewUrl(source?: string) {
    if (!source) {
      return undefined;
    }

    try {
      const url = new URL(source);

      if (url.protocol === "file:") {
        return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, "$1");
      }

      if (url.protocol === "typora-local:" && url.hostname === "file") {
        const pathname = decodeURIComponent(url.pathname);

        if (pathname.startsWith("//")) {
          return pathname.slice(1);
        }

        return pathname.replace(/^\/([A-Za-z]:)/, "$1");
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  function getLocalMediaFilePath(source?: string, documentFilePath?: string) {
    const localPath = getLocalFilePathFromPreviewUrl(source);

    if (localPath) {
      return localPath;
    }

    if (
      !source ||
      !documentFilePath ||
      !isRelativeResourceUrl(source)
    ) {
      return undefined;
    }

    return getLocalFilePathFromPreviewUrl(
      resolveDocumentResourceUrl(source, documentFilePath),
    );
  }

  function getMediaSourceFromElement(
    element?: HTMLImageElement | HTMLVideoElement | null,
  ) {
    if (!element) {
      return undefined;
    }

    if (element instanceof HTMLVideoElement) {
      return (
        element.currentSrc ||
        element.getAttribute("src") ||
        element.querySelector("source")?.getAttribute("src") ||
        undefined
      );
    }

    return element.currentSrc || element.getAttribute("src") || undefined;
  }

  function getImageAltFromElement(element?: HTMLImageElement | null) {
    return (
      element?.alt?.trim() ||
      element?.getAttribute("aria-label")?.trim() ||
      "图片"
    );
  }

  function openDocumentImagePreview(image: { alt?: string; src?: string }) {
    const src = image.src?.trim();

    if (!src) {
      return;
    }

    setDocumentImagePreview({
      alt: image.alt?.trim() || "图片",
      src,
    });
  }

  function closeDocumentImagePreview() {
    setDocumentImagePreview(null);
  }

  async function copyMediaResourceToClipboard(
    contextInfo: Pick<EditorContextMenuInfo, "mediaKind" | "mediaSource">,
    documentFilePath?: string,
  ) {
    const source = contextInfo.mediaSource;

    if (!source) {
      return false;
    }

    const localPath = getLocalMediaFilePath(source, documentFilePath);

    if (
      contextInfo.mediaKind === "image" &&
      localPath &&
      window.desktop?.writeImageFileToClipboard
    ) {
      const copied = await window.desktop.writeImageFileToClipboard(localPath);

      if (copied) {
        return true;
      }
    }

    if (contextInfo.mediaKind === "image" && navigator.clipboard?.write) {
      try {
        const response = await fetch(source);
        const blob = await response.blob();
        const mimeType = blob.type || "image/png";

        await navigator.clipboard.write([
          new ClipboardItem({
            [mimeType]: blob,
          }),
        ]);
        return true;
      } catch {
        // Fall back to copying the resource path below.
      }
    }

    await copyTextToClipboard(localPath ?? source);
    return false;
  }

  async function showMediaResourceInFolder(
    source?: string,
    documentFilePath?: string,
  ) {
    const localPath = getLocalMediaFilePath(source, documentFilePath);

    if (!localPath) {
      return false;
    }

    await window.desktop?.showInFolder?.(localPath);
    return true;
  }

  async function copyTyporaImageToClipboard(image: TyporaClipboardImage) {
    return copyMediaResourceToClipboard(
      {
        mediaKind: "image",
        mediaSource: image.source,
      },
      activeDocument?.filePath,
    );
  }

  async function copyDiaryTyporaImageToClipboard(image: TyporaClipboardImage) {
    return copyMediaResourceToClipboard(
      {
        mediaKind: "image",
        mediaSource: image.source,
      },
      diaryDocument?.filePath,
    );
  }

  function getEventTargetElement(target: EventTarget | null) {
    if (target instanceof Element) {
      return target;
    }

    if (target instanceof Node) {
      return target.parentElement;
    }

    return null;
  }

  function getDomSelectionTextWithin(container: Element | null) {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return "";
    }

    if (!container) {
      return selection.toString();
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    const anchorElement =
      selection.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (selection.anchorNode as Element)
        : selection.anchorNode?.parentElement;
    const focusElement =
      selection.focusNode?.nodeType === Node.ELEMENT_NODE
        ? (selection.focusNode as Element)
        : selection.focusNode?.parentElement;

    if (
      (commonAncestor && container.contains(commonAncestor)) ||
      (anchorElement && container.contains(anchorElement)) ||
      (focusElement && container.contains(focusElement))
    ) {
      return selection.toString();
    }

    return "";
  }

  function getEditorSelectionText(target: Element | null, isTextareaContext: boolean) {
    if (isTextareaContext) {
      const textarea = target?.closest<HTMLTextAreaElement>("textarea.markdown-input");

      if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
        return "";
      }

      return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    }

    return getDomSelectionTextWithin(
      target?.closest(".ProseMirror, .markdown-preview") ?? null,
    );
  }

  async function hasClipboardContentForPaste() {
    try {
      const nativeClipboardHasContent =
        await window.desktop?.hasClipboardContent?.();

      if (typeof nativeClipboardHasContent === "boolean") {
        return nativeClipboardHasContent;
      }
    } catch {
      // Browser clipboard is the fallback when the desktop bridge is unavailable.
    }

    try {
      return Boolean(await navigator.clipboard?.readText?.());
    } catch {
      return false;
    }
  }

  function getTextareaContextMenuInfo(): Partial<EditorContextMenuInfo> {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return {};
    }

    return getSourceTextareaContextMenuInfo({
      content: editor.value,
      selectionEnd: editor.selectionEnd,
      selectionStart: editor.selectionStart,
    });
  }

  function getImageContextMenuAlignment(
    imageElement: HTMLImageElement | null | undefined,
  ): ImageAlignment | undefined {
    if (!imageElement) {
      return undefined;
    }

    const dataAlign = imageElement.dataset.imageAlign;

    if (
      dataAlign === "left" ||
      dataAlign === "center" ||
      dataAlign === "right"
    ) {
      return dataAlign;
    }

    const style = imageElement.style;
    const display = style.display.trim().toLowerCase();
    const marginLeft = style.marginLeft.trim().toLowerCase();
    const marginRight = style.marginRight.trim().toLowerCase();
    const float = style.cssFloat.trim().toLowerCase();

    if (float === "right") {
      return "right";
    }

    if (float === "left") {
      return "left";
    }

    if (display === "block") {
      if (marginLeft === "auto" && marginRight === "auto") {
        return "center";
      }

      if (
        marginLeft === "auto" &&
        (marginRight === "" || marginRight === "0" || marginRight === "0px")
      ) {
        return "right";
      }
    }

    return "left";
  }

  function getImageContextMenuFit(
    imageElement: HTMLImageElement | null | undefined,
  ): ImageFitMode | undefined {
    if (!imageElement) {
      return undefined;
    }

    const inferImageFit = () => {
      return getDefaultImageFitMode(
        imageElement.naturalWidth || imageElement.clientWidth,
        imageElement.naturalHeight || imageElement.clientHeight,
      );
    };
    const dataFit = imageElement.dataset.imageFit;

    if (dataFit === "contain" || dataFit === "cover" || dataFit === "compact") {
      return dataFit;
    }

    if (dataFit === "auto") {
      return inferImageFit();
    }

    const imageFrame = imageElement.closest<HTMLElement>(".markdown-image-frame");

    if (imageFrame?.classList.contains("markdown-image-fit-contain")) {
      return "contain";
    }

    if (imageFrame?.classList.contains("markdown-image-fit-cover")) {
      return "cover";
    }

    if (imageFrame?.classList.contains("markdown-image-fit-compact")) {
      return "compact";
    }

    const objectFit = imageElement.style.objectFit.trim().toLowerCase();

    if (objectFit === "contain" || objectFit === "cover") {
      return objectFit;
    }

    return inferImageFit();
  }

  async function getEditorContextMenuInfo(
    event: ReactMouseEvent<HTMLElement>,
  ): Promise<EditorContextMenuInfo> {
    const target = getEventTargetElement(event.target);
    const isTextareaContext = Boolean(target?.closest("textarea.markdown-input"));
    const isPreviewContext = Boolean(target?.closest(".markdown-preview"));
    const taskElement = target?.closest(
      'li[data-item-type="task"], li.task-list-item, li.markdown-task-list-item',
    );
    const listElement = target?.closest("li");
    const linkElement = target?.closest<HTMLAnchorElement>("a[href]");
    const taskCheckedAttribute =
      taskElement?.getAttribute("data-checked") ??
      taskElement?.getAttribute("data-task-checked");
    const imageElement = target?.closest<HTMLImageElement>(
      "img.typora-editable-image, .typora-raw-html-preview img, .markdown-preview img",
    );
    const videoElement = target?.closest<HTMLVideoElement>(
      ".typora-raw-html-preview video, .markdown-preview video, video.markdown-video-player",
    );
    const documentReferenceElement = target?.closest<HTMLElement>(
      ".typora-document-reference-node",
    );
    const documentReference =
      documentReferenceElement?.dataset.target ||
      documentReferenceElement?.dataset.display
        ? {
            display:
              documentReferenceElement?.dataset.display ||
              documentReferenceElement?.dataset.target ||
              "Untitled document",
            raw:
              documentReferenceElement?.dataset.raw ||
              `[[${documentReferenceElement?.dataset.target || documentReferenceElement?.dataset.display || ""}]]`,
            target:
              documentReferenceElement?.dataset.target ||
              documentReferenceElement?.dataset.display ||
              "",
          }
        : undefined;
    const mediaKind = imageElement ? "image" : videoElement ? "video" : undefined;
    const mediaSource = getMediaSourceFromElement(imageElement ?? videoElement);
    const mediaAlt = imageElement ? getImageAltFromElement(imageElement) : undefined;
    const domTaskChecked =
      taskCheckedAttribute === "true"
        ? true
        : taskCheckedAttribute === "false"
          ? false
          : undefined;
    const textareaInfo = isTextareaContext ? getTextareaContextMenuInfo() : {};
    const selectedText = getEditorSelectionText(target, isTextareaContext);
    const isEditable = !isPreviewContext && (mode === "typora" || isTextareaContext);

    return {
      canPaste: isEditable ? await hasClipboardContentForPaste() : false,
      documentReference,
      hasSelection: selectedText.length > 0,
      imageAlign: getImageContextMenuAlignment(imageElement),
      imageFit: getImageContextMenuFit(imageElement),
      isDocumentReference: Boolean(documentReferenceElement),
      isImage: Boolean(imageElement),
      isEditable,
      isListItem: Boolean(listElement) || Boolean(textareaInfo.isListItem),
      isTaskListItem:
        Boolean(taskElement) || Boolean(textareaInfo.isTaskListItem),
      isVideo: Boolean(videoElement),
      linkHref: linkElement?.href || textareaInfo.linkHref,
      mediaAlt,
      mediaKind,
      mediaSource,
      taskChecked: domTaskChecked ?? textareaInfo.taskChecked,
    };
  }

  function compactContextMenuItems(items: AppContextMenuItem[]) {
    const compacted: AppContextMenuItem[] = [];

    for (const item of items) {
      if (
        item.type === "separator" &&
        (compacted.length === 0 ||
          compacted[compacted.length - 1]?.type === "separator")
      ) {
        continue;
      }

      compacted.push(item);
    }

    while (compacted.at(-1)?.type === "separator") {
      compacted.pop();
    }

    return compacted;
  }

  async function openEditorContextMenu(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const { clientX, clientY } = event;
    const contextInfo = await getEditorContextMenuInfo(event);
    const mediaLocalPath = getLocalMediaFilePath(
      contextInfo.mediaSource,
      activeDocument.filePath,
    );

    if (contextInfo.documentReference) {
      const reference = contextInfo.documentReference;
      const items: AppContextMenuItem[] = [
        {
          icon: <ExternalLink size={15} />,
          label: "打开引用文档",
          onSelect: () => void openDocumentReferenceTarget(reference.target),
        },
        {
          icon: <Copy size={15} />,
          label: "复制引用",
          onSelect: () => copyTextToClipboard(reference.raw),
        },
        {
          icon: <Copy size={15} />,
          label: "复制文档名称",
          onSelect: () => copyTextToClipboard(reference.display),
        },
        ...(contextInfo.isEditable
          ? [
              { type: "separator" as const },
              {
                danger: true,
                icon: <Trash2 size={15} />,
                label: "删除引用",
                onSelect: () =>
                  typoraEditorRef.current?.deleteContextDocumentReference(),
                shortcut: "Delete",
              },
            ]
          : []),
      ];

      openContextMenuAt(
        clientX,
        clientY,
        compactContextMenuItems(items),
        250,
      );
      return;
    }

    const canEditSelection = contextInfo.isEditable && contextInfo.hasSelection;
    const canDeleteTarget =
      contextInfo.isEditable && (contextInfo.hasSelection || contextInfo.isImage);
    const items: AppContextMenuItem[] = [
      ...(contextInfo.linkHref
        ? [
            {
              icon: <ExternalLink size={15} />,
              label: "打开链接",
              onSelect: () =>
                window.open(
                  contextInfo.linkHref,
                  "_blank",
                  "noopener,noreferrer",
                ),
            },
            {
              icon: <Copy size={15} />,
              label: "复制链接",
              onSelect: () => copyTextToClipboard(contextInfo.linkHref ?? ""),
            },
            ...(contextInfo.isEditable
              ? [
                  {
                    icon: <X size={15} />,
                    label: "移除链接",
                    onSelect: () => runFormatCommand({ type: "removeLink" }),
                  },
                ]
              : []),
            { type: "separator" as const },
          ]
        : []),
      ...(contextInfo.mediaKind
        ? [
            ...(contextInfo.mediaKind === "image"
              ? [
                  {
                    disabled: !contextInfo.mediaSource,
                    icon: <Maximize2 size={15} />,
                    label: "全屏浏览",
                    onSelect: () =>
                      openDocumentImagePreview({
                        alt: contextInfo.mediaAlt,
                        src: contextInfo.mediaSource,
                      }),
                  },
                ]
              : []),
            {
              icon: <Copy size={15} />,
              label:
                contextInfo.mediaKind === "image"
                  ? "复制图片"
                  : "复制视频地址",
              onSelect: () =>
                copyMediaResourceToClipboard(contextInfo, activeDocument.filePath),
            },
            {
              disabled: !mediaLocalPath || !window.desktop?.showInFolder,
              icon: <ExternalLink size={15} />,
              label: "在文件夹中显示",
              onSelect: () =>
                showMediaResourceInFolder(
                  contextInfo.mediaSource,
                  activeDocument.filePath,
                ),
            },
            { type: "separator" as const },
          ]
        : []),
      ...(contextInfo.isEditable && contextInfo.isImage
        ? [
            {
              actions: [
                {
                  active: contextInfo.imageAlign === "left",
                  icon: <AlignLeft size={16} />,
                  label: "靠左",
                  onSelect: () =>
                    runFormatCommand({ type: "imageAlign", align: "left" }),
                },
                {
                  active: contextInfo.imageAlign === "center",
                  icon: <AlignCenter size={16} />,
                  label: "居中",
                  onSelect: () =>
                    runFormatCommand({ type: "imageAlign", align: "center" }),
                },
                {
                  active: contextInfo.imageAlign === "right",
                  icon: <AlignRight size={16} />,
                  label: "靠右",
                  onSelect: () =>
                    runFormatCommand({ type: "imageAlign", align: "right" }),
                },
              ],
              label: "布局",
              type: "iconGroup" as const,
            },
            {
              actions: [
                {
                  active: contextInfo.imageFit === "contain",
                  icon: <Square size={16} />,
                  label: "等比",
                  onSelect: () =>
                    runFormatCommand({ fit: "contain", type: "imageFit" }),
                },
                {
                  active: contextInfo.imageFit === "cover",
                  icon: <Rows3 size={16} />,
                  label: "裁剪",
                  onSelect: () =>
                    runFormatCommand({ fit: "cover", type: "imageFit" }),
                },
              ],
              label: "显示",
              type: "iconGroup" as const,
            },
            { type: "separator" as const },
          ]
        : []),
      ...(canEditSelection
        ? [
            {
              icon: <Scissors size={15} />,
              label: "剪切",
              onSelect: () => runEditCommand("cut"),
              shortcut: "Ctrl+X",
            },
          ]
        : []),
      ...(contextInfo.hasSelection
        ? [
            {
              icon: <Copy size={15} />,
              label: "复制",
              onSelect: () => runEditCommand("copy"),
              shortcut: "Ctrl+C",
            },
          ]
        : []),
      ...(contextInfo.isEditable
        ? [
            ...(contextInfo.canPaste
              ? [
                  {
                    icon: <ClipboardPaste size={15} />,
                    label: "粘贴",
                    onSelect: () => runEditCommand("paste"),
                    shortcut: "Ctrl+V",
                  },
                ]
              : []),
            {
              icon: <BookOpenText size={15} />,
              label: "插入引用文档...",
              onSelect: openDocumentReferencePicker,
              shortcut: quickDocumentLinkShortcut,
            },
          ]
        : []),
      { type: "separator" },
      ...(contextInfo.isEditable && contextInfo.isTaskListItem
        ? [
            {
              icon: <ListTree size={15} />,
              label: "切换任务状态",
              onSelect: () =>
                runParagraphCommand({ type: "taskStatus", status: "toggle" }),
            },
            {
              disabled: contextInfo.taskChecked === true,
              icon: <Check size={15} />,
              label: "标记已完成",
              onSelect: () =>
                runParagraphCommand({
                  type: "taskStatus",
                  status: "completed",
                }),
            },
            {
              disabled: contextInfo.taskChecked === false,
              icon: <Square size={15} />,
              label: "标记为未完成",
              onSelect: () =>
                runParagraphCommand({
                  type: "taskStatus",
                  status: "incomplete",
                }),
            },
            { type: "separator" as const },
          ]
        : []),
      ...(contextInfo.isEditable && contextInfo.isListItem
        ? [
            {
              icon: <ChevronRight size={15} />,
              label: "增加列表缩进",
              onSelect: () => runParagraphCommand({ type: "indentList" }),
              shortcut: "Tab",
            },
            {
              icon: <ChevronLeft size={15} />,
              label: "减少列表缩进",
              onSelect: () => runParagraphCommand({ type: "outdentList" }),
              shortcut: "Shift+Tab",
            },
            { type: "separator" as const },
          ]
        : []),
      ...(canEditSelection
        ? [
            {
              icon: <Bold size={15} />,
              label: "加粗",
              onSelect: () => runFormatCommand({ type: "bold" }),
              shortcut: "Ctrl+B",
            },
            {
              icon: <Italic size={15} />,
              label: "斜体",
              onSelect: () => runFormatCommand({ type: "italic" }),
              shortcut: "Ctrl+I",
            },
            {
              icon: <Code2 size={15} />,
              label: "行内代码",
              onSelect: () => runFormatCommand({ type: "inlineCode" }),
              shortcut: "Ctrl+Shift+`",
            },
            { type: "separator" as const },
          ]
        : []),
      ...(canDeleteTarget
        ? [
            {
              danger: true,
              icon: <Trash2 size={15} />,
              label: "删除",
              onSelect: () => runEditCommand("delete"),
              shortcut: "Delete",
            },
          ]
        : []),
    ];

    openContextMenuAt(
      clientX,
      clientY,
      compactContextMenuItems(items),
      contextInfo.linkHref || contextInfo.isTaskListItem ? 272 : 246,
    );
  }

  async function openDiaryEditorMediaContextMenu(
    event: ReactMouseEvent<HTMLElement>,
  ) {
    const target = getEventTargetElement(event.target);
    const hasMediaTarget = Boolean(
      target?.closest(
        "img.typora-editable-image, .typora-raw-html-preview img, .markdown-preview img, .typora-raw-html-preview video, .markdown-preview video, video.markdown-video-player",
      ),
    );

    if (!hasMediaTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!diaryDocument?.filePath || !isMarkdownDocument(diaryDocument)) {
      return;
    }

    const { clientX, clientY } = event;
    const contextInfo = await getEditorContextMenuInfo(event);

    if (!contextInfo.mediaKind) {
      setContextMenu(null);
      return;
    }

    const mediaLocalPath = getLocalMediaFilePath(
      contextInfo.mediaSource,
      diaryDocument.filePath,
    );
    const items: AppContextMenuItem[] = [
      ...(contextInfo.mediaKind === "image"
        ? [
            {
              disabled: !contextInfo.mediaSource,
              icon: <Maximize2 size={15} />,
              label: "全屏浏览",
              onSelect: () =>
                openDocumentImagePreview({
                  alt: contextInfo.mediaAlt,
                  src: contextInfo.mediaSource,
                }),
            },
          ]
        : []),
      {
        icon: <Copy size={15} />,
        label: contextInfo.mediaKind === "image" ? "复制图片" : "复制视频地址",
        onSelect: () => {
          void copyMediaResourceToClipboard(contextInfo, diaryDocument.filePath);
        },
      },
      {
        disabled: !mediaLocalPath || !window.desktop?.showInFolder,
        icon: <ExternalLink size={15} />,
        label: "在文件夹中显示",
        onSelect: () => {
          void showMediaResourceInFolder(
            contextInfo.mediaSource,
            diaryDocument.filePath,
          );
        },
      },
    ];

    openContextMenuAt(clientX, clientY, compactContextMenuItems(items), 240);
  }

  function getLocalCreationMenuItems(directoryPath: string): AppContextMenuItem[] {
    return [
      {
        disabled: !directoryPath || !window.desktop?.createMarkdownFile,
        icon: <FilePlus2 size={15} />,
        label: "新建 Markdown 文件",
        onSelect: () => void createLocalMarkdownDocument(directoryPath),
      },
      {
        disabled: !directoryPath || !window.desktop?.createDocumentFile,
        icon: <Table2 size={15} />,
        label: "新建在线表格",
        onSelect: () => void createStandaloneSheetDocument(directoryPath),
      },
      {
        disabled: !directoryPath || !window.desktop?.createDocumentFile,
        icon: <Square size={15} />,
        label: "新建 Excalidraw 画板",
        onSelect: () => void createStandaloneDrawingDocument(directoryPath),
      },
      {
        disabled: !directoryPath || !window.desktop?.createWorkspaceDirectory,
        icon: <FolderPlus size={15} />,
        label: "新建文件夹",
        onSelect: () => void createLocalDirectory(directoryPath),
      },
    ];
  }

  function openFileContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    filePath: string,
  ) {
    const fileName = getPathLabel(filePath);
    const canUseFileIpc = Boolean(window.desktop);
    const isCloudEntry = isCloudSidebarEntryPath(filePath);
    const parentDirectoryPath = getDirectoryPath(filePath);
    const canShowHistory =
      /\.(?:md|markdown|mdown)$/i.test(filePath) &&
      Boolean(window.desktop?.listDocumentHistory);

    openContextMenu(
      event,
      [
        {
          icon: <FileText size={15} />,
          label: "打开",
          onSelect: () => void openFileFromTree(filePath),
        },
        {
          disabled: !window.desktop?.renameWorkspaceEntry,
          icon: <PencilLine size={15} />,
          label: "重命名",
          onSelect: () => startRenamingEntry(filePath, "file"),
        },
        {
          disabled: !canShowHistory,
          icon: <FileClock size={15} />,
          label: "历史记录",
          onSelect: () => openDocumentHistoryDialog(filePath),
        },
        { type: "separator" },
        {
          disabled: !window.desktop?.duplicateDocumentFile,
          icon: <Copy size={15} />,
          label: "复制文件",
          onSelect: () => void duplicateDocumentFile(filePath),
        },
        ...(isCloudEntry
          ? []
          : [
              {
                icon: <Copy size={15} />,
                label: "复制路径",
                onSelect: () => void copyTextToClipboard(filePath),
              },
            ]),
        {
          icon: <Copy size={15} />,
          label: "复制文件名",
          onSelect: () => void copyTextToClipboard(fileName),
        },
        ...(isCloudEntry
          ? [
              { type: "separator" as const },
              {
                icon: <FilePlus2 size={15} />,
                label: "新建 Markdown 文件",
                onSelect: () => void createCloudMarkdownDocument(getDirectoryPath(filePath)),
              },
              {
                icon: <FolderPlus size={15} />,
                label: "新建文件夹",
                onSelect: () => void createCloudDirectory(getDirectoryPath(filePath)),
              },
              { type: "separator" as const },
              {
                icon: <Download size={15} />,
                label: "导出到本地...",
                onSelect: () => void exportCloudEntryToLocal(filePath),
              },
            ]
          : []),
        ...(isCloudEntry
          ? []
          : [
              { type: "separator" as const },
              ...getLocalCreationMenuItems(parentDirectoryPath),
              { type: "separator" as const },
              {
                disabled: !canUseFileIpc,
                icon: <ExternalLink size={15} />,
                label: "在资源管理器中显示",
                onSelect: () => void window.desktop?.showInFolder?.(filePath),
              },
            ]),
        { type: "separator" },
        {
          danger: true,
          disabled:
            !window.desktop?.deleteWorkspaceEntry &&
            !window.desktop?.deleteDocumentFile,
          icon: <Trash2 size={15} />,
          label: "删除文件",
          onSelect: () => void deleteDocumentFile(filePath),
        },
      ],
      258,
    );
  }

  function openDirectoryContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    directoryPath: string,
  ) {
    const isCloudEntry = isCloudSidebarEntryPath(directoryPath);

    openContextMenu(
      event,
      [
        {
          disabled: !window.desktop?.renameWorkspaceEntry,
          icon: <PencilLine size={15} />,
          label: "重命名",
          onSelect: () => startRenamingEntry(directoryPath, "directory"),
        },
        ...(isCloudEntry
          ? []
          : [
              {
                icon: <ExternalLink size={15} />,
                label: "在资源管理器中显示",
                onSelect: () => void window.desktop?.showInFolder?.(directoryPath),
              },
            ]),
        {
          icon: <RefreshCw size={15} />,
          label: "刷新",
          onSelect: () =>
            void (isCloudEntry
              ? refreshCloudSidebarWorkspaceFromCache()
              : refreshCurrentLocalWorkspace()),
        },
        ...(isCloudEntry
          ? []
          : [
              { type: "separator" as const },
              ...getLocalCreationMenuItems(directoryPath),
            ]),
        ...(isCloudEntry
          ? [
              { type: "separator" as const },
              {
                icon: <FilePlus2 size={15} />,
                label: "新建 Markdown 文件",
                onSelect: () => void createCloudMarkdownDocument(directoryPath),
              },
              {
                icon: <FolderPlus size={15} />,
                label: "新建文件夹",
                onSelect: () => void createCloudDirectory(directoryPath),
              },
            ]
          : []),
        ...(isCloudEntry
          ? [
              {
                icon: <Download size={15} />,
                label: "导出到本地...",
                onSelect: () => void exportCloudEntryToLocal(directoryPath),
              },
            ]
          : []),
        ...(isCloudEntry
          ? [
              { type: "separator" as const },
              {
                danger: true,
                disabled: !window.desktop?.deleteWorkspaceEntry,
                icon: <Trash2 size={15} />,
                label: "删除文件夹",
                onSelect: () => void deleteWorkspaceEntry(directoryPath, "directory"),
              },
            ]
          : [
              { type: "separator" as const },
              {
                danger: true,
                disabled: !window.desktop?.deleteWorkspaceEntry,
                icon: <Trash2 size={15} />,
                label: "删除文件夹",
                onSelect: () => void deleteWorkspaceEntry(directoryPath, "directory"),
              },
            ]),
      ],
      246,
    );
  }

  function openLocalStorageContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    targetDirectoryPath?: string,
  ) {
    const directoryPath = targetDirectoryPath || workspace.workspacePath || "";

    openContextMenu(
      event,
      [
        ...(directoryPath
          ? getLocalCreationMenuItems(directoryPath)
          : [
              {
                icon: <FolderOpen size={15} />,
                label: "打开文件夹...",
                onSelect: () => void openWorkspaceFolder(),
              },
            ]),
        { type: "separator" as const },
        {
          disabled: !workspace.workspacePath,
          icon: <RefreshCw size={15} />,
          label: "刷新本地",
          onSelect: () => void refreshCurrentLocalWorkspace(),
        },
      ],
      258,
    );
  }

  function openCloudStorageContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    targetDirectoryPath?: string,
  ) {
    const directoryPath = getCloudTargetDirectoryPath(targetDirectoryPath);

    openContextMenu(
      event,
      [
        {
          disabled: !directoryPath,
          icon: <FilePlus2 size={15} />,
          label: "新建 Markdown 文件",
          onSelect: () => void createCloudMarkdownDocument(directoryPath),
        },
        {
          disabled: !directoryPath,
          icon: <FolderPlus size={15} />,
          label: "新建文件夹",
          onSelect: () => void createCloudDirectory(directoryPath),
        },
        { type: "separator" },
        {
          icon: <RefreshCw size={15} />,
          label: "刷新云端",
          onSelect: () => void refreshCloudSidebarWorkspaceFromCache(),
        },
      ],
      250,
    );
  }

  function captureSourceEditorViewport(documentId: string) {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    pendingSourceEditorViewportRef.current = {
      documentId,
      hadFocus: document.activeElement === editor,
      scrollLeft: editor.scrollLeft,
      scrollTop: editor.scrollTop,
      selectionEnd: editor.selectionEnd,
      selectionStart: editor.selectionStart,
    };
  }

  async function handleWorkspaceFileChange(payload: WorkspaceFileChangePayload) {
    const { changedDocument, fileKey, isCurrentDocument } =
      getWorkspaceFileChangeContext({
        activeDocument,
        documents: workspace.documents,
        payload,
      });

    void loadDirectoryTree();

    if (payload.event === "add") {
      return;
    }

    if (!changedDocument) {
      return;
    }

    if (payload.event === "unlink") {
      if (consumeInternalFileDelete(internalFileDeletesRef.current, fileKey)) {
        return;
      }

      setRecentFileAvailability((current) => ({
        ...current,
        [payload.filePath]: false,
      }));

      if (isCurrentDocument && payload.source !== "sync") {
        externalConflictPathsRef.current.add(fileKey);
        void showAppAlert(getExternalDeleteAlert(payload.filePath));
      }

      return;
    }

    let localFile: LocalMarkdownFile | null = null;

    try {
      localFile = (await window.desktop?.readMarkdownFile?.(payload.filePath)) ?? null;
    } catch {
      setRecentFileAvailability((current) => ({
        ...current,
        [payload.filePath]: false,
      }));
      return;
    }

    if (!localFile) {
      return;
    }

    const diskDocument = createDocumentFromLocalFile(localFile);

    if (isMatchingInternalFileWrite(payload.filePath, diskDocument.content)) {
      acknowledgeSavedFileContent(payload.filePath, diskDocument.content);
      setRecentFileAvailability((current) => ({
        ...current,
        [payload.filePath]: true,
      }));
      setWorkspace((current) => {
        const currentDocument = current.documents.find(
          (document) => normalizeFilePathKey(document.filePath) === fileKey,
        );

        if (
          !shouldMergeInternalWriteBack({
            currentDocument,
            diskDocument,
          })
        ) {
          return current;
        }

        return mergeDiskDocumentIntoWorkspace(current, diskDocument);
      });
      return;
    }

    const hasLocalChanges = hasUnsavedFileContent(
      changedDocument,
      savedFileContentByPathRef.current,
    );

    const diskChangeDecision = getDiskChangeDecision({
      changedDocument,
      diskDocument,
      hasLocalChanges,
      source: payload.source,
    });

    if (diskChangeDecision === "same-content") {
      acknowledgeSavedFileContent(payload.filePath, diskDocument.content);
      externalConflictPathsRef.current.delete(fileKey);
      setWorkspace((current) => mergeDiskDocumentIntoWorkspace(current, diskDocument));
      return;
    }

    if (diskChangeDecision === "keep-local-dirty") {
      externalConflictPathsRef.current.delete(fileKey);
      showWorkspaceToast("磁盘内容已更新，当前编辑会在下次保存时写入。");
      return;
    }

    acknowledgeSavedFileContent(payload.filePath, diskDocument.content);
    externalConflictPathsRef.current.delete(fileKey);
    if (isCurrentDocument) {
      setSaveState("saved");
      captureSourceEditorViewport(changedDocument.id);
    }
    setRecentFileAvailability((current) => ({
      ...current,
      [payload.filePath]: true,
    }));
    setWorkspace((current) => mergeDiskDocumentIntoWorkspace(current, diskDocument));
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

  async function openUniverSheetEditor(target: UniverSheetEditTarget, code?: string) {
    let initialData = createDefaultUniverSheetData();

    if (code) {
      try {
        const assetReference = parseUniverSheetAssetReference(code);
        const source =
          assetReference && activeDocument?.filePath && window.desktop?.readTextAsset
            ? await window.desktop.readTextAsset({
                documentFilePath: activeDocument.filePath,
                reference: assetReference.assetPath,
              })
            : code;

        initialData = parseUniverSheetData(source);
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

    void openUniverSheetEditor({ kind: "insert" });
  }

  async function createUniverSheetMarkdownForDocument(
    document: MarkdownDocument,
    data: UniverSheetData,
    existingCode?: string,
  ) {
    const existingReference = existingCode
      ? parseUniverSheetAssetReference(existingCode)?.assetPath
      : undefined;
    const reference = await saveTextAssetForDocument(
      document,
      `${data.title || "在线表格"}.univer.json`,
      serializeUniverSheetData(data),
      existingReference,
    );

    return reference
      ? createUniverSheetAssetMarkdown(data, reference)
      : createUniverSheetMarkdown(data);
  }

  async function saveUniverSheet(data: UniverSheetData) {
    const document = activeDocument;

    if (!document || !univerSheetEditorState) {
      return;
    }

    const { target } = univerSheetEditorState;

    if (target.kind === "markdown" && isMarkdownDocument(document)) {
      const markdown = await createUniverSheetMarkdownForDocument(
        document,
        data,
        target.code,
      );
      updateMarkdown(
        replaceUniverSheetMarkdownBlockWithContent(
          document.content,
          target.code,
          markdown.replace(/^\n?```univer-sheet\n|\n```\n?$/g, ""),
        ),
      );
      return;
    }

    if (target.kind === "insert" && isMarkdownDocument(document)) {
      insertMarkdown(await createUniverSheetMarkdownForDocument(document, data));
      return;
    }

    if (target.kind === "document" && isSheetDocument(document)) {
      patchActiveDocument({
        content: serializeUniverSheetData(data),
        title: data.title || document.title,
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

  function setSidebarVisible(visible: boolean) {
    if (isImmersiveMode) {
      setIsImmersiveSidebarOpen(visible);
      return;
    }

    setIsSidebarCollapsed(!visible);
  }

  function showSidebar() {
    setSidebarVisible(true);
  }

  function toggleSidebarVisibility() {
    if (isImmersiveMode) {
      setIsImmersiveSidebarOpen((current) => !current);
      return;
    }

    setIsSidebarCollapsed((current) => !current);
  }

  function openWorkspaceSearch() {
    setSidebarTab("search");
    showSidebar();
    setIsActionsOpen(false);
    setTopMenu(null);
    void refreshWorkspaceSearchDocuments();
  }

  function openKnowledgeRelationsPanel() {
    setIsKnowledgeGraphOpen(true);
    setIsActionsOpen(false);
    setTopMenu(null);
  }

  function toggleDocumentInspector() {
    setIsDocumentInspectorOpen((current) => !current);
    setIsActionsOpen(false);
    setTopMenu(null);
  }

  function closeActiveDocument() {
    setIsDiaryOpen(false);
    if (isDiaryOpen) {
      setDiaryDocument(null);
    }
    setWorkspace((current) =>
      current.activeDocumentId
        ? { ...current, activeDocumentId: "" }
        : current,
    );
    setIsHomeOpen(true);
    setIsDocumentInspectorOpen(false);
    setIsFindReplaceOpen(false);
    setIsActionsOpen(false);
    setContextMenu(null);
    setTopMenu(null);
  }

  function closeWorkspaceSearch() {
    setWorkspaceSearchQuery("");
    setSidebarTab("current");
  }

  function runAppShortcutAction(action: AppShortcutAction) {
    setTopMenu(null);
    setIsActionsOpen(false);
    setContextMenu(null);

    switch (action.type) {
      case "editor":
        switch (action.action.type) {
          case "createLink":
            createLinkFromPrompt();
            break;
          case "edit":
            void runEditCommand(action.action.command);
            break;
          case "format":
            runFormatCommand(action.action.command);
            break;
          case "insertDocumentReference":
            openDocumentReferencePicker();
            break;
          case "insertTable":
            openTableInsertDialog();
            break;
          case "paragraph":
            runParagraphCommand(action.action.command);
            break;
        }
        break;
      case "file":
        switch (action.command) {
          case "newMarkdownDocument":
            createNewDocument();
            break;
          case "newWindow":
            openNewWindow();
            break;
          case "openDocument":
            void openMarkdownFile();
            break;
          case "inspirationNote":
            openInspirationNote();
            break;
          case "closeDocument":
            closeActiveDocument();
            break;
          case "save":
            void saveNow();
            break;
          case "saveAs":
            void saveActiveDocumentAs();
            break;
        }
        break;
      case "find":
        openFindReplaceDialog(Boolean(action.replace));
        break;
      case "view":
        switch (action.command) {
          case "exitFullScreen":
          case "toggleFullScreen":
            void toggleFullScreen();
            break;
          case "resetZoom":
            void runWindowZoomCommand("reset");
            break;
          case "showDocuments":
            setIsDiaryOpen(false);
            setIsHomeOpen(true);
            break;
          case "showFiles":
            setSidebarTab("files");
            showSidebar();
            break;
          case "showOutline":
            setSidebarTab("current");
            showSidebar();
            break;
          case "toggleSidebar":
            toggleSidebarVisibility();
            break;
          case "workspaceSearch":
            openWorkspaceSearch();
            break;
          case "zoomIn":
            void runWindowZoomCommand("zoomIn");
            break;
          case "zoomOut":
            void runWindowZoomCommand("zoomOut");
            break;
        }
        break;
    }
  }

  function runAppMenuCommand(command: AppMenuCommand) {
    const shortcutAction = getShortcutActionForAppMenuCommand(command.id);

    if (shortcutAction) {
      runAppShortcutAction(shortcutAction);
      return;
    }

    setTopMenu(null);
    setIsActionsOpen(false);
    setContextMenu(null);

    const selectedTheme = getThemeFromAppMenuCommand(command.id);

    if (selectedTheme) {
      setTheme(selectedTheme);
      return;
    }

    switch (command.id) {
      case "app:about":
        setIsAboutOpen(true);
        break;
      case "file:new-sheet":
        void createStandaloneSheetDocument();
        break;
      case "file:new-drawing":
        void createStandaloneDrawingDocument();
        break;
      case "file:open-folder":
        void openWorkspaceFolder();
        break;
      case "file:history":
        openDocumentHistoryDialog();
        break;
      case "file:open-recent": {
        const document = recentDocuments.find((item) => item.id === command.documentId);

        if (document) {
          void openRecentDocument(document);
        }
        break;
      }
      case "file:export-pdf":
        void exportActiveDocument("pdf");
        break;
      case "file:export-html":
        void exportActiveDocument("html");
        break;
      case "file:show-in-folder":
        void showWorkspaceInFolder();
        break;
      case "file:reveal-sidebar":
        showSidebar();
        setSidebarTab("files");
        break;
      case "edit:insert-drawing":
        openNewDrawing();
        break;
      case "edit:insert-sheet":
        openNewUniverSheet();
        break;
      case "paragraph:table":
        openTableInsertDialog();
        break;
      case "format:image-insert":
        readFileInput(imageInputRef.current);
        break;
      case "view:knowledge-relations":
        openKnowledgeRelationsPanel();
        break;
      case "view:settings":
        openSettings("notes");
        break;
      case "view:mode-typora":
        updateEditorMode("typora");
        break;
      case "view:mode-source":
        updateEditorMode("source");
        break;
      case "view:mode-split":
        updateEditorMode("split");
        break;
      case "view:mode-preview":
        updateEditorMode("preview");
        break;
      case "view:toggle-always-on-top":
        void toggleAlwaysOnTop();
        break;
      default:
        break;
    }
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
    showDocumentLoading("正在打开文档", "等待选择文件...");

    try {
      const localFile = await window.desktop?.selectMarkdownFile?.();

      if (!localFile) {
        return;
      }

      showDocumentLoading("正在打开文档", localFile.title || getFileNameFromPath(localFile.filePath));

      if (await openLocalFileAsDiaryIfNeeded(localFile)) {
        return;
      }

      const document = createDocumentFromLocalFile(localFile);
      revealRecentDocument(document);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) =>
        addOpenedDocumentToWorkspace(current, markDocumentOpened(document)),
      );
      setIsHomeOpen(false);
      setTopMenu(null);
    } catch {
      setSaveState("failed");
    } finally {
      clearDocumentLoading();
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

  function insertDocumentReference(target: string, display?: string) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const safeTarget = target.trim();
    const safeDisplay = display?.trim() || safeTarget;

    if (!safeTarget) {
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.insertDocumentReference(safeTarget, safeDisplay);
      return;
    }

    insertMarkdown(
      safeTarget === safeDisplay
        ? `[[${safeDisplay}]]`
        : `[[${safeTarget}|${safeDisplay}]]`,
    );
  }

  function getSelectedEditorText() {
    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      return "";
    }

    return activeDocument.content.slice(editor.selectionStart, editor.selectionEnd);
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

    const editor = editorRef.current;

    if (!editor || !activeDocument) {
      const wrap = getSourceFormatWrap(command);

      if (wrap) {
        insertMarkdown(`${wrap.prefix}${wrap.placeholder}${wrap.suffix}`);
      }

      return;
    }

    if (command.type === "copyLink" || command.type === "openLink") {
      const href = findSourceFormatCommandLink({
        content: activeDocument.content,
        selectionEnd: editor.selectionEnd,
        selectionStart: editor.selectionStart,
      })?.href;

      if (href) {
        if (command.type === "copyLink") {
          void navigator.clipboard?.writeText(href);
        } else {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }

      return;
    }

    const edit = createSourceFormatCommandEdit({
      command,
      content: activeDocument.content,
      selectionEnd: editor.selectionEnd,
      selectionStart: editor.selectionStart,
    });

    if (edit) {
      setTextareaContent(editor, edit.content, edit.selectionStart, edit.selectionEnd);
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
    if (mode === "preview") {
      return;
    }

    if (isDiaryOpen) {
      diaryWorkspaceRef.current?.insertTable(size);
      return;
    }

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.insertTable(size);
      return;
    }

    const markdown = createMarkdownTable(size);
    const editor = editorRef.current;

    if (!activeDocument || !editor) {
      insertMarkdown(markdown);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const firstCellOffset = Math.max(0, markdown.indexOf("| ") + 2);
    const nextContent =
      activeDocument.content.slice(0, start) +
      markdown +
      activeDocument.content.slice(end);

    updateMarkdown(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(
        start + firstCellOffset,
        start + firstCellOffset,
      );
    });
  }

  function openTableInsertDialog() {
    const canInsert =
      (isDiaryOpen && mode !== "preview") ||
      (Boolean(activeDocument) &&
        isMarkdownDocument(activeDocument) &&
        mode !== "preview");

    if (!canInsert) {
      return;
    }

    setTableInsertRows("3");
    setTableInsertColumns("3");
    setIsTableInsertDialogOpen(true);
    setTopMenu(null);
    setIsActionsOpen(false);
  }

  function confirmTableInsert() {
    const rows = Math.max(2, Math.min(20, Number(tableInsertRows) || 3));
    const columns = Math.max(
      1,
      Math.min(20, Number(tableInsertColumns) || 3),
    );

    setIsTableInsertDialogOpen(false);
    // Radix returns focus only after its close animation. Insert afterward so
    // the selected first cell retains focus instead of the dismissed dialog.
    window.setTimeout(() => {
      insertTable({ columns, rows });
      if (isDiaryOpen) {
        diaryWorkspaceRef.current?.focusEditor();
      } else if (mode === "typora") {
        typoraEditorRef.current?.focusEditor();
      }

      // Let React finish the document update before restoring browser focus.
      // Otherwise the dialog's focus scope can still win the same event loop.
      if (mode === "typora") {
        window.setTimeout(() => {
          const editor = document.querySelector<HTMLElement>(
            ".typora-milkdown-content .ProseMirror",
          );
          editor?.focus({ preventScroll: true });
        }, 120);
      }
    }, 80);
  }

  function replaceMediaImportPlaceholder(
    importId: string,
    replacement: string,
    options: { appendIfMissing?: boolean; documentId?: string | null } = {},
  ) {
    setWorkspace((current) => {
      const targetDocumentId = options.documentId ?? current.activeDocumentId;
      const currentDocument =
        current.documents.find((item) => item.id === targetDocumentId) ?? null;

      if (!currentDocument || !isMarkdownDocument(currentDocument)) {
        return current;
      }

      const result = replaceMediaImportPlaceholderContent(
        currentDocument.content,
        importId,
        replacement,
        options.appendIfMissing ? { appendIfMissing: true } : undefined,
      );

      if (!result.didChange) {
        return current;
      }

      return updateDocument(current, {
        ...currentDocument,
        content: result.content,
        title:
          currentDocument.filePath
            ? getDocumentTitleFromFilePath(currentDocument.filePath)
            : renameFromMarkdown(result.content, currentDocument.title),
        updatedAt: now(),
      });
    });
  }

  async function insertVideoImportPlaceholder(fileName: string) {
    const importId = `video-${Date.now()}-${mediaImportIdRef.current++}`;
    const documentId = activeDocument?.id ?? null;
    const document = activeDocument && isMarkdownDocument(activeDocument) ? activeDocument : null;

    insertMarkdown(createMediaImportPlaceholder(importId, fileName, "准备读取"));
    await waitForNextPaint();

    return { document, documentId, importId };
  }

  function insertMarkdownImage(
    alt: string,
    source: string,
    title = COMPACT_IMAGE_TITLE,
  ) {

    if (mode === "typora" && typoraEditorRef.current) {
      typoraEditorRef.current.insertImage({ alt, source, title });
      return;
    }

    insertMarkdown(createMarkdownImageToken({ alt, source, title }));
  }

  function insertSingleMarkdownImageToken(text: string) {
    const token = getSingleClipboardImageToken(text);

    if (!token) {
      return false;
    }

    insertMarkdownImage(token.alt, token.source, token.title);
    return true;
  }

  function updateVideoImportPlaceholder(
    importId: string,
    fileName: string,
    status: string,
    progress?: number,
    documentId?: string | null,
  ) {
    replaceMediaImportPlaceholder(
      importId,
      createMediaImportPlaceholder(importId, fileName, status, progress),
      { documentId },
    );
  }

  async function handleImageDataUrl(fileName: string, dataUrl: string) {
    const document = activeDocument;

    if (!document || !isMarkdownDocument(document)) {
      return;
    }

    try {
      const reference = await saveDataUrlAssetForDocument(
        document,
        fileName,
        dataUrl,
      );
      insertMarkdownImage(fileName, reference);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
    }
  }

  async function handleImageFile(file: File) {
    const fileName = file.name || createTimestampedImageName(file.type);
    const mimeType =
      file.type || getClipboardMediaMimeType(fileName) || "image/png";

    await handleImageDataUrl(
      fileName,
      normalizeDataUrlMimeType(await fileToDataUrl(file), mimeType),
    );
  }

  async function handleImageFilePath(file: {
    fileName: string;
    filePath: string;
    mimeType: string;
  }) {
    const document = activeDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    try {
      const reference = await saveFileAssetForDocument(
        document,
        file.fileName,
        file.filePath,
        "image.gif",
      );
      insertMarkdownImage(file.fileName, reference);
      return true;
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
      return false;
    }
  }

  async function saveFileAssetForDocument(
    document: MarkdownDocument,
    fileName: string,
    sourceFilePath: string,
    fallbackName = "asset",
  ) {
    if (!document.filePath || !window.desktop?.copyAssetFromFile) {
      return sourceFilePath;
    }

    const savedAsset = await window.desktop.copyAssetFromFile({
      documentFilePath: document.filePath,
      fileName: createAssetFileName(fileName, fallbackName),
      sourceFilePath,
    });

    return savedAsset.reference;
  }

  async function refreshDiaryEntries(workspacePath = workspace.workspacePath) {
    if (!workspacePath || !window.desktop?.readDirectoryTree) {
      setDiaryEntries([]);
      return [];
    }

    try {
      const tree = await window.desktop.readDirectoryTree(
        getDiaryRootPath(workspacePath),
        { includeEmptyDirectories: false },
      );
      const rawEntries = getDiaryEntriesFromTree(tree);
      const entries = window.desktop?.readMarkdownFile
        ? await Promise.all(
            rawEntries.map(async (entry) => {
              try {
                const localFile = await window.desktop?.readMarkdownFile?.(
                  entry.filePath,
                );

                return localFile
                  ? enrichDiaryEntryWithContent(entry, localFile.content)
                  : entry;
              } catch {
                return entry;
              }
            }),
          )
        : rawEntries;

      setDiaryEntries(entries);
      return entries;
    } catch {
      setDiaryEntries([]);
      return [];
    }
  }

  function getDiaryDateKeyFromLocalFile(localFile: LocalMarkdownFile) {
    const titleDate = localFile.title.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
    const pathDate = localFile.filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/i)?.[1];

    return titleDate ?? pathDate ?? getDiaryDateKey();
  }

  function shouldOpenLocalFileAsDiary(localFile: LocalMarkdownFile) {
    return (
      isPathInsideDiaryRoot(localFile.filePath, workspace.workspacePath) ||
      isDiaryDocumentContent(localFile.content)
    );
  }

  function createLocalFileFromDocument(
    document: MarkdownDocument,
  ): LocalMarkdownFile | null {
    if (!document.filePath) {
      return null;
    }

    return {
      content: document.content,
      createdAt: document.createdAt,
      documentType: getDocumentType(document),
      fileExtension: document.fileExtension ?? ".md",
      filePath: document.filePath,
      title: document.title,
      updatedAt: document.updatedAt,
    };
  }

  function normalizeDiaryLocalFile(localFile: LocalMarkdownFile) {
    const fallbackDateKey = getDiaryDateKeyFromLocalFile(localFile);
    const metadata = getDiaryMetadata(localFile.content, fallbackDateKey);
    const content = updateDiaryMetadata(localFile.content, {
      dateKey: metadata.dateKey,
      mood: metadata.mood,
      tags: metadata.tags,
      templateId: metadata.templateId,
    });

    return {
      ...localFile,
      content,
      title: metadata.dateKey,
    };
  }

  function openDiaryDocumentFromFile(localFile: LocalMarkdownFile) {
    const normalizedFile = normalizeDiaryLocalFile(localFile);
    const document = createDiaryDocument(normalizedFile);

    if (document.filePath) {
      savedFileContentByPathRef.current.set(document.filePath, localFile.content);
    }

    setDiaryDocument(document);
    setDiarySaveState(document.content === localFile.content ? "saved" : "saving");
    setIsDiaryOpen(true);
    setIsHomeOpen(false);
    setIsDocumentInspectorOpen(false);
    setSidebarTab("diary");
    showSidebar();
    setTopMenu(null);
    setIsActionsOpen(false);
  }

  async function openLocalFileAsDiaryIfNeeded(localFile: LocalMarkdownFile) {
    if (!shouldOpenLocalFileAsDiary(localFile)) {
      return false;
    }

    openDiaryDocumentFromFile(localFile);
    await refreshDiaryEntries(workspace.workspacePath);
    return true;
  }

  async function openDiaryEntry(entry: DiaryEntry) {
    if (!window.desktop?.readMarkdownFile) {
      return;
    }

    try {
      const localFile = await window.desktop.readMarkdownFile(entry.filePath);
      openDiaryDocumentFromFile(localFile);
    } catch {
      setDiarySaveState("failed");
    }
  }

  async function openDiaryWorkspace() {
    setIsDiaryOpen(true);
    setIsHomeOpen(false);
    setIsDocumentInspectorOpen(false);
    setSidebarTab("diary");
    showSidebar();
    setTopMenu(null);
    setIsActionsOpen(false);

    if (!diaryDocument && diaryEntries[0]) {
      await openDiaryEntry(diaryEntries[0]);
    }
  }

  async function createDiaryForDate(dateKey = getDiaryDateKey()) {
    const workspacePath = workspace.workspacePath;

    setSidebarTab("diary");
    showSidebar();

    if (!workspacePath) {
      void showAppAlert({
        confirmLabel: "选择工作区",
        description: "日记会保存在当前工作区下，请先打开一个本地笔记目录。",
        title: "先打开一个工作区",
        tone: "info",
      });
      return;
    }

    const filePath = getDiaryFilePath(workspacePath, dateKey);

    try {
      const existingFile =
        (await window.desktop?.pathExists?.(filePath)) &&
        window.desktop?.readMarkdownFile
          ? await window.desktop.readMarkdownFile(filePath)
          : null;
      const localFile =
        existingFile ||
        (await window.desktop?.createDocumentFile?.({
          content: createDiaryInitialContent(
            dateKey,
            settings.diaryDefaultTemplate,
          ),
          directoryPath: getDiaryMonthDirectoryPath(workspacePath, dateKey),
          extension: ".md",
          title: dateKey,
        }));

      if (!localFile) {
        setDiarySaveState("failed");
        return;
      }

      openDiaryDocumentFromFile(localFile);
      await refreshDiaryEntries(workspacePath);
      await loadDirectoryTree(workspacePath);
    } catch {
      setDiarySaveState("failed");
    }
  }

  async function createTodayDiary() {
    await createDiaryForDate(getDiaryDateKey());
  }

  async function confirmCreateDiaryForDate(dateKey: string) {
    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "创建日记",
      description: `这会在当前工作区的日记目录下创建 ${dateKey}.md。`,
      title: `补写 ${dateKey} 的日记？`,
      tone: "info",
    });

    if (!confirmed) {
      return;
    }

    await createDiaryForDate(dateKey);
  }

  async function deleteDiaryFile(filePath: string, dateKey: string) {
    if (!window.desktop?.deleteDocumentFile) {
      void showAppAlert({
        confirmLabel: "知道了",
        description: "当前运行环境不支持删除本地文件。",
        title: "无法删除日记",
        tone: "warning",
      });
      return;
    }

    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除日记",
      description: "这会删除本地日记文件，此操作无法撤销。",
      detail: filePath,
      title: `删除 ${dateKey} 的日记？`,
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const fileKey = normalizeFilePathKey(filePath);
    const isDeletingCurrentDiary =
      diaryDocument?.filePath &&
      normalizeFilePathKey(diaryDocument.filePath) === fileKey;

    try {
      internalFileDeletesRef.current.add(fileKey);
      await window.desktop.deleteDocumentFile(filePath);

      for (const savedPath of savedFileContentByPathRef.current.keys()) {
        if (normalizeFilePathKey(savedPath) === fileKey) {
          savedFileContentByPathRef.current.delete(savedPath);
        }
      }

      externalConflictPathsRef.current.delete(fileKey);

      if (isDeletingCurrentDiary) {
        setDiaryDocument(null);
        setDiarySaveState("saved");
      }

      const refreshedEntries = await refreshDiaryEntries(workspace.workspacePath);

      if (workspace.workspacePath) {
        await loadDirectoryTree(workspace.workspacePath);
      }

      if (isDeletingCurrentDiary && refreshedEntries[0]) {
        await openDiaryEntry(refreshedEntries[0]);
      } else if (isDeletingCurrentDiary) {
        setIsDiaryOpen(true);
        setIsHomeOpen(false);
        setSidebarTab("diary");
      }

      showWorkspaceToast("日记已删除");
    } catch (error) {
      internalFileDeletesRef.current.delete(fileKey);
      void showAppAlert({
        confirmLabel: "知道了",
        description:
          error instanceof Error
            ? error.message
            : "删除日记时发生错误，请确认文件仍然存在且当前目录可写。",
        detail: filePath,
        title: "删除失败",
        tone: "danger",
      });
    }
  }

  async function deleteDiaryEntry(entry: DiaryEntry) {
    await deleteDiaryFile(entry.filePath, entry.dateKey);
  }

  function updateDiaryMarkdown(content: string) {
    const nextContent =
      mode === "typora" ? normalizeMarkdownHtmlBreaks(content) : content;

    setDiaryDocument((current) => {
      if (!current || current.content === nextContent) {
        return current;
      }

      setDiarySaveState("saving");

      return {
        ...current,
        content: nextContent,
        title: current.title.match(/^\d{4}-\d{2}-\d{2}$/)
          ? current.title
          : renameFromMarkdown(nextContent, current.title),
        updatedAt: now(),
      };
    });
  }

  function updateDiaryMetadataFields(
    updates: Parameters<typeof updateDiaryMetadata>[1],
  ) {
    setDiaryDocument((current) => {
      if (!current) {
        return current;
      }

      const currentMetadata = getDiaryMetadata(current.content, current.title);
      const nextContent = updateDiaryMetadata(current.content, {
        dateKey: currentMetadata.dateKey,
        ...updates,
      });

      if (nextContent === current.content) {
        return current;
      }

      setDiarySaveState("saving");

      return {
        ...current,
        content: nextContent,
        updatedAt: now(),
      };
    });
  }

  function updateDiaryMood(mood?: DiaryMood) {
    updateDiaryMetadataFields({ mood });
  }

  function updateDiaryTags(tags: string[]) {
    updateDiaryMetadataFields({ tags });
  }

  function updateDiaryTemplate(templateId: DiaryTemplateId) {
    setDiaryDocument((current) => {
      if (!current) {
        return current;
      }

      const nextContent = applyDiaryTemplateWithCarryover(
        current.content,
        templateId,
      );

      if (nextContent === current.content) {
        return current;
      }

      setDiarySaveState("saving");

      return {
        ...current,
        content: nextContent,
        updatedAt: now(),
      };
    });
  }

  function insertDiaryMarkdown(markdown: string) {
    diaryWorkspaceRef.current?.insertMarkdown(markdown);
  }

  function insertDiaryMarkdownImage(
    alt: string,
    source: string,
    title = COMPACT_IMAGE_TITLE,
  ) {
    diaryWorkspaceRef.current?.insertImage({ alt, source, title });
  }

  function insertSingleDiaryMarkdownImageToken(text: string) {
    const token = getSingleClipboardImageToken(text);

    if (!token) {
      return false;
    }

    insertDiaryMarkdownImage(token.alt, token.source, token.title);
    return true;
  }

  async function handleDiaryImageDataUrl(fileName: string, dataUrl: string) {
    const document = diaryDocument;

    if (!document || !isMarkdownDocument(document)) {
      return;
    }

    try {
      const reference = await saveDataUrlAssetForDocument(
        document,
        fileName,
        dataUrl,
      );
      insertDiaryMarkdownImage(fileName, reference);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
    }
  }

  async function handleDiaryImageFile(file: File) {
    const fileName = file.name || createTimestampedImageName(file.type);
    const mimeType =
      file.type || getClipboardMediaMimeType(fileName) || "image/png";

    await handleDiaryImageDataUrl(
      fileName,
      normalizeDataUrlMimeType(await fileToDataUrl(file), mimeType),
    );
  }

  async function handleDiaryImageFilePath(file: {
    fileName: string;
    filePath: string;
    mimeType: string;
  }) {
    const document = diaryDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    try {
      const reference = await saveFileAssetForDocument(
        document,
        file.fileName,
        file.filePath,
        "image.gif",
      );
      insertDiaryMarkdownImage(file.fileName, reference);
      return true;
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
      return false;
    }
  }

  async function handleDiaryVideoDataUrl(fileName: string, dataUrl: string) {
    const document = diaryDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    try {
      const reference = await saveDataUrlAssetForDocument(
        document,
        fileName,
        dataUrl,
      );
      insertDiaryMarkdown(createVideoMarkdown(fileName, reference));
      return true;
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleDiaryVideoFile(file: File) {
    const fileName = file.name || createTimestampedVideoName(file.type);
    const mimeType = file.type || getClipboardMediaMimeType(fileName) || "video/webm";

    try {
      const dataUrl = normalizeDataUrlMimeType(
        await fileToDataUrl(file),
        mimeType,
      );

      return handleDiaryVideoDataUrl(fileName, dataUrl);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleDiaryVideoFilePath(file: {
    fileName: string;
    filePath: string;
    mimeType: string;
  }) {
    const document = diaryDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    try {
      const reference = await saveFileAssetForDocument(
        document,
        file.fileName,
        file.filePath,
        "recording.webm",
      );
      insertDiaryMarkdown(createVideoMarkdown(file.fileName, reference));
      return true;
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleDiaryMediaImportAction(action: MediaImportAction) {
    switch (action.action) {
      case "imageFile":
        await handleDiaryImageFile(action.file);
        return;
      case "imageFilePath":
        await handleDiaryImageFilePath(action);
        return;
      case "videoFile":
        await handleDiaryVideoFile(action.file);
        return;
      case "videoFilePath":
        await handleDiaryVideoFilePath(action);
        return;
      case "imageDataUrl":
        await handleDiaryImageDataUrl(action.fileName, action.dataUrl);
        return;
      case "videoDataUrl":
        await handleDiaryVideoDataUrl(action.fileName, action.dataUrl);
        return;
    }
  }

  async function pasteDiaryClipboardMediaFallback() {
    const action = await readClipboardMediaFallbackAction({
      listMediaFileRefs: window.desktop?.listClipboardMediaFiles,
      onBeforeReadNativeMediaData: () =>
        setBackupMessage("正在读取剪贴板媒体"),
      readBrowserMedia: readBrowserClipboardMedia,
      readImageData: window.desktop?.readClipboardImage,
      readMediaData: window.desktop?.readClipboardMediaFiles,
    });

    if (!action) {
      return false;
    }

    await handleDiaryMediaImportAction(action);
    return true;
  }

  async function handleDiaryPaste(event: ClipboardEvent<HTMLElement>) {
    if (event.defaultPrevented || !diaryDocument || !isMarkdownDocument(diaryDocument)) {
      return;
    }

    const directMediaAction = getClipboardDirectMediaAction(event.clipboardData);

    if (directMediaAction) {
      event.preventDefault();
      await handleDiaryMediaImportAction(directMediaAction);
      return;
    }

    const text = event.clipboardData.getData("text/plain");

    if (insertSingleDiaryMarkdownImageToken(text)) {
      event.preventDefault();
      return;
    }

    if (!shouldTryClipboardMediaFallback(event.clipboardData)) {
      return;
    }

    event.preventDefault();
    if (await pasteDiaryClipboardMediaFallback()) {
      return;
    }

    if (text) {
      insertDiaryMarkdown(text);
      return;
    }

    setBackupMessage("未能读取剪贴板中的媒体内容");
  }

  async function handleVideoDataUrl(
    fileName: string,
    dataUrl: string,
    importTarget?: {
      document: MarkdownDocument | null;
      documentId: string | null;
      importId: string;
    },
  ) {
    const document = importTarget?.document ?? activeDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    try {
      if (importTarget) {
        updateVideoImportPlaceholder(
          importTarget.importId,
          fileName,
          "正在写入当前文件夹的 .assets",
          undefined,
          importTarget.documentId,
        );
      }

      const reference = await saveDataUrlAssetForDocument(
        document,
        fileName,
        dataUrl,
      );

      if (importTarget) {
        replaceMediaImportPlaceholder(
          importTarget.importId,
          createVideoMarkdown(fileName, reference),
          { appendIfMissing: true, documentId: importTarget.documentId },
        );
      } else {
        insertMarkdown(createVideoMarkdown(fileName, reference));
      }

      return true;
    } catch (error) {
      if (importTarget) {
        updateVideoImportPlaceholder(
          importTarget.importId,
          fileName,
          "导入失败",
          undefined,
          importTarget.documentId,
        );
      }

      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleVideoFile(file: File) {
    const fileName = file.name || createTimestampedVideoName(file.type);
    const mimeType = file.type || getClipboardMediaMimeType(fileName) || "video/webm";
    const importTarget = await insertVideoImportPlaceholder(fileName);

    try {
      const dataUrl = normalizeDataUrlMimeType(
        await fileToDataUrl(file, (progress) => {
          updateVideoImportPlaceholder(
            importTarget.importId,
            fileName,
            "正在读取剪贴板",
            progress,
            importTarget.documentId,
          );
        }),
        mimeType,
      );

      return handleVideoDataUrl(fileName, dataUrl, importTarget);
    } catch (error) {
      updateVideoImportPlaceholder(importTarget.importId, fileName, "导入失败", undefined, importTarget.documentId);
      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleVideoFilePath(file: {
    fileName: string;
    filePath: string;
    mimeType: string;
  }) {
    const document = activeDocument;

    if (!document || !isMarkdownDocument(document)) {
      return false;
    }

    const importTarget = await insertVideoImportPlaceholder(file.fileName);

    try {
      updateVideoImportPlaceholder(
        importTarget.importId,
        file.fileName,
        "正在复制到当前文件夹的 .assets",
        undefined,
        importTarget.documentId,
      );
      const reference = await saveFileAssetForDocument(
        document,
        file.fileName,
        file.filePath,
        "recording.webm",
      );
      replaceMediaImportPlaceholder(
        importTarget.importId,
        createVideoMarkdown(file.fileName, reference),
        { appendIfMissing: true, documentId: importTarget.documentId },
      );

      return true;
    } catch (error) {
      updateVideoImportPlaceholder(
        importTarget.importId,
        file.fileName,
        "导入失败",
        undefined,
        importTarget.documentId,
      );
      setBackupMessage(error instanceof Error ? error.message : "视频处理失败");
      return false;
    }
  }

  async function handleMediaImportAction(action: MediaImportAction) {
    switch (action.action) {
      case "imageFile":
        await handleImageFile(action.file);
        return;
      case "imageFilePath":
        await handleImageFilePath(action);
        return;
      case "videoFile":
        await handleVideoFile(action.file);
        return;
      case "videoFilePath":
        await handleVideoFilePath(action);
        return;
      case "imageDataUrl":
        await handleImageDataUrl(action.fileName, action.dataUrl);
        return;
      case "videoDataUrl": {
        const importTarget = await insertVideoImportPlaceholder(action.fileName);
        await handleVideoDataUrl(action.fileName, action.dataUrl, importTarget);
        return;
      }
    }
  }

  function prepareDropInsertionPoint(event: ReactDragEvent<HTMLElement>) {
    if (mode === "typora") {
      typoraEditorRef.current?.focusAtClientPoint(event.clientX, event.clientY);
      return;
    }

    editorRef.current?.focus();
  }

  function handleEditorDragOver(event: ReactDragEvent<HTMLElement>) {
    if (
      !activeDocument ||
      !isMarkdownDocument(activeDocument) ||
      !dataTransferHasFiles(event.dataTransfer)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsEditorDraggingMedia(true);
  }

  function handleEditorDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsEditorDraggingMedia(false);
    }
  }

  async function handleEditorDrop(event: ReactDragEvent<HTMLElement>) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const mediaActions = getDroppedMediaImportActions(
      event.dataTransfer,
      window.desktop?.getPathForFile,
    );

    if (mediaActions.length === 0) {
      setIsEditorDraggingMedia(false);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsEditorDraggingMedia(false);
    prepareDropInsertionPoint(event);

    for (const action of mediaActions) {
      await handleMediaImportAction(action);
    }
  }

  async function pasteClipboardMediaFallback() {
    const action = await readClipboardMediaFallbackAction({
      listMediaFileRefs: window.desktop?.listClipboardMediaFiles,
      onBeforeReadNativeMediaData: () =>
        setBackupMessage("正在读取剪贴板媒体"),
      readBrowserMedia: readBrowserClipboardMedia,
      readImageData: window.desktop?.readClipboardImage,
      readMediaData: window.desktop?.readClipboardMediaFiles,
    });

    if (!action) {
      return false;
    }

    await handleMediaImportAction(action);
    return true;
  }

  async function readClipboardTextFallback() {
    try {
      const browserText = await navigator.clipboard?.readText?.();

      if (browserText) {
        return browserText;
      }
    } catch {
      // Electron's native clipboard remains available when browser clipboard
      // permissions block programmatic paste from menus.
    }

    try {
      return (await window.desktop?.readClipboardText?.()) ?? "";
    } catch {
      return "";
    }
  }

  async function readTableClipboardPayload() {
    try {
      return parseTableClipboardPayload(
        await window.desktop?.readClipboardTablePayload?.(),
      );
    } catch {
      return null;
    }
  }

  function pasteTableClipboardPayload(payload: TableClipboardPayload) {
    if (isDiaryOpen) {
      return diaryWorkspaceRef.current?.pasteTableClipboardPayload(payload) ?? false;
    }

    if (mode === "preview") {
      return false;
    }

    return typoraEditorRef.current?.pasteTableClipboardPayload(payload) ?? false;
  }

  async function pasteFromClipboardShortcut(options: { showEmptyFeedback?: boolean } = {}) {
    const tablePayload = await readTableClipboardPayload();

    if (tablePayload && pasteTableClipboardPayload(tablePayload)) {
      return true;
    }

    if (isDiaryOpen && diaryDocument && isMarkdownDocument(diaryDocument)) {
      if (await pasteDiaryClipboardMediaFallback()) {
        return true;
      }

      const text = await readClipboardTextFallback();

      if (text) {
        if (insertSingleDiaryMarkdownImageToken(text)) {
          return true;
        }

        insertDiaryMarkdown(text);
        return true;
      }

      if (options.showEmptyFeedback) {
        setBackupMessage("剪贴板中没有可粘贴的内容");
      }

      return false;
    }

    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return false;
    }

    if (await pasteClipboardMediaFallback()) {
      return true;
    }

    const text = await readClipboardTextFallback();

    if (text) {
      if (insertSingleMarkdownImageToken(text)) {
        return true;
      }

      insertMarkdown(text);
      return true;
    }

    if (options.showEmptyFeedback) {
      setBackupMessage("剪贴板中没有可粘贴的内容");
    }

    return false;
  }

  async function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (event.defaultPrevented || !activeDocument || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const directMediaAction = getClipboardDirectMediaAction(event.clipboardData);

    if (directMediaAction) {
      event.preventDefault();
      await handleMediaImportAction(directMediaAction);
      return;
    }

    const text = event.clipboardData.getData("text/plain");

    if (insertSingleMarkdownImageToken(text)) {
      event.preventDefault();
      return;
    }

    if (!shouldTryClipboardMediaFallback(event.clipboardData)) {
      return;
    }

    event.preventDefault();
    if (await pasteClipboardMediaFallback()) {
      return;
    }

    if (text) {
      insertMarkdown(text);
      return;
    }

    setBackupMessage("未能读取剪贴板中的媒体内容");
  }

  function handleSourceCopy(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!activeDocument?.filePath || !isMarkdownDocument(activeDocument)) {
      return;
    }

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    if (selectionStart === selectionEnd) {
      return;
    }

    const selectedMarkdown = textarea.value.slice(selectionStart, selectionEnd);
    const selectedTextLength = selectedMarkdown.trim().length;
    const documentTextLength = activeDocument.content.trim().length;
    const markdown =
      documentTextLength > 0 && selectedTextLength >= documentTextLength * 0.85
        ? activeDocument.content
        : selectedMarkdown;
    const imageTokens = collectClipboardImageTokens(markdown);

    if (!imageTokens.length) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.clipboardData.setData("text/plain", markdown);

    void writeMarkdownRichClipboard(markdown, activeDocument.filePath);
  }

  async function saveNow() {
    try {
      await savePersistedAppState(
        createPersistedAppState({
          hiddenRecentDocumentKeys,
          recentDirectories: recentDirectoryPaths,
          settings,
          sidebarWidth,
          theme,
          workspace,
        }),
      );

      const writeResult = await writeExistingDocumentIfNeeded({
        acknowledgeSavedFileContent,
        document: activeDocument,
        externalConflictPaths: externalConflictPathsRef.current,
        pathExists: window.desktop?.pathExists,
        rememberInternalFileWrite,
        writeMarkdownFile: window.desktop?.writeMarkdownFile,
      });

      if (writeResult === "save-as") {
        await saveActiveDocumentAs();
        return;
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
      void showAppAlert(getSaveAsReadonlyAlert());
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

      const document = createDocumentFromSavedFile(activeDocument, savedFile);

      rememberInternalFileWrite(savedFile.filePath, savedFile.content);
      acknowledgeSavedFileContent(savedFile.filePath, savedFile.content);
      rememberRecentDirectory(getDirectoryPath(savedFile.filePath));
      setWorkspace((current) => applySavedDocumentToWorkspace(current, document));
      setSaveState("saved");
      await loadDirectoryTree(getDirectoryPath(savedFile.filePath));
    } catch {
      setSaveState("failed");
      void showAppAlert(getSaveAsFailedAlert());
    }
  }

  async function exportActiveDocument(format: ExportDocumentFormat) {
    if (!activeDocument) {
      return;
    }

    if (!isMarkdownDocument(activeDocument)) {
      void showAppAlert(getExportReadonlyAlert());
      return;
    }

    if (!window.desktop?.exportHtmlFile || !window.desktop.exportPdfFile) {
      void showAppAlert(getExportUnsupportedAlert());
      return;
    }

    try {
      const { createMarkdownExportHtml } = await import("./exportDocument");

      await exportMarkdownDocument({
        createHtml: createMarkdownExportHtml,
        document: activeDocument,
        exportHtmlFile: window.desktop.exportHtmlFile,
        exportPdfFile: window.desktop.exportPdfFile,
        format,
        showInFolder: window.desktop.showInFolder,
        theme,
      });
    } catch {
      void showAppAlert(getExportFailedAlert(format));
    }
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

  async function runEditCommand(command: TyporaEditCommand) {
    if (isDiaryOpen && command === "paste") {
      await pasteFromClipboardShortcut({ showEmptyFeedback: true });
      return;
    }

    if (isDiaryOpen) {
      diaryWorkspaceRef.current?.runEditCommand(command);
      return;
    }

    if (!activeDocument && command !== "copy") {
      return;
    }

    if (activeDocument && !isMarkdownDocument(activeDocument)) {
      return;
    }

    if (command === "paste") {
      await pasteFromClipboardShortcut({ showEmptyFeedback: true });
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
      case "moveLineDown":
      case "delete":
        if (!textarea || !activeDocument) {
          if (command === "delete") {
            document.execCommand("delete");
          }
          break;
        }

        {
          const edit = createSourceEditCommandEdit({
            command,
            content: activeDocument.content,
            selectionEnd: textarea.selectionEnd,
            selectionStart: textarea.selectionStart,
          });

          if (edit) {
            setTextareaContent(
              textarea,
              edit.content,
              edit.selectionStart,
              edit.selectionEnd,
            );
          }
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

    const textarea = editorRef.current;
    const action = createSourceParagraphCommandAction({
      command,
      content: activeDocument.content,
      selectionEnd: textarea?.selectionEnd,
      selectionStart: textarea?.selectionStart,
    });

    if (action.action === "edit" && textarea) {
      setTextareaContent(
        textarea,
        action.edit.content,
        action.edit.selectionStart,
        action.edit.selectionEnd,
      );
    } else if (action.action === "insert") {
      insertMarkdown(action.markdown);
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
            <MenuItem label="灵感便签..." shortcut="Ctrl+Alt+N" onSelect={() => runTopMenuAction(openInspirationNote)} />
            <MenuSeparator />
            <MenuItem label="打开..." shortcut="Ctrl+O" onSelect={() => runTopMenuAction(() => void openMarkdownFile())} />
            <MenuItem label="打开文件夹..." onSelect={() => runTopMenuAction(() => void openWorkspaceFolder())} />
            <MenuSeparator />
            <MenuItem
              label="历史记录"
              disabled={!historyBrowserDocuments.length}
              onSelect={() => runTopMenuAction(() => openDocumentHistoryDialog())}
            />
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
                    pathLabel={getDocumentDisplayPath(document)}
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
              label="关闭当前文档"
              shortcut="Ctrl+W"
              disabled={!activeDocument}
              onSelect={() => runTopMenuAction(closeActiveDocument)}
            />
            <MenuItem
              label="另存为..."
              shortcut="Ctrl+Shift+S"
              disabled={!isMarkdownDocument(activeDocument)}
              onSelect={() => runTopMenuAction(() => void saveActiveDocumentAs())}
            />
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
              showSidebar();
              setSidebarTab("files");
            })} />
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
            <MenuSubmenu label="查找和替换" panelClassName="find-replace-submenu-panel">
              <MenuItem label="查找" shortcut="Ctrl+F" onSelect={() => runTopMenuAction(() => openFindReplaceDialog(false))} />
              <MenuItem label="替换" shortcut="Ctrl+H" onSelect={() => runTopMenuAction(() => openFindReplaceDialog(true))} />
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
            <MenuItem label="表格" shortcut="Ctrl+T" onSelect={() => runTopMenuAction(openTableInsertDialog)} />
            <MenuItem label="公式块" shortcut="Ctrl+Shift+M" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "mathBlock" }))} />
            <MenuItem label="代码块" shortcut="Ctrl+Shift+K" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "codeBlock" }))} />
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
            <MenuSubmenu label="任务状态">
              <MenuItem label="切换任务状态" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "taskStatus", status: "toggle" }))} />
              <MenuItem label="标记已完成" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "taskStatus", status: "completed" }))} />
              <MenuItem label="标记为未完成" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "taskStatus", status: "incomplete" }))} />
            </MenuSubmenu>
            <MenuItem label="增加列表缩进" shortcut="Tab" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "indentList" }))} />
            <MenuItem label="减少列表缩进" shortcut="Shift+Tab" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "outdentList" }))} />
            <MenuSeparator />
            <MenuItem label="水平分割线" onSelect={() => runTopMenuAction(() => runParagraphCommand({ type: "horizontalRule" }))} />
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
            <MenuSubmenu label="图像" panelClassName="image-format-submenu-panel">
              <MenuItem label="插入本地图片..." onSelect={() => runTopMenuAction(() => readFileInput(imageInputRef.current))} />
              <MenuSeparator />
              <MenuItem label="左对齐" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "left" }))} />
              <MenuItem label="居中" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "center" }))} />
              <MenuItem label="右对齐" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageAlign", align: "right" }))} />
              <MenuItem label="恢复原始大小" onSelect={() => runTopMenuAction(() => runFormatCommand({ type: "imageResetSize" }))} />
            </MenuSubmenu>
          </>
        );
      case "view":
        return (
          <>
            <MenuItem label="显示 / 隐藏侧边栏" shortcut="Ctrl+Shift+L" onSelect={() => runTopMenuAction(toggleSidebarVisibility)} />
            <MenuItem label="搜索" shortcut="Ctrl+Shift+F" onSelect={() => runTopMenuAction(openWorkspaceSearch)} />
            <MenuItem label="链接总览" onSelect={() => runTopMenuAction(openKnowledgeRelationsPanel)} />
            <MenuItem label="阅读设置..." onSelect={() => runTopMenuAction(() => openSettings("notes"))} />
            <MenuSubmenu label="编辑模式" testId="menu-editor-mode">
              <MenuItem
                checked={mode === "typora"}
                label="实时渲染"
                testId="menu-mode-typora"
                onSelect={() => runTopMenuAction(() => updateEditorMode("typora"))}
              />
              <MenuItem
                checked={mode === "source"}
                label="源码"
                testId="menu-mode-source"
                onSelect={() => runTopMenuAction(() => updateEditorMode("source"))}
              />
              <MenuItem
                checked={mode === "split"}
                label="分栏"
                testId="menu-mode-split"
                onSelect={() => runTopMenuAction(() => updateEditorMode("split"))}
              />
              <MenuItem
                checked={mode === "preview"}
                label="预览"
                testId="menu-mode-preview"
                onSelect={() => runTopMenuAction(() => updateEditorMode("preview"))}
              />
            </MenuSubmenu>
            <MenuSeparator />
            <MenuItem
              label="沉浸浏览模式"
              shortcut="F11"
              checked={isFullScreen}
              onSelect={() => runTopMenuAction(() => void toggleFullScreen())}
            />
            <MenuItem
              label="保持窗口在最前端"
              checked={isAlwaysOnTop}
              onSelect={() => runTopMenuAction(() => void toggleAlwaysOnTop())}
            />
            <MenuSeparator />
            <MenuItem
              label={`实际大小 (${windowZoomPercent}%)`}
              shortcut="Ctrl+Shift+9"
              checked={isDefaultWindowZoom}
              onSelect={() => runTopMenuAction(() => void runWindowZoomCommand("reset"))}
            />
            <MenuItem
              label="放大"
              shortcut="Ctrl++"
              onSelect={() => runTopMenuAction(() => void runWindowZoomCommand("zoomIn"))}
            />
            <MenuItem
              label="缩小"
              shortcut="Ctrl+Shift+-"
              onSelect={() => runTopMenuAction(() => void runWindowZoomCommand("zoomOut"))}
            />
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
              label="关于 noteDock"
              onSelect={() => runTopMenuAction(() => setIsAboutOpen(true))}
            />
          </>
        );
      default:
        return null;
    }
  }

  const isImmersiveTopRevealed =
    isImmersiveMode && (immersiveRevealEdge === "top" || topMenu !== null);

  function setImmersiveReveal(edge: ImmersiveRevealEdge | null) {
    if (!isImmersiveMode && edge) {
      return;
    }

    setImmersiveRevealEdge((current) => (current === edge ? current : edge));
  }

  function revealImmersiveEdge(edge: ImmersiveRevealEdge) {
    setImmersiveReveal(edge);
  }

  function hideImmersiveEdge(edge: ImmersiveRevealEdge) {
    setImmersiveRevealEdge((current) => (current === edge ? null : current));
  }

  function handleImmersivePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!isImmersiveMode) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const distanceFromTop = event.clientY - bounds.top;
    const nextEdge = distanceFromTop <= immersiveRevealHitSlop ? "top" : null;

    setImmersiveReveal(nextEdge);
  }

  function handleImmersivePointerLeave() {
    setImmersiveReveal(null);
  }

  function handleAppShellMouseDown(event: ReactMouseEvent<HTMLElement>) {
    const root = appShellRef.current;

    if (!root || !(event.target instanceof Node)) {
      uiSelectionScopeRef.current = null;
      return;
    }

    uiSelectionScopeRef.current = getUiSelectionScope(event.target, root);
  }

  function shouldPreserveSelectAllFocus(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "a[href],button,iframe,input,textarea,select,[contenteditable='true']",
        ),
      )
    );
  }

  function focusSelectAllContentScope(event: ReactPointerEvent<HTMLElement>) {
    if (shouldPreserveSelectAllFocus(event.target)) {
      return;
    }

    const contentScope = getSelectAllContentScope(event.target);

    if (contentScope instanceof HTMLElement) {
      contentScope.focus({ preventScroll: true });
    }
  }

  function renderActiveDocumentOutline() {
    if (!activeDocument) {
      return (
        <div className="outline-empty" aria-label="当前文件为空">
          <FileText size={26} />
          <strong>没有当前文件</strong>
          <span>从左侧打开一个文档后，这里会显示正文大纲。</span>
        </div>
      );
    }

    if (!activeDocumentOutline.length) {
      return (
        <div className="outline-empty">
          <FileText size={26} />
          <strong>当前文件没有标题</strong>
          <span>使用 Markdown 标题后，这里会自动生成大纲。</span>
        </div>
      );
    }

    return (
      <div className="outline-tree">
        {activeDocumentOutline.map((entry) => {
          const isHtmlOutline = isHtmlDocument(activeDocument);
          const isActive = isHtmlOutline
            ? activeHtmlOutlineId === entry.id
            : "lineIndex" in entry &&
              activeEditorLineIndex === entry.lineIndex;

          return (
            <button
              className={
                isActive
                  ? "outline-item outline-item-active"
                  : "outline-item"
              }
              data-outline-level={entry.level}
              key={entry.id}
              style={
                {
                  "--outline-depth": `${Math.max(entry.level - 1, 0) * 14}px`,
                } as CSSProperties
              }
              title={
                isHtmlOutline && "anchor" in entry && entry.anchor
                  ? `#${entry.anchor}`
                  : entry.title
              }
              type="button"
              onClick={() => {
                setIsHomeOpen(false);

                if (isHtmlOutline) {
                  htmlDocumentViewerRef.current?.scrollToOutlineEntry(entry.id);
                  setActiveHtmlOutlineId(entry.id);
                  return;
                }

                if ("lineIndex" in entry) {
                  typoraEditorRef.current?.scrollToLine(entry.lineIndex);
                  setActiveEditorLineIndex(entry.lineIndex);
                }
              }}
            >
              <span>{entry.title}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderDiaryDocumentOutline() {
    if (!diaryDocument) {
      return (
        <div className="outline-empty" aria-label="当前日记为空">
          <FileText size={26} />
          <strong>没有当前日记</strong>
          <span>打开或创建一篇日记后，这里会显示正文大纲。</span>
        </div>
      );
    }

    if (!diaryMarkdownOutline.length) {
      return (
        <div className="outline-empty">
          <FileText size={26} />
          <strong>当前日记没有标题</strong>
          <span>写下标题段落后，这里会自动生成日记大纲。</span>
        </div>
      );
    }

    return (
      <div className="outline-tree">
        {diaryMarkdownOutline.map((entry) => {
          const isActive = activeEditorLineIndex === entry.lineIndex;

          return (
            <button
              className={
                isActive
                  ? "outline-item outline-item-active"
                  : "outline-item"
              }
              data-outline-level={entry.level}
              key={entry.id}
              style={
                {
                  "--outline-depth": `${Math.max(entry.level - 1, 0) * 14}px`,
                } as CSSProperties
              }
              title={entry.title}
              type="button"
              onClick={() => {
                setIsHomeOpen(false);
                diaryWorkspaceRef.current?.scrollToLine(entry.lineIndex);
                setActiveEditorLineIndex(entry.lineIndex);
              }}
            >
              <span>{entry.title}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderCurrentDocumentPanel() {
    if (isDiaryOpen) {
      if (!diaryDocument) {
        return (
          <div className="current-document-empty" aria-label="当前日记为空">
            <FileText size={28} />
            <strong>没有当前日记</strong>
            <span>打开或创建一篇日记后查看正文大纲。</span>
          </div>
        );
      }

      return (
        <div className="current-document-panel">
          {renderDiaryDocumentOutline()}
        </div>
      );
    }

    if (!activeDocument) {
      return (
        <div className="current-document-empty" aria-label="当前文件为空">
          <FileText size={28} />
          <strong>没有当前文件</strong>
          <span>从左侧打开一个文档查看大纲与信息。</span>
        </div>
      );
    }

    return (
      <div className="current-document-panel">
        {renderActiveDocumentOutline()}
      </div>
    );
  }

  function renderKnowledgeRelationsPanel() {
    return (
      <KnowledgeRelationsPanel
        filteredItems={filteredWorkspaceRelationItems}
        filter={relationPanelFilter}
        items={visibleWorkspaceRelationItems}
        query={relationPanelQuery}
        stats={workspaceRelationStats}
        onFilterChange={setRelationPanelFilter}
        onOpenDocument={openRelationDocument}
        onOpenFile={(filePath) => {
          void openFileFromTree(filePath);
        }}
        onQueryChange={setRelationPanelQuery}
        onRefresh={() => {
          void refreshWorkspaceSearchDocuments();
        }}
        onRemoveDocumentLink={removeDocumentLinkFromDocument}
      />
    );
  }

  const isCloudExplorerEnabled =
    remoteSyncFeatureEnabled &&
    syncStatus.configuration.enabled &&
    syncStatus.configuration.tokenConfigured;
  const knownDiaryDocumentPathKeys = useMemo(
    () =>
      new Set(
        workspace.documents
          .filter(
            (document) =>
              document.filePath && isDiaryDocumentContent(document.content),
          )
          .map((document) => document.filePath!),
      ),
    [workspace.documents],
  );
  const localExplorerTree = useMemo(
    () =>
      isCloudWorkspace
        ? null
        : removeDiaryRootFromDirectoryTree(
            directoryTree,
            workspace.workspacePath,
            knownDiaryDocumentPathKeys,
          ),
    [
      directoryTree,
      isCloudWorkspace,
      knownDiaryDocumentPathKeys,
      workspace.workspacePath,
    ],
  );
  const localExplorerDocuments = useMemo(
    () =>
      isCloudWorkspace
        ? []
        : workspace.documents.filter(
          (document) =>
              !isPathInsideDiaryRoot(document.filePath, workspace.workspacePath) &&
              !isDiaryDocumentContent(document.content),
          ),
    [isCloudWorkspace, workspace.documents, workspace.workspacePath],
  );
  const windowZoomPercent = Math.round(windowZoomFactor * 100);
  const isDefaultWindowZoom =
    Math.abs(windowZoomFactor - defaultWindowZoomFactor) < 0.005;
  const appMenuState = useMemo<AppMenuState>(
    () => ({
      activeDocument: Boolean(activeDocument),
      alwaysOnTop: isAlwaysOnTop,
      canOpenHistory: historyBrowserDocuments.length > 0,
      defaultZoom: isDefaultWindowZoom,
      editorMode: mode,
      fullScreen: isFullScreen,
      markdownDocument: isMarkdownDocument(activeDocument),
      recentDocuments: recentDocuments.slice(0, 10).map((document) => ({
        exists: document.filePath
          ? recentFileAvailability[document.filePath] !== false
          : true,
        id: document.id,
        label: getDocumentDisplayName(document),
        pathLabel: getDocumentDisplayPath(document),
      })),
      theme,
      windowZoomPercent,
    }),
    [
      activeDocument,
      historyBrowserDocuments.length,
      isAlwaysOnTop,
      isDefaultWindowZoom,
      isFullScreen,
      mode,
      recentDocuments,
      recentFileAvailability,
      theme,
      windowZoomPercent,
    ],
  );

  useEffect(() => {
    if (!isMac) {
      return;
    }

    void window.desktop?.updateAppMenuState?.(appMenuState);
  }, [appMenuState, isMac]);

  const isStorageSplitVisible = isCloudExplorerEnabled;
  const storageSectionsClassName = [
    "explorer-storage-sections",
    isStorageSplitVisible
      ? "explorer-storage-sections-split"
      : "explorer-storage-sections-single",
    isStorageSplitResizing ? "explorer-storage-sections-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const storageSectionsStyle = isStorageSplitVisible
    ? ({
        gridTemplateRows: `minmax(${minStorageSectionHeight}px, ${storageSplitRatio}fr) 10px minmax(${minStorageSectionHeight}px, ${1 - storageSplitRatio}fr)`,
      } as CSSProperties)
    : undefined;
  const enabledSidebarTabOrder = settings.homeShowDiaryPanel
    ? settings.sidebarTabOrder
    : settings.sidebarTabOrder.filter((tab) => tab !== "diary");
  const sidebarTabRenderOrder = sidebarTabDrag?.isDragging
    ? getReorderedSidebarTabOrder(
        enabledSidebarTabOrder,
        sidebarTabDrag.draggedTab,
        sidebarTabDrag.targetIndex,
      )
    : enabledSidebarTabOrder;
  const activeSidebarTab =
    sidebarTab === "search" ? "current" : sidebarTab;

  function renderStorageExplorerSection({
    documents,
    emptyAction,
    emptyDescription,
    emptyIcon,
    emptyTitle,
    kind,
    label,
    headingActions,
    isBusy = false,
    tree,
    viewMode = fileExplorerView,
    workspacePath,
  }: {
    documents: MarkdownDocument[];
    emptyAction?: ReactNode;
    emptyDescription: string;
    emptyIcon: ReactNode;
    emptyTitle: string;
    kind: SidebarStorageKind;
    label: string;
    headingActions?: ReactNode;
    isBusy?: boolean;
    tree: DirectoryTreeItem | null;
    viewMode?: FileExplorerView;
    workspacePath?: string;
  }) {
    const isDropTarget = sidebarDropTarget === kind;
    const treeChildren = tree?.children ?? [];
    const hasStorageItems = treeChildren.length > 0;
    const isCloudSelectionMode =
      kind === "cloud" && isCloudMultiSelectEnabled;

    return (
      <section
        className={[
          "explorer-storage-section",
          `explorer-storage-section-${kind}`,
          hasStorageItems ? "" : "explorer-storage-section-empty",
          isDropTarget ? "explorer-storage-section-drop-target" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={label}
        onDragLeave={handleSidebarStorageDragLeave}
        onDragOver={(event) => handleSidebarStorageDragOver(event, kind)}
        onDrop={(event) => void dropSidebarEntryToStorage(event, kind)}
        onContextMenu={(event) => {
          if (event.defaultPrevented) {
            return;
          }

          const target = event.target as HTMLElement | null;

          if (
            target?.closest(
              "button,a,[role='button'],.directory-tree-folder,.directory-tree-file,.directory-file-list-item",
            )
          ) {
            return;
          }

          if (kind === "cloud") {
            openCloudStorageContextMenu(event, workspacePath);
            return;
          }

          openLocalStorageContextMenu(event, workspacePath);
        }}
      >
        <div className="explorer-storage-heading">
          <div className="explorer-storage-heading-title">
          <span>{emptyIcon}</span>
          <strong>{label}</strong>
          {isBusy ? <small>导入中</small> : null}
          </div>
          {headingActions ? (
            <div className="explorer-storage-heading-actions">
              {headingActions}
            </div>
          ) : null}
        </div>
        {hasStorageItems ? (
          viewMode === "tree" ? (
            <div className="explorer-storage-tree-scroll">
              {isDropTarget && sidebarDirectoryDragPreview ? (
                <div
                  className={[
                    "directory-tree-file",
                    "directory-tree-drop-preview",
                    "directory-tree-root-drop-preview",
                    sidebarDirectoryDragPreview.entryType === "directory"
                      ? "directory-tree-drop-preview-directory"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--tree-depth": "0px" } as CSSProperties}
                >
                  <span className="directory-tree-caret-placeholder" />
                  {sidebarDirectoryDragPreview.entryType === "directory" ? (
                    <Folder size={17} />
                  ) : (
                    <FileText size={17} />
                  )}
                  <span>{sidebarDirectoryDragPreview.name}</span>
                </div>
              ) : null}
              <DirectoryTreeItems
                activeDirectoryPath={getDirectoryPath(activeDocument?.filePath)}
                activeFilePath={activeDocument?.filePath}
                directoryDragPreview={sidebarDirectoryDragPreview}
                directoryDropTargetPath={sidebarDirectoryDropTargetPath}
                expandedPaths={
                  kind === "cloud"
                    ? expandedCloudDirectoryPaths
                    : expandedDirectoryPaths
                }
                isSelectionMode={isCloudSelectionMode}
                items={treeChildren}
                level={0}
                onDirectoryContextMenu={openDirectoryContextMenu}
                onDirectoryDragOver={(event, item) =>
                  handleSidebarDirectoryDragOver(event, item, kind)
                }
                onDirectoryDrop={(event, item) =>
                  void dropSidebarEntryToDirectory(event, item.path, kind)
                }
                onFileContextMenu={openFileContextMenu}
                onItemDragEnd={clearSidebarDragState}
                onItemDragStart={(event, item) =>
                  startSidebarEntryDrag(event, {
                    entryType: item.type,
                    path: item.path,
                    source: kind,
                  })
                }
                onCancelRename={cancelRenamingEntry}
                onCommitRename={(entryPath) => void commitRenamingEntry(entryPath)}
                onRenameDraftChange={setRenameDraft}
                onToggleEntrySelection={toggleCloudEntrySelection}
                onOpenFile={(filePath) => {
                  void openFileFromTree(filePath);
                }}
                onToggleDirectory={
                  kind === "cloud" ? toggleCloudDirectoryPath : toggleDirectoryPath
                }
                renameDraft={renameDraft}
                renamingEntryPath={renamingEntryPath ?? undefined}
                selectedEntryPaths={selectedCloudEntryPaths}
              />
            </div>
          ) : (
            <DirectoryFileList
              activeFilePath={activeDocument?.filePath}
              documents={documents}
              isSelectionMode={isCloudSelectionMode}
              items={treeChildren}
              workspacePath={workspacePath}
              onFileContextMenu={openFileContextMenu}
              onFileDragEnd={clearSidebarDragState}
              onFileDragStart={(event, filePath) =>
                startSidebarEntryDrag(event, {
                  entryType: "file",
                  path: filePath,
                  source: kind,
                })
              }
              onCancelRename={cancelRenamingEntry}
              onCommitRename={(entryPath) => void commitRenamingEntry(entryPath)}
              onRenameDraftChange={setRenameDraft}
              onToggleEntrySelection={toggleCloudEntrySelection}
              onOpenFile={(filePath) => {
                void openFileFromTree(filePath);
              }}
              renameDraft={renameDraft}
              renamingEntryPath={renamingEntryPath ?? undefined}
              selectedEntryPaths={selectedCloudEntryPaths}
            />
          )
        ) : (
          <div className="explorer-empty explorer-storage-empty">
            {emptyIcon}
            <strong>{emptyTitle}</strong>
            <span>{emptyDescription}</span>
            {kind === "cloud" ? null : emptyAction}
          </div>
        )}
      </section>
    );
  }

  function renderDocumentKnowledgeBar({
    isEditorCloseVisible = true,
    isEditorHeaderVisible = true,
    isEditorOpen,
    onSetEditorOpen,
    showContentLinks = true,
    showMissingRelations = true,
  }: {
    isEditorCloseVisible?: boolean;
    isEditorHeaderVisible?: boolean;
    isEditorOpen: boolean;
    onSetEditorOpen: (isOpen: boolean) => void;
    showContentLinks?: boolean;
    showMissingRelations?: boolean;
  }) {
    return (
      <DocumentKnowledgeBar
        activeDocument={activeDocument}
        activeSuggestion={activeMetadataSuggestion}
        backlinks={activeBacklinks}
        isEditorCloseVisible={isEditorCloseVisible}
        isEditorHeaderVisible={isEditorHeaderVisible}
        isEditorOpen={isEditorOpen}
        knowledge={activeDocumentKnowledge}
        missingLinks={activeMissingLinks}
        newTagName={newTagName}
        outgoingLinks={activeOutgoingLinks}
        propertyKeyDraft={propertyKeyDraft}
        propertyKeySuggestions={propertyKeySuggestions}
        propertyValueDraft={propertyValueDraft}
        propertyValueSuggestions={propertyValueSuggestions}
        relatedDocuments={activeRelatedDocuments}
        showContentLinks={showContentLinks}
        showMissingRelations={showMissingRelations}
        tagSuggestions={tagSuggestions}
        wikiLinkInputRef={wikiLinkInputRef}
        wikiLinkTargetDraft={wikiLinkTargetDraft}
        onAddTag={addActiveDocumentTag}
        onCreateMissingWikiLink={(target) => {
          void createDocumentFromMissingWikiLink(target);
        }}
        onInsertWikiLink={insertWikiLinkFromDraft}
        onOpenDocument={openKnowledgeDocument}
        onOpenDocumentLinkPicker={() => openDocumentLinkPicker()}
        onOpenRelatedDocument={(reference) => {
          void openRelatedDocument(reference);
        }}
        onOpenWikiLinkInsertForm={openWikiLinkInsertForm}
        onRemoveDocumentLink={removeActiveDocumentLink}
        onRemoveProperty={removeActiveDocumentProperty}
        onRemoveTag={removeActiveDocumentTag}
        onSaveProperty={saveActiveDocumentProperty}
        onSetActiveSuggestion={setActiveMetadataSuggestion}
        onSetEditorOpen={onSetEditorOpen}
        onSetNewTagName={setNewTagName}
        onSetPropertyKeyDraft={setPropertyKeyDraft}
        onSetPropertyValueDraft={setPropertyValueDraft}
        onSetWikiLinkTargetDraft={setWikiLinkTargetDraft}
      />
    );
  }
  const inspectorKnowledgePanel = renderDocumentKnowledgeBar({
    isEditorCloseVisible: false,
    isEditorHeaderVisible: false,
    isEditorOpen: true,
    onSetEditorOpen: () => {},
    showContentLinks: false,
    showMissingRelations: false,
  });
  return (
    <>
      <main
        ref={appShellRef}
        data-testid="app-shell"
        className={[
          "app-shell",
          `app-shell-platform-${desktopPlatform}`,
          isSidebarHidden ? "app-shell-sidebar-collapsed" : "",
          isDocumentInspectorOpen ? "app-shell-inspector-open" : "",
          isImmersiveMode ? "app-shell-immersive" : "",
          isImmersiveTopRevealed ? "app-shell-immersive-reveal-top" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          {
            "--sidebar-width": `${isSidebarHidden ? 0 : sidebarWidth}px`,
            "--sidebar-panel-width": `${sidebarWidth}px`,
            "--inspector-width": isDocumentInspectorOpen
              ? `${inspectorWidth}px`
              : "0px",
          } as CSSProperties
        }
        onMouseDown={handleAppShellMouseDown}
        onPointerMove={handleImmersivePointerMove}
        onPointerLeave={handleImmersivePointerLeave}
      >
        <AppMenubar
          appLogoUrl={appLogoUrl}
          contentActions={
            shouldShowWorkspaceDocumentActions ? workspaceContentActions : []
          }
          contentDirty={workspaceContentDirty}
          contentKind={menubarContentKind}
          contentTitle={menubarContentTitle}
          contentTitleDetail={workspaceActionFilePath || menubarContentTitle}
          isFullScreen={isFullScreen}
          isMaximized={isMaximized}
          onCloseContent={
            shouldShowWorkspaceDocumentActions ? closeActiveDocument : undefined
          }
          onHideTop={() => hideImmersiveEdge("top")}
          onOpenHome={() => {
            setIsDiaryOpen(false);
            setIsHomeOpen(true);
          }}
          onRevealTop={() => revealImmersiveEdge("top")}
          platform={desktopPlatform}
          renderDropdown={renderMenubarDropdown}
          setTopMenu={setTopMenu}
          topMenu={topMenu}
        />

        {isImmersiveMode && (
          <div
            className="immersive-reveal-zone immersive-reveal-zone-top"
            aria-hidden="true"
            onPointerEnter={() => revealImmersiveEdge("top")}
            onPointerMove={() => revealImmersiveEdge("top")}
          />
        )}

        {sidebarResizePreviewX !== null ? (
          <div
            className="sidebar-resize-preview"
            aria-hidden="true"
            style={
              {
                "--sidebar-resize-preview-x": `${sidebarResizePreviewX}px`,
              } as CSSProperties
            }
          />
        ) : null}
        {inspectorResizePreviewX !== null ? (
          <div
            className="inspector-resize-preview"
            aria-hidden="true"
            style={
              {
                "--inspector-resize-preview-x": `${inspectorResizePreviewX}px`,
              } as CSSProperties
            }
          />
        ) : null}

        <aside className="sidebar explorer-sidebar" aria-hidden={isSidebarHidden}>
          <div
            className="explorer-tabs"
            role="tablist"
            aria-label="侧边栏视图"
            style={
              {
                "--explorer-tab-count": sidebarTabRenderOrder.length,
              } as CSSProperties
            }
          >
            {sidebarTabRenderOrder.map((tab) => {
              const isActive = activeSidebarTab === tab;
              const isDragged = sidebarTabDrag?.draggedTab === tab;

              return (
                <button
                  className={[
                    "explorer-tab",
                    `explorer-tab-${tab}`,
                    isActive ? "explorer-tab-active" : "",
                    isDragged && sidebarTabDrag?.isDragging
                      ? "explorer-tab-dragging"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={tab}
                  ref={(node) => setSidebarTabButtonRef(tab, node)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => activateSidebarTab(tab)}
                  onPointerCancel={cancelSidebarTabDrag}
                  onPointerDown={(event) => startSidebarTabDrag(event, tab)}
                  onPointerMove={moveSidebarTabDrag}
                  onPointerUp={finishSidebarTabDrag}
                >
                  {getSidebarTabLabel(tab)}
                </button>
              );
            })}
          </div>

          <div
            className="explorer-tree"
            aria-label={
              sidebarTab === "diary"
                ? "日记"
                : sidebarTab === "files"
                ? "文件目录"
                : sidebarTab === "search"
                  ? "查找"
                  : "当前文件"
            }
          >
            {sidebarTab === "diary" ? (
              <Suspense fallback={null}>
                <DiarySidebarPanel
                  document={diaryDocument}
                  entries={diaryEntries}
                  groups={diaryGroups}
                  onCreateDate={(dateKey) => void confirmCreateDiaryForDate(dateKey)}
                  onCreateToday={() => void createTodayDiary()}
                  onDeleteEntry={(entry) => void deleteDiaryEntry(entry)}
                  onOpenEntry={(entry) => void openDiaryEntry(entry)}
                  workspacePath={workspace.workspacePath}
                />
              </Suspense>
            ) : sidebarTab === "files" ? (
              <div
                ref={storageSectionsRef}
                className={storageSectionsClassName}
                style={storageSectionsStyle}
              >
                {renderStorageExplorerSection({
                  documents: localExplorerDocuments,
                  emptyAction: localExplorerTree ? (
                    <button type="button" onClick={createNewDocument}>
                      新建 Markdown 文件
                    </button>
                  ) : (
                    <button type="button" onClick={() => void openWorkspaceFolder()}>
                      打开文件夹
                    </button>
                  ),
                  emptyDescription: localExplorerTree
                    ? "当前文件夹中没有找到可打开的文档"
                    : "打开目录后，会递归读取并显示其中的 .md、.html、.pdf、.docx、.univer、.excalidraw 文件",
                  emptyIcon: <FolderOpen size={22} />,
                  emptyTitle: localExplorerTree ? workspaceLabel : "选择本地文件夹",
                  kind: "local",
                  label: "本地文档",
                  tree: localExplorerTree,
                  workspacePath: workspace.workspacePath,
                })}
                {isStorageSplitVisible ? (
                  <div
                    className="explorer-storage-split-resizer"
                    role="separator"
                    aria-label="调整本地文档和云端文档显示区域"
                    aria-orientation="horizontal"
                    onPointerDown={startStorageSplitResize}
                  />
                ) : null}
                {isCloudExplorerEnabled
                  ? renderStorageExplorerSection({
                      documents: cloudSidebarWorkspace?.documents ?? [],
                      headingActions: (
                        <>
                          <button
                            className="explorer-storage-heading-button"
                            type="button"
                            aria-label="新建云端文件夹"
                            title="新建云端文件夹"
                            disabled={isCloudDirectoryCreating}
                            onClick={() => void createCloudDirectory()}
                          >
                            <FolderPlus size={15} />
                          </button>
                          <button
                            className={[
                              "explorer-storage-heading-button",
                              isCloudMultiSelectEnabled
                                ? "explorer-storage-heading-button-active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            type="button"
                            aria-label={
                              isCloudMultiSelectEnabled ? "退出多选" : "多选云端文档"
                            }
                            aria-pressed={isCloudMultiSelectEnabled}
                            title={
                              isCloudMultiSelectEnabled ? "退出多选" : "多选云端文档"
                            }
                            onClick={toggleCloudMultiSelect}
                          >
                            <ListChecks size={15} />
                          </button>
                          {isCloudMultiSelectEnabled ? (
                            <button
                              className={[
                                "explorer-storage-heading-button",
                                areAllCloudEntriesSelected
                                  ? "explorer-storage-heading-button-active"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              type="button"
                              aria-label={
                                areAllCloudEntriesSelected
                                  ? "清空云端文档选择"
                                  : "全选云端文档"
                              }
                              aria-pressed={areAllCloudEntriesSelected}
                              title={
                                areAllCloudEntriesSelected
                                  ? "清空选择"
                                  : "全选云端文档"
                              }
                              disabled={!cloudSelectableEntryPaths.length}
                              onClick={toggleSelectAllCloudEntries}
                            >
                              {areAllCloudEntriesSelected ? (
                                <Square size={15} />
                              ) : (
                                <Check size={15} />
                              )}
                            </button>
                          ) : null}
                          <button
                            className="explorer-storage-heading-button"
                            type="button"
                            aria-label={
                              selectedCloudEntryPaths.size > 0
                                ? `导出选中的 ${selectedCloudEntryPaths.size} 项`
                                : "导出全部云端文档"
                            }
                            title={
                              selectedCloudEntryPaths.size > 0
                                ? `导出选中的 ${selectedCloudEntryPaths.size} 项`
                                : "导出全部云端文档"
                            }
                            disabled={
                              isCloudExporting ||
                              !cloudSidebarWorkspace ||
                              !cloudSelectableEntryPaths.length
                            }
                            onClick={() => void exportCloudEntriesToLocal()}
                          >
                            <Download size={15} />
                          </button>
                          {isCloudMultiSelectEnabled &&
                          selectedCloudEntryPaths.size > 0 ? (
                            <button
                              className="explorer-storage-heading-button explorer-storage-heading-button-danger"
                              type="button"
                              aria-label={`删除选中的 ${selectedCloudEntryPaths.size} 项`}
                              title={`删除选中的 ${selectedCloudEntryPaths.size} 项`}
                              onClick={() => void deleteSelectedCloudEntries()}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                          <button
                            className="explorer-storage-heading-button"
                            type="button"
                            aria-label="刷新云端"
                            title="刷新云端"
                            onClick={() =>
                              void refreshCloudSidebarWorkspaceFromCache()
                            }
                          >
                            <RefreshCw size={15} />
                          </button>
                        </>
                      ),
                      emptyAction: (
                        <button
                          type="button"
                          onClick={() => void refreshCloudSidebarWorkspaceFromCache()}
                        >
                          刷新云端
                        </button>
                      ),
                      emptyDescription: cloudSidebarWorkspace
                        ? "可以把本地文件或文件夹拖到这里导入云端。"
                        : "正在等待云端工作区，登录后会显示云端文档。",
                      emptyIcon: <Cloud size={22} />,
                      emptyTitle: cloudSidebarWorkspace
                        ? "云端暂无文档"
                        : "云端文档",
                      kind: "cloud",
                      label: "云端文档",
                      isBusy: isCloudImporting,
                      tree: cloudSidebarWorkspace?.tree ?? null,
                      workspacePath: cloudSidebarWorkspace?.directoryPath,
                    })
                  : null}
              </div>
            ) : sidebarTab === "search" ? (
              <Suspense fallback={null}>
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
              </Suspense>
            ) : (
              renderCurrentDocumentPanel()
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
              <button type="button" onClick={openInspirationNote}>
                <ClipboardPaste size={16} />
                灵感便签
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
              {isCloudWorkspace ? <Cloud size={14} /> : null}
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
            <button
              className="explorer-footer-icon-button"
              type="button"
              aria-label="打开设置"
              title="打开设置"
              onClick={() => openSettings("app")}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </aside>

        <div
          className={[
            "sidebar-resizer",
            isSidebarHidden ? "sidebar-resizer-collapsed" : "",
            isSidebarResizing ? "sidebar-resizer-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onDoubleClick={toggleSidebarVisibility}
          onPointerDown={startSidebarResize}
        />

        <section className="workspace">
          {isDiaryOpen ? (
            <Suspense
              fallback={
                <section className="standalone-document-viewer" tabIndex={-1}>
                  <div className="document-loading-inline">
                    <DocumentLoadingIndicator title="正在打开日记" />
                  </div>
                </section>
              }
            >
              <DiaryWorkspace
                ref={diaryWorkspaceRef}
                document={diaryDocument}
                editorMode={mode}
                metadata={diaryMetadata}
                moodOptions={diaryMoodValues}
                onChange={updateDiaryMarkdown}
                onCopyImage={(image) => copyDiaryTyporaImageToClipboard(image)}
                onCreateToday={() => void createTodayDiary()}
                onEditorContextMenu={openDiaryEditorMediaContextMenu}
                onMoodChange={updateDiaryMood}
                onPaste={handleDiaryPaste}
                onPreviewImage={openDocumentImagePreview}
                onRequestTableInsert={openTableInsertDialog}
                onTagsChange={updateDiaryTags}
                onTemplateChange={updateDiaryTemplate}
                templateOptions={diaryTemplateOptions}
                workspacePath={workspace.workspacePath}
              />
            </Suspense>
          ) : isHomeOpen || !activeDocument ? (
              <HomeWorkspace
                activeDocument={activeDocument}
                logoUrl={appLogoUrl}
              noteDialogRequestId={homeNoteDialogRequestId}
              onClearRecentDocuments={clearRecentDocuments}
              onCreateDocument={createNewDocument}
                onOpenKnowledgeRelations={openKnowledgeRelationsPanel}
              onOpenRecentDocument={openRecentDocument}
              onOpenRecentDocumentContextMenu={(event, document) => {
                if (document.filePath) {
                  openFileContextMenu(event, document.filePath);
                }
              }}
              onOpenWorkspaceFolder={openWorkspaceFolder}
              getDocumentPathLabel={getDocumentDisplayPath}
              recentDocuments={recentDocuments}
              showNotePanel={settings.homeShowNotePanel}
              showTodoPanel={settings.homeShowTodoPanel}
              workspacePath={workspace.workspacePath}
            />
          ) : (            <section
              className="editor-workspace"
              data-select-all-scope="content"
              onPointerDownCapture={focusSelectAllContentScope}
              tabIndex={-1}
            >
              <Suspense
                fallback={
                  isMarkdownDocument(activeDocument) ? null : (
                  <section
                    className="standalone-document-viewer"
                    data-select-all-scope="content"
                    tabIndex={-1}
                  >
                    <div className="document-loading-inline">
                      <DocumentLoadingIndicator
                        title="正在加载阅读器"
                        detail={
                          activeDocument
                            ? getDocumentDisplayName(activeDocument)
                            : undefined
                        }
                      />
                    </div>
                  </section>
                  )
                }
              >
              {isHtmlDocument(activeDocument) ? (
                <HtmlDocumentViewer
                  ref={htmlDocumentViewerRef}
                  document={activeDocument}
                  onActiveOutlineChange={setActiveHtmlOutlineId}
                  onAppShortcut={(shortcut) => {
                    const action = getAppShortcutAction(shortcut, {
                      isEditorTarget: false,
                      isFullScreen,
                    });

                    if (action) {
                      runAppShortcutAction(action);
                    }
                  }}
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
              ) : isExcelDocument(activeDocument) ? (
                <ExcelDocumentViewer document={activeDocument} />
              ) : isSheetDocument(activeDocument) ? (
                <section
                  className="standalone-document-viewer standalone-sheet-viewer"
                  data-select-all-scope="content"
                  tabIndex={-1}
                >
                  <UniverSheetPreview
                    code={activeDocument.content}
                    filePath={activeDocument.filePath}
                    maxPreviewRows={80}
                    onEdit={(code) =>
                      void openUniverSheetEditor({ kind: "document" }, code)
                    }
                    searchQuery={findQuery}
                  />
                </section>
              ) : isDrawingDocument(activeDocument) ? (
                <DrawingDocumentViewer
                  document={activeDocument!}
                  displayName={getDocumentDisplayName(activeDocument!)}
                  onEdit={() => setDrawingDialogOpen(true)}
                />
              ) : false ? (
                <section
                  className="standalone-document-viewer standalone-drawing-viewer"
                  data-select-all-scope="content"
                  tabIndex={-1}
                >
                  <div className="standalone-document-card">
                    <FileText size={26} />
                    <div>
                      <h2>
                        {activeDocument ? getDocumentDisplayName(activeDocument!) : ""}
                      </h2>
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
                <div
                  data-testid="editor-layout"
                  className={[
                    "editor-layout",
                    `editor-layout-${mode}`,
                    isEditorDraggingMedia ? "editor-layout-drop-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onDragLeave={handleEditorDragLeave}
                  onDragOver={handleEditorDragOver}
                  onDrop={handleEditorDrop}
                >
                  {isEditorDraggingMedia && (
                    <div className="editor-drop-overlay" aria-hidden="true">
                      <div>
                        <strong>释放以插入媒体</strong>
                        <span>支持 MP4、MOV、WebM、MKV 等常见视频格式</span>
                      </div>
                    </div>
                  )}
                  {mode === "typora" && (
                    <TyporaEditor
                      ref={typoraEditorRef}
                      documentId={activeDocument.id}
                      filePath={activeDocument.filePath}
                      value={activeMarkdownBody}
                      onChange={updateMarkdown}
                      onActiveLineChange={setActiveEditorLineIndex}
                      onCopyImage={(image) => copyTyporaImageToClipboard(image)}
                      onEditDrawing={(drawingId) => void openDrawingEditor(drawingId)}
                      onEditUniverSheet={(code) =>
                        void openUniverSheetEditor({ code, kind: "markdown" }, code)
                      }
                      onContextMenu={openEditorContextMenu}
                      onPaste={handlePaste}
                      onPreviewImage={openDocumentImagePreview}
                      onRequestDocumentReference={openDocumentReferencePicker}
                      onRequestTableInsert={openTableInsertDialog}
                    />
                  )}

                  {(mode === "source" || mode === "split") && (
                    <textarea
                      ref={editorRef}
                      data-testid="source-editor"
                      className="markdown-input"
                      spellCheck={false}
                      value={activeDocument.content}
                      onChange={(event) => updateMarkdown(event.target.value)}
                      onContextMenu={openEditorContextMenu}
                      onCopyCapture={handleSourceCopy}
                      onPaste={handlePaste}
                    />
                  )}

                  {(mode === "split" || mode === "preview") && (
                    <article
                      className="markdown-preview"
                      data-testid="markdown-preview"
                      data-select-all-scope="content"
                      onContextMenu={openEditorContextMenu}
                      tabIndex={-1}
                    >
                      <MarkdownRenderer
                        filePath={activeDocument.filePath}
                        onEditMindMap={(code) =>
                          openMindMapEditor({ code, kind: "markdown" }, code)
                        }
                        onEditReactFlow={(code) =>
                          openReactFlowEditor({ code, kind: "markdown" }, code)
                        }
                        onEditUniverSheet={(code) =>
                          void openUniverSheetEditor({ code, kind: "markdown" }, code)
                        }
                        onOpenWikiLink={(target) => {
                          void openWikiLinkTarget(target);
                        }}
                        onPreviewImage={openDocumentImagePreview}
                      >
                        {activeMarkdownBody}
                      </MarkdownRenderer>
                    </article>
                  )}
                </div>
              )}
              </Suspense>
            </section>
          )}
          {documentLoadingState ? (
            <div className="document-loading-overlay">
              <DocumentLoadingIndicator
                title={documentLoadingState.title}
                detail={documentLoadingState.detail}
              />
            </div>
          ) : null}
          <WorkspaceStatusBar
            activeDocument={isDiaryOpen ? diaryDocument : activeDocument}
            isInspectorOpen={isDiaryOpen ? false : isDocumentInspectorOpen}
            isSidebarHidden={isSidebarHidden}
            missingAssetReferences={isDiaryOpen ? [] : missingAssetReferences}
            saveState={isDiaryOpen ? diarySaveState : saveState}
            syncStatus={
              !isDiaryOpen && remoteSyncFeatureEnabled ? syncStatus : undefined
            }
            wordCount={isDiaryOpen ? diaryDocumentWordCount : activeDocumentWordCount}
            onConfigureSync={
              !isDiaryOpen && remoteSyncFeatureEnabled
                ? () => openSettings("sync")
                : undefined
            }
            onOpenSyncMenu={
              !isDiaryOpen && remoteSyncFeatureEnabled ? openSyncStatusMenu : undefined
            }
            onSyncNow={!isDiaryOpen && remoteSyncFeatureEnabled ? syncNow : undefined}
            onToggleInspector={isDiaryOpen ? undefined : toggleDocumentInspector}
            onToggleSidebar={toggleSidebarVisibility}
          />
        </section>

        {isDocumentInspectorOpen ? (
          <div
            className={[
              "inspector-resizer",
              isInspectorResizing ? "inspector-resizer-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="separator"
            aria-label="Resize inspector"
            aria-orientation="vertical"
            onPointerDown={startInspectorResize}
          />
        ) : null}

        {isDocumentInspectorOpen ? (
          <Suspense fallback={null}>
            <DocumentInspectorSidebar
              activeDocument={activeDocument}
              isOpen={isDocumentInspectorOpen}
              knowledgePanel={inspectorKnowledgePanel}
              relationsPanel={renderKnowledgeRelationsPanel()}
            />
          </Suspense>
        ) : null}

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

        {contextMenu ? (
          <div
            className="app-context-menu"
            role="menu"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              width: contextMenu.width,
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {contextMenu.items.map((item, index) =>
              item.type === "separator" ? (
                <div
                  className="app-context-menu-separator"
                  key={`separator-${index}`}
                  role="separator"
                />
              ) : item.type === "label" ? (
                <div
                  className="app-context-menu-heading"
                  key={`${item.label}-${index}`}
                  role="presentation"
                >
                  <span className="app-context-menu-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="app-context-menu-label">{item.label}</span>
                </div>
              ) : item.type === "iconGroup" ? (
                <div
                  className="app-context-menu-icon-group-row"
                  key={`${item.label}-${index}`}
                  role="group"
                  aria-label={item.label}
                >
                  <span className="app-context-menu-icon-group-label">
                    {item.label}
                  </span>
                  <span className="app-context-menu-icon-group">
                    {item.actions.map((action) => (
                      <button
                        className={
                          action.active
                            ? "app-context-menu-icon-option app-context-menu-icon-option-active"
                            : "app-context-menu-icon-option"
                        }
                        key={action.label}
                        type="button"
                        aria-label={action.label}
                        aria-pressed={Boolean(action.active)}
                        title={action.label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => runContextMenuIconAction(action)}
                      >
                        {action.icon}
                      </button>
                    ))}
                  </span>
                </div>
              ) : (
                <button
                  className={item.danger ? "app-context-menu-danger" : undefined}
                  disabled={item.disabled}
                  key={`${item.label}-${index}`}
                  role="menuitem"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runContextMenuItem(item)}
                >
                  <span className="app-context-menu-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="app-context-menu-label">{item.label}</span>
                  {item.shortcut ? (
                    <kbd className="app-context-menu-shortcut">{item.shortcut}</kbd>
                  ) : null}
                </button>
              ),
            )}
          </div>
        ) : null}

        <Dialog.Root open={isDrawingOpen} onOpenChange={setDrawingDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay canvas-dialog-overlay" />
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
                    onInsert={async (asset: DrawingAsset) => {
                      const document = activeDocument;

                      if (!document) {
                        return;
                      }

                      if (isDrawingDocument(document)) {
                        patchActiveDocument({
                          content: asset.sceneJSON,
                          title: asset.name || document.title,
                        });
                        return;
                      }

                      if (!isMarkdownDocument(document)) {
                        return;
                      }

                      const shouldUpdatePreview = Boolean(editingDrawingAsset);
                      const existingImage = shouldUpdatePreview
                        ? findExcalidrawMarkdownImage(document.content, asset.id)
                        : null;
                      const sceneReference = await saveTextAssetForDocument(
                        document,
                        `${asset.name || "excalidraw"}.excalidraw.json`,
                        asset.sceneJSON,
                        existingImage?.sceneReference ?? undefined,
                      );
                      const previewReference = await saveDataUrlAssetForDocument(
                        document,
                        `${asset.name || "excalidraw"}.png`,
                        asset.dataUrl,
                      );
                      const storedAsset: DrawingAsset = {
                        ...asset,
                        dataUrl: previewReference,
                        sceneReference: sceneReference ?? undefined,
                      };
                      const nextContent = shouldUpdatePreview
                        ? replaceExcalidrawImagePreview(document.content, storedAsset)
                        : document.content;

                      patchActiveDocument({
                        content: nextContent,
                        drawings: {
                          ...document.drawings,
                          [storedAsset.id]: storedAsset,
                        },
                        title:
                          document.filePath
                            ? getDocumentTitleFromFilePath(document.filePath)
                            : renameFromMarkdown(nextContent, document.title),
                      });
                      if (!shouldUpdatePreview) {
                        const title = createExcalidrawImageTitle(
                          storedAsset.id,
                          storedAsset.sceneReference ?? null,
                        );
                        insertMarkdown(
                          `![${storedAsset.name}](${storedAsset.dataUrl} "${title}") `,
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
                  <button
                    className="icon-button"
                    data-testid="find-close"
                    type="button"
                    aria-label="关闭查找"
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="find-dialog-body">
                <label className="find-field">
                  <span>查找</span>
                  <input
                    autoFocus
                    data-testid="find-input"
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

        <Dialog.Root
          modal={false}
          open={isDocumentLinkPickerOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsDocumentLinkPickerOpen(true);
            } else {
              closeDocumentLinkPicker();
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Content
              className="document-link-picker-dialog"
              onPointerDownOutside={() => closeDocumentLinkPicker()}
            >
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon">
                    <BookOpenText size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      {documentLinkPickerMode === "insertReference"
                        ? "插入引用文档"
                        : "相关文档"}
                    </Dialog.Title>
                    <Dialog.Description>
                      {documentLinkPickerMode === "insertReference"
                        ? "从当前工作区选择文件，作为行内文档引用插入到正文。"
                        : "从当前工作区选择文件，添加到正在编辑的文档元信息中。"}
                    </Dialog.Description>
                    {documentLinkPickerSourceDocument ? (
                      <p className="document-link-picker-source">
                        {documentLinkPickerMode === "insertReference"
                          ? "插入到："
                          : "关联到："}
                        <strong>
                          {getDocumentDisplayName(documentLinkPickerSourceDocument)}
                        </strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="document-link-picker-search">
                <Search size={16} />
                <input
                  autoFocus
                  value={documentLinkQuery}
                  onChange={(event) => setDocumentLinkQuery(event.target.value)}
                  placeholder="搜索文件名、路径或类型"
                />
              </div>

              <div className="document-link-picker-list" role="listbox">
                {filteredLinkableDocuments.length ? (
                  filteredLinkableDocuments.map((document) => {
                    const reference = createDocumentLinkReference(document);
                    const isLinked = Boolean(
                      reference &&
                        documentLinkPickerRelatedKeys.has(
                          normalizeFilePathKey(reference.filePath),
                        ),
                    );
                    const isDisabled =
                      !reference ||
                      (documentLinkPickerMode === "metadata" && isLinked);

                    return (
                      <button
                        className="document-link-picker-item"
                        key={document.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!reference) {
                            return;
                          }

                          if (documentLinkPickerMode === "insertReference") {
                            insertDocumentReferenceFromDocument(document);
                          } else {
                            addPickerDocumentLink(reference);
                          }
                        }}
                      >
                        <FileText size={17} />
                        <span className="document-link-picker-item-main">
                          <strong>{getDocumentDisplayName(document)}</strong>
                          <small>
                            {getDocumentTypeLabel(document)}
                            <span aria-hidden="true"> · </span>
                            {getDocumentDisplayPath(document)}
                          </small>
                        </span>
                        <span
                          className={[
                            "document-link-picker-state",
                            documentLinkPickerMode === "metadata" && isLinked
                              ? "document-link-picker-state-linked"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {documentLinkPickerMode === "insertReference"
                            ? "插入"
                            : isLinked
                              ? "已添加"
                              : "添加"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="document-link-picker-empty">
                    <BookOpenText size={24} />
                    <strong>没有可添加的文件</strong>
                    <span>当前工作区没有匹配的可打开文件。</span>
                  </div>
                )}
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
          open={isTableInsertDialogOpen}
          onOpenChange={setIsTableInsertDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content
              className="table-insert-dialog"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon table-insert-icon">
                    <Table2 size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      插入表格
                    </Dialog.Title>
                    <Dialog.Description>
                      设置行数和列数，插入后可继续在表格工具栏调整。
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>
              <form
                className="table-insert-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  confirmTableInsert();
                }}
              >
                <label>
                  <span>行数</span>
                  <input
                    autoFocus
                    aria-label="表格行数"
                    inputMode="numeric"
                    max={20}
                    min={2}
                    onChange={(event) => setTableInsertRows(event.target.value)}
                    type="number"
                    value={tableInsertRows}
                  />
                </label>
                <span className="table-insert-times" aria-hidden="true">×</span>
                <label>
                  <span>列数</span>
                  <input
                    aria-label="表格列数"
                    inputMode="numeric"
                    max={20}
                    min={1}
                    onChange={(event) =>
                      setTableInsertColumns(event.target.value)
                    }
                    type="number"
                    value={tableInsertColumns}
                  />
                </label>
                <div className="dialog-actions table-insert-actions">
                  <Dialog.Close asChild>
                    <button className="secondary-button" type="button">
                      取消
                    </button>
                  </Dialog.Close>
                  <button className="primary-button" type="submit">
                    <Table2 size={16} />
                    插入表格
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
            <Dialog.Overlay className="dialog-overlay canvas-dialog-overlay" />
            <Dialog.Content className="drawing-dialog react-flow-dialog">
              <Dialog.Title className="sr-only">React Flow 图</Dialog.Title>
              {reactFlowEditorState && (
                <Suspense fallback={<div className="drawing-loading">正在加载流程图编辑器...</div>}>
                  <ReactFlowModal
                    initialData={reactFlowEditorState.initialData}
                    onClose={() => setReactFlowEditorState(null)}
                    onSave={saveReactFlowDiagram}
                  />
                </Suspense>
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
            <Dialog.Overlay className="dialog-overlay canvas-dialog-overlay" />
            <Dialog.Content className="drawing-dialog mindmap-dialog">
              <Dialog.Title className="sr-only">思维导图</Dialog.Title>
              {mindMapEditorState && (
                <Suspense fallback={<div className="drawing-loading">正在加载思维导图编辑器...</div>}>
                  <MindMapModal
                    initialData={mindMapEditorState.initialData}
                    onClose={() => setMindMapEditorState(null)}
                    onSave={saveMindMapDiagram}
                  />
                </Suspense>
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
            <Dialog.Overlay className="dialog-overlay canvas-dialog-overlay" />
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

        <Dialog.Root
          open={isDocumentHistoryDialogOpen}
          onOpenChange={setIsDocumentHistoryDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="document-history-dialog-overlay" />
            <Dialog.Content className="document-history-dialog">
              <div className="document-history-dialog-header">
                <span className="document-history-dialog-icon" aria-hidden="true">
                  <FileClock size={20} />
                </span>
                <div className="document-history-dialog-copy">
                  <Dialog.Title className="document-history-dialog-title">
                    历史记录
                  </Dialog.Title>
                  <Dialog.Description className="document-history-dialog-description">
                    查看最近文档的历史版本，预览内容并恢复到指定时间点。
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="document-history-dialog-close"
                    type="button"
                    aria-label="关闭历史记录"
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>
              {historyBrowserDocuments.length ? (
                <div className="document-history-browser">
                  <aside
                    className="document-history-browser-documents"
                    aria-label="最近文档"
                  >
                    <div className="document-history-browser-heading">
                      <strong>最近文档</strong>
                      <span>最近编辑的 10 个文档</span>
                    </div>
                    <div className="document-history-browser-list">
                      {historyBrowserDocuments.map((document) => {
                        const isSelected =
                          document.filePath &&
                          historyBrowserDocument?.filePath &&
                          normalizeFilePathKey(document.filePath) ===
                            normalizeFilePathKey(historyBrowserDocument.filePath);
                        const isCloudDocument = Boolean(
                          document.filePath &&
                            isCloudSidebarEntryPath(document.filePath),
                        );

                        return (
                          <button
                            className={[
                              "document-history-browser-document",
                              isCloudDocument
                                ? "document-history-browser-document-cloud"
                                : "",
                              isSelected
                                ? "document-history-browser-document-active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={document.id}
                            type="button"
                            onClick={() => {
                              setHistoryBrowserDocumentPath(document.filePath ?? null);
                              setSelectedHistoryBrowserVersion(null);
                            }}
                          >
                            <span className="document-history-browser-document-icon">
                              {isCloudDocument ? <Cloud size={16} /> : <FileText size={16} />}
                            </span>
                            <span className="document-history-browser-document-body">
                              <strong>
                                <span className="document-history-browser-document-name">
                                  {getDocumentDisplayName(document)}
                                </span>
                                {isCloudDocument ? (
                                  <em className="document-history-browser-cloud-badge">
                                    <Cloud size={11} />
                                    云端文档
                                  </em>
                                ) : null}
                              </strong>
                              {isCloudDocument ? (
                                <small className="document-history-browser-cloud-path">
                                  {getDocumentDisplayPath(document)}
                                </small>
                              ) : (
                                <small>{getDocumentDisplayPath(document)}</small>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                  {historyBrowserDocument ? (
                    <Suspense fallback={null}>
                      <DocumentHistoryPanel
                        activeDocument={historyBrowserDocument}
                        isLoading={isHistoryBrowserLoading}
                        isRestoring={isHistoryBrowserRestoring}
                        selectedVersion={selectedHistoryBrowserVersion}
                        versions={historyBrowserVersions}
                        onClearHistory={() =>
                          void clearHistoryBrowserDocumentHistory()
                        }
                        onRefresh={() =>
                          void refreshHistoryBrowser(historyBrowserDocument.filePath)
                        }
                        onRestore={(version) =>
                          void restoreHistoryBrowserVersion(version)
                        }
                        onSelectVersion={(version) =>
                          void selectHistoryBrowserVersion(
                            version,
                            historyBrowserDocument.filePath,
                          )
                        }
                      />
                    </Suspense>
                  ) : null}
                </div>
              ) : (
                <div className="document-history-empty">
                  <FileClock size={18} />
                  <strong>暂无可查看的历史记录</strong>
                  <span>最近打开或编辑 Markdown 文档后，这里会显示历史。</span>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          open={Boolean(documentImagePreview)}
          onOpenChange={(open) => {
            if (!open) {
              closeDocumentImagePreview();
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="document-image-preview-overlay" />
            <Dialog.Content className="document-image-preview-dialog">
              <Dialog.Title className="sr-only">
                {documentImagePreview?.alt || "图片预览"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="document-image-preview-close"
                  type="button"
                  aria-label="关闭图片预览"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
              {documentImagePreview ? (
                <>
                  <ZoomableImagePreview
                    alt={documentImagePreview.alt}
                    classNamePrefix="document-image-preview"
                    src={documentImagePreview.src}
                    onRequestClose={closeDocumentImagePreview}
                  />
                </>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {workspaceToast ? (
          <div
            className={`workspace-toast workspace-toast-${workspaceToast.tone}`}
            role={workspaceToast.tone === "error" ? "alert" : "status"}
          >
            {workspaceToast.message}
          </div>
        ) : null}

        <AppConfirmationDialog dialog={appDialog} onClose={closeAppDialog} />

        <Suspense fallback={null}>
          <KnowledgeGraphModal
            items={workspaceRelationItems}
            open={isKnowledgeGraphOpen}
            onOpenChange={setIsKnowledgeGraphOpen}
            onOpenDocument={(document) => {
              openRelationDocument(document);
              setIsKnowledgeGraphOpen(false);
            }}
          />
        </Suspense>

        <AboutDialog
          appVersion={appVersion}
          logoUrl={appLogoUrl}
          open={isAboutOpen}
          onOpenChange={setIsAboutOpen}
        />

        <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay settings-dialog-overlay" />
            <Dialog.Content className="settings-dialog settings-redesign">
              <div className="settings-redesign-shell">
                <aside className="settings-redesign-sidebar">
                  <div className="settings-redesign-brand">
                    <span className="settings-redesign-brand-icon" aria-hidden="true">
                      <Settings2 size={18} />
                    </span>
                    <div>
                      <Dialog.Title className="settings-redesign-title">
                        设置
                      </Dialog.Title>
                      <span className="settings-redesign-app-name">v{appVersion}</span>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        className="settings-redesign-close"
                        type="button"
                        aria-label="关闭设置"
                      >
                        <X size={16} />
                      </button>
                    </Dialog.Close>
                  </div>

                  <nav className="settings-redesign-nav" aria-label="设置目录">
                    {settingsDirectoryItems.map((item) => {
                      const DirectoryIcon = item.icon;

                      return (
                        <button
                          className={`settings-redesign-nav-item ${
                            activeSettingsSection === item.id
                              ? "settings-redesign-nav-item-active"
                              : ""
                          }`}
                          key={item.id}
                          type="button"
                          aria-current={
                            activeSettingsSection === item.id ? "page" : undefined
                          }
                          onClick={() => setActiveSettingsSection(item.id)}
                        >
                          <DirectoryIcon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </aside>

                <section className="settings-redesign-main">
                  {activeSettingsSection === "app" ? (
                    <section className="settings-redesign-card settings-redesign-home">
                      <div className="settings-redesign-card-heading">
                        <h3>通用</h3>
                        <p>调整应用外观和首页模块，保持工作台干净顺手。</p>
                      </div>
                      <div className="settings-redesign-toggle-list">
                        <label className="settings-redesign-toggle-row settings-redesign-select-row">
                          <span className="settings-redesign-setting-copy">
                            <strong>应用主题</strong>
                            <small>影响应用外壳和文档阅读主题</small>
                          </span>
                          <select
                            value={theme}
                            onChange={(event) =>
                              setTheme(event.currentTarget.value as AppTheme)
                            }
                          >
                            {themeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-redesign-toggle-row">
                          <span className="settings-redesign-setting-copy">
                            <strong>今日待办</strong>
                            <small>在首页安排并查看当天任务</small>
                          </span>
                          <span className="settings-redesign-switch">
                            <input
                              type="checkbox"
                              checked={settings.homeShowTodoPanel}
                              onChange={(event) =>
                                updateSetting(
                                  "homeShowTodoPanel",
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <span />
                          </span>
                        </label>
                        <label className="settings-redesign-toggle-row">
                          <span className="settings-redesign-setting-copy">
                            <strong>灵感便签</strong>
                            <small>在首页保留随手记录区域</small>
                          </span>
                          <span className="settings-redesign-switch">
                            <input
                              type="checkbox"
                              checked={settings.homeShowNotePanel}
                              onChange={(event) =>
                                updateSetting(
                                  "homeShowNotePanel",
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <span />
                          </span>
                        </label>
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "notes" ? (
                    <section className="settings-redesign-card settings-redesign-reader">
                      <div className="settings-redesign-density-card">
                        <div className="settings-redesign-card-heading">
                          <h3>笔记</h3>
                          <p>阅读密度会统一控制字号、段落间距、行高和默认内容宽度。</p>
                        </div>
                        <div
                          className="settings-comfort-slider"
                          style={
                            {
                              "--settings-slider-progress": `${getSettingsSliderProgress(
                                editorContentDensityIndex,
                                editorContentDensityOptions.length,
                              )}%`,
                            } as CSSProperties
                          }
                        >
                          <div className="settings-comfort-slider-head">
                            <span>阅读密度</span>
                            <strong>{selectedEditorContentDensity.label}</strong>
                            <small>{selectedEditorContentDensity.meta}</small>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={editorContentDensityOptions.length - 1}
                            step={1}
                            value={editorContentDensityIndex}
                            aria-label="阅读密度"
                            onChange={(event) => {
                              const nextOption =
                                editorContentDensityOptions[
                                  Number(event.currentTarget.value)
                                ];

                              if (nextOption) {
                                updateSetting(
                                  "editorContentDensity",
                                  nextOption.value,
                                );
                              }
                            }}
                          />
                          <div className="settings-comfort-slider-labels">
                            {editorContentDensityOptions.map((option, index) => (
                              <span
                                className={
                                  index === editorContentDensityIndex
                                    ? "settings-comfort-slider-label-active"
                                    : ""
                                }
                                key={option.value}
                              >
                                {option.label}
                              </span>
                            ))}
                          </div>
                          <p>{selectedEditorContentDensity.description}</p>
                        </div>
                        <div className="settings-redesign-control-grid">
                          <label className="settings-redesign-field">
                            <span>笔记字体</span>
                            <select
                              value={settings.editorFontFamily}
                              onChange={(event) =>
                                updateSetting("editorFontFamily", event.currentTarget.value)
                              }
                            >
                              {editorFontOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="settings-redesign-field">
                            <span>编辑模式</span>
                            <select
                              value={mode}
                              onChange={(event) =>
                                updateEditorMode(event.currentTarget.value as EditorMode)
                              }
                            >
                              {editorModeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      <div
                        className="settings-redesign-preview"
                        aria-label="显示预览"
                      >
                        <div className="settings-redesign-card-heading">
                          <h3>效果预览</h3>
                        </div>
                        <div
                          className="settings-redesign-preview-page"
                          style={settingsPreviewStyle}
                        >
                          <h4>项目笔记</h4>
                          <p>正文、列表和表格会跟随当前阅读预设。</p>
                          <ul>
                            <li>快速记录 Markdown 笔记</li>
                            <li>阅读本地文档</li>
                          </ul>
                          <blockquote>合适的字号和行距可以减少长时间阅读的疲劳。</blockquote>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeSettingsSection === "code" ? (
                    <section className="settings-redesign-card settings-redesign-home">
                      <div className="settings-redesign-card-heading">
                        <h3>代码</h3>
                        <p>只保留代码字体，让代码块清晰但不打扰正文阅读。</p>
                      </div>
                      <div className="settings-redesign-control-grid settings-redesign-single-grid">
                        <label className="settings-redesign-field">
                          <span>代码字体</span>
                          <select
                            value={settings.editorCodeFontFamily}
                            onChange={(event) =>
                              updateSetting(
                                "editorCodeFontFamily",
                                event.currentTarget.value,
                              )
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
                    </section>
                  ) : null}

                  {activeSettingsSection === "diary" ? (
                    <section className="settings-redesign-card settings-redesign-home">
                      <div className="settings-redesign-card-heading">
                        <h3>日记</h3>
                        <p>日记可以单独调整书写节奏和字体，保留更轻松的记录感。</p>
                      </div>
                      <div className="settings-redesign-toggle-list">
                        <label className="settings-redesign-toggle-row">
                          <span className="settings-redesign-setting-copy">
                            <strong>日记</strong>
                            <small>在左侧栏启用日记工作区</small>
                          </span>
                          <span className="settings-redesign-switch">
                            <input
                              type="checkbox"
                              checked={settings.homeShowDiaryPanel}
                              onChange={(event) =>
                                setDiaryFeatureEnabled(event.currentTarget.checked)
                              }
                            />
                            <span />
                          </span>
                        </label>
                        <div className="settings-redesign-field settings-redesign-home-template">
                          <span>默认日记模板</span>
                          <button
                            className="settings-redesign-template-button"
                            type="button"
                            onClick={() => setIsDefaultDiaryTemplateDialogOpen(true)}
                          >
                            <BookOpenText size={14} />
                            {selectedDiaryTemplateOption.label}
                          </button>
                        </div>
                        <div className="settings-redesign-diary-comfort">
                          <div className="settings-redesign-card-heading">
                            <h3>书写节奏</h3>
                            <p>同时调整日记字号和行高。</p>
                          </div>
                          <div
                            className="settings-comfort-slider"
                            style={
                              {
                                "--settings-slider-progress": `${getSettingsSliderProgress(
                                  diaryComfortIndex,
                                  diaryComfortOptions.length,
                                )}%`,
                              } as CSSProperties
                            }
                          >
                            <div className="settings-comfort-slider-head">
                              <span>书写节奏</span>
                              <strong>{selectedDiaryComfort.label}</strong>
                              <small>
                                {selectedDiaryComfort.fontSize} /{" "}
                                {selectedDiaryComfort.lineHeight}
                              </small>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={diaryComfortOptions.length - 1}
                              step={1}
                              value={diaryComfortIndex}
                              aria-label="日记书写节奏"
                              onChange={(event) => {
                                const nextOption =
                                  diaryComfortOptions[
                                    Number(event.currentTarget.value)
                                  ];

                                if (!nextOption) {
                                  return;
                                }

                                setSettings((current) => ({
                                  ...current,
                                  diaryFontSize: nextOption.fontSize,
                                  diaryLineHeight: nextOption.lineHeight,
                                }));
                              }}
                            />
                            <div className="settings-comfort-slider-labels">
                              {diaryComfortOptions.map((option, index) => (
                                <span
                                  className={
                                    index === diaryComfortIndex
                                      ? "settings-comfort-slider-label-active"
                                      : ""
                                  }
                                  key={option.value}
                                >
                                  {option.label}
                                </span>
                              ))}
                            </div>
                            <p>{selectedDiaryComfort.description}</p>
                          </div>
                        </div>
                        <div className="settings-redesign-field-row settings-redesign-diary-typography">
                          <label className="settings-redesign-field">
                            <span>日记字体</span>
                            <select
                              value={settings.diaryFontFamily}
                              onChange={(event) =>
                                updateSetting(
                                  "diaryFontFamily",
                                  event.currentTarget
                                    .value as AppSettings["diaryFontFamily"],
                                )
                              }
                            >
                              {diaryFontOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {remoteSyncFeatureEnabled && activeSettingsSection === "sync" ? (
                    <section className="settings-redesign-card settings-redesign-sync">
                      <div className="settings-redesign-sync-head">
                        <div>
                          <h3>云同步</h3>
                        </div>
                        <label className="settings-redesign-switch">
                          <input
                            type="checkbox"
                            checked={
                              syncStatus.configuration.tokenConfigured &&
                              syncEnabledDraft
                            }
                            disabled={!syncStatus.configuration.tokenConfigured}
                            onChange={(event) => {
                              if (!syncStatus.configuration.tokenConfigured) {
                                return;
                              }

                              setSyncEnabledDraft(event.currentTarget.checked);
                            }}
                          />
                          <span />
                        </label>
                      </div>

                      <div className="settings-redesign-form">
                        <label className="settings-redesign-field">
                          <span>服务器地址</span>
                          <input
                            type="url"
                            placeholder={defaultSyncServerUrl}
                            value={syncServerUrlDraft}
                            onChange={(event) =>
                              setSyncServerUrlDraft(event.currentTarget.value)
                            }
                          />
                        </label>

                        <div className="settings-redesign-field-row">
                          <label className="settings-redesign-field">
                            <span>用户名</span>
                            <input
                              type="text"
                              autoComplete="username"
                              placeholder={defaultSyncLoginUsername}
                              value={syncLoginUsernameDraft}
                              disabled={
                                syncStatus.configuration.tokenConfigured ||
                                isSyncLoginRunning
                              }
                              onChange={(event) =>
                                setSyncLoginUsernameDraft(
                                  event.currentTarget.value,
                                )
                              }
                            />
                          </label>
                          <label className="settings-redesign-field">
                            <span>密码</span>
                            <input
                              type="password"
                              autoComplete="current-password"
                              placeholder={defaultSyncLoginPassword}
                              value={syncLoginPasswordDraft}
                              disabled={
                                syncStatus.configuration.tokenConfigured ||
                                isSyncLoginRunning
                              }
                              onChange={(event) =>
                                setSyncLoginPasswordDraft(
                                  event.currentTarget.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>

                      {syncLoginMessage ? (
                        <div
                          className={`settings-redesign-message settings-redesign-message-${syncLoginMessageTone}`}
                          role={syncLoginMessageTone === "error" ? "alert" : "status"}
                        >
                          {syncLoginMessage}
                        </div>
                      ) : null}

                      <div className="settings-redesign-actions">
                        {syncStatus.configuration.tokenConfigured ? (
                          <button
                            className="settings-redesign-text-button"
                            type="button"
                            onClick={() => void logoutSync()}
                          >
                            退出登录
                          </button>
                        ) : null}
                        {!syncStatus.configuration.tokenConfigured ? (
                          <button
                            className="settings-redesign-primary"
                            type="button"
                            disabled={isSyncLoginRunning}
                            onClick={() => void loginAndConfigureSync()}
                          >
                            {isSyncLoginRunning ? "登录中..." : "登录并启用"}
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </section>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          open={isDefaultDiaryTemplateDialogOpen}
          onOpenChange={setIsDefaultDiaryTemplateDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay diary-template-dialog-overlay" />
            <Dialog.Content className="diary-template-dialog">
              <div className="diary-template-dialog-header">
                <div>
                  <Dialog.Title className="diary-template-dialog-title">
                    选择默认日记模板
                  </Dialog.Title>
                  <Dialog.Description className="diary-template-dialog-description">
                    新建日记时会使用这里选择的模板。
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="icon-button diary-template-dialog-close"
                    type="button"
                    aria-label="关闭模板选择"
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>
              <div className="diary-template-grid">
                {diaryTemplateOptions.map((option) => {
                  const isActive =
                    option.value === settings.diaryDefaultTemplate;

                  return (
                    <button
                      className={[
                        "diary-template-card",
                        isActive ? "diary-template-card-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        updateSetting("diaryDefaultTemplate", option.value);
                        setIsDefaultDiaryTemplateDialogOpen(false);
                      }}
                    >
                      <span className="diary-template-card-head">
                        <strong>{option.label}</strong>
                        {isActive ? (
                          <span
                            className="diary-template-card-check"
                            aria-hidden="true"
                          >
                            <Check size={13} />
                          </span>
                        ) : null}
                      </span>
                      <span className="diary-template-card-description">
                        {option.description}
                      </span>
                      <span className="diary-template-card-preview">
                        {option.preview}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </>
  );
}
