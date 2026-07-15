import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  CellSelection,
  TableMap,
  cellAround,
  findTable,
} from "@milkdown/kit/prose/tables";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { NodeSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  EllipsisVertical,
  Grid3x3,
  Rows2,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type TableSize = {
  columns: number;
  rows: number;
};

export type TableToolbarState =
  | { visible: false }
  | {
      columns: number;
      left: number;
      rows: number;
      top: number;
      visible: true;
      width: number;
    };

export type TableCommand = (
  state: EditorView["state"],
  dispatch?: EditorView["dispatch"],
  view?: EditorView,
) => boolean;

type TableToolbarAction = {
  command: TableCommand;
  icon: ReactNode;
  label: string;
};

export const minTableRows = 2;
export const maxTablePickerColumns = 8;
export const maxTablePickerRows = 10;
export const maxTableSize = 20;

export function clampTableSize(size: TableSize): TableSize {
  return {
    columns: Math.max(1, Math.min(maxTableSize, Math.round(size.columns) || 1)),
    rows: Math.max(
      minTableRows,
      Math.min(maxTableSize, Math.round(size.rows) || minTableRows),
    ),
  };
}

export function getTableSize(tableNode: ProseMirrorNode): TableSize {
  const map = TableMap.get(tableNode);

  return { columns: map.width, rows: map.height };
}

type TableAlignmentTarget = {
  cellOffsets: number[];
};

function getCellOffsetsForRect(
  map: TableMap,
  rect: { bottom: number; left: number; right: number; top: number },
) {
  const cellOffsets: number[] = [];

  for (let row = rect.top; row < rect.bottom; row += 1) {
    for (let column = rect.left; column < rect.right; column += 1) {
      cellOffsets.push(map.map[row * map.width + column]);
    }
  }

  return [...new Set(cellOffsets)];
}

function getTableAlignmentTarget(state: EditorView["state"]): TableAlignmentTarget | null {
  const selection = state.selection;

  if (selection instanceof NodeSelection && selection.node.type.name === "table") {
    const map = TableMap.get(selection.node);
    return { cellOffsets: [...new Set(map.map)] };
  }

  if (selection instanceof CellSelection) {
    const table = selection.$anchorCell.node(-1);
    const tableStart = selection.$anchorCell.start(-1);
    const map = TableMap.get(table);
    const rect = map.rectBetween(
      selection.$anchorCell.pos - tableStart,
      selection.$headCell.pos - tableStart,
    );
    return { cellOffsets: getCellOffsetsForRect(map, rect) };
  }

  let $fromCell;
  let $toCell;

  try {
    $fromCell = cellAround(selection.$from);
    $toCell = cellAround(selection.$to);
  } catch {
    return null;
  }
  const tableInfo = $fromCell ? findTable($fromCell) : null;

  if (!tableInfo) {
    return null;
  }

  const map = TableMap.get(tableInfo.node);

  // A caret keeps the table-level behavior. A non-empty text selection inside
  // one cell is an explicit request to operate on that cell instead.
  if (!selection.empty && $fromCell && $toCell) {
    const toTableInfo = findTable($toCell);

    if (toTableInfo?.pos === tableInfo.pos) {
      const rect = map.rectBetween(
        $fromCell.pos - tableInfo.start,
        $toCell.pos - tableInfo.start,
      );
      return { cellOffsets: getCellOffsetsForRect(map, rect) };
    }
  }

  return { cellOffsets: [...new Set(map.map)] };
}

type TableDeletionTarget = {
  map: TableMap;
  rect: { bottom: number; left: number; right: number; top: number };
  selection: CellSelection | null;
  state: EditorView["state"];
};

function getTableDeletionTarget(state: EditorView["state"]): TableDeletionTarget | null {
  if (state.selection instanceof NodeSelection && state.selection.node.type.name === "table") {
    const map = TableMap.get(state.selection.node);
    return {
      map,
      rect: { bottom: map.height, left: 0, right: map.width, top: 0 },
      selection: null,
      state,
    };
  }

  if (state.selection instanceof CellSelection) {
    const table = state.selection.$anchorCell.node(-1);
    const tableStart = state.selection.$anchorCell.start(-1);
    const map = TableMap.get(table);

    return {
      map,
      rect: map.rectBetween(
        state.selection.$anchorCell.pos - tableStart,
        state.selection.$headCell.pos - tableStart,
      ),
      selection: null,
      state,
    };
  }

  let $cell;

  try {
    $cell = cellAround(state.selection.$from);
  } catch {
    return null;
  }

  if (!$cell || !findTable($cell)) {
    return null;
  }

  const cellSelection = CellSelection.create(state.doc, $cell.pos);
  const table = cellSelection.$anchorCell.node(-1);
  const tableStart = cellSelection.$anchorCell.start(-1);
  const map = TableMap.get(table);

  return {
    map,
    rect: map.rectBetween(
      cellSelection.$anchorCell.pos - tableStart,
      cellSelection.$headCell.pos - tableStart,
    ),
    selection: cellSelection,
    state,
  };
}

function prepareTableDeletionState(
  target: TableDeletionTarget,
  dispatch?: EditorView["dispatch"],
  view?: EditorView,
) {
  if (!target.selection) {
    return target.state;
  }

  const selectionTransaction = target.state.tr
    .setSelection(target.selection)
    .setMeta("addToHistory", false);

  // Run structural table commands against the real editor state. Dispatching
  // a transaction created from a temporary state can leave table plugins out
  // of sync for older or repaired tables and make the renderer appear frozen.
  if (dispatch && view) {
    dispatch(selectionTransaction);
    return view.state;
  }

  return target.state.apply(selectionTransaction);
}

function deleteTableFromSelection(state: EditorView["state"], dispatch?: EditorView["dispatch"]) {
  if (!(state.selection instanceof NodeSelection) || state.selection.node.type.name !== "table") {
    return deleteTable(state, dispatch);
  }

  if (dispatch) {
    dispatch(state.tr.delete(state.selection.from, state.selection.to));
  }

  return true;
}

/** Delete the selected table rows structurally, not merely their cell contents. */
export const deleteSelectedTableRows: TableCommand = (state, dispatch, view) => {
  const target = getTableDeletionTarget(state);

  if (!target) {
    return false;
  }

  const commandState = prepareTableDeletionState(target, dispatch, view);

  if (target.rect.top === 0 && target.rect.bottom === target.map.height) {
    return deleteTableFromSelection(commandState, dispatch);
  }

  return deleteRow(commandState, dispatch);
};

/** Delete the selected table columns structurally, not merely their cell contents. */
export const deleteSelectedTableColumns: TableCommand = (state, dispatch, view) => {
  const target = getTableDeletionTarget(state);

  if (!target) {
    return false;
  }

  const commandState = prepareTableDeletionState(target, dispatch, view);

  if (target.rect.left === 0 && target.rect.right === target.map.width) {
    return deleteTableFromSelection(commandState, dispatch);
  }

  return deleteColumn(commandState, dispatch);
};

/** Apply alignment to the explicit selection, or to the complete table for a caret. */
export function setTableAlignment(alignment: "left" | "center" | "right"): TableCommand {
  return (state, dispatch) => {
    const target = getTableAlignmentTarget(state);
    const selection = state.selection;
    let tableStart: number | null = null;
    let table: ProseMirrorNode | null = null;

    if (selection instanceof NodeSelection && selection.node.type.name === "table") {
      tableStart = selection.from + 1;
      table = selection.node;
    } else if (selection instanceof CellSelection) {
      tableStart = selection.$anchorCell.start(-1);
      table = selection.$anchorCell.node(-1);
    } else {
      let $cell;

      try {
        $cell = cellAround(selection.$from);
      } catch {
        return false;
      }
      const tableInfo = $cell ? findTable($cell) : null;
      tableStart = tableInfo?.start ?? null;
      table = tableInfo?.node ?? null;
    }

    if (!target || tableStart === null || !table) {
      return false;
    }

    const transaction = state.tr;
    let changed = false;

    for (const cellOffset of target.cellOffsets) {
      const cell = table.nodeAt(cellOffset);

      if (!cell || cell.attrs.alignment === alignment) {
        continue;
      }

      transaction.setNodeMarkup(tableStart + cellOffset, undefined, {
        ...cell.attrs,
        alignment,
      });
      changed = true;
    }

    if (changed && dispatch) {
      transaction.setSelection(selection.map(transaction.doc, transaction.mapping));
      dispatch(transaction);
    }

    return true;
  };
}

function normalizeTableCellAttrs(
  attrs: ProseMirrorNode["attrs"],
  alignment: string,
) {
  return {
    ...attrs,
    alignment,
    colspan: 1,
    colwidth: null,
    rowspan: 1,
  };
}

export function createResizedTableNode(
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

function TableSizePicker({
  columns,
  onApply,
  rows,
}: {
  columns: number;
  onApply: (size: TableSize) => void;
  rows: number;
}) {
  const [draftSize, setDraftSize] = useState<TableSize>(() =>
    clampTableSize({ columns, rows }),
  );
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
              cellSize.columns <= displaySize.columns &&
              cellSize.rows <= displaySize.rows;

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
          onChange={(event) =>
            updateDraft({ columns: Number(event.target.value) })
          }
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

export function TableToolbar({
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
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.visible) {
      setIsActionsOpen(false);
      setIsSizePickerOpen(false);
    }
  }, [state.visible]);

  useEffect(() => {
    if (!isActionsOpen && !isSizePickerOpen) {
      return;
    }

    const closeIfOutside = (target: EventTarget | null) => {
      if (target instanceof Node && !toolbarRef.current?.contains(target)) {
        setIsActionsOpen(false);
        setIsSizePickerOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => closeIfOutside(event.target);
    const onFocusIn = (event: FocusEvent) => closeIfOutside(event.target);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsActionsOpen(false);
        setIsSizePickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isActionsOpen, isSizePickerOpen]);

  if (!state.visible) {
    return null;
  }

  const alignActions: TableToolbarAction[] = [
    { command: setTableAlignment("left"), icon: <AlignLeft size={15} />, label: "左对齐" },
    {
      command: setTableAlignment("center"),
      icon: <AlignCenter size={15} />,
      label: "居中对齐",
    },
    { command: setTableAlignment("right"), icon: <AlignRight size={15} />, label: "右对齐" },
  ];
  const insertActions: TableToolbarAction[] = [
    { command: addColumnBefore, icon: <Columns2 size={15} />, label: "在左侧插入列" },
    { command: addColumnAfter, icon: <Columns2 size={15} />, label: "在右侧插入列" },
    { command: addRowBefore, icon: <Rows2 size={15} />, label: "在上方插入行" },
    { command: addRowAfter, icon: <Rows2 size={15} />, label: "在下方插入行" },
  ];

  return (
    <div
      ref={toolbarRef}
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
            aria-label="调整表格尺寸"
            className="milkdown-table-toolbar-button"
            data-tooltip="调整表格尺寸"
            onClick={() => {
              setIsActionsOpen(false);
              setIsSizePickerOpen((current) => !current);
            }}
            type="button"
          >
            <Grid3x3 size={16} />
          </button>
          {alignActions.map((action) => (
            <button
              aria-label={action.label}
              className="milkdown-table-toolbar-button"
              data-tooltip={action.label}
              key={action.label}
              onClick={() => onRun(action.command)}
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
              data-tooltip={action.label}
              key={action.label}
              onClick={() => onRun(action.command)}
              type="button"
            >
              {action.icon}
            </button>
          ))}
          <button
            aria-label="更多表格操作"
            className="milkdown-table-toolbar-button"
            data-tooltip="更多表格操作"
            onClick={() => {
              setIsSizePickerOpen(false);
              setIsActionsOpen((current) => !current);
            }}
            type="button"
          >
            <EllipsisVertical size={16} />
          </button>
          <button
            aria-label="删除表格"
            className="milkdown-table-toolbar-button"
            data-tooltip="删除表格"
            onClick={() => onRun(deleteTable)}
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
          <button
            type="button"
            onClick={() => {
              setIsActionsOpen(false);
              onRun(deleteSelectedTableRows);
            }}
          >
            删除行
          </button>
          <button
            type="button"
            onClick={() => {
              setIsActionsOpen(false);
              onRun(deleteSelectedTableColumns);
            }}
          >
            删除列
          </button>
        </div>
      )}
    </div>
  );
}
