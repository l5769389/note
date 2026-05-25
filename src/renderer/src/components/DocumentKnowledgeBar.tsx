import {
  BookOpenText,
  Check,
  FileText,
  Hash,
  Link2,
  Plus,
  X,
} from "lucide-react";
import type { Ref } from "react";
import {
  getDocumentDisplayName,
  getDocumentType,
  getDocumentTypeFromPath,
  isMarkdownDocument,
} from "../documentModel";
import type {
  DocumentKnowledge,
  NoteBacklink,
  NoteWikiLink,
} from "../noteKnowledge";
import type { DocumentLinkReference, MarkdownDocument } from "../types";
import {
  getDocumentTypeName,
  getPathLabel,
  normalizeFilePathKey,
} from "../workspaceDisplay";

export type DocumentMetadataSuggestionField =
  | "tag"
  | "propertyKey"
  | "propertyValue";

type RelatedDocumentItem = {
  document?: MarkdownDocument;
  link: DocumentLinkReference;
};

type DocumentKnowledgeBarProps = {
  activeDocument: MarkdownDocument | null | undefined;
  activeSuggestion: DocumentMetadataSuggestionField | null;
  backlinks: NoteBacklink[];
  isEditorOpen: boolean;
  isEditorCloseVisible?: boolean;
  isEditorHeaderVisible?: boolean;
  knowledge?: DocumentKnowledge | null;
  missingLinks: NoteWikiLink[];
  newTagName: string;
  outgoingLinks: NoteWikiLink[];
  propertyKeyDraft: string;
  propertyKeySuggestions: string[];
  propertyValueDraft: string;
  propertyValueSuggestions: string[];
  relatedDocuments: RelatedDocumentItem[];
  showMissingRelations?: boolean;
  tagSuggestions: string[];
  wikiLinkInputRef: Ref<HTMLInputElement>;
  wikiLinkTargetDraft: string;
  onAddTag: () => void;
  onCreateMissingWikiLink: (target: string) => void;
  onInsertWikiLink: () => void;
  onOpenDocument: (document: MarkdownDocument) => void;
  onOpenDocumentLinkPicker: () => void;
  onOpenRelatedDocument: (reference: DocumentLinkReference) => void;
  onOpenWikiLinkInsertForm: () => void;
  onRemoveDocumentLink: (filePath: string) => void;
  onRemoveProperty: (key: string) => void;
  onRemoveTag: (tag: string) => void;
  onSaveProperty: () => void;
  onSetActiveSuggestion: (
    field: DocumentMetadataSuggestionField | null,
  ) => void;
  onSetEditorOpen: (isOpen: boolean) => void;
  onSetNewTagName: (value: string) => void;
  onSetPropertyKeyDraft: (value: string) => void;
  onSetPropertyValueDraft: (value: string) => void;
  onSetWikiLinkTargetDraft: (value: string) => void;
};

function getMetadataSuggestionMatches(items: string[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return items
    .filter((item) =>
      normalizedQuery
        ? item.toLocaleLowerCase().includes(normalizedQuery)
        : true,
    )
    .slice(0, 8);
}

function MetadataSuggestionMenu({
  activeSuggestion,
  field,
  items,
  onSelect,
  onSetActiveSuggestion,
}: {
  activeSuggestion: DocumentMetadataSuggestionField | null;
  field: DocumentMetadataSuggestionField;
  items: string[];
  onSelect: (value: string) => void;
  onSetActiveSuggestion: (
    field: DocumentMetadataSuggestionField | null,
  ) => void;
}) {
  if (activeSuggestion !== field || !items.length) {
    return null;
  }

  return (
    <div className="document-meta-suggestion-menu" role="listbox">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="option"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item);
            onSetActiveSuggestion(null);
          }}
        >
          {field === "tag" ? <Hash size={12} /> : <FileText size={12} />}
          <span>{field === "tag" ? `#${item}` : item}</span>
        </button>
      ))}
    </div>
  );
}

function RelatedDocumentChip({
  item,
  editable = false,
  onOpenRelatedDocument,
  onRemoveDocumentLink,
}: {
  item: RelatedDocumentItem;
  editable?: boolean;
  onOpenRelatedDocument: (reference: DocumentLinkReference) => void;
  onRemoveDocumentLink: (filePath: string) => void;
}) {
  const isMissing = !item.document;
  const title = item.document
    ? getDocumentDisplayName(item.document)
    : item.link.title || getPathLabel(item.link.filePath);
  const documentType = item.document
    ? getDocumentType(item.document)
    : item.link.documentType ?? getDocumentTypeFromPath(item.link.filePath);

  return (
    <button
      className={[
        "document-meta-chip",
        "document-meta-document-link-chip",
        isMissing ? "document-meta-link-missing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      key={normalizeFilePathKey(item.link.filePath)}
      type="button"
      title={item.link.filePath}
      onClick={() => onOpenRelatedDocument(item.link)}
    >
      <BookOpenText size={13} />
      <span className="document-meta-chip-main">{title}</span>
      <span className="document-meta-type-badge">
        {isMissing ? "失效" : getDocumentTypeName(documentType)}
      </span>
      {editable ? (
        <span
          className="document-meta-chip-remove"
          role="button"
          tabIndex={0}
          aria-label={`移除相关文档 ${title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemoveDocumentLink(item.link.filePath);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemoveDocumentLink(item.link.filePath);
            }
          }}
        >
          <X size={12} />
        </span>
      ) : null}
    </button>
  );
}

export function DocumentKnowledgeBar({
  activeDocument,
  activeSuggestion,
  backlinks,
  isEditorOpen,
  isEditorCloseVisible = true,
  isEditorHeaderVisible = true,
  knowledge,
  missingLinks,
  newTagName,
  outgoingLinks,
  propertyKeyDraft,
  propertyKeySuggestions,
  propertyValueDraft,
  propertyValueSuggestions,
  relatedDocuments,
  showMissingRelations = true,
  tagSuggestions,
  wikiLinkInputRef,
  wikiLinkTargetDraft,
  onAddTag,
  onCreateMissingWikiLink,
  onInsertWikiLink,
  onOpenDocument,
  onOpenDocumentLinkPicker,
  onOpenRelatedDocument,
  onOpenWikiLinkInsertForm,
  onRemoveDocumentLink,
  onRemoveProperty,
  onRemoveTag,
  onSaveProperty,
  onSetActiveSuggestion,
  onSetEditorOpen,
  onSetNewTagName,
  onSetPropertyKeyDraft,
  onSetPropertyValueDraft,
  onSetWikiLinkTargetDraft,
}: DocumentKnowledgeBarProps) {
  if (!activeDocument) {
    return null;
  }

  const canEditContentLinks = isMarkdownDocument(activeDocument);
  const metadataTagKeys = new Set(
    knowledge?.metadataTags.map((tag) => tag.toLocaleLowerCase()) ?? [],
  );
  const metadataPropertyKeys = new Set(
    knowledge?.metadataProperties.map((property) =>
      property.key.toLocaleLowerCase(),
    ) ?? [],
  );
  const tags = knowledge?.tags ?? [];
  const properties = knowledge?.properties ?? [];
  const visibleRelatedDocuments = showMissingRelations
    ? relatedDocuments
    : relatedDocuments.filter((item) => item.document);
  const visibleOutgoingLinks = showMissingRelations
    ? outgoingLinks
    : outgoingLinks.filter((link) => link.targetDocument);
  const visibleMissingLinks = showMissingRelations ? missingLinks : [];
  const shouldShowContentLinks =
    canEditContentLinks ||
    visibleOutgoingLinks.length > 0 ||
    backlinks.length > 0 ||
    visibleMissingLinks.length > 0;
  const hasDoubleLinkKnowledge =
    visibleRelatedDocuments.length > 0 ||
    visibleOutgoingLinks.length > 0 ||
    backlinks.length > 0 ||
    visibleMissingLinks.length > 0;

  if (!isEditorOpen) {
    return (
      <section
        className="document-knowledge-bar document-knowledge-bar-compact"
        aria-label="文档元信息"
      >
        <div className="document-knowledge-summary">
          <span className="document-knowledge-summary-title">
            <Link2 size={14} />
            链接
          </span>
          {hasDoubleLinkKnowledge ? (
            <>
              {visibleOutgoingLinks.length ? (
                <span className="document-meta-chip document-meta-link-chip">
                  <Link2 size={13} />
                  笔记链接 {visibleOutgoingLinks.length}
                </span>
              ) : null}
              {backlinks.length ? (
                <span className="document-meta-chip document-meta-backlink-chip">
                  <BookOpenText size={13} />
                  反链 {backlinks.length}
                </span>
              ) : null}
              {visibleRelatedDocuments.length ? (
                <span className="document-meta-chip document-meta-document-link-chip">
                  <BookOpenText size={13} />
                  相关文档 {visibleRelatedDocuments.length}
                </span>
              ) : null}
              {canEditContentLinks && visibleMissingLinks.length ? (
                <span className="document-meta-chip document-meta-missing-chip">
                  缺失 {visibleMissingLinks.length}
                </span>
              ) : null}
            </>
          ) : (
            <span className="document-knowledge-placeholder">
              可添加笔记链接和相关文档
            </span>
          )}
          <button
            className="document-knowledge-edit-button"
            type="button"
            onClick={() => onSetEditorOpen(true)}
          >
            编辑
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="document-knowledge-bar document-knowledge-bar-expanded"
      aria-label="文档元信息"
    >
      {isEditorHeaderVisible ? (
        <div className="document-knowledge-editor-header">
          <div>
            <strong>文档信息</strong>
            <span>标签、属性和相关文档保存在元信息中，笔记链接会插入正文。</span>
          </div>
          {isEditorCloseVisible ? (
            <button
              type="button"
              aria-label="收起文档信息"
              onClick={() => onSetEditorOpen(false)}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="document-knowledge-row document-knowledge-row-suggest">
        <span className="document-knowledge-label">
          <Hash size={15} />
          标签
        </span>
        {tags.map((tag) => {
          const canRemove = metadataTagKeys.has(tag.toLocaleLowerCase());

          return (
            <span className="document-meta-chip document-meta-chip-tag" key={tag}>
              #{tag}
              {canRemove ? (
                <button
                  type="button"
                  aria-label={`移除标签 ${tag}`}
                  onClick={() => onRemoveTag(tag)}
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
          );
        })}
        <form
          className="document-meta-chip-form"
          onSubmit={(event) => {
            event.preventDefault();
            onAddTag();
          }}
        >
          <span className="document-meta-suggest-field">
            <input
              value={newTagName}
              onChange={(event) => onSetNewTagName(event.target.value)}
              onFocus={() => onSetActiveSuggestion("tag")}
              onBlur={() =>
                window.setTimeout(() => onSetActiveSuggestion(null), 120)
              }
              placeholder="添加标签"
              aria-label="添加标签"
            />
            <MetadataSuggestionMenu
              activeSuggestion={activeSuggestion}
              field="tag"
              items={getMetadataSuggestionMatches(tagSuggestions, newTagName)}
              onSelect={onSetNewTagName}
              onSetActiveSuggestion={onSetActiveSuggestion}
            />
          </span>
          <button type="submit" aria-label="添加标签">
            <Plus size={13} />
          </button>
        </form>
      </div>

      <div className="document-knowledge-row document-knowledge-row-suggest">
        <span className="document-knowledge-label">
          <FileText size={15} />
          属性
        </span>
        {properties.map((property) => (
          <span className="document-meta-chip document-meta-chip-property" key={property.key}>
            <strong>{property.key}</strong>
            <span>{property.value}</span>
            {metadataPropertyKeys.has(property.key.toLocaleLowerCase()) ? (
              <button
                type="button"
                aria-label={`移除属性 ${property.key}`}
                onClick={() => onRemoveProperty(property.key)}
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <form
          className="document-meta-property-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveProperty();
          }}
        >
          <span className="document-meta-suggest-field">
            <input
              value={propertyKeyDraft}
              onChange={(event) => onSetPropertyKeyDraft(event.target.value)}
              onFocus={() => onSetActiveSuggestion("propertyKey")}
              onBlur={() =>
                window.setTimeout(() => onSetActiveSuggestion(null), 120)
              }
              placeholder="属性名"
              aria-label="属性名"
            />
            <MetadataSuggestionMenu
              activeSuggestion={activeSuggestion}
              field="propertyKey"
              items={getMetadataSuggestionMatches(
                propertyKeySuggestions,
                propertyKeyDraft,
              )}
              onSelect={onSetPropertyKeyDraft}
              onSetActiveSuggestion={onSetActiveSuggestion}
            />
          </span>
          <span className="document-meta-suggest-field document-meta-suggest-field-wide">
            <input
              value={propertyValueDraft}
              onChange={(event) => onSetPropertyValueDraft(event.target.value)}
              onFocus={() => onSetActiveSuggestion("propertyValue")}
              onBlur={() =>
                window.setTimeout(() => onSetActiveSuggestion(null), 120)
              }
              placeholder="属性值"
              aria-label="属性值"
            />
            <MetadataSuggestionMenu
              activeSuggestion={activeSuggestion}
              field="propertyValue"
              items={getMetadataSuggestionMatches(
                propertyValueSuggestions,
                propertyValueDraft,
              )}
              onSelect={onSetPropertyValueDraft}
              onSetActiveSuggestion={onSetActiveSuggestion}
            />
          </span>
          <button type="submit" aria-label="保存属性">
            <Check size={13} />
          </button>
        </form>
      </div>

      <div className="document-knowledge-row document-knowledge-relations-row">
        <span className="document-knowledge-label">
          <BookOpenText size={15} />
          相关文档
        </span>
        {visibleRelatedDocuments.map((item) => (
          <RelatedDocumentChip
            editable
            item={item}
            key={normalizeFilePathKey(item.link.filePath)}
            onOpenRelatedDocument={onOpenRelatedDocument}
            onRemoveDocumentLink={onRemoveDocumentLink}
          />
        ))}
        <button
          className="document-meta-chip document-meta-add-link"
          type="button"
          onClick={onOpenDocumentLinkPicker}
        >
          <Plus size={13} />
          添加相关文档
        </button>
      </div>

      {shouldShowContentLinks ? (
        <div className="document-knowledge-row document-knowledge-row-links">
          <span className="document-knowledge-label">
            <Link2 size={15} />
            笔记链接
          </span>
          {visibleOutgoingLinks.map((link) =>
            link.targetDocument ? (
              <button
                className="document-meta-chip document-meta-link-chip"
                key={`${link.raw}-${link.index}`}
                type="button"
                title={getDocumentDisplayName(link.targetDocument)}
                onClick={() => onOpenDocument(link.targetDocument!)}
              >
                [[{link.display}]]
              </button>
            ) : (
              <button
                className="document-meta-chip document-meta-link-chip document-meta-link-missing"
                key={`${link.raw}-${link.index}`}
                type="button"
                title="创建目标文件"
                onClick={() => onCreateMissingWikiLink(link.target)}
              >
                [[{link.display}]]
              </button>
            ),
          )}
          {backlinks.length ? (
            <span className="document-meta-chip document-meta-backlink-chip">
              <BookOpenText size={13} />
              反链 {backlinks.length}
            </span>
          ) : null}
          {canEditContentLinks && visibleMissingLinks.length ? (
            <span className="document-meta-chip document-meta-missing-chip">
              缺失 {visibleMissingLinks.length}
            </span>
          ) : null}
          {canEditContentLinks ? (
            <>
              <button
                className="document-meta-chip document-meta-add-link"
                type="button"
                onClick={onOpenWikiLinkInsertForm}
              >
                <Plus size={13} />
                插入笔记链接
              </button>
              <form
                className="document-meta-link-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onInsertWikiLink();
                }}
              >
                <input
                  ref={wikiLinkInputRef}
                  value={wikiLinkTargetDraft}
                  onChange={(event) => onSetWikiLinkTargetDraft(event.target.value)}
                  placeholder="输入目标笔记"
                  aria-label="笔记链接目标"
                />
                <button type="submit">
                  <Check size={13} />
                  插入
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
