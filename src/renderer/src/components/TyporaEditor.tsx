import { defaultValueCtx, editorViewCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { prism, prismConfig } from "@milkdown/plugin-prism";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  setCellAttr,
} from "@milkdown/kit/prose/tables";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { NodeSelection, Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { $prose, insert, replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import jsx from "refractor/jsx";
import tsx from "refractor/tsx";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Maximize2,
  Rows2,
  Trash2,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type TyporaEditorProps = {
  onActiveLineChange?: (lineIndex: number) => void;
  onChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  value: string;
};

export type TyporaEditorHandle = {
  insertMarkdown: (markdown: string) => void;
  scrollToLine: (lineIndex: number) => void;
};

const headingPattern = /^(#{1,6})\s+(.+)$/;
const minImageWidth = 120;
const maxImageWidth = 900;

type ImageAlignment = "left" | "center" | "right";

type ImageMeta = {
  align: ImageAlignment;
  titleText: string;
  width?: number;
};

function clampImageWidth(width: number) {
  return Math.max(minImageWidth, Math.min(maxImageWidth, Math.round(width)));
}

function parseImageMeta(title?: string): ImageMeta {
  let titleText = title?.trim() ?? "";
  const widthMatch = titleText.match(/(?:^|\s)width=(\d{2,4})(?:px)?(?=\s|$)/i);
  const alignMatch = titleText.match(/(?:^|\s)align=(left|center|right)(?=\s|$)/i);
  const width = widthMatch ? clampImageWidth(Number(widthMatch[1])) : undefined;
  const align = (alignMatch?.[1]?.toLowerCase() as ImageAlignment | undefined) ?? "center";

  titleText = titleText
    .replace(/(?:^|\s)width=\d{2,4}(?:px)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)align=(left|center|right)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { align, titleText, width };
}

function serializeImageMeta(meta: ImageMeta) {
  return [
    meta.titleText,
    meta.width ? `width=${clampImageWidth(meta.width)}` : "",
    `align=${meta.align}`,
  ]
    .filter(Boolean)
    .join(" ");
}

const codeBlockLanguageDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          const selectionFrom = state.selection.from;

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "code_block") {
              return;
            }

            const rawLanguage =
              typeof node.attrs.language === "string" ? node.attrs.language.trim() : "";
            const language = rawLanguage || "plain text";
            const isActive = selectionFrom > pos && selectionFrom < pos + node.nodeSize;

            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: isActive
                  ? "typora-code-block typora-code-block-active"
                  : "typora-code-block",
                "data-code-language": language,
              }),
            );
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const editableImageDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "image") {
              return;
            }

            const meta = parseImageMeta(node.attrs.title);
            const className = [
              "typora-editable-image",
              `typora-editable-image-${meta.align}`,
            ].join(" ");
            const attrs: Record<string, string> = {
              class: className,
              "data-image-align": meta.align,
            };

            if (meta.width) {
              attrs.style = `width: ${meta.width}px;`;
              attrs["data-image-width"] = String(meta.width);
            }

            decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const editableImageSelection = $prose(
  () =>
    new Plugin({
      props: {
        handleClickOn(view, _pos, node, nodePos, event) {
          if (node.type.name !== "image") {
            return false;
          }

          event.preventDefault();
          view.dispatch(
            view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)),
          );
          view.focus();
          return true;
        },
        handleDOMEvents: {
          click(view, event) {
            if (!(event.target instanceof Element)) {
              return false;
            }

            const imageElement = event.target.closest("img");

            if (!imageElement || !view.dom.contains(imageElement)) {
              return false;
            }

            try {
              const pos = view.posAtDOM(imageElement, 0);
              const docSize = view.state.doc.content.size;
              const imagePos = [pos, pos - 1, pos + 1].find((candidate) => {
                if (candidate < 0 || candidate > docSize) {
                  return false;
                }

                return view.state.doc.nodeAt(candidate)?.type.name === "image";
              });

              if (imagePos === undefined) {
                return false;
              }

              event.preventDefault();
              view.dispatch(
                view.state.tr.setSelection(
                  NodeSelection.create(view.state.doc, imagePos),
                ),
              );
              view.focus();
              return true;
            } catch {
              return false;
            }
          },
        },
      },
    }),
);

function normalizeHeadingTitle(title: string) {
  return title
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadingAtLine(markdown: string, lineIndex: number) {
  const line = markdown.split("\n")[lineIndex] ?? "";
  const match = line.match(headingPattern);

  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    title: normalizeHeadingTitle(match[2]),
  };
}

function getHeadingOccurrence(markdown: string, lineIndex: number) {
  const target = getHeadingAtLine(markdown, lineIndex);

  if (!target) {
    return 0;
  }

  return markdown
    .split("\n")
    .slice(0, lineIndex + 1)
    .filter((line) => {
      const match = line.match(headingPattern);

      return (
        match &&
        match[1].length === target.level &&
        normalizeHeadingTitle(match[2]) === target.title
      );
    }).length;
}

function findHeadingLineIndex(
  markdown: string,
  level: number,
  title: string,
  occurrence: number,
) {
  let seen = 0;

  return markdown.split("\n").findIndex((line) => {
    const match = line.match(headingPattern);

    if (
      !match ||
      match[1].length !== level ||
      normalizeHeadingTitle(match[2]) !== title
    ) {
      return false;
    }

    seen += 1;
    return seen === occurrence;
  });
}

function getHeadingElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
}

function getElementFromSelection() {
  const anchorNode = window.getSelection()?.anchorNode;

  if (!anchorNode) {
    return null;
  }

  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as Element)
    : anchorNode.parentElement;
}

function isBeforeOrEqual(source: Element, target: Element) {
  if (source === target || source.contains(target)) {
    return true;
  }

  return Boolean(
    source.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function appendMarkdown(currentValue: string, markdown: string) {
  const separator = currentValue.length > 0 && !currentValue.endsWith("\n") ? "\n" : "";

  return `${currentValue}${separator}${markdown}`;
}

type TableToolbarState =
  | { visible: false }
  | {
      left: number;
      top: number;
      visible: true;
    };

type TableCommand = (
  state: EditorView["state"],
  dispatch?: EditorView["dispatch"],
  view?: EditorView,
) => boolean;

type TableToolbarAction = {
  command: TableCommand;
  icon: ReactNode;
  label: string;
  text?: string;
};

type ImageToolbarState =
  | { visible: false }
  | {
      align: ImageAlignment;
      displayWidth: number;
      imageHeight: number;
      imageLeft: number;
      imageTop: number;
      imageWidth: number;
      left: number;
      pos: number;
      top: number;
      visible: true;
      width?: number;
    };

function TableToolbar({
  onRun,
  state,
}: {
  onRun: (command: TableCommand) => void;
  state: TableToolbarState;
}) {
  if (!state.visible) {
    return null;
  }

  const actionGroups: TableToolbarAction[][] = [
    [
      { command: setCellAttr("alignment", "left"), icon: <AlignLeft size={15} />, label: "左对齐" },
      {
        command: setCellAttr("alignment", "center"),
        icon: <AlignCenter size={15} />,
        label: "居中对齐",
      },
      {
        command: setCellAttr("alignment", "right"),
        icon: <AlignRight size={15} />,
        label: "右对齐",
      },
    ],
    [
      { command: addColumnBefore, icon: <Columns2 size={15} />, label: "左侧插入列", text: "+左" },
      { command: addColumnAfter, icon: <Columns2 size={15} />, label: "右侧插入列", text: "+右" },
      { command: addRowBefore, icon: <Rows2 size={15} />, label: "上方插入行", text: "+上" },
      { command: addRowAfter, icon: <Rows2 size={15} />, label: "下方插入行", text: "+下" },
    ],
    [
      { command: deleteColumn, icon: <Trash2 size={15} />, label: "删除当前列", text: "列" },
      { command: deleteRow, icon: <Trash2 size={15} />, label: "删除当前行", text: "行" },
      { command: deleteTable, icon: <Trash2 size={15} />, label: "删除表格", text: "表" },
    ],
  ];

  return (
    <div
      className="milkdown-table-toolbar"
      style={{ left: state.left, top: state.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {actionGroups.map((actions, index) => (
        <div className="milkdown-table-toolbar-group" key={index}>
          {actions.map((action) => (
            <button
              className="milkdown-table-toolbar-button"
              key={action.label}
              type="button"
              title={action.label}
              aria-label={action.label}
              onClick={() => onRun(action.command)}
            >
              {action.icon}
              {action.text && <span>{action.text}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ImageToolbar({
  onResetWidth,
  onSetAlign,
  onSetWidth,
  state,
}: {
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

function ImageResizeHandle({
  onResizeStart,
  state,
}: {
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>, state: Extract<ImageToolbarState, { visible: true }>) => void;
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
        left: state.imageLeft + state.imageWidth - 9,
        top: state.imageTop + state.imageHeight - 9,
      }}
      onPointerDown={(event) => onResizeStart(event, state)}
    />
  );
}

type MilkdownRuntimeProps = TyporaEditorProps & {
  controllerRef: MutableRefObject<TyporaEditorHandle | null>;
  markdownRef: MutableRefObject<string>;
  onChangeRef: MutableRefObject<(value: string) => void>;
  rootRef: MutableRefObject<HTMLElement | null>;
  valueRef: MutableRefObject<string>;
};

function MilkdownRuntime({
  controllerRef,
  markdownRef,
  onActiveLineChange,
  onChangeRef,
  rootRef,
  value,
  valueRef,
}: MilkdownRuntimeProps) {
  const applyingExternalValueRef = useRef(false);
  const [imageToolbar, setImageToolbar] = useState<ImageToolbarState>({
    visible: false,
  });
  const [tableToolbar, setTableToolbar] = useState<TableToolbarState>({
    visible: false,
  });
  const imageResizeRef = useRef<{
    pos: number;
    startWidth: number;
    startX: number;
  } | null>(null);

  function getSelectedImage(view: EditorView) {
    const { selection } = view.state;
    const selectedNode = (selection as unknown as { node?: ProseMirrorNode }).node;

    if (selectedNode?.type.name === "image") {
      return {
        node: selectedNode,
        pos: selection.from,
      };
    }

    const from = Math.max(0, selection.from - 1);
    const to = Math.min(view.state.doc.content.size, selection.to + 1);
    let nearbyImage: { node: ProseMirrorNode; pos: number } | null = null;

    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "image") {
        nearbyImage = { node, pos };
        return false;
      }

      return true;
    });

    return nearbyImage;
  }

  function updateImageToolbarFromView(view?: EditorView) {
    const root = rootRef.current;

    if (!root || !view) {
      setImageToolbar({ visible: false });
      return;
    }

    const image = getSelectedImage(view);

    if (!image) {
      setImageToolbar({ visible: false });
      return;
    }

    const imageNodeDom = view.nodeDOM(image.pos);
    const imageDom =
      imageNodeDom instanceof HTMLImageElement
        ? imageNodeDom
        : imageNodeDom instanceof Element
          ? imageNodeDom.querySelector("img")
          : null;

    if (!imageDom || !root.contains(imageDom)) {
      setImageToolbar({ visible: false });
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const imageRect = imageDom.getBoundingClientRect();
    const maxLeft = root.scrollLeft + root.clientWidth - 460;
    const rawLeft = imageRect.left - rootRect.left + root.scrollLeft;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      root.scrollTop + 8,
      imageRect.top - rootRect.top + root.scrollTop - 46,
    );
    const meta = parseImageMeta(image.node.attrs.title);

    setImageToolbar({
      align: meta.align,
      displayWidth: clampImageWidth(imageRect.width || minImageWidth),
      imageHeight: imageRect.height,
      imageLeft: imageRect.left - rootRect.left + root.scrollLeft,
      imageTop: imageRect.top - rootRect.top + root.scrollTop,
      imageWidth: imageRect.width,
      left,
      pos: image.pos,
      top,
      visible: true,
      width: meta.width,
    });
  }

  function updateTableToolbarFromView(view?: EditorView) {
    const root = rootRef.current;

    if (!root || !view || !isInTable(view.state)) {
      setTableToolbar({ visible: false });
      return;
    }

    const domAtSelection = view.domAtPos(view.state.selection.from);
    const selectionElement =
      domAtSelection.node.nodeType === Node.ELEMENT_NODE
        ? (domAtSelection.node as Element)
        : domAtSelection.node.parentElement;
    const cell = selectionElement?.closest("td, th");
    const table = cell?.closest("table");

    if (!cell || !table || !root.contains(table)) {
      setTableToolbar({ visible: false });
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const maxLeft = root.scrollLeft + root.clientWidth - 420;
    const rawLeft = tableRect.left - rootRect.left + root.scrollLeft;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      root.scrollTop + 8,
      cellRect.top - rootRect.top + root.scrollTop - 42,
    );

    setTableToolbar({ left, top, visible: true });
  }

  function refreshTableToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      updateTableToolbarFromView(ctx.get(editorViewCtx));
    });
  }

  function refreshImageToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      updateImageToolbarFromView(ctx.get(editorViewCtx));
    });
  }

  function updateImageMeta(pos: number, patch: Partial<Pick<ImageMeta, "align" | "width">>) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(pos);

      if (!node || node.type.name !== "image") {
        setImageToolbar({ visible: false });
        return;
      }

      const currentMeta = parseImageMeta(node.attrs.title);
      const nextMeta: ImageMeta = {
        ...currentMeta,
        align: patch.align ?? currentMeta.align,
        width: Object.prototype.hasOwnProperty.call(patch, "width")
          ? patch.width === undefined
            ? undefined
            : clampImageWidth(patch.width)
          : currentMeta.width,
      };
      const nextTitle = serializeImageMeta(nextMeta);
      const transaction = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        title: nextTitle,
      });

      view.dispatch(transaction);
      view.focus();
      requestAnimationFrame(() => updateImageToolbarFromView(view));
    });
  }

  function setImageAlignment(pos: number, align: ImageAlignment) {
    updateImageMeta(pos, { align });
  }

  function setImageWidth(pos: number, width: number) {
    updateImageMeta(pos, { width });
  }

  function resetImageWidth(pos: number) {
    updateImageMeta(pos, { width: undefined });
  }

  function stopImageResize() {
    imageResizeRef.current = null;
    window.removeEventListener("pointermove", resizeSelectedImage);
    window.removeEventListener("pointerup", stopImageResize);
  }

  function resizeSelectedImage(event: PointerEvent) {
    const resizeState = imageResizeRef.current;

    if (!resizeState) {
      return;
    }

    updateImageMeta(resizeState.pos, {
      width: resizeState.startWidth + event.clientX - resizeState.startX,
    });
  }

  function startImageResize(
    event: ReactPointerEvent<HTMLDivElement>,
    state: Extract<ImageToolbarState, { visible: true }>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    imageResizeRef.current = {
      pos: state.pos,
      startWidth: state.displayWidth,
      startX: event.clientX,
    };
    window.addEventListener("pointermove", resizeSelectedImage);
    window.addEventListener("pointerup", stopImageResize);
  }

  function runTableCommand(command: TableCommand) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      command(view.state, view.dispatch.bind(view), view);
      view.focus();
      requestAnimationFrame(() => updateTableToolbarFromView(view));
    });
  }

  const { get, loading } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, markdownRef.current);
        ctx.set(prismConfig.key, {
          configureRefractor(refractor) {
            refractor.register(jsx);
            refractor.register(tsx);
          },
        });
        ctx
          .get(listenerCtx)
          .markdownUpdated((_, markdown) => {
            markdownRef.current = markdown;

            if (!applyingExternalValueRef.current) {
              onChangeRef.current(markdown);
            }
          })
          .mounted((mountedCtx) => {
            requestAnimationFrame(() => {
              const view = mountedCtx.get(editorViewCtx);
              updateImageToolbarFromView(view);
              updateTableToolbarFromView(view);
            });
          })
          .selectionUpdated((selectionCtx) => {
            requestAnimationFrame(() => {
              const view = selectionCtx.get(editorViewCtx);
              updateImageToolbarFromView(view);
              updateTableToolbarFromView(view);
            });
          });
      })
      .use(commonmark)
      .use(listener)
      .use(history)
      .use(trailing)
      .use(clipboard)
      .use(gfm)
      .use(prism)
      .use(codeBlockLanguageDecoration)
      .use(editableImageSelection)
      .use(editableImageDecoration);
  }, []);

  function reportActiveHeading() {
    const root = rootRef.current;
    const activeElement = getElementFromSelection();

    if (!root || !activeElement || !root.contains(activeElement)) {
      return;
    }

    const headings = getHeadingElements(root);
    let activeHeading: Element | null = null;

    for (const heading of headings) {
      if (isBeforeOrEqual(heading, activeElement)) {
        activeHeading = heading;
        continue;
      }

      break;
    }

    if (!activeHeading) {
      onActiveLineChange?.(0);
      return;
    }

    const level = Number(activeHeading.tagName.slice(1));
    const title = normalizeHeadingTitle(activeHeading.textContent ?? "");
    const occurrence =
      headings
        .slice(0, headings.indexOf(activeHeading) + 1)
        .filter(
          (heading) =>
            Number(heading.tagName.slice(1)) === level &&
            normalizeHeadingTitle(heading.textContent ?? "") === title,
        ).length || 1;
    const lineIndex = findHeadingLineIndex(markdownRef.current, level, title, occurrence);

    if (lineIndex >= 0) {
      onActiveLineChange?.(lineIndex);
    }
  }

  useEffect(() => {
    const editor = get();

    if (!editor || value === markdownRef.current) {
      return;
    }

    applyingExternalValueRef.current = true;
    markdownRef.current = value;
    editor.action(replaceAll(value));
    queueMicrotask(() => {
      applyingExternalValueRef.current = false;
    });
  }, [get, loading, markdownRef, value]);

  useEffect(() => {
    controllerRef.current = {
      insertMarkdown(markdown: string) {
        const editor = get();

        if (!editor) {
          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
          return;
        }

        editor.action((ctx) => {
          ctx.get(editorViewCtx).focus();
          insert(markdown)(ctx);
        });
      },
      scrollToLine(lineIndex: number) {
        const root = rootRef.current;
        const heading = getHeadingAtLine(markdownRef.current, lineIndex);

        if (!root || !heading) {
          return;
        }

        const occurrence = getHeadingOccurrence(markdownRef.current, lineIndex);
        const headingElement = getHeadingElements(root)
          .filter(
            (element) =>
              Number(element.tagName.slice(1)) === heading.level &&
              normalizeHeadingTitle(element.textContent ?? "") === heading.title,
          )
          .at(occurrence - 1);

        headingElement?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        onActiveLineChange?.(lineIndex);
      },
    };

    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, get, markdownRef, onActiveLineChange, onChangeRef, rootRef, valueRef]);

  return (
    <div
      className="typora-milkdown-content"
      onClick={() => {
        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);
        requestAnimationFrame(refreshTableToolbar);
      }}
      onKeyUp={() => {
        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);
        requestAnimationFrame(refreshTableToolbar);
      }}
    >
      <ImageToolbar
        state={imageToolbar}
        onResetWidth={resetImageWidth}
        onSetAlign={setImageAlignment}
        onSetWidth={setImageWidth}
      />
      <ImageResizeHandle state={imageToolbar} onResizeStart={startImageResize} />
      <TableToolbar state={tableToolbar} onRun={runTableCommand} />
      <Milkdown />
    </div>
  );
}

export const TyporaEditor = forwardRef<TyporaEditorHandle, TyporaEditorProps>(
  function TyporaEditor({ onActiveLineChange, onChange, onPaste, value }, ref) {
    const rootRef = useRef<HTMLElement | null>(null);
    const controllerRef = useRef<TyporaEditorHandle | null>(null);
    const markdownRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);

    onChangeRef.current = onChange;
    valueRef.current = value;

    useImperativeHandle(
      ref,
      () => ({
        insertMarkdown(markdown: string) {
          if (controllerRef.current) {
            controllerRef.current.insertMarkdown(markdown);
            return;
          }

          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
        },
        scrollToLine(lineIndex: number) {
          controllerRef.current?.scrollToLine(lineIndex);
        },
      }),
      [],
    );

    return (
      <article
        ref={rootRef}
        className="typora-editor typora-rich-editor"
        aria-label="Milkdown markdown editor"
        onPaste={onPaste}
      >
        <MilkdownProvider>
          <MilkdownRuntime
            controllerRef={controllerRef}
            markdownRef={markdownRef}
            onActiveLineChange={onActiveLineChange}
            onChange={onChange}
            onChangeRef={onChangeRef}
            onPaste={onPaste}
            rootRef={rootRef}
            value={value}
            valueRef={valueRef}
          />
        </MilkdownProvider>
      </article>
    );
  },
);
