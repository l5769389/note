import { Schema } from "@milkdown/kit/prose/model";
import {
  EditorState,
  NodeSelection,
  TextSelection,
} from "@milkdown/kit/prose/state";
import type { Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import {
  CellSelection,
  TableMap,
  tableNodes,
} from "@milkdown/kit/prose/tables";
import { describe, expect, it } from "vitest";
import {
  createTerminalTableCursorTransaction,
  getTableClipboardCopyData,
  getWholeTableNodeSelection,
  pasteTableClipboardPayloadIntoView,
  shiftCurrentTableRowRight,
} from "../components/tableEditing";
import {
  deleteSelectedTableColumns,
  deleteSelectedTableRows,
  setTableAlignment,
} from "../components/TableToolbar";

const tableNodeSpecs = tableNodes({
  cellAttributes: {
    alignment: {
      default: "left",
      getFromDOM: (dom) => dom.getAttribute("data-align") || "left",
      setDOMAttr: (value, attrs) => {
        if (value && value !== "left") {
          attrs["data-align"] = value;
        }
      },
    },
  },
  cellContent: "block+",
  tableGroup: "block",
});

const schema = new Schema({
  marks: {},
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
    ...tableNodeSpecs,
    table: {
      ...tableNodeSpecs.table,
      content: "table_header_row table_row*",
    },
    table_header_row: tableNodeSpecs.table_row,
  },
});

function createCell(value: string, header = false) {
  const paragraph = schema.nodes.paragraph.create(
    null,
    schema.text(value || "\u200B"),
  );

  return schema.nodes[header ? "table_header" : "table_cell"].create(
    { alignment: "left", colspan: 1, colwidth: null, rowspan: 1 },
    paragraph,
  );
}

function createTableState() {
  const table = schema.nodes.table.create(null, [
    schema.nodes.table_header_row.create(null, [
      createCell("A", true),
      createCell("B", true),
    ]),
    schema.nodes.table_row.create(null, [createCell("C"), createCell("D")]),
  ]);
  const doc = schema.nodes.doc.create(null, table);
  const map = TableMap.get(table);

  return { doc, map };
}

function createTableStateWithTrailingParagraph() {
  const { doc, map } = createTableState();

  return {
    doc: schema.nodes.doc.create(null, [doc.firstChild!, schema.nodes.paragraph.create()]),
    map,
  };
}

type MockEditorView = EditorView & { readonly dispatchCount: number };

function createMockView(state: EditorState): MockEditorView {
  let currentState = state;
  let dispatchCount = 0;
  const view = {
    dispatch(transaction: Transaction) {
      dispatchCount += 1;
      currentState = currentState.apply(transaction);
    },
    focus() {},
    get dispatchCount() {
      return dispatchCount;
    },
    get state() {
      return currentState;
    },
  } as unknown as MockEditorView;

  return view;
}

function getTableTextRows(state: EditorState) {
  const table = state.doc.firstChild!;

  return Array.from({ length: table.childCount }, (_, rowIndex) => {
    const row = table.child(rowIndex);

    return Array.from(
      { length: row.childCount },
      (_, columnIndex) =>
        row.child(columnIndex).textContent.replaceAll("\u200B", ""),
    );
  });
}

function getTableAlignments(state: EditorState) {
  const table = state.doc.firstChild!;

  return Array.from({ length: table.childCount }, (_, rowIndex) => {
    const row = table.child(rowIndex);
    return Array.from({ length: row.childCount }, (_, columnIndex) =>
      String(row.child(columnIndex).attrs.alignment),
    );
  });
}

describe("table clipboard selection", () => {
  it("copies text selected inside one cell as plain text", () => {
    const { doc, map } = createTableState();
    const cellPos = 1 + map.map[0];
    const textPos = cellPos + 2;
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, textPos, textPos + 1),
    });

    expect(getTableClipboardCopyData(state)).toEqual({ text: "A" });
  });

  it("copies a multi-cell rectangle as a matrix and TSV", () => {
    const { doc, map } = createTableState();
    const state = EditorState.create({
      doc,
      selection: CellSelection.create(
        doc,
        1 + map.map[0],
        1 + map.map[3],
      ),
    });

    expect(getTableClipboardCopyData(state)).toEqual({
      payload: {
        cells: [
          ["A", "B"],
          ["C", "D"],
        ],
        version: 1,
      },
      text: "A\tB\nC\tD",
    });
  });

  it("promotes a full table cell selection to a table node selection", () => {
    const { doc, map } = createTableState();
    const state = EditorState.create({
      doc,
      selection: CellSelection.create(
        doc,
        1 + map.map[0],
        1 + map.map[3],
      ),
    });

    const selection = getWholeTableNodeSelection(state);

    expect(selection).toBeInstanceOf(NodeSelection);
    expect(selection?.node.type.name).toBe("table");
  });

  it("keeps a cursor landing area after a terminal table", () => {
    const { doc } = createTableState();
    const state = EditorState.create({ doc });
    const transaction = createTerminalTableCursorTransaction(state);

    expect(transaction?.doc.lastChild?.type.name).toBe("paragraph");
  });

  it("promotes a mouse range from the table end to a whole table selection", () => {
    const { doc, map } = createTableStateWithTrailingParagraph();
    const firstCellText = 1 + map.map[0] + 2;
    const afterTable = 1 + doc.firstChild!.nodeSize;
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, firstCellText, afterTable),
    });

    expect(getWholeTableNodeSelection(state)?.node.type.name).toBe("table");
  });

  it("pastes a matrix into cells and grows the table as needed", () => {
    const { doc, map } = createTableState();
    const cellPos = 1 + map.map[0];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    expect(
      pasteTableClipboardPayloadIntoView(view, {
        cells: [
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ],
        version: 1,
      }),
    ).toBe(true);
    expect(getTableTextRows(view.state)).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
    ]);
    expect(view.state.selection).toBeInstanceOf(CellSelection);
  });

  it("shifts a row right and grows all rows when its last cell is occupied", () => {
    const { doc, map } = createTableState();
    const cellPos = 1 + map.map[0];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    expect(shiftCurrentTableRowRight(view)).toBe(true);
    expect(getTableTextRows(view.state)).toEqual([
      ["", "A", "B"],
      ["C", "D", ""],
    ]);
  });
});

describe("table alignment", () => {
  it("aligns only the selected cell when text is selected inside it", () => {
    const { doc, map } = createTableState();
    const cellPos = 1 + map.map[0];
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, cellPos + 2, cellPos + 3),
    });
    const view = createMockView(state);

    expect(setTableAlignment("center")(view.state, view.dispatch, view)).toBe(true);
    expect(getTableAlignments(view.state)).toEqual([
      ["center", "left"],
      ["left", "left"],
    ]);
    expect(view.state.selection.from).toBe(state.selection.from);
    expect(view.state.selection.to).toBe(state.selection.to);
  });

  it("aligns the complete table from a caret", () => {
    const { doc, map } = createTableState();
    const cellPos = 1 + map.map[0];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    setTableAlignment("right")(view.state, view.dispatch, view);

    expect(getTableAlignments(view.state)).toEqual([
      ["right", "right"],
      ["right", "right"],
    ]);
  });

  it("aligns only the selected cell rectangle and preserves it", () => {
    const { doc, map } = createTableState();
    const state = EditorState.create({
      doc,
      selection: CellSelection.create(
        doc,
        1 + map.map[0],
        1 + map.map[2],
      ),
    });
    const view = createMockView(state);

    expect(setTableAlignment("right")(view.state, view.dispatch, view)).toBe(true);
    expect(getTableAlignments(view.state)).toEqual([
      ["right", "left"],
      ["right", "left"],
    ]);
    expect(view.state.selection).toBeInstanceOf(CellSelection);
    expect(getTableClipboardCopyData(view.state)?.payload?.cells).toEqual([
      ["A"],
      ["C"],
    ]);
  });

  it("aligns a selected row without changing the remaining rows", () => {
    const { doc, map } = createTableState();
    const state = EditorState.create({
      doc,
      selection: CellSelection.create(
        doc,
        1 + map.map[0],
        1 + map.map[1],
      ),
    });
    const view = createMockView(state);

    setTableAlignment("center")(view.state, view.dispatch, view);

    expect(getTableAlignments(view.state)).toEqual([
      ["center", "center"],
      ["left", "left"],
    ]);
  });
});

describe("table structural deletion", () => {
  it("removes the current row instead of only clearing its cells", () => {
    const { doc, map } = createTableStateWithTrailingParagraph();
    const cellPos = 1 + map.map[2];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    expect(deleteSelectedTableRows(view.state, view.dispatch, view)).toBe(true);
    expect(view.dispatchCount).toBe(2);
    expect(view.state.doc.firstChild?.childCount).toBe(1);
    expect(getTableTextRows(view.state)).toEqual([["A", "B"]]);
  });

  it("keeps the table valid when removing its header row", () => {
    const { doc, map } = createTableStateWithTrailingParagraph();
    const cellPos = 1 + map.map[0];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    expect(deleteSelectedTableRows(view.state, view.dispatch, view)).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe("table");
    expect(view.state.doc.firstChild?.firstChild?.type.name).toBe("table_header_row");
  });

  it("removes the whole table when its full range is selected", () => {
    const { doc, map } = createTableStateWithTrailingParagraph();
    const tableSelection = getWholeTableNodeSelection(
      EditorState.create({
        doc,
        selection: CellSelection.create(doc, 1 + map.map[0], 1 + map.map[3]),
      }),
    )!;
    const view = createMockView(
      EditorState.create({ doc, selection: tableSelection }),
    );

    expect(deleteSelectedTableRows(view.state, view.dispatch, view)).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe("paragraph");
  });

  it("removes the current column instead of only clearing its cells", () => {
    const { doc, map } = createTableStateWithTrailingParagraph();
    const cellPos = 1 + map.map[1];
    const view = createMockView(
      EditorState.create({
        doc,
        selection: TextSelection.create(doc, cellPos + 2),
      }),
    );

    expect(deleteSelectedTableColumns(view.state, view.dispatch, view)).toBe(true);
    expect(getTableTextRows(view.state)).toEqual([["A"], ["C"]]);
  });
});
