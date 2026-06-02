import type {
  ICellData,
  IWorkbookData,
  IWorksheetData,
  LocaleType,
} from "@univerjs/core";

const booleanNumberFalse = 0;
const booleanNumberTrue = 1;
const localeTypeZhCn = "zhCN" as LocaleType;

export type UniverSheetData = {
  title: string;
  version: 1;
  workbook: IWorkbookData;
};

export type UniverSheetAssetReference = {
  assetPath: string;
  title: string;
  updatedAt?: string;
  version: 1;
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

function createDefaultWorksheet(sheetId: string): IWorksheetData {
  return {
    cellData: {},
    columnCount: defaultColumnCount,
    columnData: {},
    columnHeader: {
      height: 24,
    },
    defaultColumnWidth: 96,
    defaultRowHeight: 28,
    freeze: {
      startColumn: 0,
      startRow: 0,
      xSplit: 0,
      ySplit: 0,
    },
    hidden: booleanNumberFalse,
    id: sheetId,
    mergeData: [],
    name: "Sheet1",
    rightToLeft: booleanNumberFalse,
    rowCount: defaultRowCount,
    rowData: {},
    rowHeader: {
      width: 46,
    },
    scrollLeft: 0,
    scrollTop: 0,
    showGridlines: booleanNumberTrue,
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
      locale: localeTypeZhCn,
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

export function parseUniverSheetAssetReference(
  source: string,
): UniverSheetAssetReference | null {
  try {
    const parsed = JSON.parse(source) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (typeof record.assetPath !== "string" || !record.assetPath.trim()) {
      return null;
    }

    return {
      assetPath: record.assetPath.trim(),
      title:
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : "在线表格",
      updatedAt:
        typeof record.updatedAt === "string" && record.updatedAt.trim()
          ? record.updatedAt.trim()
          : undefined,
      version: 1,
    };
  } catch {
    return null;
  }
}

export function isUniverSheetAssetReference(source: string) {
  return parseUniverSheetAssetReference(source) !== null;
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

export function createUniverSheetAssetMarkdown(
  data: Pick<UniverSheetData, "title">,
  assetPath: string,
  updatedAt = new Date().toISOString(),
) {
  return `\n\`\`\`univer-sheet\n${JSON.stringify(
    {
      title: data.title || "在线表格",
      updatedAt,
      version: 1,
      assetPath,
    },
    null,
    2,
  )}\n\`\`\`\n`;
}

export function replaceUniverSheetMarkdownBlock(
  content: string,
  targetCode: string,
  nextData: UniverSheetData,
) {
  return replaceUniverSheetMarkdownBlockWithContent(
    content,
    targetCode,
    serializeUniverSheetData(nextData),
  );
}

export function replaceUniverSheetMarkdownBlockWithContent(
  content: string,
  targetCode: string,
  nextCode: string,
) {
  let didReplace = false;

  return content.replace(markdownUniverSheetBlockPattern, (match, code: string) => {
    if (didReplace || code.trim() !== targetCode.trim()) {
      return match;
    }

    didReplace = true;
    return `\`\`\`univer-sheet\n${nextCode}\n\`\`\``;
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

function pushUniverSheetSearchText(lines: string[], value?: string | null) {
  const text = value?.trim();

  if (text) {
    lines.push(text);
  }
}

function getWorkbookSheetIds(workbook: IWorkbookData) {
  const orderedIds = workbook.sheetOrder.filter((sheetId) => workbook.sheets[sheetId]);
  const remainingIds = Object.keys(workbook.sheets).filter(
    (sheetId) => !orderedIds.includes(sheetId),
  );

  return [...orderedIds, ...remainingIds];
}

export function createUniverSheetSearchRows(data: UniverSheetData) {
  const lines: string[] = [];
  pushUniverSheetSearchText(lines, data.title);
  pushUniverSheetSearchText(lines, data.workbook.name);

  getWorkbookSheetIds(data.workbook).forEach((sheetId) => {
    const sheet = data.workbook.sheets[sheetId];

    if (!sheet) {
      return;
    }

    pushUniverSheetSearchText(lines, sheet.name);

    const cellData = sheet.cellData ?? {};
    Object.keys(cellData)
      .map(Number)
      .filter(Number.isFinite)
      .sort((first, second) => first - second)
      .forEach((rowIndex) => {
        const row = cellData[rowIndex] ?? {};
        const rowText = Object.keys(row)
          .map(Number)
          .filter(Number.isFinite)
          .sort((first, second) => first - second)
          .map((columnIndex) => getCellText(row[columnIndex]).trim())
          .filter(Boolean)
          .join("  ");

        pushUniverSheetSearchText(lines, rowText);
      });
  });

  return lines;
}

export function createUniverSheetSearchRowsFromSource(source: string) {
  try {
    return createUniverSheetSearchRows(parseUniverSheetData(source));
  } catch {
    return [];
  }
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
