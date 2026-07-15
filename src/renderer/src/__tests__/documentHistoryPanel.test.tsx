import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentHistoryPanel } from "../components/DocumentHistoryPanel";
import type { MarkdownDocument } from "../types";

const document: MarkdownDocument = {
  content: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  documentType: "markdown",
  drawings: {},
  filePath: "/notes/example.md",
  id: "example",
  metadata: { documentLinks: [], properties: [], tags: [] },
  title: "example",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("DocumentHistoryPanel", () => {
  it("keeps the no-version state in the version list and the preview state compact", () => {
    const html = renderToStaticMarkup(
      <DocumentHistoryPanel
        activeDocument={document}
        isLoading={false}
        isRestoring={false}
        selectedVersion={null}
        versions={[]}
        onRefresh={() => undefined}
        onSelectVersion={() => undefined}
      />,
    );

    expect(html).toContain("document-history-empty");
    expect(html).toContain("document-history-preview-empty");
    expect(html).toContain("还没有历史记录");
    expect(html).toContain("选择一个版本查看内容");
  });

  it("renders history with the normal Markdown preview surface and hides frontmatter", () => {
    const html = renderToStaticMarkup(
      <DocumentHistoryPanel
        activeDocument={document}
        isLoading={false}
        isRestoring={false}
        selectedVersion={{
          byteSize: 52,
          content: "---\nprivate: metadata\n---\n# History body",
          contentHash: "hash",
          contentUpdatedAt: "2026-01-01T10:00:00.000Z",
          createdAt: "2026-01-01T10:01:00.000Z",
          filePath: "/notes/example.md",
          id: "version",
          lineCount: 4,
          preview: "# History body",
          reason: "auto",
          title: "example.md",
          wordCount: 2,
        }}
        versions={[]}
        onRefresh={() => undefined}
        onSelectVersion={() => undefined}
      />,
    );

    expect(html).toContain("document-history-markdown-preview");
    expect(html).toContain("History body");
    expect(html).not.toContain("private: metadata");
    expect(html).toContain("保存于");
  });
});
