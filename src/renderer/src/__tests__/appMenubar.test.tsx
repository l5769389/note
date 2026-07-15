import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppMenubar } from "../features/app-shell/AppMenubar";

function renderMenubar(platform: string) {
  return renderToStaticMarkup(
    <AppMenubar
      appLogoUrl="/icon.png"
      isFullScreen={false}
      isMaximized={false}
      onHideTop={() => {}}
      onOpenHome={() => {}}
      onRevealTop={() => {}}
      platform={platform}
      renderDropdown={() => null}
      setTopMenu={() => {}}
      topMenu={null}
    />,
  );
}

describe("AppMenubar platform chrome", () => {
  it("uses native macOS chrome instead of in-app menus and window buttons", () => {
    const html = renderMenubar("darwin");

    expect(html).toContain("app-menubar-mac");
    expect(html).toContain("mac-window-title");
    expect(html.match(/noteDock/g)).toHaveLength(1);
    expect(html).not.toContain("menubar-home-title");
    expect(html).not.toContain("window-controls");
    expect(html).not.toContain("data-testid=\"menu-file\"");
  });

  it("keeps custom menus and window buttons on non-mac platforms", () => {
    const html = renderMenubar("win32");

    expect(html).toContain("window-controls");
    expect(html).toContain("data-testid=\"menu-file\"");
    expect(html).not.toContain("mac-window-title");
    expect(html).not.toContain("menubar-home-title");
  });

  it("renders the active content as a closeable top-bar tab", () => {
    const html = renderToStaticMarkup(
      <AppMenubar
        appLogoUrl="/icon.png"
        contentActions={[
          {
            icon: <span>i</span>,
            key: "save",
            label: "保存",
            onSelect: () => {},
          },
        ]}
        contentDirty
        contentKind="document"
        contentTitle="项目方案.md"
        contentTitleDetail="D:/notes/项目方案.md"
        isFullScreen={false}
        isMaximized={false}
        onCloseContent={() => {}}
        onHideTop={() => {}}
        onOpenHome={() => {}}
        onRevealTop={() => {}}
        platform="win32"
        renderDropdown={() => null}
        setTopMenu={() => {}}
        topMenu={null}
      />,
    );

    expect(html).toContain("menubar-content-tab");
    expect(html).toContain("项目方案.md");
    expect(html).toContain("有未保存的更改");
    expect(html).toContain("更多文件操作");
    expect(html).toContain("关闭当前文档");
  });
});
