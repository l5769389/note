import { Clock3, FileClock, RefreshCw, RotateCcw, Save } from "lucide-react";
import type {
  DocumentHistoryVersion,
  DocumentHistoryVersionWithContent,
  MarkdownDocument,
} from "../types";

type DocumentHistoryPanelProps = {
  activeDocument: MarkdownDocument;
  isLoading: boolean;
  isRestoring: boolean;
  selectedVersion: DocumentHistoryVersionWithContent | null;
  versions: DocumentHistoryVersion[];
  onCreateSnapshot: () => void;
  onRefresh: () => void;
  onRestore: (version: DocumentHistoryVersionWithContent) => void;
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
  onCreateSnapshot,
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
            title="记录当前版本"
            aria-label="记录当前版本"
            disabled={isLoading || !activeDocument.filePath}
            onClick={onCreateSnapshot}
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            title="刷新历史版本"
            aria-label="刷新历史版本"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw size={14} />
          </button>
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
                    {version.preview}
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
          <span>自动保存产生有效修改后会记录，也可以手动记录当前版本。</span>
        </div>
      )}

      {selectedVersion ? (
        <div className="document-history-preview">
          <div className="document-history-preview-header">
            <div>
              <strong>版本内容</strong>
              <span>{formatHistoryTime(selectedVersion.createdAt)}</span>
            </div>
            <button
              type="button"
              disabled={isRestoring}
              onClick={() => onRestore(selectedVersion)}
            >
              <RotateCcw size={14} />
              恢复
            </button>
          </div>
          <pre>{selectedVersion.content}</pre>
        </div>
      ) : null}
    </section>
  );
}
