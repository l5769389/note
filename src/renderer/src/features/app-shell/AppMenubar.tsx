import { Minimize2, Minus, Square, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import {
  menubarItems,
  type MenubarMenu,
  type TopMenu,
} from "./appShellModel";

type AppMenubarProps = {
  appLogoUrl: string;
  isFullScreen: boolean;
  isMaximized: boolean;
  onHideTop: () => void;
  onOpenHome: () => void;
  onRevealTop: () => void;
  renderDropdown: (menu: MenubarMenu) => ReactNode;
  setTopMenu: Dispatch<SetStateAction<TopMenu>>;
  topMenu: TopMenu;
};

export function AppMenubar({
  appLogoUrl,
  isFullScreen,
  isMaximized,
  onHideTop,
  onOpenHome,
  onRevealTop,
  renderDropdown,
  setTopMenu,
  topMenu,
}: AppMenubarProps) {
  const isWindowRestorable = isFullScreen || isMaximized;
  const sizeControlLabel = isFullScreen
    ? "退出全屏"
    : isMaximized
      ? "还原窗口"
      : "最大化";

  function toggleWindowSize() {
    if (isFullScreen) {
      void window.desktop?.toggleFullScreen?.();
      return;
    }

    void window.desktop?.windowControl?.("maximize");
  }

  return (
    <header
      className="app-menubar"
      onPointerEnter={onRevealTop}
      onPointerLeave={onHideTop}
    >
      <div className="menubar-left">
        <button
          className="app-logo-button"
          type="button"
          aria-label="返回首页"
          onClick={onOpenHome}
        >
          <img className="app-logo-image" src={appLogoUrl} alt="" draggable={false} />
        </button>
        <nav className="menubar-menu" aria-label="应用菜单">
          {menubarItems.map((item) => (
            <div className="menubar-item" key={item.key}>
              <button
                data-testid={`menu-${item.key}`}
                className={
                  topMenu === item.key
                    ? "menubar-trigger menubar-trigger-active"
                    : "menubar-trigger"
                }
                type="button"
                aria-expanded={topMenu === item.key}
                onMouseEnter={() => {
                  if (topMenu) {
                    setTopMenu(item.key);
                  }
                }}
                onClick={() =>
                  setTopMenu((current) => (current === item.key ? null : item.key))
                }
              >
                {item.label}
              </button>
              {topMenu === item.key && (
                <div
                  className={`menubar-dropdown menubar-dropdown-${item.key}`}
                  role="menu"
                  aria-label={item.label}
                  onPointerDown={(event) => {
                    if (
                      event.target instanceof Element &&
                      !event.target.closest("button")
                    ) {
                      setTopMenu(null);
                    }
                  }}
                >
                  <div
                    className={`menubar-dropdown-scroll menubar-dropdown-scroll-${item.key}`}
                  >
                    {renderDropdown(item.key)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div className="window-controls" aria-label="窗口控制">
        <button
          className="window-control-button"
          type="button"
          aria-label="最小化"
          onClick={() => void window.desktop?.windowControl?.("minimize")}
        >
          <Minus size={15} />
        </button>
        <button
          className="window-control-button"
          type="button"
          aria-label={sizeControlLabel}
          title={sizeControlLabel}
          onClick={toggleWindowSize}
        >
          {isWindowRestorable ? <Minimize2 size={13} /> : <Square size={12} />}
        </button>
        <button
          className="window-control-button window-control-close"
          type="button"
          aria-label="关闭"
          onClick={() => void window.desktop?.windowControl?.("close")}
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
