import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { splitWorkspaceEntryNameForRename } from "../../../shared/workspaceRename";
import type { DirectoryTreeItem } from "../types";
import { isQuickDocumentLinkShortcut } from "../workspaceShortcuts";

type DirectoryTreeHandlerProps = {
  activeDirectoryPath?: string;
  activeFilePath?: string;
  expandedPaths: Set<string>;
  isSelectionMode?: boolean;
  onCancelRename?: (entryPath: string) => void;
  onCommitRename?: (entryPath: string) => void;
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
  onOpenFile: (filePath: string) => void;
  onQuickLinkFile?: (filePath: string) => void;
  onRenameDraftChange?: (value: string) => void;
  onToggleEntrySelection?: (item: DirectoryTreeItem) => void;
  onToggleDirectory: (directoryPath: string) => void;
  renameDraft?: string;
  renamingEntryPath?: string;
  selectedEntryPaths?: Set<string>;
};

type DirectoryTreeProps = DirectoryTreeHandlerProps & {
  item: DirectoryTreeItem;
  level?: number;
};

function RenameInput({
  ariaLabel,
  entryPath,
  extension = "",
  onCancelRename,
  onCommitRename,
  onRenameDraftChange,
  value,
}: {
  ariaLabel: string;
  entryPath: string;
  extension?: string;
  onCancelRename?: (entryPath: string) => void;
  onCommitRename?: (entryPath: string) => void;
  onRenameDraftChange?: (value: string) => void;
  value: string;
}) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename?.(entryPath);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename?.(entryPath);
    }
  };

  return (
    <span className="directory-entry-rename">
      <input
        aria-label={ariaLabel}
        autoFocus
        value={value}
        onBlur={() => onCommitRename?.(entryPath)}
        onChange={(event) => onRenameDraftChange?.(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      />
      {extension ? <em>{extension}</em> : null}
    </span>
  );
}

function DirectoryTree({
  activeDirectoryPath,
  activeFilePath,
  expandedPaths,
  isSelectionMode = false,
  item,
  level = 0,
  onCancelRename,
  onCommitRename,
  onDirectoryContextMenu,
  onFileContextMenu,
  onItemDragStart,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  onToggleDirectory,
  renameDraft,
  renamingEntryPath,
  selectedEntryPaths,
}: DirectoryTreeProps) {
  const isRoot = level === 0;
  const isCurrentDirectory = item.path === activeDirectoryPath;
  const hasChildren = Boolean(item.children?.length);
  const isExpanded = expandedPaths.has(item.path);
  const isRenaming = renamingEntryPath === item.path;
  const renameInputValue =
    isRenaming && renameDraft !== undefined
      ? renameDraft
      : splitWorkspaceEntryNameForRename(item.name, "directory").editableName;

  return (
    <div className={isRoot ? "directory-tree-root" : "directory-tree-branch"}>
      {isRenaming ? (
        <div
          className={
            isCurrentDirectory
              ? "directory-tree-folder directory-tree-folder-active directory-tree-renaming"
              : "directory-tree-folder directory-tree-renaming"
          }
          style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
          title={item.name}
        >
          <span className="directory-tree-caret-placeholder" />
          {isSelectionMode ? (
            <DirectoryEntryCheckbox
              checked={selectedEntryPaths?.has(item.path) ?? false}
              item={item}
              onToggleEntrySelection={onToggleEntrySelection}
            />
          ) : null}
          {isRoot ? <FolderOpen size={18} /> : <Folder size={18} />}
          <RenameInput
            ariaLabel="重命名文件夹"
            entryPath={item.path}
            value={renameInputValue}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onRenameDraftChange={onRenameDraftChange}
          />
        </div>
      ) : (
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
          onClick={() => onToggleDirectory(item.path)}
          onContextMenu={(event) => onDirectoryContextMenu?.(event, item.path)}
          onDragStart={(event) => onItemDragStart?.(event, item)}
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
          {isSelectionMode ? (
            <DirectoryEntryCheckbox
              checked={selectedEntryPaths?.has(item.path) ?? false}
              item={item}
              onToggleEntrySelection={onToggleEntrySelection}
            />
          ) : null}
          {isRoot ? <FolderOpen size={18} /> : <Folder size={18} />}
          <span>{item.name}</span>
        </button>
      )}
      {isExpanded ? (
        <DirectoryTreeItems
          activeDirectoryPath={activeDirectoryPath}
          activeFilePath={activeFilePath}
          expandedPaths={expandedPaths}
          isSelectionMode={isSelectionMode}
          items={item.children ?? []}
          level={level + 1}
          onCancelRename={onCancelRename}
          onCommitRename={onCommitRename}
          onDirectoryContextMenu={onDirectoryContextMenu}
          onFileContextMenu={onFileContextMenu}
          onItemDragStart={onItemDragStart}
          onOpenFile={onOpenFile}
          onQuickLinkFile={onQuickLinkFile}
          onRenameDraftChange={onRenameDraftChange}
          onToggleEntrySelection={onToggleEntrySelection}
          onToggleDirectory={onToggleDirectory}
          renameDraft={renameDraft}
          renamingEntryPath={renamingEntryPath}
          selectedEntryPaths={selectedEntryPaths}
        />
      ) : null}
    </div>
  );
}

function DirectoryEntryCheckbox({
  checked,
  item,
  onToggleEntrySelection,
}: {
  checked: boolean;
  item: DirectoryTreeItem;
  onToggleEntrySelection?: (item: DirectoryTreeItem) => void;
}) {
  return (
    <input
      aria-label={`选择 ${item.name}`}
      checked={checked}
      className="directory-entry-checkbox"
      type="checkbox"
      onChange={() => onToggleEntrySelection?.(item)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

type DirectoryTreeFileRowProps = DirectoryTreeHandlerProps & {
  child: DirectoryTreeItem;
  level: number;
};

function DirectoryTreeFileRow({
  activeFilePath,
  child,
  level,
  isSelectionMode = false,
  onCancelRename,
  onCommitRename,
  onFileContextMenu,
  onItemDragStart,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  renameDraft,
  renamingEntryPath,
  selectedEntryPaths,
}: DirectoryTreeFileRowProps) {
  const isRenaming = renamingEntryPath === child.path;
  const { editableName, extension } = splitWorkspaceEntryNameForRename(
    child.name,
    "file",
  );
  const renameInputValue =
    isRenaming && renameDraft !== undefined ? renameDraft : editableName;

  if (isRenaming) {
    return (
      <div
        className={
          child.path === activeFilePath
            ? "directory-tree-file directory-tree-file-active directory-tree-renaming"
            : "directory-tree-file directory-tree-renaming"
        }
        style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
        title={child.name}
      >
        <span className="directory-tree-caret-placeholder" />
        {isSelectionMode ? (
          <DirectoryEntryCheckbox
            checked={selectedEntryPaths?.has(child.path) ?? false}
            item={child}
            onToggleEntrySelection={onToggleEntrySelection}
          />
        ) : null}
        <FileText size={17} />
        <RenameInput
          ariaLabel="重命名文件"
          entryPath={child.path}
          extension={extension}
          value={renameInputValue}
          onCancelRename={onCancelRename}
          onCommitRename={onCommitRename}
          onRenameDraftChange={onRenameDraftChange}
        />
      </div>
    );
  }

  return (
    <button
      className={
        child.path === activeFilePath
          ? "directory-tree-file directory-tree-file-active"
          : "directory-tree-file"
      }
      style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
      title={child.name}
      type="button"
      draggable={Boolean(onItemDragStart)}
      onClick={() => onOpenFile(child.path)}
      onContextMenu={(event) => onFileContextMenu?.(event, child.path)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenFile(child.path);
      }}
      onDragStart={(event) => onItemDragStart?.(event, child)}
      onKeyDown={(event) => {
        if (!isQuickDocumentLinkShortcut(event)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onQuickLinkFile?.(child.path);
      }}
      onMouseDown={(event) => {
        if (event.detail > 1) {
          event.preventDefault();
        }
      }}
    >
      <span className="directory-tree-caret-placeholder" />
      {isSelectionMode ? (
        <DirectoryEntryCheckbox
          checked={selectedEntryPaths?.has(child.path) ?? false}
          item={child}
          onToggleEntrySelection={onToggleEntrySelection}
        />
      ) : null}
      <FileText size={17} />
      <span>{child.name}</span>
    </button>
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
  isSelectionMode = false,
  items,
  level,
  onCancelRename,
  onCommitRename,
  onDirectoryContextMenu,
  onFileContextMenu,
  onItemDragStart,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  onToggleDirectory,
  renameDraft,
  renamingEntryPath,
  selectedEntryPaths,
}: DirectoryTreeItemsProps) {
  return (
    <>
      {items.map((child) =>
        child.type === "directory" ? (
          <DirectoryTree
            activeDirectoryPath={activeDirectoryPath}
            activeFilePath={activeFilePath}
            expandedPaths={expandedPaths}
            isSelectionMode={isSelectionMode}
            item={child}
            key={child.path}
            level={level}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onDirectoryContextMenu={onDirectoryContextMenu}
            onFileContextMenu={onFileContextMenu}
            onItemDragStart={onItemDragStart}
            onOpenFile={onOpenFile}
            onQuickLinkFile={onQuickLinkFile}
            onRenameDraftChange={onRenameDraftChange}
            onToggleEntrySelection={onToggleEntrySelection}
            onToggleDirectory={onToggleDirectory}
            renameDraft={renameDraft}
            renamingEntryPath={renamingEntryPath}
            selectedEntryPaths={selectedEntryPaths}
          />
        ) : (
          <DirectoryTreeFileRow
            activeDirectoryPath={activeDirectoryPath}
            activeFilePath={activeFilePath}
            child={child}
            expandedPaths={expandedPaths}
            isSelectionMode={isSelectionMode}
            key={child.path}
            level={level}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onDirectoryContextMenu={onDirectoryContextMenu}
            onFileContextMenu={onFileContextMenu}
            onItemDragStart={onItemDragStart}
            onOpenFile={onOpenFile}
            onQuickLinkFile={onQuickLinkFile}
            onRenameDraftChange={onRenameDraftChange}
            onToggleEntrySelection={onToggleEntrySelection}
            onToggleDirectory={onToggleDirectory}
            renameDraft={renameDraft}
            renamingEntryPath={renamingEntryPath}
            selectedEntryPaths={selectedEntryPaths}
          />
        ),
      )}
    </>
  );
}
