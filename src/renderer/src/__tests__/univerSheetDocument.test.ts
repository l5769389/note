import { describe, expect, it } from "vitest";
import {
  createDefaultUniverSheetData,
  createUniverSheetAssetMarkdown,
  createUniverSheetMarkdown,
  createUniverSheetPreviewRows,
  createUniverSheetSearchRows,
  isUniverSheetLanguage,
  parseUniverSheetAssetReference,
  parseUniverSheetData,
  replaceUniverSheetMarkdownBlock,
  replaceUniverSheetMarkdownBlockWithContent,
  serializeUniverSheetData,
} from "../univerSheetDocument";

describe("univerSheetDocument", () => {
  it("creates and parses an embedded Univer workbook", () => {
    const data = createDefaultUniverSheetData();
    const parsed = parseUniverSheetData(serializeUniverSheetData(data));

    expect(parsed.title).toBe(data.title);
    expect(parsed.workbook.sheetOrder).toHaveLength(1);
    expect(parsed.workbook.name).toBe(data.workbook.name);
  });

  it("recognizes supported fenced code languages", () => {
    expect(isUniverSheetLanguage("univer-sheet")).toBe(true);
    expect(isUniverSheetLanguage("spreadsheet")).toBe(true);
    expect(isUniverSheetLanguage("mermaid")).toBe(false);
  });

  it("replaces markdown blocks by matching the original code", () => {
    const initial = createDefaultUniverSheetData();
    const next = {
      ...initial,
      title: "Sales Plan",
      workbook: {
        ...initial.workbook,
        name: "Sales Plan",
      },
    };
    const markdown = createUniverSheetMarkdown(initial);

    expect(
      replaceUniverSheetMarkdownBlock(
        markdown,
        serializeUniverSheetData(initial),
        next,
      ),
    ).toContain('"Sales Plan"');
  });

  it("supports lightweight asset references for embedded sheets", () => {
    const initial = createDefaultUniverSheetData();
    const markdown = createUniverSheetAssetMarkdown(
      initial,
      ".assets/project.univer.json",
    );
    const originalCode = markdown.replace(/^\n?```univer-sheet\n|\n```\n?$/g, "");
    const reference = parseUniverSheetAssetReference(originalCode);

    expect(reference?.assetPath).toBe(".assets/project.univer.json");
    expect(
      replaceUniverSheetMarkdownBlockWithContent(
        markdown,
        originalCode,
        JSON.stringify({ title: "Next", version: 1, assetPath: ".assets/next.json" }),
      ),
    ).toContain(".assets/next.json");
  });

  it("creates blank preview rows for a new workbook", () => {
    const data = createDefaultUniverSheetData();
    const sheetId = data.workbook.sheetOrder[0]!;
    const firstSheet = data.workbook.sheets[sheetId]!;
    const rows = createUniverSheetPreviewRows(data);

    expect(firstSheet.cellData).toEqual({});
    expect(rows).toEqual([[{ text: "空白表格" }]]);
  });

  it("creates searchable text rows from workbook title, sheets, and cells", () => {
    const data = createDefaultUniverSheetData();
    const sheetId = data.workbook.sheetOrder[0]!;
    const sheet = data.workbook.sheets[sheetId]!;
    data.title = "Roadmap";
    data.workbook.name = "Planning Workbook";
    sheet.name = "Sprint Sheet";
    sheet.cellData = {
      ...sheet.cellData,
      4: {
        0: { v: "Search target" },
        1: { f: "=SUM(A1:A3)" },
      },
    };

    expect(createUniverSheetSearchRows(data)).toEqual(
      expect.arrayContaining([
        "Roadmap",
        "Planning Workbook",
        "Sprint Sheet",
        "Search target  =SUM(A1:A3)",
      ]),
    );
  });
});
