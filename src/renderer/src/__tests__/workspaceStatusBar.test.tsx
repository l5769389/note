import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceStatusBar } from "../components/WorkspaceStatusBar";
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

describe("WorkspaceStatusBar", () => {
  it("renders autosave state and markdown word count", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="saving"
        wordCount={12}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("workspace-autosave-status-saving");
    expect(html).toContain("12 ");
  });

  it("renders preview labels for non-markdown documents", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document({ documentType: "pdf" })}
        isSidebarHidden
        missingAssetReferences={["missing.png"]}
        saveState="failed"
        wordCount={0}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("PDF preview");
    expect(html).toContain("workspace-asset-warning");
    expect(html).toContain("workspace-autosave-status-failed");
  });

  it("renders relation action when relation data is available", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        relationCount={3}
        saveState="saved"
        wordCount={12}
        onOpenRelations={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("关系 3");
    expect(html).toContain("workspace-autosave-status-saved");
  });
});
