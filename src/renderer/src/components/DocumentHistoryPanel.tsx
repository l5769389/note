import { Clock3, FileClock, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import type {
  DocumentHistoryVersion,
  DocumentHistoryVersionWithContent,
  MarkdownDocument,
} from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";

type DocumentHistoryPanelProps = {
  activeDocument: MarkdownDocument;
  isLoading: boolean;
  isRestoring: boolean;
  selectedVersion: DocumentHistoryVersionWithContent | null;
  versions: DocumentHistoryVersion[];
  onClearHistory?: () => void;
  onRefresh: () => void;
  onRestore?: (version: DocumentHistoryVersionWithContent) => void;
  onSelectVersion: (version: DocumentHistoryVersion) => void;
};

const reasonLabels = {
  auto: "自动记录",
  manual: "手动记录",
  restore: "恢复前",
} satisfies Record<DocumentHistoryVersion["reason"], string>;

function formatHistoryTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatByteSize(byteSize: number) {
  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
  }

  if (byteSize >= 1024) {
    return `${Math.round(byteSize / 1024)} KB`;
  }

  return `${byteSize} B`;
}

export function DocumentHistoryPanel({
  activeDocument,
  isLoading,
  isRestoring,
  selectedVersion,
  versions,
  onClearHistory,
  onRefresh,
  onRestore,
  onSelectVersion,
}: DocumentHistoryPanelProps) {
  return (
    <section className="document-history-panel" aria-label="历史版本">
      <div className="document-history-header">
        <div>
          <strong>历史版本</strong>
          <span>
            {isLoading
              ? "正在读取"
              : versions.length
                ? `${versions.length} 条记录`
                : "暂无记录"}
          </span>
        </div>
        <div className="document-history-actions">
          <button
            type="button"
            title="刷新历史版本"
            aria-label="刷新历史版本"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw size={14} />
          </button>
          {onClearHistory ? (
            <button
              type="button"
              title="清空历史版本"
              aria-label="清空历史版本"
              disabled={isLoading || !versions.length}
              onClick={onClearHistory}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {versions.length ? (
        <div className="document-history-list" role="list">
          {versions.map((version) => {
            const isSelected = selectedVersion?.id === version.id;

            return (
              <button
                key={version.id}
                className={[
                  "document-history-item",
                  isSelected ? "document-history-item-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                role="listitem"
                aria-pressed={isSelected}
                onClick={() => onSelectVersion(version)}
              >
                <span className="document-history-item-icon">
                  <FileClock size={15} />
                </span>
                <span className="document-history-item-main">
                  <span className="document-history-item-topline">
                    <span>{formatHistoryTime(version.createdAt)}</span>
                    <span>{reasonLabels[version.reason]}</span>
                  </span>
                  <span className="document-history-item-preview">
                    {version.preview || "空白版本"}
                  </span>
                  <span className="document-history-item-meta">
                    {version.lineCount} 行 · {version.wordCount} 词 ·{" "}
                    {formatByteSize(version.byteSize)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="document-history-empty">
          <Clock3 size={18} />
          <strong>还没有历史记录</strong>
          <span>自动保存产生有效修改后会记录关键版本。</span>
        </div>
      )}

      {selectedVersion ? (
        <div className="document-history-preview">
          <div className="document-history-preview-header">
            <div>
              <strong>版本内容</strong>
              <span>{formatHistoryTime(selectedVersion.createdAt)}</span>
            </div>
            {onRestore ? (
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => onRestore(selectedVersion)}
              >
                <RotateCcw size={14} />
                恢复
              </button>
            ) : null}
          </div>
          <div className="document-history-preview-markdown">
            <MarkdownRenderer filePath={activeDocument.filePath}>
              {selectedVersion.content}
            </MarkdownRenderer>
          </div>
        </div>
      ) : (
        <div className="document-history-preview document-history-preview-empty">
          <Clock3 size={20} />
          <strong>选择一个版本查看内容</strong>
          <span>这里会显示该历史版本保存时的完整文档。</span>
        </div>
      )}
    </section>
  );
}
