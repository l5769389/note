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
  findTable,
  isInTable,
  setCellAttr,
  TableMap,
} from "@milkdown/kit/prose/tables";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { NodeSelection, Plugin, Selection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { $prose, insert, replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  EllipsisVertical,
  Grid3x3,
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
import { registerMarkdownLanguages } from "../syntaxHighlighting";

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

function selectionTouchesRange(
  selectionFrom: number,
  selectionTo: number,
  rangeFrom: number,
  rangeTo: number,
) {
  if (selectionFrom === selectionTo) {
    return selectionFrom >= rangeFrom && selectionFrom <= rangeTo;
  }

  return selectionFrom < rangeTo && selectionTo > rangeFrom;
}

function createMarkdownSyntaxMarker(value: string) {
  const marker = document.createElement("span");
  marker.className = "typora-markdown-syntax-marker";
  marker.textContent = value;
  return marker;
}

const markdownSyntaxDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          const { from, to } = state.selection;
          const codeRanges: Array<{ from: number; to: number }> = [];

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (/^heading$/i.test(node.type.name)) {
              const level =
                typeof node.attrs.level === "number" ? node.attrs.level : 1;
              const rangeFrom = pos;
              const rangeTo = pos + node.nodeSize;

              if (selectionTouchesRange(from, to, rangeFrom, rangeTo)) {
                decorations.push(
                  Decoration.node(rangeFrom, rangeTo, {
                    class: "typora-active-heading",
                    "data-heading-prefix": `${"#".repeat(level)} `,
                  }),
                );
              }
            }

            if (!node.isText || !node.marks.some((mark) => mark.type.name === "code")) {
              return;
            }

            const range = { from: pos, to: pos + node.nodeSize };
            const previousRange = codeRanges.at(-1);

            if (previousRange && previousRange.to === range.from) {
              previousRange.to = range.to;
              return;
            }

            codeRanges.push(range);
          });

          for (const range of codeRanges) {
            if (!selectionTouchesRange(from, to, range.from, range.to)) {
              continue;
            }

            decorations.push(
              Decoration.inline(range.from, range.to, {
                class: "typora-active-inline-code",
              }),
              Decoration.widget(range.from, () => createMarkdownSyntaxMarker("`"), {
                side: -1,
              }),
              Decoration.widget(range.to, () => createMarkdownSyntaxMarker("`"), {
                side: 1,
              }),
            );
          }

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const disableNativeWritingChecks = $prose(
  () =>
    new Plugin({
      props: {
        attributes: {
          autocapitalize: "off",
          autocomplete: "off",
          autocorrect: "off",
          spellcheck: "false",
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

          const nodeDom = view.nodeDOM(nodePos);

          if (
            !(nodeDom instanceof HTMLImageElement) ||
            !nodeDom.classList.contains("typora-editable-image")
          ) {
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

            if (
              !imageElement ||
              !view.dom.contains(imageElement) ||
              !imageElement.classList.contains("typora-editable-image")
            ) {
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

function getOverlayContainer(root: HTMLElement) {
  return root.querySelector<HTMLElement>(".typora-milkdown-content") ?? root;
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

type TableSize = {
  columns: number;
  rows: number;
};

type TableToolbarState =
  | { visible: false }
  | {
      columns: number;
      left: number;
      rows: number;
      top: number;
      visible: true;
      width: number;
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

const minTableRows = 2;
const maxTablePickerColumns = 8;
const maxTablePickerRows = 10;
const maxTableSize = 20;

function clampTableSize(size: TableSize): TableSize {
  return {
    columns: Math.max(1, Math.min(maxTableSize, Math.round(size.columns) || 1)),
    rows: Math.max(minTableRows, Math.min(maxTableSize, Math.round(size.rows) || minTableRows)),
  };
}

function getTableSize(tableNode: ProseMirrorNode): TableSize {
  const map = TableMap.get(tableNode);

  return { columns: map.width, rows: map.height };
}

function normalizeTableCellAttrs(attrs: ProseMirrorNode["attrs"], alignment: string) {
  return {
    ...attrs,
    alignment,
    colspan: 1,
    colwidth: null,
    rowspan: 1,
  };
}

function createResizedTableNode(
  state: EditorView["state"],
  tableNode: ProseMirrorNode,
  size: TableSize,
) {
  const { columns, rows } = clampTableSize(size);
  const tableType = state.schema.nodes.table;
  const headerRowType = state.schema.nodes.table_header_row;
  const rowType = state.schema.nodes.table_row;
  const headerCellType = state.schema.nodes.table_header;
  const cellType = state.schema.nodes.table_cell;

  if (!tableType || !headerRowType || !rowType || !headerCellType || !cellType) {
    return tableNode;
  }

  const headerRow = tableNode.maybeChild(0);
  const nextRows = Array.from({ length: rows }, (_, rowIndex) => {
    const sourceRow = tableNode.maybeChild(rowIndex);
    const nextRowType = rowIndex === 0 ? headerRowType : rowType;
    const nextCellType = rowIndex === 0 ? headerCellType : cellType;
    const nextCells = Array.from({ length: columns }, (__, columnIndex) => {
      const sourceCell = sourceRow?.maybeChild(columnIndex);
      const headerCell = headerRow?.maybeChild(columnIndex);
      const alignment = String(
        sourceCell?.attrs.alignment ?? headerCell?.attrs.alignment ?? "left",
      );
      const attrs = normalizeTableCellAttrs(sourceCell?.attrs ?? {}, alignment);

      if (sourceCell) {
        return nextCellType.create(attrs, sourceCell.content, sourceCell.marks);
      }

      return nextCellType.createAndFill(attrs) ?? nextCellType.create(attrs);
    });

    return nextRowType.create(sourceRow?.attrs, nextCells);
  });

  return tableType.create(tableNode.attrs, nextRows);
}

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

export function LegacyTableToolbar({
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

function TableSizePicker({
  columns,
  onApply,
  rows,
}: {
  columns: number;
  onApply: (size: TableSize) => void;
  rows: number;
}) {
  const [draftSize, setDraftSize] = useState<TableSize>(() => clampTableSize({ columns, rows }));
  const [previewSize, setPreviewSize] = useState<TableSize | null>(null);
  const displaySize = previewSize ?? draftSize;

  useEffect(() => {
    setDraftSize(clampTableSize({ columns, rows }));
    setPreviewSize(null);
  }, [columns, rows]);

  function applySize(size: TableSize) {
    const nextSize = clampTableSize(size);

    setDraftSize(nextSize);
    setPreviewSize(null);
    onApply(nextSize);
  }

  function updateDraft(partialSize: Partial<TableSize>) {
    setPreviewSize(null);
    setDraftSize((current) => clampTableSize({ ...current, ...partialSize }));
  }

  return (
    <div
      className="milkdown-table-size-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          applySize(draftSize);
        }
      }}
      onMouseLeave={() => setPreviewSize(null)}
    >
      <div className="milkdown-table-size-grid">
        {Array.from({ length: maxTablePickerRows }).flatMap((_, rowIndex) =>
          Array.from({ length: maxTablePickerColumns }).map((__, columnIndex) => {
            const cellSize = { columns: columnIndex + 1, rows: rowIndex + 1 };
            const isActive =
              cellSize.columns <= displaySize.columns && cellSize.rows <= displaySize.rows;

            return (
              <button
                aria-label={`${cellSize.rows} x ${cellSize.columns}`}
                className={[
                  "milkdown-table-size-cell",
                  isActive ? "milkdown-table-size-cell-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={`${cellSize.rows}-${cellSize.columns}`}
                onClick={() => applySize(cellSize)}
                onMouseEnter={() => setPreviewSize(clampTableSize(cellSize))}
                type="button"
              />
            );
          }),
        )}
      </div>
      <div className="milkdown-table-size-inputs">
        <input
          aria-label="Rows"
          max={maxTableSize}
          min={minTableRows}
          onChange={(event) => updateDraft({ rows: Number(event.target.value) })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applySize(draftSize);
            }
          }}
          type="number"
          value={displaySize.rows}
        />
        <span>x</span>
        <input
          aria-label="Columns"
          max={maxTableSize}
          min={1}
          onChange={(event) => updateDraft({ columns: Number(event.target.value) })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applySize(draftSize);
            }
          }}
          type="number"
          value={displaySize.columns}
        />
      </div>
    </div>
  );
}

function TableToolbar({
  onResize,
  onRun,
  state,
}: {
  onResize: (size: TableSize) => void;
  onRun: (command: TableCommand) => void;
  state: TableToolbarState;
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isSizePickerOpen, setIsSizePickerOpen] = useState(false);

  useEffect(() => {
    if (!state.visible) {
      setIsActionsOpen(false);
      setIsSizePickerOpen(false);
    }
  }, [state.visible]);

  if (!state.visible) {
    return null;
  }

  const alignActions: TableToolbarAction[] = [
    { command: setCellAttr("alignment", "left"), icon: <AlignLeft size={15} />, label: "Left" },
    {
      command: setCellAttr("alignment", "center"),
      icon: <AlignCenter size={15} />,
      label: "Center",
    },
    { command: setCellAttr("alignment", "right"), icon: <AlignRight size={15} />, label: "Right" },
  ];
  const insertActions: TableToolbarAction[] = [
    { command: addColumnBefore, icon: <Columns2 size={15} />, label: "Insert column before" },
    { command: addColumnAfter, icon: <Columns2 size={15} />, label: "Insert column after" },
    { command: addRowBefore, icon: <Rows2 size={15} />, label: "Insert row before" },
    { command: addRowAfter, icon: <Rows2 size={15} />, label: "Insert row after" },
  ];

  return (
    <div
      className="milkdown-table-toolbar"
      style={{ left: state.left, top: state.top, width: state.width }}
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          event.preventDefault();
        }
      }}
    >
      <div className="milkdown-table-toolbar-main">
        <div className="milkdown-table-toolbar-side">
          <button
            aria-expanded={isSizePickerOpen}
            aria-label="Table size"
            className="milkdown-table-toolbar-button"
            onClick={() => {
              setIsActionsOpen(false);
              setIsSizePickerOpen((current) => !current);
            }}
            title="Table size"
            type="button"
          >
            <Grid3x3 size={16} />
          </button>
          {alignActions.map((action) => (
            <button
              aria-label={action.label}
              className="milkdown-table-toolbar-button"
              key={action.label}
              onClick={() => onRun(action.command)}
              title={action.label}
              type="button"
            >
              {action.icon}
            </button>
          ))}
        </div>
        <div className="milkdown-table-toolbar-side">
          {insertActions.map((action) => (
            <button
              aria-label={action.label}
              className="milkdown-table-toolbar-button"
              key={action.label}
              onClick={() => onRun(action.command)}
              title={action.label}
              type="button"
            >
              {action.icon}
            </button>
          ))}
          <button
            aria-label="More table actions"
            className="milkdown-table-toolbar-button"
            onClick={() => {
              setIsSizePickerOpen(false);
              setIsActionsOpen((current) => !current);
            }}
            title="More table actions"
            type="button"
          >
            <EllipsisVertical size={16} />
          </button>
          <button
            aria-label="Delete table"
            className="milkdown-table-toolbar-button"
            onClick={() => onRun(deleteTable)}
            title="Delete table"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {isSizePickerOpen && (
        <TableSizePicker
          columns={state.columns}
          rows={state.rows}
          onApply={(size) => {
            setIsSizePickerOpen(false);
            onResize(size);
          }}
        />
      )}
      {isActionsOpen && (
        <div className="milkdown-table-more-menu">
          <button type="button" onClick={() => onRun(deleteRow)}>
            Delete row
          </button>
          <button type="button" onClick={() => onRun(deleteColumn)}>
            Delete column
          </button>
        </div>
      )}
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
        left: state.imageLeft + state.imageWidth - 16,
        top: state.imageTop + state.imageHeight - 16,
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
  const scrollFrameRef = useRef<number | null>(null);
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

    const overlay = getOverlayContainer(root);
    const rootRect = root.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const imageRect = imageDom.getBoundingClientRect();
    const visibleTop = rootRect.top + 8 - overlayRect.top;
    const maxLeft = overlay.clientWidth - 132;
    const rawLeft = imageRect.left - overlayRect.left;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      visibleTop,
      imageRect.top - overlayRect.top - 46,
    );
    const meta = parseImageMeta(image.node.attrs.title);

    setImageToolbar({
      align: meta.align,
      displayWidth: clampImageWidth(imageRect.width || minImageWidth),
      imageHeight: imageRect.height,
      imageLeft: imageRect.left - overlayRect.left,
      imageTop: imageRect.top - overlayRect.top,
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

    const tableInfo = findTable(view.state.selection.$from);

    if (!tableInfo) {
      setTableToolbar({ visible: false });
      return;
    }

    const overlay = getOverlayContainer(root);
    const rootRect = root.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const visibleTop = rootRect.top + 8 - overlayRect.top;
    const width = Math.max(220, Math.min(tableRect.width, overlay.clientWidth - 16));
    const maxLeft = overlay.clientWidth - width - 8;
    const rawLeft = tableRect.left - overlayRect.left;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      visibleTop,
      tableRect.top - overlayRect.top - 34,
    );
    const size = getTableSize(tableInfo.node);

    setTableToolbar({ ...size, left, top, visible: true, width });
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

  function refreshTableToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      updateTableToolbarFromView(ctx.get(editorViewCtx));
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

  function resizeSelectedTable(size: TableSize) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tableInfo = findTable(view.state.selection.$from);

      if (!tableInfo) {
        setTableToolbar({ visible: false });
        return;
      }

      const nextTable = createResizedTableNode(view.state, tableInfo.node, size);
      const transaction = view.state.tr.replaceWith(
        tableInfo.pos,
        tableInfo.pos + tableInfo.node.nodeSize,
        nextTable,
      );
      const selectionPosition = Math.min(tableInfo.pos + 3, transaction.doc.content.size);
      const nextSelection = Selection.findFrom(
        transaction.doc.resolve(selectionPosition),
        1,
        true,
      );

      if (nextSelection) {
        transaction.setSelection(nextSelection);
      }

      view.dispatch(transaction.scrollIntoView());
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
            registerMarkdownLanguages(refractor);
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
      .use(disableNativeWritingChecks)
      .use(codeBlockLanguageDecoration)
      .use(markdownSyntaxDecoration)
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

  function reportActiveHeadingFromScroll() {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const headings = getHeadingElements(root);

    if (!headings.length) {
      onActiveLineChange?.(0);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const activationY = rootRect.top + Math.min(140, root.clientHeight * 0.24);
    let activeHeading = headings[0];

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= activationY) {
        activeHeading = heading;
        continue;
      }

      break;
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
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        reportActiveHeadingFromScroll();
        refreshImageToolbar();
        refreshTableToolbar();
      });
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    window.requestAnimationFrame(reportActiveHeadingFromScroll);

    return () => {
      root.removeEventListener("scroll", handleScroll);

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [get, rootRef]);

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
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onClick={(event) => {
        const target = event.target;
        const isTableInteraction =
          target instanceof Element &&
          (target.closest("table") || target.closest(".milkdown-table-toolbar"));

        if (!isTableInteraction) {
          setTableToolbar({ visible: false });
        }

        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);

        if (isTableInteraction) {
          requestAnimationFrame(refreshTableToolbar);
        }
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
      <TableToolbar state={tableToolbar} onResize={resizeSelectedTable} onRun={runTableCommand} />
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
        autoCapitalize="off"
        autoCorrect="off"
        onPaste={onPaste}
        spellCheck={false}
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
