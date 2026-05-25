import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentInspectorSidebar } from "../components/DocumentInspectorSidebar";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/current.md",
    id: "doc",
    title: "Current",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DocumentInspectorSidebar", () => {
  it("renders expanded metadata and relation content in the right sidebar", () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorSidebar
        activeDocument={document()}
        isOpen
        knowledgePanel={<div>metadata panel</div>}
        relationsPanel={<div>relations panel</div>}
      />,
    );

    expect(html).toContain("document-inspector-sidebar-open");
    expect(html).not.toContain("属性与关系");
    expect(html).not.toContain("Current");
    expect(html).toContain("metadata panel");
    expect(html).toContain("relations panel");
  });

  it("keeps collapsed state accessible without rendering document metadata", () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorSidebar
        activeDocument={null}
        isOpen={false}
        knowledgePanel={<div>metadata panel</div>}
        relationsPanel={<div>relations panel</div>}
      />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("document-inspector-sidebar-open");
    expect(html).not.toContain("metadata panel");
    expect(html).toContain("relations panel");
  });
});
