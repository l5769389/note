import { BookOpenText, FileText, Link2, RefreshCw, Search, X } from "lucide-react";
import { getDocumentDisplayName } from "../documentModel";
import type {
  DocumentLinkReference,
  MarkdownDocument,
} from "../types";
import type { NoteWikiLink } from "../noteKnowledge";

export type RelationPanelFilter = "all" | "document" | "content";

export type WorkspaceRelationItem = {
  id: string;
  kind: "content" | "document";
  link?: NoteWikiLink;
  reference?: DocumentLinkReference;
  searchText: string;
  sourceDocument: MarkdownDocument;
  status: "linked" | "missing";
  targetDocument?: MarkdownDocument;
  targetPath?: string;
  title: string;
};

export type WorkspaceRelationStats = {
  contentCount: number;
  documentCount: number;
  sourceCount: number;
  totalCount: number;
};

type KnowledgeRelationsPanelProps = {
  filteredItems: WorkspaceRelationItem[];
  filter: RelationPanelFilter;
  items: WorkspaceRelationItem[];
  query: string;
  stats: WorkspaceRelationStats;
  onFilterChange: (filter: RelationPanelFilter) => void;
  onOpenDocument: (document: MarkdownDocument) => void;
  onOpenFile: (filePath: string) => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onRemoveDocumentLink: (sourceDocumentId: string, filePath: string) => void;
};

export function KnowledgeRelationsPanel({
  filteredItems,
  filter,
  items,
  query,
  stats,
  onFilterChange,
  onOpenDocument,
  onOpenFile,
  onQueryChange,
  onRefresh,
  onRemoveDocumentLink,
}: KnowledgeRelationsPanelProps) {
  const filters: Array<{
    count: number;
    label: string;
    value: RelationPanelFilter;
  }> = [
    { count: stats.totalCount, label: "全部", value: "all" },
    { count: stats.documentCount, label: "相关文档", value: "document" },
    { count: stats.contentCount, label: "正文引用", value: "content" },
  ];
  const relationItems = items.filter((item) => item.status === "linked");
  const visibleItems = filteredItems.filter((item) => item.status === "linked");

  return (
    <div className="knowledge-relations-panel">
      <header className="knowledge-relations-header">
        <div>
          <strong>具体关系</strong>
          <span>
            {stats.totalCount ? `${stats.totalCount} 条关系` : "当前文件还没有关系"}
          </span>
        </div>
        <button
          type="button"
          title="刷新"
          aria-label="刷新链接总览"
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="knowledge-relations-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索文件、路径或引用"
        />
        {query ? (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => onQueryChange("")}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="knowledge-relations-filters" role="tablist">
        {filters.map((item) => (
          <button
            className={
              filter === item.value
                ? "knowledge-relations-filter-active"
                : undefined
            }
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            onClick={() => onFilterChange(item.value)}
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className="knowledge-relations-list">
        {!relationItems.length ? (
          <div className="knowledge-relations-empty">
            <Link2 size={24} />
            <strong>还没有关系</strong>
            <span>
              可以在文档元信息里添加相关文档，或在正文中使用 [[文件名]]。
            </span>
          </div>
        ) : !visibleItems.length ? (
          <div className="knowledge-relations-empty">
            <Search size={24} />
            <strong>没有匹配的关系</strong>
            <span>换个关键词或切换筛选条件试试。</span>
          </div>
        ) : (
          visibleItems.map((item) => (
            <KnowledgeRelationCard
              item={item}
              key={item.id}
              onOpenDocument={onOpenDocument}
              onOpenFile={onOpenFile}
              onRemoveDocumentLink={onRemoveDocumentLink}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KnowledgeRelationCard({
  item,
  onOpenDocument,
  onOpenFile,
  onRemoveDocumentLink,
}: {
  item: WorkspaceRelationItem;
  onOpenDocument: (document: MarkdownDocument) => void;
  onOpenFile: (filePath: string) => void;
  onRemoveDocumentLink: (sourceDocumentId: string, filePath: string) => void;
}) {
  const sourceTitle = getDocumentDisplayName(item.sourceDocument);
  const targetLabel = item.title || item.targetPath || "未命名";
  const relationLabel = item.kind === "document" ? "相关文档" : "正文引用";

  return (
    <article className="knowledge-relation-card">
      <div className="knowledge-relation-main">
        <button
          className="knowledge-relation-source"
          type="button"
          title={item.sourceDocument.filePath}
          onClick={() => onOpenDocument(item.sourceDocument)}
        >
          <FileText size={14} />
          <span>{sourceTitle}</span>
        </button>
        <span className="knowledge-relation-arrow">→</span>
        <button
          className="knowledge-relation-target"
          type="button"
          title={item.targetPath}
          onClick={() => {
            if (item.targetDocument) {
              onOpenDocument(item.targetDocument);
              return;
            }

            if (item.reference?.filePath) {
              onOpenFile(item.reference.filePath);
            }
          }}
        >
          <BookOpenText size={14} />
          <span>{targetLabel}</span>
        </button>
      </div>
      <div className="knowledge-relation-meta">
        <span>{relationLabel}</span>
        {item.targetPath ? <small>{item.targetPath}</small> : null}
      </div>
      <div className="knowledge-relation-actions">
        {item.kind === "document" && item.reference ? (
          <button
            type="button"
            onClick={() =>
              onRemoveDocumentLink(
                item.sourceDocument.id,
                item.reference!.filePath,
              )
            }
          >
            移除
          </button>
        ) : null}
      </div>
    </article>
  );
}
