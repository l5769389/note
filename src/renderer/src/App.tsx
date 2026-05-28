import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
  BookOpenText,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Code2,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Inbox,
  Italic,
  Link2,
  ListTree,
  Minus,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Scissors,
  Square,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  Fragment,
  useDeferredValue,
  useEffect,
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
  editorContentDensityOptions,
  editorFontSizeAdjustmentRange,
  formatEditorFontSizeAdjustment,
  themeOptions,
  type AppSettings,
  type AppTheme,
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
import {
  AppConfirmationDialog,
  AboutDialog,
  DocumentLoadingIndicator,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  RecentFileMenuItem,
} from "./components/AppChrome";
import {
  KnowledgeRelationsPanel,
  type RelationPanelFilter,
  type WorkspaceRelationItem,
} from "./components/KnowledgeRelationsPanel";
import {
  DocumentKnowledgeBar,
  type DocumentMetadataSuggestionField,
} from "./components/DocumentKnowledgeBar";
import { DocumentInspectorSidebar } from "./components/DocumentInspectorSidebar";
import { UniverSheetPreview } from "./components/UniverSheetPreview";
import { WorkspaceSearchPanel } from "./components/WorkspaceSearchPanel";
import { WorkspaceStatusBar } from "./components/WorkspaceStatusBar";
import type { HtmlDocumentViewerHandle } from "./components/HtmlDocumentViewer";
import type { TyporaEditorHandle } from "./components/TyporaEditor";
import appLogoUrl from "../../../resources/icon.png";
import type {
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "./editorCommands";
import { useFindMatchStateMaintenance } from "./findMatchState";
import { useEditorCssVariables } from "./editorCssVariables";
import { useGlobalAppShortcuts } from "./globalAppShortcuts";
import { useImmersiveModeState } from "./immersiveModeState";
import {
  getSelectAllContentScope,
  getAppShortcutAction,
  type AppShortcutAction,
} from "./editorShortcuts";
import { createMarkdownExportHtml } from "./exportDocument";
import {
  createMarkdownTable,
  type TableSize,
} from "./markdownCommands";
import {
  getLineColumnAtOffset,
} from "./markdownEditing";
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
import {
  acknowledgeSavedFileContent as acknowledgeFileContent,
  createSavedFileContentByPath,
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
import {
  getTagInputValues,
  normalizeDocumentMetadata,
} from "./documentMetadata";
import { getHtmlOutline } from "./htmlStructure";
import {
  dataTransferHasFiles,
  createMediaImportPlaceholder,
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
  DocumentLinkReference,
  DocumentMetadata,
  DrawingAsset,
  EditorMode,
  MarkdownDocument,
  SaveState,
  LocalMarkdownFile,
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
  getExternalChangeConfirm,
  getExternalDeleteAlert,
  getWorkspaceFileChangeContext,
  mergeDiskDocumentIntoWorkspace,
  shouldMergeInternalWriteBack,
  type WorkspaceFileChangePayload,
} from "./workspaceFileChanges";
import {
  normalizeDirectoryKey,
  rememberRecentDirectoryPath,
} from "./recentDirectories";
import { useRecentFileAvailability } from "./recentFileAvailability";
import { useWindowChromeState } from "./windowChromeState";
import { useWorkspaceDirectoryWatcher } from "./workspaceDirectoryWatcher";
import { useWorkspaceDirectoryTree } from "./workspaceDirectoryTree";
import { useWorkspaceAutosave } from "./workspaceAutosave";
import {
  useActiveDocumentUiReset,
  useQuickCaptureBridge,
  useWorkspaceSearchAutoFocus,
} from "./workspaceUiEffects";
import {
  formatRecentTimestamp,
  getDocumentTypeLabel,
  getDocumentTypeName,
  getPathLabel,
  normalizeFilePathKey,
} from "./workspaceDisplay";

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

const UniverSheetModal = lazy(() =>
  import("./components/UniverSheetModal").then((module) => ({
    default: module.UniverSheetModal,
  })),
);

const WordDocumentViewer = lazy(() =>
  import("./components/WordDocumentViewer").then((module) => ({
    default: module.WordDocumentViewer,
  })),
);

type MenubarMenu = "file" | "edit" | "paragraph" | "format" | "view" | "theme" | "help";
type TopMenu = MenubarMenu | null;
type ImmersiveRevealEdge = "top";
type SidebarTab = "files" | "current" | "search";
type FileExplorerView = "tree" | "list";

const homeRecentDocumentLimit = 3;
const homeTodoStorageKey = "notedock:home-todos";
const homeQuickNoteStorageKey = "notedock:home-quick-note";
const sidebarRecentDirectoryLimit = 5;
const immersiveRevealHitSlop = 44;
const defaultWindowZoomFactor = 1;
const zoomIndicatorVisibleMs = 1500;

type FindPanelMode = "find" | "replace";

type HomeTodoItem = {
  createdAt: string;
  done: boolean;
  id: string;
  text: string;
};

type HomeTodoDragState = {
  height: number;
  id: string;
  insertIndex: number;
  left: number;
  offsetY: number;
  pointerId: number;
  pointerY: number;
  width: number;
};

function createHomeTodoId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHomeQuickNote() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(homeQuickNoteStorageKey) ?? "";
  } catch {
    return "";
  }
}

function loadHomeTodoItems(): HomeTodoItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawItems = window.localStorage.getItem(homeTodoStorageKey);

    if (!rawItems) {
      return [];
    }

    const parsedItems = JSON.parse(rawItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .filter((item): item is HomeTodoItem =>
        Boolean(
          item &&
            typeof item.id === "string" &&
            typeof item.text === "string" &&
            typeof item.done === "boolean" &&
            typeof item.createdAt === "string",
        ),
      )
      .slice(0, 80);
  } catch {
    return [];
  }
}

function reorderHomeTodoItems(
  items: HomeTodoItem[],
  activeTodoId: string,
  insertIndex: number,
) {
  const activeIndex = items.findIndex((item) => item.id === activeTodoId);

  if (activeIndex < 0) {
    return items;
  }

  const activeItem = items[activeIndex];
  const nextItems = items.filter((item) => item.id !== activeTodoId);
  const targetIndex = clamp(insertIndex, 0, nextItems.length);

  nextItems.splice(targetIndex, 0, activeItem);

  const didOrderChange = nextItems.some((item, index) => item.id !== items[index]?.id);

  return didOrderChange ? nextItems : items;
}

type HomeTodoRowProps = {
  item: HomeTodoItem;
  onDelete: (todoId: string) => void;
  onDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
  ) => void;
  onToggle: (todoId: string) => void;
  rowRef: (todoId: string, node: HTMLDivElement | null) => void;
};

function HomeTodoRow({
  item,
  onDelete,
  onDragStart,
  onToggle,
  rowRef,
}: HomeTodoRowProps) {
  return (
    <div
      className={
        [
          "home-todo-item",
          item.done ? "home-todo-item-done" : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      ref={(node) => rowRef(item.id, node)}
    >
      <button
        className="home-todo-check"
        type="button"
        aria-label={item.done ? "标记为未完成" : "标记为已完成"}
        aria-pressed={item.done}
        onClick={() => onToggle(item.id)}
      >
        {item.done ? <Check size={14} /> : null}
      </button>
      <span>{item.text}</span>
      <button
        className="home-todo-delete"
        type="button"
        aria-label="删除待办"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={14} />
      </button>
      <button
        className="home-todo-drag-handle"
        type="button"
        aria-label="拖拽排序"
        title="拖拽排序"
        onPointerDown={(event) => onDragStart(event, item.id)}
      >
        <GripVertical size={15} />
      </button>
    </div>
  );
}

function HomeTodoDropSlot() {
  return (
    <div className="home-todo-drop-slot-row" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

function HomeTodoDragPreview({ item }: { item: HomeTodoItem }) {
  return (
    <div
      className={[
        "home-todo-item",
        "home-todo-item-preview",
        item.done ? "home-todo-item-done" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="home-todo-check" aria-hidden="true">
        {item.done ? <Check size={14} /> : null}
      </span>
      <span>{item.text}</span>
      <span className="home-todo-delete" aria-hidden="true" />
      <span className="home-todo-drag-handle" aria-hidden="true">
        <GripVertical size={15} />
      </span>
    </div>
  );
}

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

type EditorContextMenuInfo = {
  canPaste: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  isListItem: boolean;
  isTaskListItem: boolean;
  linkHref?: string;
  taskChecked?: boolean;
};

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
const defaultInspectorWidth = 360;
const minInspectorWidth = 300;
const maxInspectorWidth = 620;

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

export function App() {
  const [workspace, setWorkspace] = useState(createStartupWorkspace);
  const [mode, setMode] = useState<EditorMode>(defaultAppSettings.editorMode);
  const [topMenu, setTopMenu] = useState<TopMenu>(null);
  const [theme, setTheme] = useState<AppTheme>("github");
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [windowZoomFactor, setWindowZoomFactor] = useState(defaultWindowZoomFactor);
  const [isZoomIndicatorVisible, setIsZoomIndicatorVisible] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const [homeQuickNote, setHomeQuickNote] = useState(loadHomeQuickNote);
  const [homeTodoItems, setHomeTodoItems] = useState<HomeTodoItem[]>(loadHomeTodoItems);
  const [homeTodoDraft, setHomeTodoDraft] = useState("");
  const [homeTodoDrag, setHomeTodoDrag] = useState<HomeTodoDragState | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isDocumentInspectorOpen, setIsDocumentInspectorOpen] = useState(false);
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
  const [documentLinkQuery, setDocumentLinkQuery] = useState("");
  const [documentLinkSourceDocumentId, setDocumentLinkSourceDocumentId] =
    useState<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureTitle, setQuickCaptureTitle] = useState("");
  const [quickCaptureBody, setQuickCaptureBody] = useState("");
  const [quickCaptureTags, setQuickCaptureTags] = useState("inbox");
  const [documentReloadTokens, setDocumentReloadTokens] = useState<
    Record<string, number>
  >({});
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [fileExplorerView, setFileExplorerView] =
    useState<FileExplorerView>("tree");
  const { clearDocumentLoading, documentLoadingState, showDocumentLoading } =
    useDocumentLoading();
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
  const homeTodoDragRef = useRef<HomeTodoDragState | null>(null);
  const homeTodoListRef = useRef<HTMLDivElement | null>(null);
  const homeTodoRowRefs = useRef(new Map<string, HTMLDivElement>());
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
  const isImmersiveMode = isFullScreen;
  const [immersiveRevealEdge, setImmersiveRevealEdge] =
    useState<ImmersiveRevealEdge | null>(null);
  const isSidebarHidden = isImmersiveMode
    ? !isImmersiveSidebarOpen
    : isSidebarCollapsed;
  const [recentDirectoryPaths, setRecentDirectoryPaths] = useState<string[]>([]);
  const [activeEditorLineIndex, setActiveEditorLineIndex] = useState(0);
  const [activeHtmlOutlineId, setActiveHtmlOutlineId] = useState<string | null>(
    null,
  );
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
  const htmlDocumentViewerRef = useRef<HtmlDocumentViewerHandle | null>(null);
  const zoomIndicatorTimerRef = useRef<number | null>(null);
  const mediaImportIdRef = useRef(0);
  const workspaceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const wikiLinkInputRef = useRef<HTMLInputElement | null>(null);
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
    try {
      window.localStorage.setItem(homeTodoStorageKey, JSON.stringify(homeTodoItems));
    } catch {
      // Todo persistence should never block the editor shell.
    }
  }, [homeTodoItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem(homeQuickNoteStorageKey, homeQuickNote);
    } catch {
      // The quick note is intentionally lightweight and should never block startup.
    }
  }, [homeQuickNote]);

  useEffect(() => {
    homeTodoDragRef.current = homeTodoDrag;
  }, [homeTodoDrag]);

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
  const remainingHomeTodoCount = homeTodoItems.filter((item) => !item.done).length;
  const completedHomeTodoCount = homeTodoItems.length - remainingHomeTodoCount;
  const homeTodoProgress = homeTodoItems.length
    ? Math.round((completedHomeTodoCount / homeTodoItems.length) * 100)
    : 0;
  const hasCompletedHomeTodos = homeTodoItems.some((item) => item.done);
  const addHomeTodo = () => {
    const text = homeTodoDraft.trim();

    if (!text) {
      return;
    }

    setHomeTodoItems((currentItems) => [
      {
        id: createHomeTodoId(),
        text,
        done: false,
        createdAt: new Date().toISOString(),
      },
      ...currentItems,
    ]);
    setHomeTodoDraft("");
  };
  const toggleHomeTodo = (todoId: string) => {
    setHomeTodoItems((currentItems) =>
      currentItems.map((item) =>
        item.id === todoId ? { ...item, done: !item.done } : item,
      ),
    );
  };
  const deleteHomeTodo = (todoId: string) => {
    setHomeTodoItems((currentItems) =>
      currentItems.filter((item) => item.id !== todoId),
    );
  };
  const clearCompletedHomeTodos = () => {
    setHomeTodoItems((currentItems) => currentItems.filter((item) => !item.done));
  };
  const activeHomeTodoItem = useMemo(
    () =>
      homeTodoDrag
        ? homeTodoItems.find((item) => item.id === homeTodoDrag.id) ?? null
        : null,
    [homeTodoDrag, homeTodoItems],
  );
  const visibleHomeTodoItems = useMemo(
    () =>
      homeTodoDrag
        ? homeTodoItems.filter((item) => item.id !== homeTodoDrag.id)
        : homeTodoItems,
    [homeTodoDrag, homeTodoItems],
  );
  const setHomeTodoRowRef = (todoId: string, node: HTMLDivElement | null) => {
    if (node) {
      homeTodoRowRefs.current.set(todoId, node);
      return;
    }

    homeTodoRowRefs.current.delete(todoId);
  };
  const getHomeTodoInsertIndex = (clientY: number, activeTodoId: string) => {
    const visibleItems = homeTodoItems.filter((item) => item.id !== activeTodoId);

    for (let index = 0; index < visibleItems.length; index += 1) {
      const row = homeTodoRowRefs.current.get(visibleItems[index].id);

      if (!row) {
        continue;
      }

      const rect = row.getBoundingClientRect();

      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return visibleItems.length;
  };
  const handleHomeTodoDragStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const row = homeTodoRowRefs.current.get(todoId);

    if (!row) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rowRect = row.getBoundingClientRect();

    setHomeTodoDrag({
      height: rowRect.height,
      id: todoId,
      insertIndex: getHomeTodoInsertIndex(event.clientY, todoId),
      left: rowRect.left,
      offsetY: event.clientY - rowRect.top,
      pointerId: event.pointerId,
      pointerY: event.clientY,
      width: rowRect.width,
    });
  };
  useEffect(() => {
    if (!homeTodoDrag) {
      return;
    }

    const scrollNearEdges = (clientY: number) => {
      const list = homeTodoListRef.current;

      if (!list) {
        return;
      }

      const rect = list.getBoundingClientRect();
      const edgeSize = 48;

      if (clientY < rect.top + edgeSize) {
        list.scrollTop -= 12;
      } else if (clientY > rect.bottom - edgeSize) {
        list.scrollTop += 12;
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      event.preventDefault();
      scrollNearEdges(event.clientY);

      setHomeTodoDrag((current) =>
        current && event.pointerId === current.pointerId
          ? {
              ...current,
              insertIndex: getHomeTodoInsertIndex(event.clientY, current.id),
              pointerY: event.clientY,
            }
          : current,
      );
    };
    const finishDrag = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      event.preventDefault();
      setHomeTodoDrag(null);
      setHomeTodoItems((currentItems) =>
        reorderHomeTodoItems(
          currentItems,
          currentDrag.id,
          currentDrag.insertIndex,
        ),
      );
    };
    const cancelDrag = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      setHomeTodoDrag(null);
    };

    document.body.classList.add("home-todo-global-dragging");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);

    return () => {
      document.body.classList.remove("home-todo-global-dragging");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [homeTodoDrag?.id, homeTodoItems]);
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

  useEffect(() => {
    if (!hasMoreRecentDocuments && isRecentExpanded) {
      setIsRecentExpanded(false);
    }
  }, [hasMoreRecentDocuments, isRecentExpanded]);

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useWindowChromeState({
    getWindowState: window.desktop?.getWindowState,
    getZoomFactor: window.desktop?.getZoomFactor,
    setIsAlwaysOnTop,
    setIsFullScreen,
    setWindowZoomFactor,
  });

  useEffect(
    () => () => {
      if (zoomIndicatorTimerRef.current !== null) {
        window.clearTimeout(zoomIndicatorTimerRef.current);
      }
    },
    [],
  );

  useEditorCssVariables(settings);

  usePersistedAppStateWriter({
    isReady: isPersistenceReady,
    recentDirectories: recentDirectoryPaths,
    settings,
    sidebarWidth,
    theme,
    workspace,
  });

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

  function updateEditorMode(nextMode: EditorMode) {
    setMode(nextMode);
    updateSetting("editorMode", nextMode);
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
    setIsZoomIndicatorVisible(true);

    if (zoomIndicatorTimerRef.current !== null) {
      window.clearTimeout(zoomIndicatorTimerRef.current);
    }

    zoomIndicatorTimerRef.current = window.setTimeout(() => {
      setIsZoomIndicatorVisible(false);
      zoomIndicatorTimerRef.current = null;
    }, zoomIndicatorVisibleMs);
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

  function rememberRecentDirectory(path?: string) {
    setRecentDirectoryPaths((current) =>
      rememberRecentDirectoryPath(current, path),
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

  useQuickCaptureBridge(window.desktop?.onQuickCapture, openQuickCapture);

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
        : createDocument(title, "");

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) =>
        addCreatedDocumentToWorkspace(current, document, directoryPath),
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

    setWorkspace((current) =>
      addCreatedDocumentToWorkspace(current, document, directoryPath),
    );
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
      void openUniverSheetEditor({ kind: "document" }, document.content);

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
      workspacePath: directoryPath,
    }));
    applyDirectoryTree(tree);
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

  async function openFileFromTree(filePath: string) {
    const existingDocument = workspace.documents.find(
      (document) => document.filePath === filePath,
    );
    const shouldShowLoading = getDocumentTypeFromPath(filePath) !== "markdown";

    if (existingDocument) {
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

      const document = createDocumentFromLocalFile(localFile);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) => addOpenedDocumentToWorkspace(current, document));
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

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) => addOpenedDocumentToWorkspace(current, document));
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

  async function deleteDocumentFile(filePath: string) {
    const confirmed = await showAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除",
      description: "文件会从磁盘中删除，此操作无法撤销。",
      detail: filePath,
      title: "删除这个文件？",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const fileKey = normalizeFilePathKey(filePath);

    try {
      internalFileDeletesRef.current.add(fileKey);
      await window.desktop?.deleteDocumentFile?.(filePath);
      savedFileContentByPathRef.current.delete(filePath);
      externalConflictPathsRef.current.delete(fileKey);

      setWorkspace((current) => {
        const deletedDocument = current.documents.find(
          (document) => document.filePath === filePath,
        );
        const documents = current.documents.filter(
          (document) => document.filePath !== filePath,
        );

        return {
          ...current,
          activeDocumentId:
            deletedDocument?.id === current.activeDocumentId
              ? ""
              : current.activeDocumentId,
          documents,
        };
      });
      await loadDirectoryTree(getDirectoryPath(filePath));

      if (activeDocument?.filePath === filePath) {
        setIsHomeOpen(true);
      }
    } catch {
      internalFileDeletesRef.current.delete(normalizeFilePathKey(filePath));
      void showAppAlert({
        confirmLabel: "知道了",
        description: "删除文件时发生错误，请确认文件仍然存在且当前目录可写。",
        detail: filePath,
        title: "删除失败",
        tone: "danger",
      });
    }
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

    const nextContent =
      mode === "typora"
        ? replaceMarkdownBodyPreservingFrontmatter(activeDocument.content, content)
        : content;

    patchActiveDocument({
      content: nextContent,
      title: renameFromMarkdown(nextContent, activeDocument.title),
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

    insertMarkdown(`[[${target}]]`);
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

  function createDocumentLinkReferenceFromFilePath(
    filePath: string,
  ): DocumentLinkReference {
    const document = getDocumentByFilePath(filePath);

    return (
      (document && createDocumentLinkReference(document)) ?? {
        createdAt: now(),
        documentType: getDocumentTypeFromPath(filePath),
        filePath,
        title: getPathLabel(filePath),
      }
    );
  }

  function canRelateDocumentFile(filePath: string) {
    return (
      Boolean(activeDocument) &&
      normalizeFilePathKey(activeDocument?.filePath) !== normalizeFilePathKey(filePath)
    );
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

  function addActiveDocumentLink(reference: DocumentLinkReference) {
    addDocumentLinkToDocument(activeDocument, reference);
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

  function relateDocumentFromFile(filePath: string) {
    if (!canRelateDocumentFile(filePath)) {
      return;
    }

    addActiveDocumentLink(createDocumentLinkReferenceFromFilePath(filePath));
  }

  function removeActiveDocumentLink(filePath: string) {
    if (!activeDocument) {
      return;
    }

    const targetKey = normalizeFilePathKey(filePath);

    removeDocumentLinkFromDocument(activeDocument.id, targetKey);
  }

  function openDocumentLinkPicker(sourceDocument?: MarkdownDocument | null) {
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

    setDocumentLinkSourceDocumentId(pickerSource.id);
    setDocumentLinkQuery("");
    if (pickerSource.id === activeDocument?.id) {
      setIsDocumentInspectorOpen(true);
    }
    setIsDocumentLinkPickerOpen(true);
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

  function openQuickCapture() {
    setIsQuickCaptureOpen(true);
    setTopMenu(null);
    setIsActionsOpen(false);
  }

  async function createQuickCapture() {
    const nowDate = new Date();
    const fallbackTitle = `Capture ${nowDate
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 16)
      .replace("T", " ")}`;
    const title = normalizeMarkdownTitle(quickCaptureTitle || fallbackTitle);
    const tags = getTagInputValues(quickCaptureTags || "inbox");
    const content = createMarkdownNoteContent({
      body: quickCaptureBody,
      properties: {
        created: nowDate.toISOString(),
        source: "quick-capture",
      },
      tags,
      title,
    });

    try {
      await createMarkdownDocumentWithContent(title, content);
      setQuickCaptureTitle("");
      setQuickCaptureBody("");
      setQuickCaptureTags("inbox");
      setIsQuickCaptureOpen(false);
      setSidebarTab("current");
    } catch {
      setSaveState("failed");
    }
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

    try {
      const localFile = await window.desktop?.readMarkdownFile?.(document.filePath);

      if (!localFile) {
        setActiveDocument(document.id);
        return;
      }

      const nextDocument = createDocumentFromLocalFile(localFile);

      savedFileContentByPathRef.current.set(nextDocument.filePath!, nextDocument.content);
      rememberRecentDirectory(getDirectoryPath(nextDocument.filePath));
      setWorkspace((current) =>
        addOpenedDocumentToWorkspace(current, nextDocument, document.id),
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
      addOpenedDocumentToWorkspace(current, nextDocument, document.id),
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
    if (item.type === "separator" || item.disabled) {
      return;
    }

    setContextMenu(null);
    void item.onSelect();
  }

  async function copyTextToClipboard(text: string) {
    if (!text) {
      return;
    }

    await navigator.clipboard?.writeText(text);
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

  async function getEditorContextMenuInfo(
    event: ReactMouseEvent<HTMLElement>,
  ): Promise<EditorContextMenuInfo> {
    const target = event.target instanceof Element ? event.target : null;
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
      hasSelection: selectedText.length > 0,
      isEditable,
      isListItem: Boolean(listElement) || Boolean(textareaInfo.isListItem),
      isTaskListItem:
        Boolean(taskElement) || Boolean(textareaInfo.isTaskListItem),
      linkHref: linkElement?.href || textareaInfo.linkHref,
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
      ...(contextInfo.isEditable
        ? [
            {
              disabled: !contextInfo.hasSelection,
              icon: <Scissors size={15} />,
              label: "剪切",
              onSelect: () => runEditCommand("cut"),
              shortcut: "Ctrl+X",
            },
          ]
        : []),
      {
        disabled: !contextInfo.hasSelection,
        icon: <Copy size={15} />,
        label: "复制",
        onSelect: () => runEditCommand("copy"),
        shortcut: "Ctrl+C",
      },
      ...(contextInfo.isEditable
        ? [
            {
              disabled: !contextInfo.canPaste,
              icon: <ClipboardPaste size={15} />,
              label: "粘贴",
              onSelect: () => runEditCommand("paste"),
              shortcut: "Ctrl+V",
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
      ...(contextInfo.isEditable
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
            {
              danger: true,
              disabled: !activeDocument.content,
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

  function openFileContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    filePath: string,
  ) {
    const fileName = getPathLabel(filePath);
    const canUseFileIpc = Boolean(window.desktop);
    const sourceDocument = getDocumentByFilePath(filePath);
    const canUseFileAsLinkSource = Boolean(sourceDocument);

    openContextMenu(
      event,
      [
        {
          icon: <FileText size={15} />,
          label: "打开",
          onSelect: () => void openFileFromTree(filePath),
        },
        {
          disabled: !canRelateDocumentFile(filePath),
          icon: <Link2 size={15} />,
          label: "添加到相关文档",
          onSelect: () => relateDocumentFromFile(filePath),
          shortcut: quickDocumentLinkShortcut,
        },
        {
          disabled: !canUseFileAsLinkSource,
          icon: <BookOpenText size={15} />,
          label: "选择相关文档...",
          onSelect: () => openDocumentLinkPicker(sourceDocument),
        },
        { type: "separator" },
        {
          disabled: !window.desktop?.duplicateDocumentFile,
          icon: <Copy size={15} />,
          label: "复制文件",
          onSelect: () => void duplicateDocumentFile(filePath),
        },
        {
          icon: <Copy size={15} />,
          label: "复制路径",
          onSelect: () => void copyTextToClipboard(filePath),
        },
        {
          icon: <Copy size={15} />,
          label: "复制文件名",
          onSelect: () => void copyTextToClipboard(fileName),
        },
        { type: "separator" },
        {
          disabled: !canUseFileIpc,
          icon: <ExternalLink size={15} />,
          label: "在资源管理器中显示",
          onSelect: () => void window.desktop?.showInFolder?.(filePath),
        },
        { type: "separator" },
        {
          danger: true,
          disabled: !window.desktop?.deleteDocumentFile,
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
    openContextMenu(
      event,
      [
        {
          icon: <FolderOpen size={15} />,
          label: "打开文件夹",
          onSelect: () => void openWorkspaceDirectoryPath(directoryPath),
        },
        {
          icon: <ExternalLink size={15} />,
          label: "在资源管理器中显示",
          onSelect: () => void window.desktop?.showInFolder?.(directoryPath),
        },
        {
          icon: <RefreshCw size={15} />,
          label: "刷新",
          onSelect: () => void loadDirectoryTree(directoryPath),
        },
      ],
      246,
    );
  }

  function bumpDocumentReloadToken(documentId: string) {
    setDocumentReloadTokens((current) => ({
      ...current,
      [documentId]: (current[documentId] ?? 0) + 1,
    }));
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

      if (isCurrentDocument) {
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
      isCurrentDocument,
    });

    if (diskChangeDecision === "same-content") {
      acknowledgeSavedFileContent(payload.filePath, diskDocument.content);
      setWorkspace((current) => mergeDiskDocumentIntoWorkspace(current, diskDocument));
      return;
    }

    if (diskChangeDecision === "keep-background-conflict") {
      externalConflictPathsRef.current.add(fileKey);
      return;
    }

    if (diskChangeDecision === "confirm-current-reload") {
      externalConflictPathsRef.current.add(fileKey);

      const shouldReload = await showAppConfirm(
        getExternalChangeConfirm(payload.filePath),
      );

      if (!shouldReload) {
        return;
      }
    }

    acknowledgeSavedFileContent(payload.filePath, diskDocument.content);
    if (isCurrentDocument) {
      bumpDocumentReloadToken(changedDocument.id);
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
          case "quickCapture":
            openQuickCapture();
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

      const document = createDocumentFromLocalFile(localFile);

      if (document.filePath) {
        savedFileContentByPathRef.current.set(document.filePath, document.content);
      }

      setWorkspace((current) => addOpenedDocumentToWorkspace(current, document));
      setIsHomeOpen(false);
      setTopMenu(null);
      setSaveState("saved");
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
    insertMarkdown(createMarkdownTable(size));
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
        title: renameFromMarkdown(result.content, currentDocument.title),
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
      insertMarkdown(`![${fileName}](${reference} "align=left") `);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "图片处理失败");
    }
  }

  async function handleImageFile(file: File) {
    await handleImageDataUrl(file.name, await fileToDataUrl(file));
  }

  async function saveFileAssetForDocument(
    document: MarkdownDocument,
    fileName: string,
    sourceFilePath: string,
  ) {
    if (!document.filePath || !window.desktop?.copyAssetFromFile) {
      return sourceFilePath;
    }

    const savedAsset = await window.desktop.copyAssetFromFile({
      documentFilePath: document.filePath,
      fileName: createAssetFileName(fileName, "recording.webm"),
      sourceFilePath,
    });

    return savedAsset.reference;
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
          "正在写入 .assets",
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
        "正在复制到 .assets",
        undefined,
        importTarget.documentId,
      );
      const reference = await saveFileAssetForDocument(
        document,
        file.fileName,
        file.filePath,
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

  async function pasteFromClipboardShortcut(options: { showEmptyFeedback?: boolean } = {}) {
    if (!activeDocument || !isMarkdownDocument(activeDocument)) {
      return false;
    }

    if (await pasteClipboardMediaFallback()) {
      return true;
    }

    const text = await readClipboardTextFallback();

    if (text) {
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

    if (!shouldTryClipboardMediaFallback(event.clipboardData)) {
      return;
    }

    event.preventDefault();
    if (await pasteClipboardMediaFallback()) {
      return;
    }

    const text = event.clipboardData.getData("text/plain");

    if (text) {
      insertMarkdown(text);
      return;
    }

    setBackupMessage("未能读取剪贴板中的媒体内容");
  }

  async function saveNow() {
    try {
      await savePersistedAppState(
        createPersistedAppState({
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
            <MenuItem label="快速捕捉..." shortcut="Ctrl+Alt+N" onSelect={() => runTopMenuAction(openQuickCapture)} />
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
            <MenuSubmenu label="图像">
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
            <MenuItem label="阅读设置..." onSelect={() => runTopMenuAction(() => setIsSettingsOpen(true))} />
            <MenuSubmenu label="编辑模式">
              <MenuItem
                checked={mode === "typora"}
                label="实时渲染"
                onSelect={() => runTopMenuAction(() => updateEditorMode("typora"))}
              />
              <MenuItem
                checked={mode === "source"}
                label="源码"
                onSelect={() => runTopMenuAction(() => updateEditorMode("source"))}
              />
              <MenuItem
                checked={mode === "split"}
                label="分栏"
                onSelect={() => runTopMenuAction(() => updateEditorMode("split"))}
              />
              <MenuItem
                checked={mode === "preview"}
                label="预览"
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
        <div className="outline-empty" aria-label="当前文件为空" />
      );
    }

    if (!activeDocumentOutline.length) {
      return <div className="outline-empty">当前文件没有可显示的标题</div>;
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

  function renderCurrentDocumentPanel() {
    if (!activeDocument) {
      return <div className="outline-empty" aria-label="当前文件为空" />;
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

  const selectedContentDensity =
    editorContentDensityOptions.find(
      (option) => option.value === settings.editorContentDensity,
    ) ?? editorContentDensityOptions[1];
  const fontSizeAdjustmentLabel = formatEditorFontSizeAdjustment(
    settings.editorFontSizeAdjustment,
  );
  const windowZoomPercent = Math.round(windowZoomFactor * 100);
  const isDefaultWindowZoom =
    Math.abs(windowZoomFactor - defaultWindowZoomFactor) < 0.005;
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
        className={[
          "app-shell",
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
        onPointerMove={handleImmersivePointerMove}
        onPointerLeave={handleImmersivePointerLeave}
      >
        <header
          className="app-menubar"
          onPointerEnter={() => revealImmersiveEdge("top")}
          onPointerLeave={() => hideImmersiveEdge("top")}
        >
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
                      <div className="menubar-dropdown-scroll">
                        {renderMenubarDropdown(item.key)}
                      </div>
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
              <>
              {directoryTree ? (
                directoryTree.children?.length ? (
                  fileExplorerView === "tree" ? (
                    <div className="directory-tree-root">
                      <DirectoryTreeItems
                        activeDirectoryPath={getDirectoryPath(activeDocument?.filePath)}
                        activeFilePath={activeDocument?.filePath}
                        expandedPaths={expandedDirectoryPaths}
                        items={directoryTree.children ?? []}
                        level={0}
                        onDirectoryContextMenu={openDirectoryContextMenu}
                        onFileContextMenu={openFileContextMenu}
                        onQuickLinkFile={relateDocumentFromFile}
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
                      onFileContextMenu={openFileContextMenu}
                      onQuickLinkFile={relateDocumentFromFile}
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
              }
              </>
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
              <button type="button" onClick={openQuickCapture}>
                <Inbox size={16} />
                快速捕捉
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
          {isHomeOpen || !activeDocument ? (
            <section className="welcome-home">
              <section className="home-dashboard">
                <section className="home-main-column">
                  <section className="home-brand-panel" aria-label="工作台">
                    <div className="home-brand-logo">
                      <img src={appLogoUrl} alt="" draggable={false} />
                    </div>
                    <div className="home-brand-copy">
                      <span>noteDock</span>
                      <h1>工作台</h1>
                      <p>开始今天的整理、阅读与写作。</p>
                    </div>
                    <div className="home-hero-visual" aria-hidden="true">
                      <div className="home-hero-sheet">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="home-hero-fold" />
                      <div className="home-hero-pencil" />
                    </div>
                  </section>

                  <section className="home-shortcut-panel" aria-label="快捷操作">
                    <header className="home-section-header">
                      <h2>快捷操作</h2>
                    </header>
                    <div className="home-brand-actions">
                      <button type="button" onClick={createNewDocument}>
                        <FilePlus2 size={18} />
                        <span>
                          <strong>新建文档</strong>
                          <em>创建一篇空白笔记</em>
                        </span>
                      </button>
                      <button type="button" onClick={() => void openWorkspaceFolder()}>
                        <FolderOpen size={18} />
                        <span>
                          <strong>打开文件夹</strong>
                          <em>浏览本地知识库</em>
                        </span>
                      </button>
                      <button type="button" onClick={openKnowledgeRelationsPanel}>
                        <BookOpenText size={18} />
                        <span>
                          <strong>知识关系</strong>
                          <em>查看笔记之间的连接</em>
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="home-note-panel" aria-label="灵感便签">
                    <header className="home-section-header">
                      <div>
                        <h2>灵感便签</h2>
                        <span>自动保存在本机</span>
                      </div>
                      <ClipboardPaste size={18} />
                    </header>
                    <textarea
                      aria-label="灵感便签"
                      placeholder="先记下一个想法、临时链接或待整理的片段。"
                      value={homeQuickNote}
                      onChange={(event) => setHomeQuickNote(event.target.value)}
                    />
                  </section>

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
                      {visibleRecentDocuments.length ? (
                        visibleRecentDocuments.map((document) => (
                          <button
                            className="recent-row"
                            key={document.id}
                            title={`${getDocumentDisplayName(document)}\n${getDocumentPathPreview(
                              document,
                              workspace.workspacePath,
                            )}`}
                            type="button"
                            onClick={() => void openRecentDocument(document)}
                            onContextMenu={(event) => {
                              if (document.filePath) {
                                openFileContextMenu(event, document.filePath);
                              }
                            }}
                          >
                            <FileText size={16} />
                            <strong>{getDocumentDisplayName(document)}</strong>
                            <span>{getDocumentPathPreview(document, workspace.workspacePath)}</span>
                            <time dateTime={document.updatedAt}>
                              {formatRecentTimestamp(document.updatedAt)}
                            </time>
                          </button>
                        ))
                      ) : (
                        <div className="recent-empty">
                          <strong>还没有最近文档</strong>
                          <span>打开文件夹或新建文档后，这里会显示最近访问的笔记。</span>
                        </div>
                      )}
                    </div>
                  </section>
                </section>

                <section className="home-todo-panel" aria-label="今日待办">
                  <div className="home-todo-header">
                    <div className="home-todo-title">
                      <span>工作台</span>
                      <h1>今日待办</h1>
                      <div
                        className="home-todo-progress"
                        aria-hidden="true"
                        title={`${homeTodoProgress}%`}
                      >
                        <span style={{ width: `${homeTodoProgress}%` }} />
                      </div>
                    </div>
                    <strong>{remainingHomeTodoCount} 项未完成</strong>
                  </div>

                  <form
                    className="home-todo-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addHomeTodo();
                    }}
                  >
                    <input
                      aria-label="添加待办"
                      placeholder="添加一个待办，例如：整理会议笔记"
                      value={homeTodoDraft}
                      onChange={(event) => setHomeTodoDraft(event.target.value)}
                    />
                    <button type="submit" disabled={!homeTodoDraft.trim()}>
                      <Plus size={15} />
                      添加
                    </button>
                  </form>

                  <div
                    className={
                      homeTodoDrag
                        ? "home-todo-list home-todo-list-dragging"
                        : "home-todo-list"
                    }
                    ref={homeTodoListRef}
                  >
                    {homeTodoItems.length > 0 ? (
                      <>
                        {visibleHomeTodoItems.map((item, index) => (
                          <Fragment key={item.id}>
                            {homeTodoDrag?.insertIndex === index ? (
                              <HomeTodoDropSlot />
                            ) : null}
                            <HomeTodoRow
                              item={item}
                              onDelete={deleteHomeTodo}
                              onDragStart={handleHomeTodoDragStart}
                              onToggle={toggleHomeTodo}
                              rowRef={setHomeTodoRowRef}
                            />
                          </Fragment>
                        ))}
                        {homeTodoDrag?.insertIndex === visibleHomeTodoItems.length ? (
                          <HomeTodoDropSlot />
                        ) : null}
                      </>
                    ) : (
                      <div className="home-todo-empty">
                        <strong>暂无待办</strong>
                        <span>把今天要处理的笔记、阅读或整理任务放在这里。</span>
                      </div>
                    )}
                  </div>

                  {homeTodoDrag && activeHomeTodoItem ? (
                    <div
                      className="home-todo-drag-layer"
                      style={{
                        height: homeTodoDrag.height,
                        left: homeTodoDrag.left,
                        top: homeTodoDrag.pointerY - homeTodoDrag.offsetY,
                        width: homeTodoDrag.width,
                      }}
                    >
                      <HomeTodoDragPreview item={activeHomeTodoItem} />
                    </div>
                  ) : null}

                  {hasCompletedHomeTodos ? (
                    <button
                      className="home-todo-clear"
                      type="button"
                      onClick={clearCompletedHomeTodos}
                    >
                      清除已完成
                    </button>
                  ) : null}
                </section>
              </section>
            </section>
          ) : (
            <section
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
                    onEdit={(code) =>
                      void openUniverSheetEditor({ kind: "document" }, code)
                    }
                  />
                </section>
              ) : isDrawingDocument(activeDocument) ? (
                <section
                  className="standalone-document-viewer standalone-drawing-viewer"
                  data-select-all-scope="content"
                  tabIndex={-1}
                >
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
                <div
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
                      key={`${activeDocument.id}:${documentReloadTokens[activeDocument.id] ?? 0}`}
                      ref={typoraEditorRef}
                      documentId={activeDocument.id}
                      filePath={activeDocument.filePath}
                      value={activeMarkdownBody}
                      onChange={updateMarkdown}
                      onActiveLineChange={setActiveEditorLineIndex}
                      onEditDrawing={(drawingId) => void openDrawingEditor(drawingId)}
                      onEditUniverSheet={(code) =>
                        void openUniverSheetEditor({ code, kind: "markdown" }, code)
                      }
                      onContextMenu={openEditorContextMenu}
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
                      onContextMenu={openEditorContextMenu}
                      onPaste={handlePaste}
                    />
                  )}

                  {(mode === "split" || mode === "preview") && (
                    <article
                      className="markdown-preview"
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
            activeDocument={activeDocument}
            isInspectorOpen={isDocumentInspectorOpen}
            isSidebarHidden={isSidebarHidden}
            missingAssetReferences={missingAssetReferences}
            saveState={saveState}
            wordCount={activeDocumentWordCount}
            onToggleInspector={toggleDocumentInspector}
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

        <DocumentInspectorSidebar
          activeDocument={activeDocument}
          isOpen={isDocumentInspectorOpen}
          knowledgePanel={inspectorKnowledgePanel}
          relationsPanel={renderKnowledgeRelationsPanel()}
        />

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

        <div
          className={[
            "window-zoom-indicator",
            isZoomIndicatorVisible ? "window-zoom-indicator-visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
          aria-hidden={!isZoomIndicatorVisible}
        >
          {windowZoomPercent}%
        </div>

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
                        title: renameFromMarkdown(nextContent, document.title),
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

        <Dialog.Root open={isQuickCaptureOpen} onOpenChange={setIsQuickCaptureOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="quick-capture-dialog">
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon">
                    <Inbox size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      快速捕捉
                    </Dialog.Title>
                    <Dialog.Description>
                      把临时想法保存为当前工作区中的 Markdown 笔记
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
                className="quick-capture-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createQuickCapture();
                }}
              >
                <label>
                  <span>标题</span>
                  <input
                    autoFocus
                    value={quickCaptureTitle}
                    onChange={(event) => setQuickCaptureTitle(event.target.value)}
                    placeholder="可留空，自动使用时间命名"
                  />
                </label>
                <label>
                  <span>内容</span>
                  <textarea
                    value={quickCaptureBody}
                    onChange={(event) => setQuickCaptureBody(event.target.value)}
                    placeholder="写下临时想法、链接或待办"
                  />
                </label>
                <label>
                  <span>标签</span>
                  <input
                    value={quickCaptureTags}
                    onChange={(event) => setQuickCaptureTags(event.target.value)}
                    placeholder="inbox, idea"
                  />
                </label>
                <div className="quick-capture-actions">
                  <Dialog.Close asChild>
                    <button className="secondary-button" type="button">
                      取消
                    </button>
                  </Dialog.Close>
                  <button className="primary-button" type="submit">
                    保存捕捉
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root
          modal={false}
          open={isDocumentLinkPickerOpen}
          onOpenChange={(open) => {
            setIsDocumentLinkPickerOpen(open);
            if (!open) {
              setDocumentLinkSourceDocumentId(null);
              setDocumentLinkQuery("");
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Content
              className="document-link-picker-dialog"
              onInteractOutside={(event) => event.preventDefault()}
            >
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon">
                    <BookOpenText size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      相关文档
                    </Dialog.Title>
                    <Dialog.Description>
                      从当前工作区选择文件，添加到正在编辑的文档元信息中。
                    </Dialog.Description>
                    {documentLinkPickerSourceDocument ? (
                      <p className="document-link-picker-source">
                        关联到：
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

                    return (
                      <button
                        className="document-link-picker-item"
                        key={document.id}
                        type="button"
                        disabled={!reference || isLinked}
                        onClick={() => {
                          if (reference) {
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
                            {getDocumentPathPreview(document, workspace.workspacePath)}
                          </small>
                        </span>
                        <span
                          className={[
                            "document-link-picker-state",
                            isLinked ? "document-link-picker-state-linked" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {isLinked ? "已添加" : "添加"}
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
            <Dialog.Overlay className="dialog-overlay" />
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
          logoUrl={appLogoUrl}
          open={isAboutOpen}
          onOpenChange={setIsAboutOpen}
        />

        <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="settings-dialog">
              <div className="settings-header">
                <div className="settings-title-group">
                  <span className="settings-title-icon" aria-hidden="true">
                    <BookOpenText size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="settings-title">阅读设置</Dialog.Title>
                    <p className="settings-subtitle">
                      调整正文区域的显示大小，实时影响 Markdown、HTML 与编辑器内容。
                    </p>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭设置">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="settings-body">
                <section className="settings-section">
                  <div className="settings-section-heading">
                    <div>
                      <div className="settings-section-title">正文大小</div>
                      <p>
                        选择一个阅读密度预设，字体、行高、表格留白和内容宽度会一起调整。
                      </p>
                    </div>
                    <span className="settings-current-badge">
                      当前：{selectedContentDensity.label} · {fontSizeAdjustmentLabel}
                    </span>
                  </div>

                  <ToggleGroup.Root
                    className="settings-density-grid"
                    type="single"
                    value={settings.editorContentDensity}
                    aria-label="正文大小"
                    onValueChange={(nextDensity) => {
                      if (nextDensity) {
                        updateSetting(
                          "editorContentDensity",
                          nextDensity as AppSettings["editorContentDensity"],
                        );
                      }
                    }}
                  >
                    {editorContentDensityOptions.map((option) => (
                      <ToggleGroup.Item
                        className="settings-density-card"
                        key={option.value}
                        value={option.value}
                        aria-label={option.label}
                      >
                        <span className="settings-density-title">
                          <strong>{option.label}</strong>
                          <span>{option.meta}</span>
                        </span>
                        <span className="settings-density-description">
                          {option.description}
                        </span>
                        <span
                          className={`settings-density-preview settings-density-preview-${option.value}`}
                          aria-hidden="true"
                        >
                          <span />
                          <span />
                          <span />
                        </span>
                      </ToggleGroup.Item>
                    ))}
                  </ToggleGroup.Root>

                  <div className="settings-font-control">
                    <div className="settings-font-control-header">
                      <div>
                        <div className="settings-font-control-title">字号微调</div>
                        <p>在当前预设基础上拖拽调整，适合按屏幕距离和主题字体再细调。</p>
                      </div>
                      <span className="settings-font-value-badge">
                        {fontSizeAdjustmentLabel}
                      </span>
                    </div>
                    <div className="settings-font-slider-row">
                      <span>{editorFontSizeAdjustmentRange.min}px</span>
                      <input
                        className="settings-font-slider"
                        type="range"
                        min={editorFontSizeAdjustmentRange.min}
                        max={editorFontSizeAdjustmentRange.max}
                        step={editorFontSizeAdjustmentRange.step}
                        value={settings.editorFontSizeAdjustment}
                        aria-label="字号微调"
                        onChange={(event) => {
                          updateSetting(
                            "editorFontSizeAdjustment",
                            Number(event.currentTarget.value),
                          );
                        }}
                      />
                      <span>+{editorFontSizeAdjustmentRange.max}px</span>
                    </div>
                    <div className="settings-font-control-footer">
                      <span>预设控制整体密度，微调只改变正文基准字号。</span>
                      <button
                        className="settings-font-reset"
                        type="button"
                        onClick={() =>
                          updateSetting(
                            "editorFontSizeAdjustment",
                            editorFontSizeAdjustmentRange.defaultValue,
                          )
                        }
                      >
                        重置到预设
                      </button>
                    </div>
                  </div>
                </section>

                <section className="settings-preview-panel" aria-label="显示预览">
                  <div className="settings-preview-kicker">预览</div>
                  <h3>项目笔记</h3>
                  <p>
                    文本大小会同步影响正文、列表和表格区域。这个设置偏向阅读体验，不改变文档本身内容。
                  </p>
                  <div className="settings-preview-table" aria-hidden="true">
                    <span>类型</span>
                    <span>状态</span>
                    <span>Markdown</span>
                    <span>已同步</span>
                  </div>
                </section>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </>
  );
}
