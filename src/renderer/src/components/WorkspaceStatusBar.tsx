import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  isDrawingDocument,
  isExcelDocument,
  isHtmlDocument,
  isPdfDocument,
  isSheetDocument,
  isWordDocument,
} from "../documentModel";
import type { MarkdownDocument, SaveState } from "../types";

const autoSaveStatus = {
  failed: {
    icon: <AlertTriangle size={14} />,
    label: "自动保存失败",
    title: "自动保存失败，请检查文件权限或磁盘状态",
  },
  idle: {
    icon: <Check size={14} />,
    label: "自动保存待命",
    title: "自动保存已启用",
  },
  saved: {
    icon: <Check size={14} />,
    label: "已自动保存",
    title: "最近的修改已保存到本地文件",
  },
  saving: {
    icon: <RefreshCw size={14} />,
    label: "自动保存中",
    title: "正在保存当前修改",
  },
} satisfies Record<SaveState, { icon: ReactNode; label: string; title: string }>;

type WorkspaceStatusBarProps = {
  activeDocument: MarkdownDocument | null;
  isSidebarHidden: boolean;
  missingAssetReferences: string[];
  relationCount?: number;
  saveState: SaveState;
  wordCount: number;
  onOpenRelations?: () => void;
  onToggleSidebar: () => void;
};

function getDocumentStatusLabel(document: MarkdownDocument | null, wordCount: number) {
  if (isHtmlDocument(document)) {
    return "HTML preview";
  }

  if (isPdfDocument(document)) {
    return "PDF preview";
  }

  if (isWordDocument(document)) {
    return "Word preview";
  }

  if (isExcelDocument(document)) {
    return "Excel preview";
  }

  if (isSheetDocument(document)) {
    return "Sheet";
  }

  if (isDrawingDocument(document)) {
    return "Excalidraw";
  }

  return `${document ? wordCount : 0} 词`;
}

export function WorkspaceStatusBar({
  activeDocument,
  isSidebarHidden,
  missingAssetReferences,
  relationCount = 0,
  saveState,
  wordCount,
  onOpenRelations,
  onToggleSidebar,
}: WorkspaceStatusBarProps) {
  const status = autoSaveStatus[saveState];
  const relationLabel = `关系 ${relationCount}`;

  return (
    <footer className="workspace-statusbar">
      <button
        className="workspace-status-button"
        type="button"
        aria-label={isSidebarHidden ? "展开左侧栏" : "折叠左侧栏"}
        onClick={onToggleSidebar}
      >
        {isSidebarHidden ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
      </button>
      <span className="workspace-status-spacer" />
      {onOpenRelations ? (
        <button
          className="workspace-relations-button"
          type="button"
          title={relationLabel}
          aria-label="查看关系"
          onClick={onOpenRelations}
        >
          <Link2 size={14} />
          <span>{relationLabel}</span>
        </button>
      ) : null}
      {missingAssetReferences.length > 0 && (
        <span className="workspace-asset-warning" title={missingAssetReferences.join("\n")}>
          <AlertTriangle size={14} />
          {missingAssetReferences.length} 个附件失效
        </span>
      )}
      <span
        className={`workspace-autosave-status workspace-autosave-status-${saveState}`}
        title={status.title}
        aria-live="polite"
      >
        {status.icon}
        {status.label}
      </span>
      <span className="workspace-word-count">
        {getDocumentStatusLabel(activeDocument, wordCount)}
      </span>
    </footer>
  );
}
