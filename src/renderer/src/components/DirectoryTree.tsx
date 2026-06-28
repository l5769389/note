import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { splitWorkspaceEntryNameForRename } from "../../../shared/workspaceRename";
import { DocumentFileIcon } from "./DocumentFileIcon";
import type { DirectoryTreeItem } from "../types";
import { isWorkspaceEntrySelected } from "../workspaceSelection";
import { isQuickDocumentLinkShortcut } from "../workspaceShortcuts";

type DirectoryTreeHandlerProps = {
  activeDirectoryPath?: string;
  activeFilePath?: string;
  directoryDragPreview?: DirectoryDragPreview | null;
  directoryDropTargetPath?: string | null;
  expandedPaths: Set<string>;
  isSelectionMode?: boolean;
  onCancelRename?: (entryPath: string) => void;
  onCommitRename?: (entryPath: string) => void;
  onDirectoryContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    directoryPath: string,
  ) => void;
  onDirectoryDragOver?: (
    event: ReactDragEvent<HTMLElement>,
    item: DirectoryTreeItem,
  ) => void;
  onDirectoryDrop?: (
    event: ReactDragEvent<HTMLElement>,
    item: DirectoryTreeItem,
  ) => void;
  onFileContextMenu?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    filePath: string,
  ) => void;
  onItemDragStart?: (
    event: ReactDragEvent<HTMLButtonElement>,
    item: DirectoryTreeItem,
  ) => void;
  onItemDragEnd?: () => void;
  onOpenFile: (filePath: string) => void;
  onQuickLinkFile?: (filePath: string) => void;
  onRenameDraftChange?: (value: string) => void;
  onToggleEntrySelection?: (item: DirectoryTreeItem) => void;
  onToggleDirectory: (directoryPath: string) => void;
  renameDraft?: string;
  renamingEntryPath?: string;
  selectedEntryPaths?: Set<string>;
};

export type DirectoryDragPreview = {
  entryType: DirectoryTreeItem["type"];
  name: string;
  path: string;
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
  directoryDragPreview,
  directoryDropTargetPath,
  expandedPaths,
  isSelectionMode = false,
  item,
  level = 0,
  onCancelRename,
  onCommitRename,
  onDirectoryContextMenu,
  onDirectoryDragOver,
  onDirectoryDrop,
  onFileContextMenu,
  onItemDragEnd,
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
  const isDirectoryDropTarget = directoryDropTargetPath === item.path;
  const shouldShowDropPreview =
    isDirectoryDropTarget && Boolean(directoryDragPreview);
  const hasVisibleChildren = hasChildren || shouldShowDropPreview;
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
              checked={isWorkspaceEntrySelected(selectedEntryPaths, item)}
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
        <div className="directory-tree-folder-drop-zone">
          <button
            className={
              [
                "directory-tree-folder",
                isCurrentDirectory ? "directory-tree-folder-active" : "",
                isDirectoryDropTarget ? "directory-tree-folder-drop-target" : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
            style={{ "--tree-depth": `${level * 18}px` } as CSSProperties}
            title={item.name}
            type="button"
            draggable={Boolean(onItemDragStart)}
            onClick={() => onToggleDirectory(item.path)}
            onContextMenu={(event) => onDirectoryContextMenu?.(event, item.path)}
            onDragEnd={onItemDragEnd}
            onDragEnter={(event) => onDirectoryDragOver?.(event, item)}
            onDragOver={(event) => onDirectoryDragOver?.(event, item)}
            onDragStart={(event) => onItemDragStart?.(event, item)}
            onDrop={(event) => onDirectoryDrop?.(event, item)}
          >
            {hasVisibleChildren ? (
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
                checked={isWorkspaceEntrySelected(selectedEntryPaths, item)}
                item={item}
                onToggleEntrySelection={onToggleEntrySelection}
              />
            ) : null}
            {isRoot ? <FolderOpen size={18} /> : <Folder size={18} />}
            <span>{item.name}</span>
          </button>
        </div>
      )}
      {isExpanded ? (
        <>
          {shouldShowDropPreview && directoryDragPreview ? (
            <div
              className={[
                "directory-tree-file",
                "directory-tree-drop-preview",
                directoryDragPreview.entryType === "directory"
                  ? "directory-tree-drop-preview-directory"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--tree-depth": `${(level + 1) * 18}px` } as CSSProperties}
              onDragOver={(event) => onDirectoryDragOver?.(event, item)}
              onDragEnter={(event) => onDirectoryDragOver?.(event, item)}
              onDrop={(event) => onDirectoryDrop?.(event, item)}
            >
              <span className="directory-tree-caret-placeholder" />
              {directoryDragPreview.entryType === "directory" ? (
                <Folder size={17} />
              ) : (
                <DocumentFileIcon filePath={directoryDragPreview.path} size={17} />
              )}
              <span>{directoryDragPreview.name}</span>
            </div>
          ) : null}
          <DirectoryTreeItems
            activeDirectoryPath={activeDirectoryPath}
            activeFilePath={activeFilePath}
            directoryDragPreview={directoryDragPreview}
            expandedPaths={expandedPaths}
            directoryDropTargetPath={directoryDropTargetPath}
            isSelectionMode={isSelectionMode}
            items={item.children ?? []}
            level={level + 1}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onDirectoryContextMenu={onDirectoryContextMenu}
            onDirectoryDragOver={onDirectoryDragOver}
            onDirectoryDrop={onDirectoryDrop}
            onFileContextMenu={onFileContextMenu}
            onItemDragEnd={onItemDragEnd}
            onItemDragStart={onItemDragStart}
            onOpenFile={onOpenFile}
            onQuickLinkFile={onQuickLinkFile}
            onRenameDraftChange={onRenameDraftChange}
            onToggleEntrySelection={onToggleEntrySelection}
            onToggleDirectory={onToggleDirectory}
            parentDirectory={item}
            renameDraft={renameDraft}
            renamingEntryPath={renamingEntryPath}
            selectedEntryPaths={selectedEntryPaths}
          />
        </>
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
  parentDirectory?: DirectoryTreeItem;
};

function DirectoryTreeFileRow({
  activeFilePath,
  child,
  level,
  isSelectionMode = false,
  onCancelRename,
  onCommitRename,
  onDirectoryDragOver,
  onDirectoryDrop,
  onFileContextMenu,
  onItemDragEnd,
  onItemDragStart,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  parentDirectory,
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
            checked={isWorkspaceEntrySelected(selectedEntryPaths, child)}
            item={child}
            onToggleEntrySelection={onToggleEntrySelection}
          />
        ) : null}
        <DocumentFileIcon filePath={child.path} size={17} />
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
      onDragEnd={onItemDragEnd}
      onDragEnter={(event) => {
        if (parentDirectory) {
          onDirectoryDragOver?.(event, parentDirectory);
        }
      }}
      onDragOver={(event) => {
        if (parentDirectory) {
          onDirectoryDragOver?.(event, parentDirectory);
        }
      }}
      onDragStart={(event) => onItemDragStart?.(event, child)}
      onDrop={(event) => {
        if (parentDirectory) {
          onDirectoryDrop?.(event, parentDirectory);
        }
      }}
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
          checked={isWorkspaceEntrySelected(selectedEntryPaths, child)}
          item={child}
          onToggleEntrySelection={onToggleEntrySelection}
        />
      ) : null}
      <DocumentFileIcon filePath={child.path} size={17} />
      <span>{child.name}</span>
    </button>
  );
}

type DirectoryTreeItemsProps = DirectoryTreeHandlerProps & {
  items: DirectoryTreeItem[];
  level: number;
  parentDirectory?: DirectoryTreeItem;
};

export function DirectoryTreeItems({
  activeDirectoryPath,
  activeFilePath,
  directoryDragPreview,
  directoryDropTargetPath,
  expandedPaths,
  isSelectionMode = false,
  items,
  level,
  onCancelRename,
  onCommitRename,
  onDirectoryContextMenu,
  onDirectoryDragOver,
  onDirectoryDrop,
  onFileContextMenu,
  onItemDragEnd,
  onItemDragStart,
  onOpenFile,
  onQuickLinkFile,
  onRenameDraftChange,
  onToggleEntrySelection,
  onToggleDirectory,
  parentDirectory,
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
            directoryDragPreview={directoryDragPreview}
            directoryDropTargetPath={directoryDropTargetPath}
            expandedPaths={expandedPaths}
            isSelectionMode={isSelectionMode}
            item={child}
            key={child.path}
            level={level}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onDirectoryContextMenu={onDirectoryContextMenu}
            onDirectoryDragOver={onDirectoryDragOver}
            onDirectoryDrop={onDirectoryDrop}
            onFileContextMenu={onFileContextMenu}
            onItemDragEnd={onItemDragEnd}
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
            directoryDragPreview={directoryDragPreview}
            directoryDropTargetPath={directoryDropTargetPath}
            child={child}
            expandedPaths={expandedPaths}
            isSelectionMode={isSelectionMode}
            key={child.path}
            level={level}
            onCancelRename={onCancelRename}
            onCommitRename={onCommitRename}
            onDirectoryContextMenu={onDirectoryContextMenu}
            onDirectoryDragOver={onDirectoryDragOver}
            onDirectoryDrop={onDirectoryDrop}
            onFileContextMenu={onFileContextMenu}
            onItemDragEnd={onItemDragEnd}
            onItemDragStart={onItemDragStart}
            onOpenFile={onOpenFile}
            onQuickLinkFile={onQuickLinkFile}
            onRenameDraftChange={onRenameDraftChange}
            onToggleEntrySelection={onToggleEntrySelection}
            onToggleDirectory={onToggleDirectory}
            parentDirectory={parentDirectory}
            renameDraft={renameDraft}
            renamingEntryPath={renamingEntryPath}
            selectedEntryPaths={selectedEntryPaths}
          />
        ),
      )}
    </>
  );
}
