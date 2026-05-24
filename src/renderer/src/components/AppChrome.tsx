import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileText,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  getDocumentDisplayName,
  getDocumentPathPreview,
} from "../documentModel";
import type { AppDialogState } from "../useAppDialog";
import type { MarkdownDocument } from "../types";
import { formatRecentTimestamp } from "../workspaceDisplay";

export function DocumentLoadingIndicator({
  detail,
  title,
}: {
  detail?: string;
  title: string;
}) {
  return (
    <div className="document-loading-card" role="status" aria-live="polite">
      <span className="document-loading-spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

export function AboutDialog({
  logoUrl,
  onOpenChange,
  open,
}: {
  logoUrl: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay about-dialog-overlay" />
        <Dialog.Content className="about-dialog">
          <div className="about-header">
            <div className="about-brand">
              <img src={logoUrl} alt="" draggable={false} />
              <div>
                <Dialog.Title className="about-title">noteDock</Dialog.Title>
                <Dialog.Description className="about-subtitle">
                  本地优先的 Markdown 笔记与文档阅读工具
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" type="button" aria-label="关闭关于 noteDock">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="about-body">
            <p>
              noteDock 面向日常学习、项目笔记和资料阅读，提供实时渲染编辑、文件树、目录定位、HTML/PDF/Office 文档预览，以及轻量批注能力。
            </p>
            <div className="about-feature-grid" aria-label="noteDock 功能概览">
              <span>实时渲染编辑</span>
              <span>多格式预览</span>
              <span>HTML 批注</span>
            </div>
            <p>
              应用基于 Electron、React 与 Milkdown 构建，优先使用本地文件和本机存储，让笔记工作流保持简单、可控。
            </p>
            <div className="about-meta">
              <span>版本 0.1.0</span>
              <span>Electron + Milkdown</span>
            </div>
          </div>
          <div className="dialog-actions about-actions">
            <Dialog.Close asChild>
              <button className="primary-button" type="button">
                <Check size={16} />
                知道了
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppConfirmationDialog({
  dialog,
  onClose,
}: {
  dialog: AppDialogState | null;
  onClose: (confirmed: boolean) => void;
}) {
  return (
    <Dialog.Root
      open={Boolean(dialog)}
      onOpenChange={(open) => {
        if (!open) {
          onClose(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay app-dialog-overlay" />
        <Dialog.Content
          className={`app-dialog app-dialog-${dialog?.tone ?? "info"}`}
        >
          <AppConfirmationDialogBody dialog={dialog} onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppConfirmationDialogBody({
  dialog,
  onClose,
  useDialogPrimitives = true,
}: {
  dialog: AppDialogState | null;
  onClose: (confirmed: boolean) => void;
  useDialogPrimitives?: boolean;
}) {
  if (!dialog) {
    return null;
  }

  return (
    <>
      <div className="app-dialog-header">
        <span className="app-dialog-icon" aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <div>
          {useDialogPrimitives ? (
            <>
              <Dialog.Title className="app-dialog-title">
                {dialog.title}
              </Dialog.Title>
              <Dialog.Description className="app-dialog-description">
                {dialog.description}
              </Dialog.Description>
            </>
          ) : (
            <>
              <h2 className="app-dialog-title">{dialog.title}</h2>
              <p className="app-dialog-description">{dialog.description}</p>
            </>
          )}
        </div>
        <button
          className="icon-button app-dialog-close"
          type="button"
          aria-label="关闭"
          onClick={() => onClose(false)}
        >
          <X size={16} />
        </button>
      </div>
      {dialog.detail ? (
        <div className="app-dialog-detail" title={dialog.detail}>
          {dialog.detail}
        </div>
      ) : null}
      <div className="dialog-actions app-dialog-actions">
        {dialog.type === "confirm" ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onClose(false)}
          >
            {dialog.cancelLabel ?? "取消"}
          </button>
        ) : null}
        <button
          className="primary-button"
          type="button"
          onClick={() => onClose(true)}
        >
          <Check size={16} />
          {dialog.confirmLabel}
        </button>
      </div>
    </>
  );
}

export function MenuSeparator() {
  return <div className="menubar-dropdown-separator" role="separator" />;
}

export function MenuItem({
  checked,
  disabled,
  label,
  onSelect,
  shortcut,
  submenu,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: ReactNode;
  onSelect?: () => void;
  shortcut?: string;
  submenu?: boolean;
}) {
  const role = checked === undefined ? "menuitem" : "menuitemcheckbox";

  return (
    <button
      aria-checked={checked === undefined ? undefined : checked}
      className={[
        "menubar-dropdown-item",
        checked ? "menubar-dropdown-item-checked" : "",
        disabled ? "menubar-dropdown-item-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onSelect}
      role={role}
      type="button"
    >
      <span className="menubar-dropdown-check">{checked ? <Check size={17} /> : null}</span>
      <span className="menubar-dropdown-label">{label}</span>
      <span className="menubar-dropdown-shortcut">{shortcut ? <kbd>{shortcut}</kbd> : null}</span>
      {submenu && <ChevronRight className="menubar-dropdown-arrow" size={18} />}
    </button>
  );
}

export function MenuSubmenu({
  children,
  label,
  panelClassName,
}: {
  children: ReactNode;
  label: ReactNode;
  panelClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({
    left: -9999,
    top: -9999,
  });

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 220);
  }

  function updatePanelPosition() {
    const rect = submenuRef.current?.getBoundingClientRect();
    const panel = panelRef.current;

    if (rect) {
      const panelHeight = panel?.offsetHeight || 320;
      const panelWidth = panel?.offsetWidth || 176;
      const maxTop = Math.max(8, window.innerHeight - panelHeight - 8);
      const preferredLeft = rect.right - 2;
      const left =
        preferredLeft + panelWidth > window.innerWidth - 8
          ? Math.max(8, rect.left - panelWidth + 2)
          : preferredLeft;

      setPanelStyle({
        left,
        top: Math.min(Math.max(8, rect.top - 8), maxTop),
      });
    }
  }

  function openSubmenu() {
    clearCloseTimer();
    setIsOpen(true);
  }

  function closeWhenPointerLeaves(event: ReactPointerEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    scheduleClose();
  }

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
      setIsOpen(false);
    }
  }

  useLayoutEffect(() => {
    if (isOpen) {
      updatePanelPosition();
    }
  }, [isOpen]);

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <div
      ref={submenuRef}
      className={["menubar-submenu", isOpen ? "menubar-submenu-open" : ""]
        .filter(Boolean)
        .join(" ")}
      onBlur={closeWhenFocusLeaves}
      onFocus={openSubmenu}
      onPointerEnter={openSubmenu}
      onPointerLeave={closeWhenPointerLeaves}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="menubar-dropdown-item"
        onClick={openSubmenu}
        role="menuitem"
        type="button"
      >
        <span className="menubar-dropdown-check" />
        <span className="menubar-dropdown-label">{label}</span>
        <span className="menubar-dropdown-shortcut" />
        <ChevronRight className="menubar-dropdown-arrow" size={18} />
      </button>
      <div
        ref={panelRef}
        className={["menubar-submenu-panel", panelClassName ?? ""]
          .filter(Boolean)
          .join(" ")}
        onPointerEnter={openSubmenu}
        onPointerLeave={scheduleClose}
        role="menu"
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
}

export function RecentFileMenuItem({
  document,
  exists,
  onOpen,
}: {
  document: MarkdownDocument;
  exists?: boolean;
  onOpen: (document: MarkdownDocument) => void;
}) {
  const isMissing = exists === false;
  const displayName = getDocumentDisplayName(document);
  const pathLabel = isMissing
    ? "文件不存在"
    : document.filePath
      ? getDocumentPathPreview(document)
      : "未保存到本地";
  const timeLabel = isMissing ? "不存在" : formatRecentTimestamp(document.updatedAt);

  return (
    <button
      className={[
        "menubar-dropdown-item",
        "recent-file-menu-button",
        isMissing ? "recent-file-menu-button-missing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isMissing}
      onClick={() => onOpen(document)}
      role="menuitem"
      title={`${displayName}\n${pathLabel}`}
      type="button"
    >
      <FileText className="recent-file-menu-icon" size={16} />
      <span className="recent-file-menu-entry">
        <strong>{displayName}</strong>
        <small>{pathLabel}</small>
      </span>
      <span className="recent-file-menu-time">{timeLabel}</span>
    </button>
  );
}
