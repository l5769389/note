import { describe, expect, it } from "vitest";
import {
  countMarkdownWords,
  createTableOfContentsMarkdown,
  getMarkdownHeadingAtLine,
  getMarkdownOutline,
  normalizeMarkdownHeadingTitle,
} from "../markdownStructure";

describe("markdown structure helpers", () => {
  it("normalizes formatted heading text for outline display", () => {
    expect(normalizeMarkdownHeadingTitle("**[Roadmap](./roadmap.md)** `v1`")).toBe(
      "Roadmap v1",
    );
  });

  it("builds an outline with stable line-based ids", () => {
    expect(getMarkdownOutline("# Title\n\n### Details\nplain\n## Next")).toEqual([
      {
        id: "0-Title",
        level: 1,
        lineIndex: 0,
        title: "Title",
      },
      {
        id: "2-Details",
        level: 3,
        lineIndex: 2,
        title: "Details",
      },
      {
        id: "4-Next",
        level: 2,
        lineIndex: 4,
        title: "Next",
      },
    ]);
  });

  it("creates table-of-contents markdown relative to the shallowest heading", () => {
    expect(createTableOfContentsMarkdown("## A\n\n### B\n\n#### C")).toBe(
      "\n- A\n  - B\n    - C\n",
    );
    expect(createTableOfContentsMarkdown("plain text")).toBe("\n- \n");
  });

  it("reads the heading at a specific line", () => {
    expect(getMarkdownHeadingAtLine("plain\n### Current", 1)).toEqual({
      level: 3,
      title: "Current",
    });
    expect(getMarkdownHeadingAtLine("plain\n### Current", 0)).toBeNull();
  });

  it("counts CJK characters and latin words while ignoring fenced code and images", () => {
    expect(
      countMarkdownWords(
        "# Hello 世界\n\n```js\nignored words\n```\n![alt](image.png)\n[docs](x) and `code`",
      ),
    ).toBe(6);
  });
});
