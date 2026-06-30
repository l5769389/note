import { describe, expect, it } from "vitest";
import {
  createSourceEditCommandEdit,
  createSourceFormatCommandEdit,
  createSourceParagraphCommandAction,
  findSourceFormatCommandLink,
  getSourceFormatWrap,
  getSourceTextareaContextMenuInfo,
} from "../sourceEditorCommands";

describe("source editor command helpers", () => {
  it("maps wrapping format commands to markdown delimiters", () => {
    expect(getSourceFormatWrap({ type: "bold" })).toEqual({
      placeholder: "加粗文本",
      prefix: "**",
      suffix: "**",
    });
    expect(getSourceFormatWrap({ type: "inlineCode" })).toEqual({
      placeholder: "code",
      prefix: "`",
      suffix: "`",
    });
    expect(getSourceFormatWrap({ href: "", type: "link" })?.suffix).toBe(
      "](https://)",
    );
  });

  it("creates text edits for source format commands", () => {
    expect(
      createSourceFormatCommandEdit({
        command: { type: "italic" },
        content: "hello",
        selectionEnd: 5,
        selectionStart: 0,
      }),
    ).toEqual({
      content: "*hello*",
      selectionEnd: 6,
      selectionStart: 1,
    });
    expect(
      createSourceFormatCommandEdit({
        command: { type: "clearStyle" },
        content: "**hello**",
        selectionEnd: 9,
        selectionStart: 0,
      }),
    ).toEqual({
      content: "hello",
      selectionEnd: 5,
      selectionStart: 0,
    });
  });

  it("finds and edits links and images near the selection", () => {
    expect(
      findSourceFormatCommandLink({
        content: "[docs](https://example.com)",
        selectionEnd: 2,
        selectionStart: 2,
      })?.href,
    ).toBe("https://example.com");

    expect(
      createSourceFormatCommandEdit({
        command: { type: "removeLink" },
        content: "[docs](https://example.com)",
        selectionEnd: 2,
        selectionStart: 2,
      }),
    ).toEqual({
      content: "docs",
      selectionEnd: 4,
      selectionStart: 0,
    });

    const imageEdit = createSourceFormatCommandEdit({
        command: { align: "right", type: "imageAlign" },
        content: "![logo](logo.png)",
        selectionEnd: 3,
        selectionStart: 3,
      });

    expect(imageEdit?.content).toBe('![logo](logo.png "align=right")');

    expect(
      createSourceFormatCommandEdit({
        command: { fit: "cover", type: "imageFit" },
        content: '![logo](logo.png "Logo align=center")',
        selectionEnd: 3,
        selectionStart: 3,
      })?.content,
    ).toBe('![logo](logo.png "Logo align=center fit=cover")');

    expect(
      createSourceFormatCommandEdit({
        command: { type: "imageResetSize" },
        content: '![logo](logo.png "Logo width=400 align=center")',
        selectionEnd: 3,
        selectionStart: 3,
      })?.content,
    ).toBe('![logo](logo.png "Logo align=center")');
  });

  it("creates text edits for source edit commands", () => {
    expect(
      createSourceEditCommandEdit({
        command: "moveLineDown",
        content: "a\nb\nc",
        selectionEnd: 0,
        selectionStart: 0,
      }),
    ).toEqual({
      content: "b\na\nc",
      selectionEnd: 4,
      selectionStart: 2,
    });
    expect(
      createSourceEditCommandEdit({
        command: "delete",
        content: "a\nb",
        selectionEnd: 2,
        selectionStart: 2,
      }),
    ).toEqual({
      content: "a\n",
      selectionEnd: 2,
      selectionStart: 2,
    });
    expect(
      createSourceEditCommandEdit({
        command: "copy",
        content: "a",
        selectionEnd: 1,
        selectionStart: 0,
      }),
    ).toBeNull();
  });

  it("creates source paragraph insert actions", () => {
    expect(
      createSourceParagraphCommandAction({
        command: { type: "heading", level: 3 },
        content: "",
        selectionEnd: undefined,
        selectionStart: undefined,
      }),
    ).toEqual({ action: "insert", markdown: "### " });

    expect(
      createSourceParagraphCommandAction({
        command: { type: "toc" },
        content: "# A\n\n## B\n",
        selectionEnd: undefined,
        selectionStart: undefined,
      }),
    ).toEqual({ action: "insert", markdown: "\n- A\n  - B\n" });

    expect(
      createSourceParagraphCommandAction({
        command: { type: "horizontalRule" },
        content: "",
        selectionEnd: undefined,
        selectionStart: undefined,
      }),
    ).toEqual({ action: "insert", markdown: "\n---\n" });

    expect(
      createSourceParagraphCommandAction({
        command: { type: "indentList" },
        content: "- item",
        selectionEnd: undefined,
        selectionStart: undefined,
      }),
    ).toEqual({ action: "none" });
  });

  it("creates source paragraph task status edit actions", () => {
    expect(
      createSourceParagraphCommandAction({
        command: { status: "toggle", type: "taskStatus" },
        content: "- [ ] A\n- [x] B",
        selectionEnd: 2,
        selectionStart: 2,
      }),
    ).toEqual({
      action: "edit",
      edit: {
        content: "- [x] A\n- [x] B",
        selectionEnd: 2,
        selectionStart: 2,
      },
    });

    expect(
      createSourceParagraphCommandAction({
        command: { status: "completed", type: "taskStatus" },
        content: "- item",
        selectionEnd: 0,
        selectionStart: 0,
      }),
    ).toEqual({ action: "none" });

    expect(
      createSourceParagraphCommandAction({
        command: { status: "completed", type: "taskStatus" },
        content: "- [ ] A",
        selectionEnd: undefined,
        selectionStart: undefined,
      }),
    ).toEqual({ action: "none" });
  });

  it("detects textarea context menu state from the current source line", () => {
    expect(
      getSourceTextareaContextMenuInfo({
        content: "- [x] Done\nplain",
        selectionEnd: 3,
        selectionStart: 3,
      }),
    ).toEqual({
      isListItem: true,
      isTaskListItem: true,
      linkHref: undefined,
      taskChecked: true,
    });

    expect(
      getSourceTextareaContextMenuInfo({
        content: "[docs](https://example.com)",
        selectionEnd: 2,
        selectionStart: 2,
      }),
    ).toEqual({
      isListItem: false,
      isTaskListItem: false,
      linkHref: "https://example.com",
      taskChecked: undefined,
    });
  });
});
