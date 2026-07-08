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
    expect(html).not.toContain("window-controls");
    expect(html).not.toContain("data-testid=\"menu-file\"");
  });

  it("keeps custom menus and window buttons on non-mac platforms", () => {
    const html = renderMenubar("win32");

    expect(html).toContain("window-controls");
    expect(html).toContain("data-testid=\"menu-file\"");
    expect(html).not.toContain("mac-window-title");
  });
});
