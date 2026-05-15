import { describe, expect, it } from "vitest";
import {
  createDefaultUniverSheetData,
  createUniverSheetMarkdown,
  createUniverSheetPreviewRows,
  isUniverSheetLanguage,
  parseUniverSheetData,
  replaceUniverSheetMarkdownBlock,
  serializeUniverSheetData,
} from "../univerSheetDocument";

describe("univerSheetDocument", () => {
  it("creates and parses an embedded Univer workbook", () => {
    const data = createDefaultUniverSheetData();
    const parsed = parseUniverSheetData(serializeUniverSheetData(data));

    expect(parsed.title).toBe(data.title);
    expect(parsed.workbook.sheetOrder).toHaveLength(1);
    expect(parsed.workbook.name).toBe("在线表格");
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
      title: "销售计划",
      workbook: {
        ...initial.workbook,
        name: "销售计划",
      },
    };
    const markdown = createUniverSheetMarkdown(initial);

    expect(
      replaceUniverSheetMarkdownBlock(
        markdown,
        serializeUniverSheetData(initial),
        next,
      ),
    ).toContain('"销售计划"');
  });

  it("creates compact preview rows from workbook cells", () => {
    const rows = createUniverSheetPreviewRows(createDefaultUniverSheetData());

    expect(rows[0][0].text).toBe("项目");
    expect(rows[1][0].text).toBe("Markdown 编辑器");
  });
});
