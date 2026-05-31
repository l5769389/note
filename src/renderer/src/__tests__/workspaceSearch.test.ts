import { describe, expect, it } from "vitest";
import {
  findMarkdownSearchMatches,
  getWorkspaceSearchGroups,
} from "../workspaceSearch";
import {
  createDefaultUniverSheetData,
  serializeUniverSheetData,
} from "../univerSheetDocument";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument>): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/doc.md",
    id: "doc",
    title: "Document",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("workspace search helpers", () => {
  it("matches visible markdown text while ignoring formatting markers", () => {
    expect(findMarkdownSearchMatches("## **Hello** `world`", "hello")).toEqual([
      {
        column: 0,
        end: 10,
        line: 1,
        lineIndex: 0,
        snippet: "Hello world",
        start: 5,
      },
    ]);
  });

  it("searches html text and image alt text while skipping script and style bodies", () => {
    const html = [
      "<style>.target { color: red; }</style>",
      "<script>const target = true;</script>",
      '<main><img alt="Target image" src="x.png"><p>Visible target</p></main>',
    ].join("\n");

    const matches = findMarkdownSearchMatches(html, "target", "html");

    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.snippet)).toEqual([
      "Target imageVisible target",
      "Target imageVisible target",
    ]);
  });

  it("limits workspace groups to documents inside the selected workspace", () => {
    const groups = getWorkspaceSearchGroups(
      [
        document({ content: "alpha", filePath: "D:/notes/a.md", id: "a" }),
        document({ content: "alpha", filePath: "D:/other/b.md", id: "b" }),
      ],
      "alpha",
      "D:/notes",
    );

    expect(groups.map((group) => group.document.id)).toEqual(["a"]);
  });

  it("skips binary preview documents", () => {
    const groups = getWorkspaceSearchGroups(
      [
        document({
          content: "alpha",
          documentType: "pdf",
          fileExtension: ".pdf",
          filePath: "D:/notes/a.pdf",
          id: "pdf",
        }),
        document({
          content: "alpha",
          documentType: "word",
          fileExtension: ".docx",
          filePath: "D:/notes/a.docx",
          id: "word",
        }),
      ],
      "alpha",
      "D:/notes",
    );

    expect(groups).toEqual([]);
  });

  it("searches standalone Univer sheet title, sheet name, and cell text", () => {
    const sheet = createDefaultUniverSheetData();
    const sheetId = sheet.workbook.sheetOrder[0]!;
    sheet.title = "Roadmap";
    sheet.workbook.name = "Planning Workbook";
    sheet.workbook.sheets[sheetId]!.name = "Sprint Sheet";
    sheet.workbook.sheets[sheetId]!.cellData = {
      0: {
        0: { v: "Owner" },
        1: { v: "Target cell" },
      },
    };
    const content = serializeUniverSheetData(sheet);

    expect(findMarkdownSearchMatches(content, "target", "sheet")).toEqual([
      expect.objectContaining({
        line: 4,
        snippet: "Owner  Target cell",
      }),
    ]);

    expect(
      getWorkspaceSearchGroups(
        [
          document({
            content,
            documentType: "sheet",
            fileExtension: ".univer",
            filePath: "D:/notes/roadmap.univer",
            id: "sheet",
          }),
        ],
        "sprint",
        "D:/notes",
      ).map((group) => group.document.id),
    ).toEqual(["sheet"]);
  });
});

