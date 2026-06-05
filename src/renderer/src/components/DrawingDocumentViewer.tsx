import { Edit3, ImageOff, Loader2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MarkdownDocument } from "../types";

type DrawingPreviewState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; url: string };

type DrawingDocumentViewerProps = {
  document: MarkdownDocument;
  displayName: string;
  onEdit: () => void;
};

type ExcalidrawScene = {
  appState?: Record<string, unknown>;
  elements?: readonly unknown[];
  files?: Record<string, unknown>;
};

type ContextMenuState = {
  x: number;
  y: number;
};

type ResizeSession = {
  maxWidth: number;
  startWidth: number;
  startX: number;
  startY: number;
};

const defaultPreviewWidth = 920;
const minPreviewWidth = 280;
const maxPreviewWidth = 1320;
const previewWidthStoragePrefix = "notedock:drawing-preview-width:";

function parseScene(content: string): ExcalidrawScene {
  if (!content.trim()) {
    return { elements: [] };
  }

  const scene = JSON.parse(content) as ExcalidrawScene;

  return {
    appState: scene.appState ?? {},
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    files: scene.files ?? {},
  };
}

function clampPreviewWidth(value: number, maxWidth = maxPreviewWidth) {
  return Math.round(
    Math.min(Math.max(value, minPreviewWidth), Math.max(minPreviewWidth, maxWidth)),
  );
}

function getPreviewWidthStorageKey(document: MarkdownDocument) {
  return `${previewWidthStoragePrefix}${document.filePath ?? document.id}`;
}

function readPreviewWidth(document: MarkdownDocument) {
  try {
    const value = window.localStorage.getItem(getPreviewWidthStorageKey(document));
    const parsed = value ? Number(value) : NaN;

    return Number.isFinite(parsed)
      ? clampPreviewWidth(parsed)
      : defaultPreviewWidth;
  } catch {
    return defaultPreviewWidth;
  }
}

function getConstrainedMenuPosition(x: number, y: number) {
  const menuWidth = 190;
  const menuHeight = 58;

  return {
    x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
  };
}

export function DrawingDocumentViewer({
  document,
  displayName,
  onEdit,
}: DrawingDocumentViewerProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [previewState, setPreviewState] = useState<DrawingPreviewState>({
    kind: "loading",
  });
  const [previewWidth, setPreviewWidth] = useState(() =>
    readPreviewWidth(document),
  );
  const [naturalSize, setNaturalSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    setPreviewWidth(readPreviewWidth(document));
    setNaturalSize(null);
    setIsSelected(false);
    setContextMenu(null);
  }, [document.id, document.filePath]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        getPreviewWidthStorageKey(document),
        String(previewWidth),
      );
    } catch {
      // Ignore local storage failures; preview sizing is a view preference.
    }
  }, [document, previewWidth]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function renderPreview() {
      setPreviewState({ kind: "loading" });

      try {
        const scene = parseScene(document.content);

        if (!scene.elements?.length) {
          setPreviewState({ kind: "empty" });
          return;
        }

        const { exportToBlob } = await import("@excalidraw/excalidraw");
        const blob = await exportToBlob({
          elements: scene.elements as never,
          appState: {
            ...scene.appState,
            exportBackground: true,
            viewBackgroundColor:
              scene.appState?.viewBackgroundColor ?? "#ffffff",
          } as never,
          files: (scene.files ?? {}) as never,
          mimeType: "image/png",
          exportPadding: 32,
        });

        objectUrl = URL.createObjectURL(blob);

        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewState({ kind: "ready", url: objectUrl });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "无法生成 Excalidraw 预览";

        if (!disposed) {
          setPreviewState({ kind: "error", message });
        }
      }
    }

    void renderPreview();

    return () => {
      disposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document.content]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsSelected(false);
        setContextMenu(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function hideContextMenu() {
      setContextMenu(null);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        hideContextMenu();
      }
    }

    window.addEventListener("click", hideContextMenu);
    window.addEventListener("blur", hideContextMenu);
    window.addEventListener("scroll", hideContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", hideContextMenu);
      window.removeEventListener("blur", hideContextMenu);
      window.removeEventListener("scroll", hideContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = resizeSessionRef.current;

      if (!session) {
        return;
      }

      const ratio = naturalSize
        ? naturalSize.width / Math.max(1, naturalSize.height)
        : 1;
      const deltaX = event.clientX - session.startX;
      const deltaY = (event.clientY - session.startY) * ratio;
      const delta = Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX;

      setPreviewWidth(
        clampPreviewWidth(session.startWidth + delta, session.maxWidth),
      );
    }

    function handlePointerUp() {
      resizeSessionRef.current = null;
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, naturalSize]);

  function selectPreview() {
    setIsSelected(true);
    setContextMenu(null);
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsSelected(true);
    setContextMenu(getConstrainedMenuPosition(event.clientX, event.clientY));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onEdit();
    }
  }

  function startResize(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setIsSelected(true);

    const shellWidth =
      previewShellRef.current?.getBoundingClientRect().width ?? maxPreviewWidth;

    resizeSessionRef.current = {
      maxWidth: Math.min(maxPreviewWidth, Math.max(minPreviewWidth, shellWidth)),
      startWidth: previewWidth,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsResizing(true);
  }

  const previewStyle = {
    "--drawing-preview-width": `${previewWidth}px`,
  } as CSSProperties;
  const previewClassName = [
    "drawing-document-preview",
    previewState.kind === "ready" ? "drawing-document-preview-ready" : "",
    isSelected ? "drawing-document-preview-selected" : "",
    isResizing ? "drawing-document-preview-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className="standalone-document-viewer standalone-drawing-viewer"
      data-select-all-scope="content"
      tabIndex={-1}
    >
      <article className="drawing-document-panel" ref={rootRef}>
        <div className="drawing-document-preview-shell" ref={previewShellRef}>
          <div
            aria-label={`${displayName} 预览，双击编辑`}
            className={previewClassName}
            onClick={selectPreview}
            onContextMenu={handleContextMenu}
            onDoubleClick={onEdit}
            onKeyDown={handleKeyDown}
            role="button"
            style={previewStyle}
            tabIndex={0}
            title="双击编辑画板，拖拽右下角调整预览大小"
          >
            {previewState.kind === "loading" && (
              <span className="drawing-document-preview-state">
                <Loader2 size={22} />
                正在生成预览
              </span>
            )}
            {previewState.kind === "empty" && (
              <span className="drawing-document-preview-state">
                <ImageOff size={24} />
                画板为空，双击开始编辑
              </span>
            )}
            {previewState.kind === "error" && (
              <span className="drawing-document-preview-state">
                <ImageOff size={24} />
                <span>
                  <strong>预览生成失败</strong>
                  <small>{previewState.message}</small>
                </span>
              </span>
            )}
            {previewState.kind === "ready" && (
              <img
                src={previewState.url}
                alt={`${displayName} 预览`}
                onLoad={(event) =>
                  setNaturalSize({
                    height: event.currentTarget.naturalHeight,
                    width: event.currentTarget.naturalWidth,
                  })
                }
              />
            )}
            {isSelected && (
              <span
                aria-hidden="true"
                className="drawing-document-resize-handle"
                onPointerDown={startResize}
              />
            )}
          </div>
        </div>

        {contextMenu && (
          <div
            className="app-context-menu drawing-document-context-menu"
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setContextMenu(null);
                onEdit();
              }}
            >
              <span className="app-context-menu-icon">
                <Edit3 size={15} />
              </span>
              <span className="app-context-menu-label">编辑画板</span>
            </button>
          </div>
        )}
      </article>
    </section>
  );
}
