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

  it("hides the autosave pill while idle", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="idle"
        wordCount={12}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).not.toContain("workspace-autosave-status");
    expect(html).toContain("workspace-word-count");
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

  it("renders an icon-only inspector toggle", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isInspectorOpen
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="saved"
        wordCount={12}
        onToggleInspector={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("隐藏右侧栏");
    expect(html).not.toContain("关系 3");
    expect(html).toContain("workspace-inspector-button-active");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("workspace-autosave-status-saved");
  });

  it("renders an icon-only close document action", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="saved"
        wordCount={12}
        onCloseDocument={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("关闭当前文档");
    expect(html).toContain("workspace-close-document-button");
  });

  it("hides document status content when no document is open", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={null}
        isSidebarHidden={false}
        missingAssetReferences={["missing.png"]}
        saveState="saved"
        wordCount={0}
        onToggleInspector={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("workspace-status-button");
    expect(html).not.toContain("workspace-inspector-button");
    expect(html).not.toContain("workspace-asset-warning");
    expect(html).not.toContain("workspace-autosave-status");
    expect(html).not.toContain("workspace-word-count");
  });

  it("renders settings and lets disabled sync open configuration", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={null}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="idle"
        syncStatus={{
          configuration: {
            enabled: false,
            serverUrl: "",
            tokenConfigured: false,
            workspaceId: "default",
          },
          state: "disabled",
        }}
        wordCount={0}
        onConfigureSync={() => {}}
        onOpenSettings={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("workspace-settings-button");
    expect(html).toContain("workspace-sync-status-disabled");
    expect(html).toContain("配置同步信息");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("renders an enabled sync status entry for the account menu", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={null}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="idle"
        syncStatus={{
          configuration: {
            enabled: true,
            serverUrl: "https://sync.example.com",
            tokenConfigured: true,
            workspaceId: "default",
          },
          state: "synced",
        }}
        wordCount={0}
        onOpenSyncMenu={() => {}}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).toContain("workspace-sync-status-synced");
    expect(html).toContain("已同步");
    expect(html).not.toContain("disabled=\"\"");
  });
});
