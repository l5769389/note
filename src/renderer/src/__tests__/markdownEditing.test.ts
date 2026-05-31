import { describe, expect, it } from "vitest";
import {
  createClearInlineStyleEdit,
  createDeleteSelectionOrLineEdit,
  createMarkdownImageEdit,
  createMoveSelectedLinesEdit,
  createRemoveMarkdownLinkEdit,
  createWrappedSelectionEdit,
  findMarkdownLinkInRange,
  getLineColumnAtOffset,
  getSelectedLineRange,
  type SelectedTextRange,
} from "../markdownEditing";

function selectedLineRange(
  content: string,
  selectionStart: number,
  selectionEnd = selectionStart,
): SelectedTextRange {
  const lineStart = content.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextLineBreak = content.indexOf("\n", selectionEnd);
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;

  return {
    content,
    lineEnd,
    lineStart,
    selectionEnd,
    selectionStart,
  };
}

describe("markdown editing helpers", () => {
  it("gets line/column positions and selected line ranges", () => {
    expect(getLineColumnAtOffset("a\nbc", 3)).toEqual({
      column: 1,
      lineIndex: 1,
    });
    expect(getSelectedLineRange("a\nbc\nd", 2, 3)).toEqual({
      content: "a\nbc\nd",
      lineEnd: 5,
      lineStart: 2,
      selectionEnd: 3,
      selectionStart: 2,
    });
  });

  it("wraps selected text for format commands", () => {
    expect(createWrappedSelectionEdit("hello", 0, 5, "**", "**", "加粗文本")).toEqual({
      content: "**hello**",
      selectionEnd: 7,
      selectionStart: 2,
    });

    expect(createWrappedSelectionEdit("hello", 5, 5, "`", "`", "code")).toEqual({
      content: "hello`code`",
      selectionEnd: 10,
      selectionStart: 6,
    });
  });

  it("clears common inline markdown styles in the selected range", () => {
    expect(
      createClearInlineStyleEdit(selectedLineRange("**bold** and `code`", 0, 19)),
    ).toEqual({
      content: "bold and code",
      selectionEnd: 13,
      selectionStart: 0,
    });
  });

  it("finds and removes markdown links touched by the cursor", () => {
    const content = "open [docs](https://example.com) now";
    const link = findMarkdownLinkInRange(selectedLineRange(content, 8));

    expect(link).toEqual({
      from: 5,
      href: "https://example.com",
      text: "docs",
      to: 32,
    });
    expect(createRemoveMarkdownLinkEdit(content, link!)).toEqual({
      content: "open docs now",
      selectionEnd: 9,
      selectionStart: 5,
    });
  });

  it("patches image alignment metadata for source-mode image commands", () => {
    const content = "![logo](logo.png)";

    expect(
      createMarkdownImageEdit(selectedLineRange(content, 3), { align: "center" }),
    ).toEqual({
      content: '![logo](logo.png "align=center")',
      selectionEnd: 32,
      selectionStart: 32,
    });
  });

  it("resets image width metadata while preserving title and alignment", () => {
    const content = '![logo](logo.png "Logo width=320 align=right")';

    expect(
      createMarkdownImageEdit(selectedLineRange(content, 3), { resetWidth: true }),
    ).toEqual({
      content: '![logo](logo.png "Logo align=right")',
      selectionEnd: 36,
      selectionStart: 36,
    });
    expect(
      createMarkdownImageEdit(selectedLineRange("plain text", 0), {
        align: "center",
      }),
    ).toBeNull();
  });

  it("moves selected lines up and down", () => {
    expect(
      createMoveSelectedLinesEdit(getSelectedLineRange("a\nb\nc", 2, 2), "up"),
    ).toEqual({
      content: "b\na\nc",
      selectionEnd: 2,
      selectionStart: 0,
    });
    expect(
      createMoveSelectedLinesEdit(getSelectedLineRange("a\nb\nc", 0, 0), "down"),
    ).toEqual({
      content: "b\na\nc",
      selectionEnd: 4,
      selectionStart: 2,
    });
    expect(
      createMoveSelectedLinesEdit(getSelectedLineRange("a\nb\nc", 0, 0), "up"),
    ).toBeNull();
  });

  it("deletes selected text or the current line", () => {
    expect(createDeleteSelectionOrLineEdit(getSelectedLineRange("abc", 1, 2))).toEqual({
      content: "ac",
      selectionEnd: 1,
      selectionStart: 1,
    });
    expect(
      createDeleteSelectionOrLineEdit(getSelectedLineRange("a\nb\nc", 2, 2)),
    ).toEqual({
      content: "a\nc",
      selectionEnd: 2,
      selectionStart: 2,
    });
  });
});
