import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppConfirmationDialog,
  AppConfirmationDialogBody,
  DocumentLoadingIndicator,
  MenuItem,
  RecentFileMenuItem,
} from "../components/AppChrome";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/example.md",
    id: "doc",
    title: "Example",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("App chrome components", () => {
  it("renders loading details", () => {
    const html = renderToStaticMarkup(
      <DocumentLoadingIndicator title="正在打开" detail="example.md" />,
    );

    expect(html).toContain("正在打开");
    expect(html).toContain("example.md");
  });

  it("renders checked menu items and recent missing files", () => {
    const menuHtml = renderToStaticMarkup(
      <MenuItem checked label="选项" shortcut="Ctrl+1" />,
    );
    const recentHtml = renderToStaticMarkup(
      <RecentFileMenuItem
        document={document()}
        exists={false}
        onOpen={() => {}}
      />,
    );

    expect(menuHtml).toContain("menuitemcheckbox");
    expect(menuHtml).toContain("Ctrl+1");
    expect(recentHtml).toContain("recent-file-menu-button-missing");
    expect(recentHtml).toContain("文件不存在");
  });

  it("renders confirmation dialogs", () => {
    const html = renderToStaticMarkup(
      <div className="app-dialog app-dialog-danger">
        <AppConfirmationDialogBody
          dialog={{
            cancelLabel: "取消",
            confirmLabel: "删除",
            description: "这个操作不可撤销。",
            title: "删除文件？",
            tone: "danger",
            type: "confirm",
          }}
          onClose={() => {}}
          useDialogPrimitives={false}
        />
      </div>,
    );

    expect(html).toContain("删除文件？");
    expect(html).toContain("这个操作不可撤销。");
    expect(html).toContain("app-dialog-danger");
  });

  it("keeps the portal-backed confirmation dialog SSR-safe", () => {
    const html = renderToStaticMarkup(
      <AppConfirmationDialog
        dialog={{
          cancelLabel: "取消",
          confirmLabel: "删除",
          description: "这个操作不可撤销。",
          title: "删除文件？",
          tone: "danger",
          type: "confirm",
        }}
        onClose={() => {}}
      />,
    );

    expect(html).toBe("");
  });
});
