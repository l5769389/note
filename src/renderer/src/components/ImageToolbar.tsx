import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize2,
  Pencil,
} from "lucide-react";
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { ImageAlignment } from "../editorCommands";
import {
  getExcalidrawDrawingId,
  maxImageWidth,
  minImageWidth,
} from "../imageMeta";

export type ImageToolbarState =
  | { visible: false }
  | {
      align: ImageAlignment;
      displayWidth: number;
      name: string;
      imageHeight: number;
      imageLeft: number;
      imageTop: number;
      imageWidth: number;
      left: number;
      pos: number;
      top: number;
      visible: true;
      drawingId?: string;
      width?: number;
    };

export function getImageDisplayName(node: ProseMirrorNode) {
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt.trim() : "";

  if (alt) {
    return alt;
  }

  const source = typeof node.attrs.src === "string" ? node.attrs.src.trim() : "";

  if (!source || source.startsWith("data:")) {
    return getExcalidrawDrawingId(node.attrs.title) ? "Excalidraw" : "Image";
  }

  const cleanSource = source.split(/[?#]/)[0] ?? "";
  const fileName = cleanSource.split(/[\\/]/).filter(Boolean).pop();

  if (!fileName) {
    return "Image";
  }

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export function ImageToolbar({
  onEditDrawing,
  onResetWidth,
  onSetAlign,
  onSetWidth,
  state,
}: {
  onEditDrawing?: (drawingId: string) => void;
  onResetWidth: (pos: number) => void;
  onSetAlign: (pos: number, align: ImageAlignment) => void;
  onSetWidth: (pos: number, width: number) => void;
  state: ImageToolbarState;
}) {
  if (!state.visible) {
    return null;
  }

  const alignmentActions: Array<{
    align: ImageAlignment;
    icon: ReactNode;
    label: string;
  }> = [
    { align: "left", icon: <AlignLeft size={15} />, label: "左对齐" },
    { align: "center", icon: <AlignCenter size={15} />, label: "居中对齐" },
    { align: "right", icon: <AlignRight size={15} />, label: "右对齐" },
  ];
  const sliderValue = state.width ?? state.displayWidth;

  return (
    <div
      className="milkdown-image-toolbar"
      style={{ left: state.left, top: state.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {state.drawingId && onEditDrawing && (
        <button
          className="milkdown-image-toolbar-button"
          type="button"
          title="Edit Excalidraw"
          aria-label="Edit Excalidraw"
          onClick={() => onEditDrawing(state.drawingId!)}
        >
          <Pencil size={15} />
        </button>
      )}
      <div className="milkdown-image-toolbar-group">
        {alignmentActions.map((action) => (
          <button
            className={
              state.align === action.align
                ? "milkdown-image-toolbar-button milkdown-image-toolbar-button-active"
                : "milkdown-image-toolbar-button"
            }
            key={action.align}
            type="button"
            title={action.label}
            aria-label={action.label}
            onClick={() => onSetAlign(state.pos, action.align)}
          >
            {action.icon}
          </button>
        ))}
      </div>
      <label className="milkdown-image-size-control">
        <span>{sliderValue}px</span>
        <input
          type="range"
          min={minImageWidth}
          max={maxImageWidth}
          step={10}
          value={sliderValue}
          onChange={(event) => onSetWidth(state.pos, Number(event.target.value))}
        />
      </label>
      <button
        className="milkdown-image-toolbar-button"
        type="button"
        title="恢复自适应宽度"
        aria-label="恢复自适应宽度"
        onClick={() => onResetWidth(state.pos)}
      >
        <Maximize2 size={15} />
      </button>
    </div>
  );
}

export function ImageNameEditor({
  onRename,
  state,
}: {
  onRename: (pos: number, name: string) => void;
  state: ImageToolbarState;
}) {
  const [draft, setDraft] = useState("");
  const visiblePos = state.visible ? state.pos : -1;
  const visibleName = state.visible ? state.name : "";

  useEffect(() => {
    setDraft(visibleName);
  }, [visibleName, visiblePos]);

  if (!state.visible) {
    return null;
  }

  const commit = () => {
    const nextName = draft.trim() || (state.drawingId ? "Excalidraw" : "Image");

    if (nextName !== state.name) {
      onRename(state.pos, nextName);
    }
  };

  return (
    <input
      className="milkdown-image-name-editor"
      aria-label="Image name"
      value={draft}
      style={{
        left: state.imageLeft + state.imageWidth / 2,
        top: state.imageTop + state.imageHeight + 7,
        width: Math.max(148, Math.min(state.imageWidth, 360)),
      }}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onMouseDown={(event) => event.stopPropagation()}
    />
  );
}

export function ImageResizeHandle({
  onResizeStart,
  state,
}: {
  onResizeStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    state: Extract<ImageToolbarState, { visible: true }>,
  ) => void;
  state: ImageToolbarState;
}) {
  if (!state.visible) {
    return null;
  }

  return (
    <div
      className="milkdown-image-resize-handle"
      role="presentation"
      style={{
        left: state.imageLeft + state.imageWidth + 2,
        top: state.imageTop + state.imageHeight + 2,
      }}
      onPointerDown={(event) => onResizeStart(event, state)}
    />
  );
}

