import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../../../package.json", import.meta.url), "utf8");

describe("responsive interface layout CSS", () => {
  it("keeps enabled home side panels available at every container width", () => {
    expect(styles).toContain("@container welcome-home (max-width: 1040px)");
    expect(styles).toContain("@container welcome-home (max-width: 720px)");
    expect(styles).not.toMatch(
      /\.home-side-column\s*\{[^}]*display:\s*none/,
    );
  });

  it("keeps the home workspace compact without visible page scrollbars", () => {
    expect(styles).toMatch(
      /\.welcome-home\s*\{[\s\S]*?overflow:\s*hidden/,
    );
    expect(styles).toMatch(
      /\.home-dashboard\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden/,
    );
    expect(styles).toMatch(
      /\.home-main-column\s*\{[\s\S]*?overflow:\s*hidden/,
    );
    expect(styles).toMatch(
      /\.home-brand-panel\s*\{[\s\S]*?min-height:\s*66px/,
    );
    expect(styles).toMatch(
      /\.home-shortcut-panel\s*\{[\s\S]*?border:\s*0;[\s\S]*?padding:\s*0;[\s\S]*?box-shadow:\s*none/,
    );
    expect(styles).toMatch(
      /\.home-brand-actions \.home-quick-action-primary\s*\{[\s\S]*?background:\s*var\(--ui-primary\)/,
    );
    expect(styles).toMatch(
      /\.home-brand-actions \.home-quick-action-primary:hover\s*\{[\s\S]*?background:\s*var\(--ui-primary-hover\)/,
    );
  });

  it("uses a single separator between home sections without nested cards", () => {
    expect(styles).toMatch(
      /\.home-main-column > section \+ section\s*\{[\s\S]*?border-top:\s*1px solid var\(--ui-border\);[\s\S]*?border-bottom:\s*0/,
    );
    expect(styles).toMatch(
      /\.recent-documents\s*\{[\s\S]*?border-bottom:\s*0/,
    );
    expect(styles).toMatch(
      /\.home-todo-date-bar\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.home-todo-empty,[\s\S]*?\.home-saved-notes-empty\s*\{[\s\S]*?border:\s*0/,
    );
  });

  it("lets Markdown tables fill the available document width", () => {
    expect(styles).toMatch(
      /\.markdown-preview table,[\s\S]*?\.typora-table-block table\s*\{[\s\S]*?width:\s*100%/,
    );
    expect(styles).toMatch(
      /\.typora-milkdown-content \.ProseMirror table\s*\{[\s\S]*?width:\s*100%/,
    );
  });

  it("uses the full wide workspace height and keeps diary entry points out of home", () => {
    expect(styles).toMatch(
      /\.home-main-column\s*\{[\s\S]*?height:\s*100%;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /\.home-side-column\s*\{[\s\S]*?height:\s*100%;[\s\S]*?grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(styles).toMatch(
      /\.home-side-column-single\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/,
    );
    expect(appSource).not.toContain("showDiaryPanel={");
    expect(appSource).not.toContain("onCreateTodayDiary={");
  });

  it("uses a fluid dashboard grid instead of centering a fixed-width home canvas", () => {
    expect(styles).toMatch(
      /\.home-dashboard\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?margin:\s*0;/,
    );
    expect(styles).toMatch(
      /@container welcome-home \(min-width: 1440px\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(360px, 0\.9fr\)/,
    );
    expect(styles).toMatch(
      /@container welcome-home \(min-width: 1920px\)\s*\{[\s\S]*?padding-inline:\s*56px/,
    );
  });

  it("keeps the sidebar footer hidden until the sidebar is active", () => {
    expect(styles).toMatch(
      /\.explorer-footer-bar\s*\{[^}]*visibility:\s*hidden/,
    );
    expect(styles).toMatch(
      /\.explorer-sidebar:hover \.explorer-footer-bar,[\s\S]*?\.explorer-sidebar:focus-within \.explorer-footer-bar\s*\{[^}]*visibility:\s*visible/,
    );
  });

  it("keeps a stable settings dialog size while tabs change", () => {
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign,[\s\S]*?width:\s*min\(960px, calc\(100vw - 24px\)\);[\s\S]*?height:\s*min\(640px, calc\(100vh - 24px\)\)/,
    );
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign \.settings-redesign-shell,[\s\S]*?height:\s*100%;[\s\S]*?max-height:\s*none/,
    );
  });

  it("keeps autosave status width stable and removes the current directory dot", () => {
    expect(styles).toMatch(
      /\.workspace-autosave-status\s*\{[^}]*width:\s*82px;[^}]*flex:\s*0 0 82px/,
    );
    expect(styles).not.toContain(".sidebar-recent-directory-current {");
  });

  it("uses v1.0.5 as the packaged and renderer fallback version", () => {
    expect(packageJson).toContain('"version": "1.0.5"');
    expect(appSource).toContain('useState("1.0.5")');
  });

  it("places canvas editors above the title bar with a viewport safety inset", () => {
    expect(styles).toMatch(
      /\.canvas-dialog-overlay\s*\{[^}]*z-index:\s*400/,
    );
    expect(styles).toMatch(
      /\.drawing-dialog,[\s\S]*?inset:\s*12px;[\s\S]*?z-index:\s*410/,
    );
  });

  it("keeps history and image dialogs inside a safe, layered viewport", () => {
    expect(styles).toMatch(
      /\.document-history-dialog\s*\{[\s\S]*?z-index:\s*var\(--ui-z-dialog\);[\s\S]*?inset:\s*16px;[\s\S]*?grid-template-rows:\s*76px minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /\.document-history-browser\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px, 260px\) minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /\.document-history-browser \.document-history-panel\s*\{[\s\S]*?grid-template-columns:\s*minmax\(270px, 320px\) minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /\.document-history-preview-markdown\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow-y:\s*auto/,
    );
    expect(styles).toMatch(
      /\.document-history-preview-markdown \.markdown-preview\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible/,
    );
    expect(styles).toMatch(
      /\.document-image-preview-dialog\s*\{[\s\S]*?z-index:\s*var\(--ui-z-immersive\);[\s\S]*?inset:\s*12px/,
    );
    expect(styles).toMatch(
      /\.document-image-preview-overlay\s*\{[\s\S]*?z-index:\s*var\(--ui-z-dialog-overlay\)/,
    );
    expect(appSource).toContain('className="document-image-preview-overlay"');
  });

  it("uses visible tab count for equal sidebar tab widths", () => {
    expect(appSource).toContain("--explorer-tab-count");
    expect(styles).toMatch(
      /\.explorer-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(var\(--explorer-tab-count, 3\), minmax\(0, 1fr\)\)/,
    );
  });

  it("does not force remount the markdown editor for disk refreshes", () => {
    expect(appSource).not.toContain("documentReloadTokens");
    expect(appSource).not.toContain("setDocumentReloadTokens");
  });

  it("does not show the external-change reload dialog for normal disk updates", () => {
    expect(appSource).not.toContain("getExternalChangeConfirm");
  });

  it("keeps key UI active colors on the soft violet palette variables", () => {
    expect(styles).toContain("--ui-accent: #6254E8;");
    expect(styles).toContain("--ui-accent-soft: #F1EDFF;");
    expect(styles).toContain("--ui-primary: #4F46E5;");
    expect(styles).toContain("--ui-primary-hover: #6254E8;");
    expect(styles).toContain("/* Unified soft violet interface palette. */");
    expect(styles).not.toMatch(
      /#e56b5d|#fff0ed|#f08a7d|#3b2726|#43a96b|#edf8f1|#7bd99e|#1f3529/i,
    );
    expect(styles).toMatch(
      /\.directory-file-list-item-active\s*\{[\s\S]*?background:\s*var\(--ui-accent-soft\)/,
    );
    expect(styles).toMatch(
      /\.explorer-tab-active::after,[\s\S]*?background:\s*var\(--ui-accent\)/,
    );
    expect(styles).toMatch(
      /\.workspace-autosave-status-saving\s*\{[\s\S]*?color:\s*var\(--ui-accent\)/,
    );
    expect(styles).toMatch(
      /\.new-doc-button,[\s\S]*?\.settings-redesign-primary\s*\{[\s\S]*?var\(--ui-primary\)/,
    );
    expect(styles).toMatch(
      /\.new-doc-button:hover:not\(:disabled\),[\s\S]*?\.settings-redesign-primary:hover:not\(:disabled\)\s*\{[\s\S]*?var\(--ui-primary-hover\)/,
    );
  });

  it("centers the settings active rail and avoids sticky mouse focus styles", () => {
    expect(styles).toMatch(
      /\.settings-redesign-nav-item-active::before\s*\{[\s\S]*?top:\s*50%;[\s\S]*?height:\s*20px;[\s\S]*?transform:\s*translateY\(-50%\)/,
    );
    expect(styles).toContain("button:focus:not(:focus-visible)");
    expect(styles).toContain(
      ".settings-redesign-nav-item:focus:not(:focus-visible):not(.settings-redesign-nav-item-active)",
    );
  });

  it("uses simple settings sections without manual body typography overrides", () => {
    expect(appSource).toContain('label: "通用"');
    expect(appSource).toContain('label: "笔记"');
    expect(appSource).toContain('label: "代码"');
    expect(appSource).toContain('label: "日记"');
    expect(appSource).not.toMatch(/应用舒适度|笔记舒适度|日记舒适度|代码样式/);
    expect(appSource).not.toContain("正文排版");
    expect(appSource).not.toContain("正文字号");
    expect(appSource).not.toContain("正文行高");
    expect(appSource).not.toContain("ToggleGroup.Root");
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign \.settings-comfort-slider input\[type="range"\]\s*\{[\s\S]*?appearance:\s*none/,
    );
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign[\s\S]*?\.settings-comfort-slider[\s\S]*?input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?background:\s*var\(--ui-accent\)/,
    );
  });

  it("keeps redesigned settings surfaces theme-safe across themes", () => {
    expect(styles).toContain(
      "/* Final theme-safe settings pass: keep every setting surface on theme tokens. */",
    );
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign \.settings-redesign-shell,[\s\S]*?\.settings-dialog\.settings-redesign \.settings-redesign-main\s*\{[\s\S]*?background:\s*var\(--ui-surface\)/,
    );
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign \.settings-redesign-toggle-row,[\s\S]*?\.settings-dialog\.settings-redesign \.settings-redesign-select-row\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.settings-dialog\.settings-redesign select,[\s\S]*?\.settings-dialog\.settings-redesign input,[\s\S]*?\.settings-dialog\.settings-redesign textarea,[\s\S]*?\.settings-dialog\.settings-redesign \.settings-redesign-template-button\s*\{[\s\S]*?background:\s*var\(--ui-surface-muted\)/,
    );
    expect(styles).toMatch(
      /:root\[data-theme="night"\] \.settings-dialog\.settings-redesign select,[\s\S]*?:root\[data-theme="dark"\] \.settings-dialog\.settings-redesign textarea\s*\{[\s\S]*?color-scheme:\s*dark/,
    );
    expect(styles).toMatch(
      /\.diary-template-dialog-overlay\s*\{[\s\S]*?z-index:\s*330/,
    );
  });
});
