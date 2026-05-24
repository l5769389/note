import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeRelationsPanel } from "../components/KnowledgeRelationsPanel";
import type { WorkspaceRelationItem } from "../components/KnowledgeRelationsPanel";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Document",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("KnowledgeRelationsPanel", () => {
  it("renders concrete linked relations without missing status noise", () => {
    const sourceDocument = document({
      filePath: "D:/notes/source.md",
      id: "source",
      title: "Source",
    });
    const targetDocument = document({
      filePath: "D:/notes/target.md",
      id: "target",
      title: "Target",
    });
    const item: WorkspaceRelationItem = {
      id: "content-source-target",
      kind: "content",
      link: {
        display: "Target",
        index: 0,
        normalizedTarget: "target",
        raw: "[[Target]]",
        target: "Target",
        targetDocument,
      },
      searchText: "source target",
      sourceDocument,
      status: "linked",
      targetDocument,
      targetPath: "D:/notes/target.md",
      title: "Target",
    };

    const html = renderToStaticMarkup(
      <KnowledgeRelationsPanel
        filter="all"
        filteredItems={[item]}
        items={[item]}
        query=""
        stats={{
          contentCount: 1,
          documentCount: 0,
          sourceCount: 1,
          totalCount: 1,
        }}
        onFilterChange={() => {}}
        onOpenDocument={() => {}}
        onOpenFile={() => {}}
        onQueryChange={() => {}}
        onRefresh={() => {}}
        onRemoveDocumentLink={() => {}}
      />,
    );

    expect(html).toContain("具体关系");
    expect(html).toContain("Source");
    expect(html).toContain("Target");
    expect(html).not.toContain("失效");
    expect(html).not.toContain("创建");
  });
});
