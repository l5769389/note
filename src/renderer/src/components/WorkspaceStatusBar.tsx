import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  isDrawingDocument,
  isExcelDocument,
  isHtmlDocument,
  isPdfDocument,
  isSheetDocument,
  isWordDocument,
} from "../documentModel";
import type { MarkdownDocument, SaveState } from "../types";
import type { SyncStatusSnapshot } from "../../../shared/sync";

const autoSaveStatus = {
  failed: {
    icon: <AlertTriangle size={14} />,
    label: "保存失败",
    title: "自动保存失败，请检查文件权限或磁盘状态",
  },
  idle: {
    icon: <Check size={14} />,
    label: "已保存",
    title: "当前内容已保存",
  },
  saved: {
    icon: <Check size={14} />,
    label: "已保存",
    title: "最近的修改已保存到本地文件",
  },
  saving: {
    icon: <RefreshCw size={14} />,
    label: "保存中",
    title: "正在保存当前修改",
  },
} satisfies Record<SaveState, { icon: ReactNode; label: string; title: string }>;

type WorkspaceStatusBarProps = {
  activeDocument: MarkdownDocument | null;
  isInspectorOpen?: boolean;
  isSidebarHidden: boolean;
  missingAssetReferences: string[];
  saveState: SaveState;
  syncStatus?: SyncStatusSnapshot;
  wordCount: number;
  onConfigureSync?: () => void;
  onOpenSyncMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSyncNow?: () => void;
  onToggleInspector?: () => void;
  onToggleSidebar: () => void;
};

function getDocumentStatusLabel(document: MarkdownDocument | null, wordCount: number) {
  if (isHtmlDocument(document)) {
    return "HTML 阅读";
  }

  if (isPdfDocument(document)) {
    return "PDF 阅读";
  }

  if (isWordDocument(document)) {
    return "Word 阅读";
  }

  if (isExcelDocument(document)) {
    return "Excel 阅读";
  }

  if (isSheetDocument(document)) {
    return "表格";
  }

  if (isDrawingDocument(document)) {
    return "Excalidraw";
  }

  return `${document ? wordCount : 0} 词`;
}

function getSyncStatusDisplay(syncStatus?: SyncStatusSnapshot) {
  const state = syncStatus?.state ?? "disabled";
  const message = syncStatus?.message;

  switch (state) {
    case "failed":
      return {
        icon: <AlertTriangle size={14} />,
        label: "同步失败",
        title: message || "云端同步失败，点击重试。",
      };
    case "pending":
      return {
        icon: <RefreshCw size={14} />,
        label: "待同步",
        title: message || "本地变更正在等待同步。",
      };
    case "syncing":
      return {
        icon: <RefreshCw size={14} />,
        label: "同步中",
        title: message || "正在同步本地工作区。",
      };
    case "synced":
      return {
        icon: <Cloud size={14} />,
        label: "已同步",
        title: message || "本地工作区已和云端同步。",
      };
    case "idle":
      return {
        icon: <Cloud size={14} />,
        label: "云同步",
        title: message || "云同步已启用，点击立即同步。",
      };
    case "disabled":
    default:
      return {
        icon: <CloudOff size={14} />,
        label: "未同步",
        title: "云同步未启用，点击配置同步信息。",
      };
  }
}

export function WorkspaceStatusBar({
  activeDocument,
  isInspectorOpen = false,
  isSidebarHidden,
  missingAssetReferences,
  saveState,
  syncStatus,
  wordCount,
  onConfigureSync,
  onOpenSyncMenu,
  onSyncNow,
  onToggleInspector,
  onToggleSidebar,
}: WorkspaceStatusBarProps) {
  const status = autoSaveStatus[saveState];
  const syncDisplay = getSyncStatusDisplay(syncStatus);
  const syncState = syncStatus?.state ?? "disabled";
  const isSyncConfigured = Boolean(
    syncStatus?.configuration.enabled && syncStatus.configuration.tokenConfigured,
  );
  const shouldShowSyncStatus =
    Boolean(syncStatus) &&
    syncState !== "disabled" &&
    (isSyncConfigured || syncState !== "idle");
  const canUseSyncStatus =
    syncState === "disabled"
      ? Boolean(onConfigureSync)
      : Boolean(onOpenSyncMenu ?? onSyncNow) &&
        syncState !== "pending" &&
        syncState !== "syncing";
  const inspectorTitle = isInspectorOpen ? "隐藏右侧栏" : "显示右侧栏";
  const shouldShowDocumentStatus = Boolean(activeDocument);
  const shouldShowAutoSaveStatus = shouldShowDocumentStatus;

  function handleSyncStatusClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (syncState === "disabled") {
      onConfigureSync?.();
      return;
    }

    if (onOpenSyncMenu) {
      onOpenSyncMenu(event);
      return;
    }

    onSyncNow?.();
  }

  return (
    <footer className="workspace-statusbar">
      <button
        className="workspace-status-button"
        type="button"
        aria-label={isSidebarHidden ? "展开左侧栏" : "折叠左侧栏"}
        onClick={onToggleSidebar}
      >
        {isSidebarHidden ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        <span className="workspace-status-button-label">
          {isSidebarHidden ? "展开侧栏" : "折叠侧栏"}
        </span>
      </button>
      <span className="workspace-status-spacer" />
      {shouldShowSyncStatus ? (
        <button
          className={[
            "workspace-sync-status",
            `workspace-sync-status-${syncStatus?.state ?? "disabled"}`,
          ].join(" ")}
          type="button"
          title={syncDisplay.title}
          aria-label={syncDisplay.title}
          disabled={!canUseSyncStatus}
          onClick={handleSyncStatusClick}
        >
          {syncDisplay.icon}
          {syncDisplay.label}
        </button>
      ) : null}
      {shouldShowDocumentStatus && missingAssetReferences.length > 0 && (
        <span className="workspace-asset-warning" title={missingAssetReferences.join("\n")}>
          <AlertTriangle size={14} />
          {missingAssetReferences.length} 个附件失效
        </span>
      )}
      {shouldShowDocumentStatus ? (
        <>
          {shouldShowAutoSaveStatus ? (
            <span
              className={`workspace-autosave-status workspace-autosave-status-${saveState}`}
              data-testid="autosave-status"
              title={status.title}
              aria-live="polite"
            >
              {status.icon}
              {status.label}
            </span>
          ) : null}
          <span className="workspace-word-count">
            {getDocumentStatusLabel(activeDocument, wordCount)}
          </span>
        </>
      ) : null}
      {shouldShowDocumentStatus && onToggleInspector ? (
        <button
          className={[
            "workspace-inspector-button",
            isInspectorOpen ? "workspace-inspector-button-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          title={inspectorTitle}
          aria-label={inspectorTitle}
          aria-pressed={isInspectorOpen}
          onClick={onToggleInspector}
        >
          {isInspectorOpen ? (
            <PanelRightClose size={15} />
          ) : (
            <PanelRightOpen size={15} />
          )}
          <span className="workspace-status-button-label">
            {isInspectorOpen ? "隐藏右栏" : "显示右栏"}
          </span>
        </button>
      ) : null}
    </footer>
  );
}
