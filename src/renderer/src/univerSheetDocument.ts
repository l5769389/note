import {
  BooleanNumber,
  CellValueType,
  LocaleType,
  type ICellData,
  type IWorkbookData,
  type IWorksheetData,
} from "@univerjs/core";

export type UniverSheetData = {
  title: string;
  version: 1;
  workbook: IWorkbookData;
};

export type UniverSheetEditTarget =
  | { kind: "insert" }
  | { kind: "document" }
  | { code: string; kind: "markdown" };

export type UniverSheetPreviewCell = {
  text: string;
};

export type UniverSheetPreviewRow = UniverSheetPreviewCell[];

const univerSheetLanguagePattern = /^(?:univer-sheet|univer|spreadsheet)$/i;
const markdownUniverSheetBlockPattern =
  /```(?:univer-sheet|univer|spreadsheet)\s*\n([\s\S]*?)\n```/gi;
const defaultColumnCount = 8;
const defaultRowCount = 60;

export function isUniverSheetLanguage(language: string) {
  return univerSheetLanguagePattern.test(language.trim());
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createStringCell(value: string): ICellData {
  return {
    t: CellValueType.STRING,
    v: value,
  };
}

function createNumberCell(value: number): ICellData {
  return {
    t: CellValueType.NUMBER,
    v: value,
  };
}

function createDefaultWorksheet(sheetId: string): IWorksheetData {
  return {
    cellData: {
      0: {
        0: createStringCell("项目"),
        1: createStringCell("负责人"),
        2: createStringCell("状态"),
        3: createStringCell("进度"),
      },
      1: {
        0: createStringCell("Markdown 编辑器"),
        1: createStringCell("Demo"),
        2: createStringCell("进行中"),
        3: createNumberCell(0.7),
      },
      2: {
        0: createStringCell("在线表格"),
        1: createStringCell("Univer"),
        2: createStringCell("可编辑"),
        3: createNumberCell(1),
      },
    },
    columnCount: defaultColumnCount,
    columnData: {
      0: { w: 170 },
      1: { w: 120 },
      2: { w: 110 },
      3: { w: 96 },
    },
    columnHeader: {
      height: 24,
    },
    defaultColumnWidth: 96,
    defaultRowHeight: 28,
    freeze: {
      startColumn: 0,
      startRow: 1,
      xSplit: 0,
      ySplit: 1,
    },
    hidden: BooleanNumber.FALSE,
    id: sheetId,
    mergeData: [],
    name: "Sheet1",
    rightToLeft: BooleanNumber.FALSE,
    rowCount: defaultRowCount,
    rowData: {},
    rowHeader: {
      width: 46,
    },
    scrollLeft: 0,
    scrollTop: 0,
    showGridlines: BooleanNumber.TRUE,
    tabColor: "",
    zoomRatio: 1,
  };
}

export function createDefaultUniverSheetData(): UniverSheetData {
  const workbookId = createId("workbook");
  const sheetId = createId("sheet");
  const title = "在线表格";

  return {
    title,
    version: 1,
    workbook: {
      appVersion: "0.22.1",
      id: workbookId,
      locale: LocaleType.ZH_CN,
      name: title,
      resources: [],
      sheetOrder: [sheetId],
      sheets: {
        [sheetId]: createDefaultWorksheet(sheetId),
      },
      styles: {},
    },
  };
}

function isWorkbookData(value: unknown): value is IWorkbookData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<IWorkbookData>;

  return Boolean(record.id && record.name && record.sheetOrder && record.sheets);
}

export function parseUniverSheetData(source: string): UniverSheetData {
  const parsed = JSON.parse(source) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Univer sheet data must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;

  if (isWorkbookData(record.workbook)) {
    return {
      title:
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : record.workbook.name,
      version: 1,
      workbook: record.workbook,
    };
  }

  if (isWorkbookData(parsed)) {
    return {
      title: parsed.name,
      version: 1,
      workbook: parsed,
    };
  }

  throw new Error("Univer sheet data must contain a workbook snapshot.");
}

export function serializeUniverSheetData(data: UniverSheetData) {
  return JSON.stringify(
    {
      title: data.title,
      version: 1,
      workbook: data.workbook,
    },
    null,
    2,
  );
}

export function createUniverSheetMarkdown(data: UniverSheetData) {
  return `\n\`\`\`univer-sheet\n${serializeUniverSheetData(data)}\n\`\`\`\n`;
}

export function replaceUniverSheetMarkdownBlock(
  content: string,
  targetCode: string,
  nextData: UniverSheetData,
) {
  let didReplace = false;

  return content.replace(markdownUniverSheetBlockPattern, (match, code: string) => {
    if (didReplace || code.trim() !== targetCode.trim()) {
      return match;
    }

    didReplace = true;
    return `\`\`\`univer-sheet\n${serializeUniverSheetData(nextData)}\n\`\`\``;
  });
}

function getCellText(cell: ICellData | undefined) {
  if (!cell) {
    return "";
  }

  if (cell.f) {
    return cell.f;
  }

  return cell.v === null || cell.v === undefined ? "" : String(cell.v);
}

function getFirstWorksheet(workbook: IWorkbookData) {
  const sheetId = workbook.sheetOrder[0] ?? Object.keys(workbook.sheets)[0];

  if (!sheetId) {
    return null;
  }

  return workbook.sheets[sheetId] ?? null;
}

export function createUniverSheetPreviewRows(
  data: UniverSheetData,
  maxRows = 6,
  maxColumns = 5,
): UniverSheetPreviewRow[] {
  const sheet = getFirstWorksheet(data.workbook);
  const cellData = sheet?.cellData ?? {};
  const rows = Object.keys(cellData)
    .map(Number)
    .filter(Number.isFinite)
    .sort((first, second) => first - second)
    .slice(0, maxRows);

  if (!rows.length) {
    return [[{ text: "空白表格" }]];
  }

  return rows.map((rowIndex) => {
    const row = cellData[rowIndex] ?? {};
    const columns = Object.keys(row)
      .map(Number)
      .filter(Number.isFinite)
      .sort((first, second) => first - second)
      .slice(0, maxColumns);

    if (!columns.length) {
      return [{ text: "" }];
    }

    return columns.map((columnIndex) => ({
      text: getCellText(row[columnIndex]),
    }));
  });
}
