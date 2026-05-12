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
  ImagePlus,
  MoreVertical,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SplitSquareHorizontal,
  Table2,
  UploadCloud,
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

const backupProvider = createCloudBackupProvider();
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

type MenubarMenu = "file" | "edit" | "paragraph" | "format" | "view" | "help";
type TopMenu = MenubarMenu | null;
type AppTheme = "light" | "paper" | "dark";
type SidebarTab = "files" | "current";

const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: "明亮", value: "light" },
  { label: "纸张", value: "paper" },
  { label: "深色", value: "dark" },
];

const menubarItems: Array<{ key: MenubarMenu; label: string }> = [
  { key: "file", label: "文件(F)" },
  { key: "edit", label: "编辑(E)" },
  { key: "paragraph", label: "段落(P)" },
  { key: "format", label: "格式(O)" },
  { key: "view", label: "视图(V)" },
  { key: "help", label: "帮助(H)" },
];

function getInitialTheme(): AppTheme {
  const storedTheme = window.localStorage.getItem("typora-like-theme");

  return storedTheme === "paper" || storedTheme === "dark" ? storedTheme : "light";
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
      const result = await uploadImage(file);
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
      const result = await backupProvider.backup(workspace);
      setBackupMessage(result.message);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "云备份失败");
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
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(createNewDocument)}>
              <FilePlus2 size={15} />
              <span>新建 Markdown 文件</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runTopMenuAction(() => void openWorkspaceFolder())}
            >
              <FolderOpen size={15} />
              <span>打开文件夹...</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runTopMenuAction(() => void showWorkspaceInFolder())}
            >
              <ExternalLink size={15} />
              <span>在资源管理器中显示</span>
            </button>
            <div className="menubar-dropdown-separator" />
            <button
              type="button"
              role="menuitem"
              onClick={() => runTopMenuAction(() => void loadDirectoryTree())}
            >
              <RefreshCw size={15} />
              <span>刷新目录</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runTopMenuAction(() => void backupNow())}
            >
              <UploadCloud size={15} />
              <span>立即云备份</span>
            </button>
          </>
        );
      case "edit":
        return (
          <>
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(() => setIsHomeOpen(false))}>
              <Pencil size={15} />
              <span>编辑当前文档</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(() => setIsActionsOpen(true))}>
              <Search size={15} />
              <span>打开文件操作</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(() => setIsSettingsOpen(true))}>
              <Settings size={15} />
              <span>设置</span>
            </button>
          </>
        );
      case "paragraph":
        return (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runTopMenuAction(() => {
                  setIsHomeOpen(false);
                  insertTable({ columns: 3, rows: 3 });
                })
              }
            >
              <Table2 size={15} />
              <span>插入 3 x 3 表格</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runTopMenuAction(() => {
                  setIsHomeOpen(false);
                  setIsDrawingOpen(true);
                })
              }
            >
              <Pencil size={15} />
              <span>插入 Excalidraw</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runTopMenuAction(() => {
                  setIsHomeOpen(false);
                  readFileInput(imageInputRef.current);
                })
              }
            >
              <ImagePlus size={15} />
              <span>插入图片</span>
            </button>
          </>
        );
      case "format":
        return (
          <>
            {editorModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={mode === option.value}
                onClick={() =>
                  runTopMenuAction(() => {
                    setMode(option.value);
                    setIsHomeOpen(false);
                  })
                }
              >
                {option.icon}
                <span>{option.label}</span>
                {mode === option.value && <Check size={14} />}
              </button>
            ))}
          </>
        );
      case "view":
        return (
          <>
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(() => setIsHomeOpen(true))}>
              <BookOpenText size={15} />
              <span>欢迎页</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runTopMenuAction(() => setIsHomeOpen(false))}>
              <FileText size={15} />
              <span>当前文档</span>
            </button>
            <div className="menubar-dropdown-separator" />
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option.value}
                onClick={() => runTopMenuAction(() => setTheme(option.value))}
              >
                <span className={`theme-dot theme-dot-${option.value}`} />
                <span>{option.label}</span>
                {theme === option.value && <Check size={14} />}
              </button>
            ))}
          </>
        );
      case "help":
        return (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runTopMenuAction(() => {
                  setBackupMessage("Markdown 编辑器 · Electron + Milkdown");
                })
              }
            >
              <BookOpenText size={15} />
              <span>关于编辑器</span>
            </button>
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
                    onClick={() =>
                      setTopMenu((current) => (current === item.key ? null : item.key))
                    }
                  >
                    {item.label}
                  </button>
                  {topMenu === item.key && (
                    <div className="menubar-dropdown" role="menu" aria-label={item.label}>
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
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </>
  );
}
