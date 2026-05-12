import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  MoreVertical,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SplitSquareHorizontal,
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
  type ReactNode,
} from "react";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import {
  TyporaEditor,
  type TyporaEditorHandle,
} from "./components/TyporaEditor";
import { createCloudBackupProvider } from "./services/cloudBackup";
import { uploadImage } from "./services/imageUpload";
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
  LocalMarkdownFile,
  MarkdownDocument,
  SaveState,
  WorkspaceSnapshot,
} from "./types";

const DrawingModal = lazy(() =>
  import("./components/DrawingModal").then((module) => ({
    default: module.DrawingModal,
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
const appThemeValues = [
  "light",
  "paper",
  "github",
  "newsprint",
  "night",
  "pixyll",
  "whitey",
  "dark",
] as const;
type AppTheme = (typeof appThemeValues)[number];
type SidebarTab = "files" | "current";
type AppSettings = {
  imageUploadEndpoint: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossBaseUrl: string;
  ossBucket: string;
  ossEndpoint: string;
  ossRegion: string;
  remoteServerToken: string;
  remoteServerUrl: string;
};

const appSettingsStorageKey = "typora-like-settings";
const defaultAppSettings: AppSettings = {
  imageUploadEndpoint: "",
  ossAccessKeyId: "",
  ossAccessKeySecret: "",
  ossBaseUrl: "",
  ossBucket: "",
  ossEndpoint: "",
  ossRegion: "",
  remoteServerToken: "",
  remoteServerUrl: "",
};

const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: "Github", value: "github" },
  { label: "Newsprint", value: "newsprint" },
  { label: "Night", value: "night" },
  { label: "Pixyll", value: "pixyll" },
  { label: "Whitey", value: "whitey" },
];

const menubarItems: Array<{ key: MenubarMenu; label: string }> = [
  { key: "file", label: "文件(F)" },
  { key: "edit", label: "编辑(E)" },
  { key: "paragraph", label: "段落(P)" },
  { key: "format", label: "格式(O)" },
  { key: "view", label: "视图(V)" },
  { key: "theme", label: "主题(T)" },
  { key: "help", label: "帮助(H)" },
];

function getInitialTheme(): AppTheme {
  const storedTheme = window.localStorage.getItem("typora-like-theme");

  return themeOptions.some((option) => option.value === storedTheme)
    ? (storedTheme as AppTheme)
    : "github";
}

function loadAppSettings(): AppSettings {
  try {
    const storedSettings = window.localStorage.getItem(appSettingsStorageKey);

    if (!storedSettings) {
      return defaultAppSettings;
    }

    return {
      ...defaultAppSettings,
      ...(JSON.parse(storedSettings) as Partial<AppSettings>),
    };
  } catch {
    return defaultAppSettings;
  }
}

const now = () => new Date().toISOString();

type TableSize = {
  columns: number;
  rows: number;
};

function updateDocument(
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
      {shortcut && <kbd>{shortcut}</kbd>}
      {submenu && <ChevronRight className="menubar-dropdown-arrow" size={18} />}
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

function getDirectoryPath(filePath?: string) {
  if (!filePath) {
    return undefined;
  }

  return filePath.split(/[\\/]/).slice(0, -1).join("\\");
}

function getDocumentPathPreview(document: MarkdownDocument, workspacePath?: string) {
  const directoryPath = getDirectoryPath(document.filePath) || workspacePath || "D:";
  const normalizedPath = directoryPath.replace(/\\/g, "/");

  return normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
}

function normalizeMarkdownTitle(value: string) {
  return value.trim().replace(/\.md$/i, "") || "Untitled";
}

function createDocumentFromLocalFile(file: LocalMarkdownFile): MarkdownDocument {
  return {
    ...createDocument(file.title, file.content, file.filePath),
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

function mergeDocumentByFilePath(
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

type OutlineEntry = {
  id: string;
  level: number;
  lineIndex: number;
  title: string;
};

function normalizeOutlineTitle(value: string) {
  return value
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentOutline(markdown: string): OutlineEntry[] {
  return markdown
    .split("\n")
    .map((line, lineIndex) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);

      if (!match) {
        return null;
      }

      const title = normalizeOutlineTitle(match[2]);

      if (!title) {
        return null;
      }

      return {
        id: `${lineIndex}-${title}`,
        level: match[1].length,
        lineIndex,
        title,
      };
    })
    .filter((entry): entry is OutlineEntry => Boolean(entry));
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
      {isExpanded && item.children?.map((child) =>
        child.type === "directory" ? (
          <DirectoryTree
            activeDirectoryPath={activeDirectoryPath}
            activeFilePath={activeFilePath}
            expandedPaths={expandedPaths}
            item={child}
            key={child.path}
            level={level + 1}
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
            style={{ "--tree-depth": `${(level + 1) * 18}px` } as CSSProperties}
            type="button"
            onClick={() => onOpenFile(child.path)}
          >
            <span className="directory-tree-caret-placeholder" />
            <FileText size={17} />
            <span>{child.name}</span>
          </button>
        ),
      )}
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
  const [, setSaveState] = useState<SaveState>("idle");
  const [, setBackupMessage] = useState("本地自动保存已启用");
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [newFileName, setNewFileName] = useState("Untitled");
  const [directoryTree, setDirectoryTree] = useState<DirectoryTreeItem | null>(
    null,
  );
  const [expandedDirectoryPaths, setExpandedDirectoryPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeEditorLineIndex, setActiveEditorLineIndex] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument = useMemo(
    () =>
      workspace.documents.find((item) => item.id === workspace.activeDocumentId) ??
      workspace.documents[0],
    [workspace],
  );
  const workspaceLabel = getPathLabel(workspace.workspacePath);
  const recentDocuments = useMemo(
    () =>
      [...workspace.documents]
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
        )
        .slice(0, 5),
    [workspace.documents],
  );
  const activeDocumentOutline = useMemo(
    () => getDocumentOutline(activeDocument.content),
    [activeDocument.content],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("typora-like-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(appSettingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  function updateSetting(key: keyof AppSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
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

      if (topMenu && !event.target.closest(".menubar-item")) {
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
    setActiveEditorLineIndex(0);
  }, [activeDocument.id]);

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        saveWorkspace(workspace);
        const writableDocuments = workspace.documents.filter(
          (document) => document.filePath,
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
            setSaveState("saved");
            void loadDirectoryTree();
          })
          .catch(() => setSaveState("failed"));
      } catch {
        setSaveState("failed");
      }
    }, 250);

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

      const localDocuments = localFiles.map(createDocumentFromLocalFile);
      const fallbackDocument = createDocument("Untitled", "# Untitled\n\n");
      const nextDocuments = localDocuments.length ? localDocuments : [fallbackDocument];

      setWorkspace((current) => ({
        ...current,
        activeDocumentId: nextDocuments[0].id,
        documents: nextDocuments,
        workspacePath: directoryPath,
      }));
      setDirectoryTree(tree);
      setExpandedDirectoryPaths(new Set(tree ? collectDirectoryPaths(tree) : []));
      setIsHomeOpen(true);
      setIsActionsOpen(false);
      setTopMenu(null);
      setSaveState("saved");
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

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: document.id,
      documents: mergeDocumentByFilePath(current.documents, document),
      workspacePath: current.workspacePath || filePath.split(/[\\/]/).slice(0, -1).join("\\"),
    }));
    setIsHomeOpen(false);
  }

  async function showWorkspaceInFolder() {
    const targetPath = workspace.workspacePath || activeDocument.filePath;

    if (!targetPath) {
      return;
    }

    await window.desktop?.showInFolder?.(targetPath);
    setIsActionsOpen(false);
  }

  function patchActiveDocument(patch: Partial<MarkdownDocument>) {
    setWorkspace((current) => {
      const currentDocument =
        current.documents.find((item) => item.id === current.activeDocumentId) ??
        current.documents[0];
      const nextDocument = {
        ...currentDocument,
        ...patch,
        updatedAt: now(),
      };

      return updateDocument(current, nextDocument);
    });
  }

  function updateMarkdown(content: string) {
    patchActiveDocument({
      content,
      title: renameFromMarkdown(content, activeDocument.title),
    });
  }

  function insertMarkdown(markdown: string) {
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

  function insertTable(size: TableSize) {
    insertMarkdown(createMarkdownTable(size));
  }

  async function handleImageFile(file: File) {
    try {
      const result = await uploadImage(file, {
        endpoint: settings.imageUploadEndpoint.trim() || undefined,
      });
      insertMarkdown(`\n![${file.name}](${result.url} "align=center")\n`);
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

  async function backupNow() {
    try {
      setBackupMessage("正在备份");
      const backupProvider = createCloudBackupProvider({
        endpoint: settings.remoteServerUrl.trim() || undefined,
        token: settings.remoteServerToken.trim() || undefined,
      });
      const result = await backupProvider.backup(workspace);
      setBackupMessage(result.message);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "云备份失败");
    }
  }

  async function saveNow() {
    try {
      saveWorkspace(workspace);

      if (activeDocument.filePath && window.desktop?.writeMarkdownFile) {
        await window.desktop.writeMarkdownFile({
          content: activeDocument.content,
          filePath: activeDocument.filePath,
        });
      }

      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  }

  function setEditorMode(nextMode: EditorMode) {
    setMode(nextMode);
    setIsHomeOpen(false);
  }

  function runDocumentCommand(command: string) {
    document.execCommand(command);
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
            <MenuItem label="新建" shortcut="Ctrl+N" onSelect={() => runTopMenuAction(createNewDocument)} />
            <MenuItem label="新建窗口" shortcut="Ctrl+Shift+N" disabled />
            <MenuSeparator />
            <MenuItem label="打开..." shortcut="Ctrl+O" onSelect={() => runTopMenuAction(() => void openWorkspaceFolder())} />
            <MenuItem label="打开文件夹..." onSelect={() => runTopMenuAction(() => void openWorkspaceFolder())} />
            <MenuSeparator />
            <MenuItem label="快速打开..." shortcut="Ctrl+P" onSelect={() => runTopMenuAction(() => setIsActionsOpen(true))} />
            <MenuItem label="打开最近文件" submenu disabled />
            <MenuSeparator />
            <MenuItem label="保存" shortcut="Ctrl+S" onSelect={() => runTopMenuAction(() => void saveNow())} />
            <MenuItem label="另存为..." shortcut="Ctrl+Shift+S" disabled />
            <MenuItem label="移动到..." disabled />
            <MenuItem label="保存全部打开的文件..." onSelect={() => runTopMenuAction(() => void saveNow())} />
            <MenuSeparator />
            <MenuItem label="属性..." disabled />
            <MenuItem label="打开文件位置..." onSelect={() => runTopMenuAction(() => void showWorkspaceInFolder())} />
            <MenuItem label="在侧边栏中显示" onSelect={() => runTopMenuAction(() => setSidebarTab("files"))} />
            <MenuItem label="删除..." disabled />
            <MenuSeparator />
            <MenuItem label="导入..." disabled />
            <MenuItem label="导出" submenu onSelect={() => runTopMenuAction(() => void backupNow())} />
            <MenuItem label="打印..." shortcut="Alt+Shift+P" disabled />
            <MenuSeparator />
            <MenuItem label="偏好设置..." shortcut="Ctrl+逗号" onSelect={() => runTopMenuAction(() => setIsSettingsOpen(true))} />
            <MenuSeparator />
            <MenuItem label="关闭" shortcut="Ctrl+W" disabled />
          </>
        );
      case "edit":
        return (
          <>
            <MenuItem label="撤消" shortcut="Ctrl+Z" onSelect={() => runTopMenuAction(() => runDocumentCommand("undo"))} />
            <MenuItem label="重做" shortcut="Ctrl+Y" onSelect={() => runTopMenuAction(() => runDocumentCommand("redo"))} />
            <MenuSeparator />
            <MenuItem label="剪切" shortcut="Ctrl+X" onSelect={() => runTopMenuAction(() => runDocumentCommand("cut"))} />
            <MenuItem label="复制" shortcut="Ctrl+C" onSelect={() => runTopMenuAction(() => runDocumentCommand("copy"))} />
            <MenuItem label="拷贝图片" disabled />
            <MenuItem label="粘贴" shortcut="Ctrl+V" onSelect={() => runTopMenuAction(() => runDocumentCommand("paste"))} />
            <MenuSeparator />
            <MenuItem label="复制为纯文本" disabled />
            <MenuItem label="复制为 Markdown" shortcut="Ctrl+Shift+C" disabled />
            <MenuItem label="复制为 HTML 代码" disabled />
            <MenuItem label="复制内容并简化格式" disabled />
            <MenuSeparator />
            <MenuItem label="粘贴为纯文本" shortcut="Ctrl+Shift+V" disabled />
            <MenuSeparator />
            <MenuItem label="选择" submenu disabled />
            <MenuItem label="上移该行" shortcut="Alt+向上箭头" disabled />
            <MenuItem label="下移该行" shortcut="Alt+向下箭头" disabled />
            <MenuSeparator />
            <MenuItem label="删除" onSelect={() => runTopMenuAction(() => runDocumentCommand("delete"))} />
            <MenuItem label="删除范围" submenu disabled />
            <MenuSeparator />
            <MenuItem label="数学工具" submenu disabled />
            <MenuSeparator />
            <MenuItem label="智能标点" submenu disabled />
            <MenuItem label="换行符" submenu disabled />
            <MenuItem label="空格与换行" submenu disabled />
            <MenuItem label="拼写检查..." disabled />
            <MenuSeparator />
            <MenuItem label="查找和替换" submenu onSelect={() => runTopMenuAction(() => setIsActionsOpen(true))} />
            <MenuSeparator />
            <MenuItem label="表情与符号" shortcut="Win 键+句号" disabled />
          </>
        );
      case "paragraph":
        return (
          <>
            <MenuItem label="一级标题" shortcut="Ctrl+1" onSelect={() => runTopMenuAction(() => insertMarkdown("# "))} />
            <MenuItem label="二级标题" shortcut="Ctrl+2" onSelect={() => runTopMenuAction(() => insertMarkdown("## "))} />
            <MenuItem label="三级标题" shortcut="Ctrl+3" onSelect={() => runTopMenuAction(() => insertMarkdown("### "))} />
            <MenuItem label="四级标题" shortcut="Ctrl+4" onSelect={() => runTopMenuAction(() => insertMarkdown("#### "))} />
            <MenuItem label="五级标题" shortcut="Ctrl+5" onSelect={() => runTopMenuAction(() => insertMarkdown("##### "))} />
            <MenuItem label="六级标题" shortcut="Ctrl+6" onSelect={() => runTopMenuAction(() => insertMarkdown("###### "))} />
            <MenuSeparator />
            <MenuItem label="段落" shortcut="Ctrl+0" onSelect={() => runTopMenuAction(() => insertMarkdown("\n"))} />
            <MenuSeparator />
            <MenuItem label="提升标题级别" shortcut="Ctrl+=" disabled />
            <MenuItem label="降低标题级别" shortcut="Ctrl+-" disabled />
            <MenuSeparator />
            <MenuItem label="表格" submenu onSelect={() => runTopMenuAction(() => insertTable({ columns: 3, rows: 3 }))} />
            <MenuItem label="公式块" shortcut="Ctrl+Shift+M" onSelect={() => runTopMenuAction(() => insertMarkdown("\n$$\n\n$$\n"))} />
            <MenuItem label="代码块" shortcut="Ctrl+Shift+K" onSelect={() => runTopMenuAction(() => insertMarkdown("\n```\n\n```\n"))} />
            <MenuItem label="代码工具" submenu disabled />
            <MenuItem label="警告框" submenu disabled />
            <MenuSeparator />
            <MenuItem label="引用" shortcut="Ctrl+Shift+Q" onSelect={() => runTopMenuAction(() => insertMarkdown("> "))} />
            <MenuSeparator />
            <MenuItem label="有序列表" shortcut="Ctrl+Shift+[" onSelect={() => runTopMenuAction(() => insertMarkdown("1. "))} />
            <MenuItem label="无序列表" shortcut="Ctrl+Shift+]" onSelect={() => runTopMenuAction(() => insertMarkdown("- "))} />
            <MenuItem label="任务列表" shortcut="Ctrl+Shift+X" onSelect={() => runTopMenuAction(() => insertMarkdown("- [ ] "))} />
            <MenuItem label="任务状态" submenu disabled />
            <MenuItem label="列表缩进" submenu disabled />
            <MenuSeparator />
            <MenuItem label="在上方插入段落" onSelect={() => runTopMenuAction(() => insertMarkdown("\n"))} />
            <MenuItem label="在下方插入段落" onSelect={() => runTopMenuAction(() => insertMarkdown("\n"))} />
            <MenuSeparator />
            <MenuItem label="链接引用" disabled />
            <MenuItem label="脚注" disabled />
            <MenuSeparator />
            <MenuItem label="水平分割线" onSelect={() => runTopMenuAction(() => insertMarkdown("\n---\n"))} />
            <MenuItem label="内容目录" onSelect={() => runTopMenuAction(() => setSidebarTab("current"))} />
            <MenuItem label="YAML Front Matter" onSelect={() => runTopMenuAction(() => insertMarkdown("---\n\n---\n"))} />
          </>
        );
      case "format":
        return (
          <>
            <MenuItem label="加粗" shortcut="Ctrl+B" onSelect={() => runTopMenuAction(() => insertMarkdown("****"))} />
            <MenuItem label="斜体" shortcut="Ctrl+I" onSelect={() => runTopMenuAction(() => insertMarkdown("**"))} />
            <MenuItem label="下划线" shortcut="Ctrl+U" onSelect={() => runTopMenuAction(() => runDocumentCommand("underline"))} />
            <MenuItem label="代码" shortcut="Ctrl+Shift+`" onSelect={() => runTopMenuAction(() => insertMarkdown("``"))} />
            <MenuSeparator />
            <MenuItem label="删除线" shortcut="Alt+Shift+5" onSelect={() => runTopMenuAction(() => insertMarkdown("~~~~"))} />
            <MenuItem label="注释" disabled />
            <MenuSeparator />
            <MenuItem label="超链接" shortcut="Ctrl+K" onSelect={() => runTopMenuAction(() => insertMarkdown("[]()"))} />
            <MenuItem label="链接操作" submenu disabled />
            <MenuItem label="图像" submenu onSelect={() => runTopMenuAction(() => readFileInput(imageInputRef.current))} />
            <MenuSeparator />
            <MenuItem label="清除样式" shortcut="Ctrl+\\" disabled />
          </>
        );
      case "view":
        return (
          <>
            <MenuItem label="显示 / 隐藏侧边栏" shortcut="Ctrl+Shift+L" onSelect={() => runTopMenuAction(() => setSidebarTab("files"))} />
            <MenuItem label="大纲" shortcut="Ctrl+Shift+1" onSelect={() => runTopMenuAction(() => setSidebarTab("current"))} />
            <MenuItem label="文档列表" shortcut="Ctrl+Shift+2" onSelect={() => runTopMenuAction(() => setIsHomeOpen(true))} />
            <MenuItem label="文件树" shortcut="Ctrl+Shift+3" onSelect={() => runTopMenuAction(() => setSidebarTab("files"))} />
            <MenuItem label="搜索" shortcut="Ctrl+Shift+F" onSelect={() => runTopMenuAction(() => setIsActionsOpen(true))} />
            <MenuSeparator />
            <MenuItem label="源代码模式" shortcut="Ctrl+/" checked={mode === "source"} onSelect={() => runTopMenuAction(() => setEditorMode("source"))} />
            <MenuSeparator />
            <MenuItem label="专注模式" shortcut="F8" disabled />
            <MenuItem label="打字机模式" shortcut="F9" disabled />
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
            <MenuSeparator />
            <MenuItem label="开发者工具" shortcut="Shift+F12" disabled />
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
      <main className="app-shell">
        <header className="app-menubar">
          <div className="menubar-left">
            <button
              className="app-logo-button"
              type="button"
              aria-label="返回首页"
              onClick={() => setIsHomeOpen(true)}
            >
              T
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
                    >
                      {renderMenubarDropdown(item.key)}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </header>

        <aside className="sidebar explorer-sidebar">
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
              className={sidebarTab === "current" ? "explorer-tab explorer-tab-active" : "explorer-tab"}
              type="button"
              role="tab"
              aria-selected={sidebarTab === "current"}
              onClick={() => setSidebarTab("current")}
            >
              当前文件
            </button>
          </div>

          <div className="explorer-tree" aria-label={sidebarTab === "files" ? "文件目录" : "当前文件"}>
            {sidebarTab === "files" ? (
              directoryTree ? (
                directoryTree.children?.length ? (
                  <DirectoryTree
                    activeDirectoryPath={getDirectoryPath(activeDocument.filePath)}
                    activeFilePath={activeDocument.filePath}
                    expandedPaths={expandedDirectoryPaths}
                    item={directoryTree}
                    onOpenFile={(filePath) => {
                      void openFileFromTree(filePath);
                    }}
                    onToggleDirectory={toggleDirectoryPath}
                  />
                ) : (
                  <div className="explorer-empty">
                    <FolderOpen size={24} />
                    <strong>{workspaceLabel}</strong>
                    <span>当前文件夹中没有找到 Markdown 文件</span>
                    <button type="button" onClick={createNewDocument}>
                      新建 Markdown 文件
                    </button>
                  </div>
                )
              ) : (
                <div className="explorer-empty">
                  <FolderOpen size={24} />
                  <strong>选择本地文件夹</strong>
                  <span>打开一个目录后，会递归读取并显示其中的 .md 文件</span>
                  <button type="button" onClick={() => void openWorkspaceFolder()}>
                    打开文件夹
                  </button>
                </div>
              )
            ) : activeDocumentOutline.length ? (
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
            ) : (
              <div className="outline-empty">当前文件没有可显示的标题</div>
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
              <button type="button" onClick={() => setIsActionsOpen(false)}>
                <Search size={16} />
                搜索
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
            </div>
          )}

          <div className="explorer-header explorer-footer-bar">
            <div className="explorer-title">
              <FolderOpen size={17} />
              <span>文件</span>
            </div>
            <div className="explorer-actions">
              <button type="button" aria-label="搜索">
                <Search size={17} />
              </button>
              <button type="button" aria-label="新建文件" onClick={createNewDocument}>
                <Plus size={17} />
              </button>
              <button
                type="button"
                aria-label="刷新"
                onClick={() => {
                  void loadDirectoryTree();
                }}
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                aria-label="更多"
                aria-expanded={isActionsOpen}
                data-sidebar-actions-trigger
                onClick={() => setIsActionsOpen((current) => !current)}
              >
                <MoreVertical size={17} />
              </button>
            </div>
          </div>
        </aside>

        <section className="workspace">
          {isHomeOpen ? (
            <section className="welcome-home">
              <div className="welcome-hero">
                <div className="welcome-logo">T</div>
                <h1>
                  欢迎使用 <span>Markdown</span> 编辑器
                </h1>
                <p>专注于写作与思考，让 Markdown 创作更高效优雅。</p>
                <WelcomeIllustration />
              </div>

              <section className="recent-documents">
                <div className="recent-header">
                  <h2>最近文档</h2>
                  <button type="button">
                    更多
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="recent-list">
                  {recentDocuments.map((document) => (
                    <button
                      className="recent-row"
                      key={document.id}
                      type="button"
                      onClick={() => setActiveDocument(document.id)}
                    >
                      <FileText size={16} />
                      <strong>{document.title}.md</strong>
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
              <div className={`editor-layout editor-layout-${mode}`}>
                {mode === "typora" && (
                  <TyporaEditor
                    ref={typoraEditorRef}
                    value={activeDocument.content}
                    onChange={updateMarkdown}
                    onActiveLineChange={setActiveEditorLineIndex}
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
                    <MarkdownRenderer>{activeDocument.content}</MarkdownRenderer>
                  </article>
                )}
              </div>
            </section>
          )}
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

        <Dialog.Root open={isDrawingOpen} onOpenChange={setIsDrawingOpen}>
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
                <DrawingModal
                  assetIndex={Object.keys(activeDocument.drawings).length + 1}
                  onClose={() => setIsDrawingOpen(false)}
                  onInsert={(asset: DrawingAsset) => {
                    patchActiveDocument({
                      drawings: {
                        ...activeDocument.drawings,
                        [asset.id]: asset,
                      },
                    });
                    insertMarkdown(
                      `\n![${asset.name}](${asset.dataUrl} "excalidraw:${asset.id}")\n`,
                    );
                  }}
                />
              </Suspense>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={isCreateFileOpen} onOpenChange={setIsCreateFileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="create-file-dialog">
              <div className="settings-header">
                <Dialog.Title className="settings-title">
                  新建 Markdown 文件
                </Dialog.Title>
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
                      取消
                    </button>
                  </Dialog.Close>
                  <button className="primary-button" type="submit">
                    确定
                  </button>
                </div>
              </form>
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
                <div className="settings-section-title">Remote Sync</div>
                <label className="settings-field">
                  <span>Server URL</span>
                  <input
                    placeholder="https://example.com/backup"
                    value={settings.remoteServerUrl}
                    onChange={(event) =>
                      updateSetting("remoteServerUrl", event.target.value)
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>Token</span>
                  <input
                    type="password"
                    value={settings.remoteServerToken}
                    onChange={(event) =>
                      updateSetting("remoteServerToken", event.target.value)
                    }
                  />
                </label>
              </section>
              <section className="settings-section settings-form-section">
                <div className="settings-section-title">Image Upload / OSS</div>
                <label className="settings-field">
                  <span>Upload API</span>
                  <input
                    placeholder="https://example.com/upload"
                    value={settings.imageUploadEndpoint}
                    onChange={(event) =>
                      updateSetting("imageUploadEndpoint", event.target.value)
                    }
                  />
                </label>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span>OSS Endpoint</span>
                    <input
                      placeholder="oss-cn-shanghai.aliyuncs.com"
                      value={settings.ossEndpoint}
                      onChange={(event) =>
                        updateSetting("ossEndpoint", event.target.value)
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>Region</span>
                    <input
                      placeholder="oss-cn-shanghai"
                      value={settings.ossRegion}
                      onChange={(event) =>
                        updateSetting("ossRegion", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span>Bucket</span>
                    <input
                      value={settings.ossBucket}
                      onChange={(event) =>
                        updateSetting("ossBucket", event.target.value)
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>Base URL</span>
                    <input
                      placeholder="https://bucket.oss-cn-shanghai.aliyuncs.com"
                      value={settings.ossBaseUrl}
                      onChange={(event) =>
                        updateSetting("ossBaseUrl", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span>Access Key ID</span>
                    <input
                      value={settings.ossAccessKeyId}
                      onChange={(event) =>
                        updateSetting("ossAccessKeyId", event.target.value)
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>Access Key Secret</span>
                    <input
                      type="password"
                      value={settings.ossAccessKeySecret}
                      onChange={(event) =>
                        updateSetting("ossAccessKeySecret", event.target.value)
                      }
                    />
                  </label>
                </div>
              </section>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </>
  );
}
