import type { ReactNode } from "react";
import type { MarkdownDocument } from "../types";

type DocumentInspectorSidebarProps = {
  activeDocument: MarkdownDocument | null;
  historyPanel?: ReactNode;
  isOpen: boolean;
  knowledgePanel: ReactNode;
  relationsPanel?: ReactNode;
};

export function DocumentInspectorSidebar({
  activeDocument,
  historyPanel,
  isOpen,
  knowledgePanel,
  relationsPanel,
}: DocumentInspectorSidebarProps) {
  return (
    <aside
      className={[
        "document-inspector-sidebar",
        isOpen ? "document-inspector-sidebar-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!isOpen}
      aria-label="文档属性和关系"
    >
      <div className="document-inspector-body">
        <section className="document-inspector-card document-inspector-card-metadata">
          {activeDocument ? (
            knowledgePanel
          ) : (
            <div className="document-inspector-empty">
              打开一个文件后，可以在这里维护标签、属性和相关文档。
            </div>
          )}
        </section>
        {activeDocument && relationsPanel ? (
          <details className="document-inspector-card document-inspector-card-relations">
            <summary>关系总览</summary>
            {relationsPanel}
          </details>
        ) : null}
        {activeDocument && historyPanel ? (
          <section className="document-inspector-card document-inspector-card-history">
            {historyPanel}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
