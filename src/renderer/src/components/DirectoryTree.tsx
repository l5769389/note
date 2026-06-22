import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { isQuickDocumentLinkShortcut } from "../workspaceShortcuts";
import type { DirectoryTreeItem } from "../types";

type DirectoryTreeHandlerProps = {
  activeDirectoryPath?: string;
  activeFilePath?: string;
  expandedPaths: Set<string>;
  onDirectoryContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    directoryPath: string,
  ) => void;
  onFileContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    filePath: string,
  ) => void;
  onItemDragStart?: (
    event: ReactDragEvent<HTMLButtonElement>,
    item: DirectoryTreeItem,
  ) => void;
  onQuickLinkFile?: (filePath: string) => void;
  onOpenFile: (filePath: string) => void;
  onToggleDirectory: (directoryPath: string) => void;
};

type DirectoryTreeProps = DirectoryTreeHandlerProps & {
  item: DirectoryTreeItem;
  level?: number;
};

function DirectoryTree({
  activeDirectoryPath,
  activeFilePath,
  expandedPaths,
  item,
  level = 0,
  onDirectoryContextMenu,
  onFileContextMenu,
  onItemDragStart,
  onQuickLinkFile,
  onOpenFile,
  onToggleDirectory,
}: DirectoryTreeProps) {
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
        title={item.name}
        type="button"
        draggable={Boolean(onItemDragStart)}
        onDragStart={(event) => onItemDragStart?.(event, item)}
        onClick={() => onToggleDirectory(item.path)}
        onContextMenu={(event) => onDirectoryContextMenu?.(event, item.path)}
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
          onDirectoryContextMenu={onDirectoryContextMenu}
          onFileContextMenu={onFileContextMenu}
          onItemDragStart={onItemDragStart}
          onQuickLinkFile={onQuickLinkFile}
          onOpenFile={onOpenFile}
          onToggleDirectory={onToggleDirectory}
        />
      ) : null}
    </div>
  );
}

type DirectoryTreeItemsProps = DirectoryTreeHandlerProps & {
  items: DirectoryTreeItem[];
  level: number;
};

export function DirectoryTreeItems({
  activeDirectoryPath,
  activeFilePath,
  expandedPaths,
  items,
  level,
  onDirectoryContextMenu,
  onFileContextMenu,
  onItemDragStart,
  onQuickLinkFile,
  onOpenFile,
  onToggleDirectory,
}: DirectoryTreeItemsProps) {
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
            onDirectoryContextMenu={onDirectoryContextMenu}
            onFileContextMenu={onFileContextMenu}
            onItemDragStart={onItemDragStart}
            onQuickLinkFile={onQuickLinkFile}
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
            title={child.name}
            type="button"
            draggable={Boolean(onItemDragStart)}
            onDragStart={(event) => onItemDragStart?.(event, child)}
            onClick={() => onOpenFile(child.path)}
            onContextMenu={(event) => onFileContextMenu?.(event, child.path)}
            onMouseDown={(event) => {
              if (event.detail > 1) {
                event.preventDefault();
              }
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (!isQuickDocumentLinkShortcut(event)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              onQuickLinkFile?.(child.path);
            }}
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
