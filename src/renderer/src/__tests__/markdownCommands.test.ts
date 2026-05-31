import { describe, expect, it } from "vitest";
import {
  createMarkdownTable,
  createParagraphCommandMarkdown,
  updateMarkdownTaskStatus,
} from "../markdownCommands";

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
    expect(createParagraphCommandMarkdown({ type: "horizontalRule" })).toBe(
      "\n---\n",
    );
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
    expect(
      createParagraphCommandMarkdown({
        type: "taskStatus",
        status: "toggle",
      }),
    ).toBe("");
  });
});

describe("updateMarkdownTaskStatus", () => {
  it("toggles task items on the current line", () => {
    const result = updateMarkdownTaskStatus("- [ ] A\n- [x] B", 2, 2, "toggle");

    expect(result?.markdown).toBe("- [x] A\n- [x] B");
  });

  it("marks selected task lines as completed or incomplete", () => {
    const markdown = "- [ ] A\n- [x] B\n- [ ] C";

    expect(updateMarkdownTaskStatus(markdown, 0, markdown.length, "completed")?.markdown).toBe(
      "- [x] A\n- [x] B\n- [x] C",
    );
    expect(updateMarkdownTaskStatus(markdown, 0, markdown.length, "incomplete")?.markdown).toBe(
      "- [ ] A\n- [ ] B\n- [ ] C",
    );
  });

  it("leaves non-task lines unchanged", () => {
    expect(updateMarkdownTaskStatus("- A\nplain", 0, 0, "completed")).toBeNull();
  });
});

describe("createMarkdownTable", () => {
  it("creates markdown tables with clamped dimensions", () => {
    expect(createMarkdownTable({ columns: 2, rows: 3 })).toBe(
      "\n|   |   |\n| --- | --- |\n|   |   |\n|   |   |\n",
    );
    expect(createMarkdownTable({ columns: 0, rows: 0 })).toBe(
      "\n|   |\n| --- |\n",
    );
  });
});
