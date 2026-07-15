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
    expect(html).toContain("保存中");
    expect(html).not.toContain("自动保存中");
    expect(html).toContain("12 ");
  });

  it("shows idle autosave as saved", () => {
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

    expect(html).toContain("workspace-autosave-status-idle");
    expect(html).toContain("已保存");
    expect(html).not.toContain("自动保存待命");
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

    expect(html).toContain("PDF 阅读");
    expect(html).toContain("workspace-asset-warning");
    expect(html).toContain("workspace-autosave-status-failed");
    expect(html).toContain("保存失败");
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

  it("does not render document close actions in the status bar", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="saved"
        wordCount={12}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).not.toContain("关闭当前文档");
    expect(html).not.toContain("workspace-close-document-button");
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

  it("hides disabled sync status when sync is not configured", () => {
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
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).not.toContain("workspace-sync-status-disabled");
    expect(html).not.toContain("未同步");
  });

  it("does not render zoom controls or the editor mode switcher", () => {
    const html = renderToStaticMarkup(
      <WorkspaceStatusBar
        activeDocument={document()}
        isSidebarHidden={false}
        missingAssetReferences={[]}
        saveState="saved"
        wordCount={18}
        onToggleSidebar={() => {}}
      />,
    );

    expect(html).not.toContain('aria-label="编辑模式"');
    expect(html).not.toContain("实时预览");
    expect(html).not.toContain("workspace-editor-mode");
    expect(html).not.toContain("workspace-zoom-button");
    expect(html).not.toContain("恢复 100%");
    expect(html).not.toContain("workspace-settings-button");
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
