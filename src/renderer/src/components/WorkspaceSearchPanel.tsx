import { FileText, Search, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { getDocumentDisplayName } from "../documentModel";
import type { MarkdownDocument } from "../types";
import type {
  MarkdownSearchMatch,
  WorkspaceSearchGroup,
} from "../workspaceSearch";

function HighlightedSearchSnippet({
  query,
  text,
}: {
  query: string;
  text: string;
}) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return <>{text}</>;
  }

  const normalizedText = text.toLocaleLowerCase();
  const normalizedNeedle = normalizedQuery.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = normalizedText.indexOf(normalizedNeedle, cursor);

    if (index < 0) {
      parts.push(text.slice(cursor));
      break;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(
      <mark key={`${index}-${cursor}`}>
        {text.slice(index, index + normalizedNeedle.length)}
      </mark>,
    );
    cursor = index + normalizedNeedle.length;
  }

  return <>{parts}</>;
}

type WorkspaceSearchPanelProps = {
  groups: WorkspaceSearchGroup[];
  inputRef: RefObject<HTMLInputElement>;
  matchCount: number;
  onClose: () => void;
  onOpenMatch: (document: MarkdownDocument, match: MarkdownSearchMatch) => void;
  onQueryChange: (value: string) => void;
  query: string;
  workspacePath?: string;
};

export function WorkspaceSearchPanel({
  groups,
  inputRef,
  matchCount,
  onClose,
  onOpenMatch,
  onQueryChange,
  query,
  workspacePath,
}: WorkspaceSearchPanelProps) {
  const trimmedQuery = query.trim();

  return (
    <div className="workspace-search-panel">
      <div className="workspace-search-input-row">
        <Search size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
          placeholder="查找"
        />
        <div className="workspace-search-toggles" aria-hidden="true">
          <span>Aa</span>
          <span>W</span>
          <span>.*</span>
        </div>
        {query && (
          <button type="button" aria-label="清空查找" onClick={() => onQueryChange("")}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="workspace-search-meta">
        {trimmedQuery
          ? matchCount
            ? `在 ${groups.length} 个文件中找到 ${matchCount} 处`
            : "没有找到匹配内容"
          : workspacePath
            ? "输入关键词后搜索当前文件夹"
            : "先打开一个本地文件夹"}
      </div>

      <div className="workspace-search-results">
        {!trimmedQuery ? (
          <div className="workspace-search-empty">
            输入内容后会在当前文件夹内搜索 .md 和 .html 文件。
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <section
              className="workspace-search-group"
              key={group.document.filePath ?? group.document.id}
            >
              <div
                className="workspace-search-file"
                title={getDocumentDisplayName(group.document)}
              >
                <FileText size={15} />
                <strong>{getDocumentDisplayName(group.document)}</strong>
                <span>{group.matches.length}</span>
              </div>
              {group.matches.map((match) => (
                <button
                  className="workspace-search-match"
                  key={`${group.document.filePath ?? group.document.id}-${match.start}`}
                  type="button"
                  onClick={() => onOpenMatch(group.document, match)}
                >
                  <span className="workspace-search-line">{match.line}</span>
                  <span className="workspace-search-snippet">
                    <HighlightedSearchSnippet
                      query={trimmedQuery}
                      text={match.snippet || "空白行"}
                    />
                  </span>
                </button>
              ))}
            </section>
          ))
        ) : (
          <div className="workspace-search-empty">没有匹配结果。</div>
        )}
      </div>
    </div>
  );
}
