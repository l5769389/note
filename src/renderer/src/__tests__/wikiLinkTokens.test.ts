import { describe, expect, it } from "vitest";
import {
  findWikiLinkTokensInMarkdown,
  findWikiLinkTokensInText,
  getWikiLinkTokenDeleteRange,
  parseWikiLinkInner,
} from "../wikiLinkTokens";

describe("wikiLinkTokens", () => {
  it("parses plain and display wiki links", () => {
    expect(findWikiLinkTokensInText("See [[Doc]].")).toMatchObject([
      {
        display: "Doc",
        from: 4,
        raw: "[[Doc]]",
        target: "Doc",
        to: 11,
      },
    ]);

    expect(parseWikiLinkInner("path/to/Doc.md|标题")).toEqual({
      display: "标题",
      target: "path/to/Doc.md",
    });
  });

  it("uses a document-name fallback for display text", () => {
    expect(parseWikiLinkInner("folder/Project Brief.docx")).toEqual({
      display: "Project Brief",
      target: "folder/Project Brief.docx",
    });
  });

  it("ignores escaped wiki links", () => {
    expect(findWikiLinkTokensInText(String.raw`\[[Doc]] and [[Real]]`)).toMatchObject([
      {
        display: "Real",
        raw: "[[Real]]",
        target: "Real",
      },
    ]);
  });

  it("ignores wiki links inside code spans and fenced code blocks", () => {
    const markdown = [
      "See [[Real]].",
      "`[[Inline Code]]`",
      "```",
      "[[Fenced Code]]",
      "```",
    ].join("\n");

    expect(findWikiLinkTokensInMarkdown(markdown).map((token) => token.target)).toEqual([
      "Real",
    ]);
  });

  it("keeps an even number of backslashes as an unescaped wiki link", () => {
    expect(findWikiLinkTokensInText(String.raw`\\[[Doc]]`)).toMatchObject([
      {
        display: "Doc",
        from: 2,
        raw: "[[Doc]]",
        target: "Doc",
      },
    ]);
  });

  it("returns the full token range for boundary deletion", () => {
    const [token] = findWikiLinkTokensInText("A [[Doc]] B");

    expect(token).toBeDefined();
    expect(
      getWikiLinkTokenDeleteRange([token!], { from: token!.to, to: token!.to }, "Backspace"),
    ).toEqual({ from: token!.from, to: token!.to });
    expect(
      getWikiLinkTokenDeleteRange([token!], { from: token!.from, to: token!.from }, "Delete"),
    ).toEqual({ from: token!.from, to: token!.to });
  });

  it("expands selected ranges that touch a token", () => {
    const [token] = findWikiLinkTokensInText("A [[Doc]] B");

    expect(
      getWikiLinkTokenDeleteRange(
        [token!],
        { from: token!.from + 2, to: token!.to - 2 },
        "Backspace",
      ),
    ).toEqual({ from: token!.from, to: token!.to });
  });
});
