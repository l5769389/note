import { describe, expect, it } from "vitest";
import { createParagraphCommandMarkdown } from "../markdownCommands";

describe("createParagraphCommandMarkdown", () => {
  it("creates markdown for heading and paragraph commands", () => {
    expect(createParagraphCommandMarkdown({ type: "heading", level: 2 })).toBe(
      "## ",
    );
    expect(createParagraphCommandMarkdown({ type: "paragraph" })).toBe("\n");
  });

  it("creates markdown for block and list commands", () => {
    expect(createParagraphCommandMarkdown({ type: "codeBlock" })).toBe(
      "\n```\n\n```\n",
    );
    expect(createParagraphCommandMarkdown({ type: "mathBlock" })).toBe(
      "\n$$\n\n$$\n",
    );
    expect(createParagraphCommandMarkdown({ type: "blockquote" })).toBe("> ");
    expect(createParagraphCommandMarkdown({ type: "orderedList" })).toBe("1. ");
    expect(createParagraphCommandMarkdown({ type: "bulletList" })).toBe("- ");
    expect(createParagraphCommandMarkdown({ type: "taskList" })).toBe("- [ ] ");
  });

  it("creates markdown for alert commands", () => {
    expect(createParagraphCommandMarkdown({ type: "alert", kind: "warning" })).toBe(
      "\n> [!WARNING]\n>\n> 警告内容\n",
    );
  });

  it("creates a table of contents from the current markdown", () => {
    expect(
      createParagraphCommandMarkdown(
        { type: "toc" },
        "# A\n\n## B\n\n### [C](https://example.com)\n",
      ),
    ).toBe("\n- A\n  - B\n    - C\n");
  });

  it("returns an empty insertion for commands that need editor context", () => {
    expect(createParagraphCommandMarkdown({ type: "promoteHeading" })).toBe("");
    expect(createParagraphCommandMarkdown({ type: "demoteHeading" })).toBe("");
    expect(createParagraphCommandMarkdown({ type: "indentList" })).toBe("");
    expect(createParagraphCommandMarkdown({ type: "outdentList" })).toBe("");
  });
});
