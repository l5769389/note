import { describe, expect, it } from "vitest";
import { normalizeMarkdownHtmlBreaks } from "../markdownBreaks";

describe("normalizeMarkdownHtmlBreaks", () => {
  it("turns standalone html breaks into blank markdown lines", () => {
    expect(normalizeMarkdownHtmlBreaks("第一行\n<br />\n第二行")).toBe(
      "第一行\n\n第二行",
    );
  });

  it("turns inline html breaks into normal markdown newlines", () => {
    expect(normalizeMarkdownHtmlBreaks("第一行<br>第二行<br />第三行")).toBe(
      "第一行\n第二行\n第三行",
    );
  });

  it("keeps html breaks inside fenced code blocks", () => {
    const markdown = ["```html", "<br />", "```", "<br />", "正文"].join("\n");

    expect(normalizeMarkdownHtmlBreaks(markdown)).toBe(
      ["```html", "<br />", "```", "", "正文"].join("\n"),
    );
  });
});
