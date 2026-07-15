import {
  BookOpenText,
  Copy,
  FileText,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  menubarItems,
  type MenubarMenu,
  type TopMenu,
} from "./appShellModel";

type AppMenubarProps = {
  appLogoUrl: string;
  contentActions?: AppMenubarContentAction[];
  contentDirty?: boolean;
  contentKind?: "diary" | "document" | "viewer";
  contentTitle?: string;
  contentTitleDetail?: string;
  isFullScreen: boolean;
  isMaximized: boolean;
  onCloseContent?: () => void;
  onHideTop: () => void;
  onOpenHome: () => void;
  onRevealTop: () => void;
  platform?: string;
  renderDropdown: (menu: MenubarMenu) => ReactNode;
  setTopMenu: Dispatch<SetStateAction<TopMenu>>;
  topMenu: TopMenu;
};

export type AppMenubarContentAction = {
  disabled?: boolean;
  group?: "document" | "export" | "location";
  icon: ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
};

export function AppMenubar({
  appLogoUrl,
  contentActions = [],
  contentDirty = false,
  contentKind = "document",
  contentTitle,
  contentTitleDetail,
  isFullScreen,
  isMaximized,
  onCloseContent,
  onHideTop,
  onOpenHome,
  onRevealTop,
  platform,
  renderDropdown,
  setTopMenu,
  topMenu,
}: AppMenubarProps) {
  const isMac = platform === "darwin";
  const [isContentMenuOpen, setIsContentMenuOpen] = useState(false);
  const contentMenuRef = useRef<HTMLDivElement | null>(null);
  const sizeControlLabel = isFullScreen
    ? "退出全屏"
    : isMaximized
      ? "还原窗口"
      : "最大化";

  useEffect(() => {
    if (!isContentMenuOpen) {
      return;
    }

    const closeContentMenu = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof PointerEvent &&
        contentMenuRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      if (event instanceof KeyboardEvent && event.key !== "Escape") {
        return;
      }

      setIsContentMenuOpen(false);
    };

    window.addEventListener("pointerdown", closeContentMenu);
    window.addEventListener("keydown", closeContentMenu);

    return () => {
      window.removeEventListener("pointerdown", closeContentMenu);
      window.removeEventListener("keydown", closeContentMenu);
    };
  }, [isContentMenuOpen]);

  useEffect(() => {
    if (topMenu) {
      setIsContentMenuOpen(false);
    }
  }, [topMenu]);

  function toggleWindowSize() {
    if (isFullScreen) {
      void window.desktop?.toggleFullScreen?.();
      return;
    }

    void window.desktop?.windowControl?.("maximize");
  }

  return (
    <header
      className={isMac ? "app-menubar app-menubar-mac" : "app-menubar"}
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
        {isMac ? (
          <div className="mac-window-title">noteDock</div>
        ) : (
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
        )}
      </div>
      <div className="menubar-content-slot">
        {contentTitle && onCloseContent ? (
          <div className="menubar-content-tab" title={contentTitleDetail || contentTitle}>
            <span className="menubar-content-icon" aria-hidden="true">
              {contentKind === "diary" ? (
                <BookOpenText size={14} />
              ) : (
                <FileText size={14} />
              )}
            </span>
            <span className="menubar-content-title">{contentTitle}</span>
            {contentDirty ? (
              <span className="menubar-content-dirty" aria-label="有未保存的更改" />
            ) : null}
            {contentActions.length ? (
              <div className="menubar-content-menu" ref={contentMenuRef}>
                <button
                  className="menubar-content-icon-button"
                  type="button"
                  aria-label="更多文件操作"
                  aria-expanded={isContentMenuOpen}
                  title="更多文件操作"
                  onClick={() => {
                    setTopMenu(null);
                    setIsContentMenuOpen((current) => !current);
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
                {isContentMenuOpen ? (
                  <div className="menubar-content-dropdown" role="menu" aria-label="文件操作">
                    <div className="menubar-content-dropdown-header">
                      <strong title={contentTitleDetail || contentTitle}>{contentTitle}</strong>
                      <span>文件操作</span>
                    </div>
                    {contentActions.map((action, index) => {
                      const previousGroup = contentActions[index - 1]?.group;
                      const showDivider = index > 0 && action.group !== previousGroup;

                      return (
                        <Fragment key={action.key}>
                          {showDivider ? (
                            <div className="menubar-content-dropdown-divider" role="separator" />
                          ) : null}
                          <button
                            disabled={action.disabled}
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setIsContentMenuOpen(false);
                              action.onSelect();
                            }}
                          >
                            <span aria-hidden="true">{action.icon}</span>
                            <span>{action.label}</span>
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              className="menubar-content-icon-button menubar-content-close"
              type="button"
              aria-label={contentKind === "diary" ? "关闭日记" : "关闭当前文档"}
              title={contentKind === "diary" ? "关闭日记" : "关闭当前文档"}
              onClick={onCloseContent}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}
      </div>
      {isMac ? null : (
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
            {isFullScreen ? (
              <Copy size={13} />
            ) : isMaximized ? (
              <Minimize2 size={13} />
            ) : (
              <Maximize2 size={13} />
            )}
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
      )}
    </header>
  );
}
