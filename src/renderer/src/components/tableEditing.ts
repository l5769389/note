import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { Fragment } from "@milkdown/kit/prose/model";
import {
  type EditorState,
  NodeSelection,
  Plugin,
  Selection,
  TextSelection,
} from "@milkdown/kit/prose/state";
import {
  CellSelection,
  TableMap,
  cellAround,
  findTable,
  isInTable,
  pointsAtCell,
} from "@milkdown/kit/prose/tables";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  createTableClipboardPayload,
  tableClipboardPayloadToText,
  type TableClipboardPayload,
} from "../../../shared/tableClipboard";
import { createResizedTableNode } from "./TableToolbar";

export type TableClipboardCopyData = {
  payload?: TableClipboardPayload;
  text: string;
};

// Milkdown serializes a completely empty table cell as its own Markdown row.
// Keep a zero-width marker in empty cells so their row and column positions stay
// intact, then hide it from every user-facing table operation.
const emptyTableCellMarker = "\u200B";

type TableCellContext = {
  cell: ProseMirrorNode;
  cellPos: number;
  column: number;
  map: TableMap;
  row: number;
  table: ProseMirrorNode;
  tablePos: number;
  tableStart: number;
};

function getCellPlainText(cell: ProseMirrorNode) {
  return cell
    .textBetween(0, cell.content.size, "\n")
    .replaceAll(emptyTableCellMarker, "")
    .trimEnd();
}

function getCellAtSelection(state: EditorState) {
  if (state.selection instanceof CellSelection) {
    return state.selection.$anchorCell;
  }

  try {
    return cellAround(state.selection.$from);
  } catch {
    return null;
  }
}

function getTableCellContext(state: EditorState): TableCellContext | null {
  const $cell = getCellAtSelection(state);

  if (!$cell || !pointsAtCell($cell)) {
    return null;
  }

  const tableInfo = findTable($cell);

  if (!tableInfo) {
    return null;
  }

  const map = TableMap.get(tableInfo.node);
  const cellOffset = $cell.pos - tableInfo.start;
  const rect = map.findCell(cellOffset);
  const cell = tableInfo.node.nodeAt(cellOffset);

  if (!cell) {
    return null;
  }

  return {
    cell,
    cellPos: $cell.pos,
    column: rect.left,
    map,
    row: rect.top,
    table: tableInfo.node,
    tablePos: tableInfo.pos,
    tableStart: tableInfo.start,
  };
}

export function getTableSelectionRectangle(state: EditorState) {
  const selection = state.selection;

  if (selection instanceof NodeSelection && selection.node.type.name === "table") {
    const table = selection.node;
    const map = TableMap.get(table);

    return {
      map,
      rect: { bottom: map.height, left: 0, right: map.width, top: 0 },
      table,
      tableStart: selection.from + 1,
    };
  }

  if (selection instanceof CellSelection) {
    const table = selection.$anchorCell.node(-1);
    const tableStart = selection.$anchorCell.start(-1);
    const map = TableMap.get(table);

    return {
      map,
      rect: map.rectBetween(
        selection.$anchorCell.pos - tableStart,
        selection.$headCell.pos - tableStart,
      ),
      table,
      tableStart,
    };
  }

  let $fromCell;
  let $toCell;

  try {
    $fromCell = cellAround(selection.$from);
    $toCell = cellAround(selection.$to);
  } catch {
    return null;
  }

  if (!$fromCell || !$toCell) {
    return null;
  }

  const fromTable = findTable($fromCell);
  const toTable = findTable($toCell);

  if (!fromTable || !toTable || fromTable.pos !== toTable.pos) {
    return null;
  }

  const map = TableMap.get(fromTable.node);

  return {
    map,
    rect: map.rectBetween(
      $fromCell.pos - fromTable.start,
      $toCell.pos - fromTable.start,
    ),
    table: fromTable.node,
    tableStart: fromTable.start,
  };
}

export function getWholeTableNodeSelection(state: EditorState) {
  const selectionRect = getTableSelectionRectangle(state);

  if (
    selectionRect &&
    !(state.selection instanceof NodeSelection) &&
    selectionRect.rect.left === 0 &&
    selectionRect.rect.top === 0 &&
    selectionRect.rect.right === selectionRect.map.width &&
    selectionRect.rect.bottom === selectionRect.map.height
  ) {
    return NodeSelection.create(state.doc, selectionRect.tableStart - 1);
  }

  // A trailing paragraph provides a natural place to start a mouse drag below
  // a table. Promote a range covering the visible first and last cells to the
  // table node selection so the table itself receives the selected styling.
  if (!(state.selection instanceof TextSelection) || state.selection.empty) {
    return null;
  }

  const selectedTablePositions: number[] = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "table") {
      return true;
    }

    const map = TableMap.get(node);
    const tableStart = pos + 1;
    const firstCellOffset = map.map[0];
    const lastCellOffset = map.map[map.map.length - 1];
    const lastCell = node.nodeAt(lastCellOffset);

    if (!lastCell) {
      return false;
    }

    const firstCellTextStart = tableStart + firstCellOffset + 2;
    const lastCellTextEnd = tableStart + lastCellOffset + lastCell.nodeSize - 1;

    if (
      state.selection.from <= firstCellTextStart &&
      state.selection.to >= lastCellTextEnd
    ) {
      selectedTablePositions.push(pos);
      return false;
    }

    return false;
  });

  return selectedTablePositions.length
    ? NodeSelection.create(state.doc, selectedTablePositions[0]!)
    : null;
}

export function createTerminalTableCursorTransaction(state: EditorState) {
  const terminalNode = state.doc.lastChild;
  const paragraph = state.schema.nodes.paragraph;

  if (terminalNode?.type.name !== "table" || !paragraph) {
    return null;
  }

  return state.tr.insert(state.doc.content.size, paragraph.create());
}

export function getTableClipboardCopyData(
  state: EditorState,
): TableClipboardCopyData | null {
  const isTableNodeSelected =
    state.selection instanceof NodeSelection &&
    state.selection.node.type.name === "table";

  if (state.selection.empty || (!isInTable(state) && !isTableNodeSelected)) {
    return null;
  }

  const selectionRect = getTableSelectionRectangle(state);

  if (!selectionRect) {
    return null;
  }

  const { map, rect, table } = selectionRect;
  const selectedCellCount = (rect.right - rect.left) * (rect.bottom - rect.top);

  if (selectedCellCount === 1 && !(state.selection instanceof CellSelection)) {
    return {
      text: state.doc
        .textBetween(state.selection.from, state.selection.to, "\n")
        .replaceAll(emptyTableCellMarker, ""),
    };
  }

  const cells = Array.from({ length: rect.bottom - rect.top }, (_, rowIndex) =>
    Array.from({ length: rect.right - rect.left }, (_, columnIndex) => {
      const row = rect.top + rowIndex;
      const column = rect.left + columnIndex;
      const cellOffset = map.map[row * map.width + column];
      const cell = table.nodeAt(cellOffset);

      return cell ? getCellPlainText(cell) : "";
    }),
  );
  const payload = createTableClipboardPayload(cells);

  if (!payload) {
    return null;
  }

  if (selectedCellCount === 1) {
    return { text: payload.cells[0]?.[0] ?? "" };
  }

  return {
    payload,
    text: tableClipboardPayloadToText(payload),
  };
}

function createTextCellContent(
  state: EditorState,
  value: string,
): Fragment {
  const paragraph = state.schema.nodes.paragraph;

  if (!paragraph) {
    return Fragment.empty;
  }

  const text = value
    .replaceAll(emptyTableCellMarker, "")
    .replace(/\r?\n/g, " ");

  return Fragment.from(
    paragraph.create(
      null,
      state.schema.text(text || emptyTableCellMarker),
    ),
  );
}

function replaceTableCellContents(
  table: ProseMirrorNode,
  replacements: Map<string, Fragment>,
) {
  const rows: ProseMirrorNode[] = [];

  table.forEach((row, _rowOffset, rowIndex) => {
    const cells: ProseMirrorNode[] = [];

    row.forEach((cell, _cellOffset, columnIndex) => {
      const replacement = replacements.get(`${rowIndex}:${columnIndex}`);
      cells.push(replacement ? cell.copy(replacement) : cell);
    });

    rows.push(row.copy(Fragment.fromArray(cells)));
  });

  return table.copy(Fragment.fromArray(rows));
}

function getTargetSelectionStart(state: EditorState) {
  if (state.selection instanceof CellSelection) {
    const table = state.selection.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = state.selection.$anchorCell.start(-1);
    const rect = map.rectBetween(
      state.selection.$anchorCell.pos - tableStart,
      state.selection.$headCell.pos - tableStart,
    );

    return { column: rect.left, row: rect.top };
  }

  const context = getTableCellContext(state);
  return context ? { column: context.column, row: context.row } : null;
}

function setInsertedCellSelection(
  doc: ProseMirrorNode,
  tablePos: number,
  table: ProseMirrorNode,
  startRow: number,
  startColumn: number,
  rowCount: number,
  columnCount: number,
) {
  const map = TableMap.get(table);
  const tableStart = tablePos + 1;
  const anchorOffset = map.map[startRow * map.width + startColumn];
  const headRow = startRow + rowCount - 1;
  const headColumn = startColumn + columnCount - 1;
  const headOffset = map.map[headRow * map.width + headColumn];

  return CellSelection.create(
    doc,
    tableStart + anchorOffset,
    tableStart + headOffset,
  );
}

export function pasteTableClipboardPayloadIntoView(
  view: EditorView,
  payload: TableClipboardPayload,
) {
  if (!isInTable(view.state)) {
    return false;
  }

  const context = getTableCellContext(view.state);
  const start = getTargetSelectionStart(view.state);

  if (!context || !start || payload.cells.length === 0) {
    return false;
  }

  const rowCount = payload.cells.length;
  const columnCount = Math.max(...payload.cells.map((row) => row.length));
  const resizedTable = createResizedTableNode(view.state, context.table, {
    columns: Math.max(context.map.width, start.column + columnCount),
    rows: Math.max(context.map.height, start.row + rowCount),
  });
  const replacements = new Map<string, Fragment>();

  payload.cells.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      replacements.set(
        `${start.row + rowIndex}:${start.column + columnIndex}`,
        createTextCellContent(view.state, value),
      );
    });
  });

  const nextTable = replaceTableCellContents(resizedTable, replacements);
  const tr = view.state.tr.replaceWith(
    context.tablePos,
    context.tablePos + context.table.nodeSize,
    nextTable,
  );

  tr.setSelection(
    setInsertedCellSelection(
      tr.doc,
      context.tablePos,
      nextTable,
      start.row,
      start.column,
      rowCount,
      columnCount,
    ),
  );
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function isTableCellEmpty(cell: ProseMirrorNode) {
  let hasVisibleContent = false;

  cell.descendants((node) => {
    if (
      (node.isText &&
        Boolean(node.text?.replaceAll(emptyTableCellMarker, "").trim())) ||
      (node.isLeaf && !node.isText && node.type.name !== "hardbreak")
    ) {
      hasVisibleContent = true;
      return false;
    }

    return !hasVisibleContent;
  });

  return !hasVisibleContent;
}

function hasEmptyTableCellMarker(cell: ProseMirrorNode) {
  return cell.textContent.includes(emptyTableCellMarker);
}

function getTableCellMarkerContent(state: EditorState) {
  const paragraph = state.schema.nodes.paragraph;

  return paragraph
    ? Fragment.from(paragraph.create(null, state.schema.text(emptyTableCellMarker)))
    : Fragment.empty;
}

function preserveEmptyTableCells(state: EditorState) {
  const replacements: Array<{ node: ProseMirrorNode; pos: number }> = [];

  state.doc.descendants((node, pos) => {
    if (
      (node.type.name === "table_cell" || node.type.name === "table_header") &&
      isTableCellEmpty(node) &&
      !hasEmptyTableCellMarker(node)
    ) {
      replacements.push({ node, pos });
      return false;
    }

    return true;
  });

  if (!replacements.length) {
    return null;
  }

  const transaction = state.tr;

  replacements.reverse().forEach(({ node, pos }) => {
    transaction.replaceWith(
      pos,
      pos + node.nodeSize,
      node.copy(getTableCellMarkerContent(state)),
    );
  });

  if (state.selection instanceof TextSelection) {
    const from = transaction.mapping.map(state.selection.from, -1);
    const to = transaction.mapping.map(state.selection.to, 1);

    transaction.setSelection(
      TextSelection.create(
        transaction.doc,
        Math.min(from, transaction.doc.content.size),
        Math.min(Math.max(to, from), transaction.doc.content.size),
      ),
    );
  }

  return transaction;
}

function createEmptyCellContent(cell: ProseMirrorNode) {
  return cell.type.createAndFill(cell.attrs)?.content ?? Fragment.empty;
}

export function shiftCurrentTableRowRight(view: EditorView) {
  const context = getTableCellContext(view.state);

  if (!context || view.state.selection instanceof CellSelection) {
    return false;
  }

  const sourceRow = context.table.child(context.row);
  const lastCell = sourceRow.lastChild;
  const shouldGrow = Boolean(lastCell && !isTableCellEmpty(lastCell));
  const resizedTable = shouldGrow
    ? createResizedTableNode(view.state, context.table, {
        columns: context.map.width + 1,
        rows: context.map.height,
      })
    : context.table;
  const row = resizedTable.child(context.row);
  const replacements = new Map<string, Fragment>();

  for (let column = row.childCount - 1; column > context.column; column -= 1) {
    replacements.set(
      `${context.row}:${column}`,
      row.child(column - 1).content,
    );
  }

  replacements.set(
    `${context.row}:${context.column}`,
    createEmptyCellContent(row.child(context.column)),
  );

  const nextTable = replaceTableCellContents(resizedTable, replacements);
  const tr = view.state.tr.replaceWith(
    context.tablePos,
    context.tablePos + context.table.nodeSize,
    nextTable,
  );
  const map = TableMap.get(nextTable);
  const cellOffset = map.map[context.row * map.width + context.column];
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      Math.min(context.tablePos + 1 + cellOffset + 2, tr.doc.content.size),
    ),
  );

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function getPreviousTableCellSelection(state: EditorState, cellPos: number) {
  const $cell = state.doc.resolve(cellPos);

  if (!pointsAtCell($cell)) {
    return null;
  }

  const tableInfo = findTable($cell);

  if (!tableInfo) {
    return null;
  }

  const map = TableMap.get(tableInfo.node);
  const rect = map.findCell(cellPos - tableInfo.start);
  const previousRow = rect.left > 0 ? rect.top : rect.top - 1;
  const previousColumn = rect.left > 0 ? rect.left - 1 : map.width - 1;

  if (previousRow < 0) {
    return null;
  }

  const previousOffset = map.map[previousRow * map.width + previousColumn];
  const previousCell = tableInfo.node.nodeAt(previousOffset);

  if (!previousCell) {
    return null;
  }

  return Selection.findFrom(
    state.doc.resolve(
      tableInfo.start + previousOffset + previousCell.nodeSize - 1,
    ),
    -1,
    true,
  );
}

function enterSelectedTableCell(view: EditorView, event: MouseEvent) {
  if (
    !(view.state.selection instanceof NodeSelection) ||
    view.state.selection.node.type.name !== "table"
  ) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest<HTMLElement>("td, th");

  if (!cell || !view.dom.contains(cell)) {
    return false;
  }

  const domPosition = view.posAtDOM(cell, 0);
  const resolvedPos = view.state.doc.resolve(
    Math.max(0, Math.min(domPosition, view.state.doc.content.size)),
  );
  const selection = Selection.findFrom(resolvedPos, 1, true);

  if (!selection || selection instanceof NodeSelection) {
    return false;
  }

  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

export function createTableKeyboardBehavior() {
  return $prose(() => {
    let pendingDeleteCellPos: number | null = null;

    return new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (transactions.some((transaction) => transaction.docChanged)) {
          const tableCellMarkerTransaction = preserveEmptyTableCells(newState);

          if (tableCellMarkerTransaction) {
            return tableCellMarkerTransaction.setMeta("addToHistory", false);
          }

          const terminalTableCursorTransaction =
            createTerminalTableCursorTransaction(newState);

          if (terminalTableCursorTransaction) {
            return terminalTableCursorTransaction.setMeta("addToHistory", false);
          }
        }

        if (pendingDeleteCellPos === null) {
          const wholeTableSelection = getWholeTableNodeSelection(newState);

          if (wholeTableSelection) {
            return newState.tr
              .setSelection(wholeTableSelection)
              .setMeta("addToHistory", false);
          }

          return null;
        }

        let mappedCellPos = pendingDeleteCellPos;

        transactions.forEach((transaction) => {
          mappedCellPos = transaction.mapping.map(mappedCellPos, 1);
        });
        pendingDeleteCellPos = null;

        if (!transactions.some((transaction) => transaction.docChanged)) {
          return null;
        }

        const cell = newState.doc.nodeAt(mappedCellPos);

        if (!cell || !isTableCellEmpty(cell)) {
          return null;
        }

        const selection = getPreviousTableCellSelection(newState, mappedCellPos);

        return selection
          ? newState.tr.setSelection(selection).setMeta("addToHistory", false)
          : null;
      },
      props: {
        handleClick(view, _pos, event) {
          return enterSelectedTableCell(view, event);
        },
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0 || !enterSelectedTableCell(view, event)) {
              return false;
            }

            event.preventDefault();
            return true;
          },
        },
        handleKeyDown(view, event) {
          if (
            event.key === "Tab" &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            if (!isInTable(view.state)) {
              return false;
            }

            event.preventDefault();
            return shiftCurrentTableRowRight(view);
          }

          if (
            (event.key !== "Backspace" && event.key !== "Delete") ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.isComposing ||
            view.state.selection instanceof CellSelection
          ) {
            pendingDeleteCellPos = null;
            return false;
          }

          const context = getTableCellContext(view.state);

          if (!context) {
            pendingDeleteCellPos = null;
            return false;
          }

          if (isTableCellEmpty(context.cell)) {
            const selection = getPreviousTableCellSelection(
              view.state,
              context.cellPos,
            );

            if (!selection) {
              return false;
            }

            event.preventDefault();
            view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
            view.focus();
            return true;
          }

          pendingDeleteCellPos = context.cellPos;
          return false;
        },
      },
      view(view) {
        let destroyed = false;

        // Old documents can be parsed directly into a document ending in a
        // table, before appendTransaction has a chance to run.
        window.setTimeout(() => {
          if (destroyed) {
            return;
          }

          const transaction = createTerminalTableCursorTransaction(view.state);

          if (transaction) {
            view.dispatch(transaction.setMeta("addToHistory", false));
          }
        }, 0);

        return {
          destroy() {
            destroyed = true;
          },
        };
      },
    });
  });
}
