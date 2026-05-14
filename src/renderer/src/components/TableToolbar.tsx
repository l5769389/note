import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  setCellAttr,
  TableMap,
} from "@milkdown/kit/prose/tables";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
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
import { useEffect, useState, type ReactNode } from "react";

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

