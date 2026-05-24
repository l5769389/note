import type {
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "./editorCommands";
import {
  createParagraphCommandMarkdown,
  updateMarkdownTaskStatus,
} from "./markdownCommands";
import {
  createClearInlineStyleEdit,
  createDeleteSelectionOrLineEdit,
  createMarkdownImageEdit,
  createMoveSelectedLinesEdit,
  createRemoveMarkdownLinkEdit,
  createWrappedSelectionEdit,
  findMarkdownLinkInRange,
  getSelectedLineRange,
  type MarkdownLinkRange,
  type TextEditResult,
} from "./markdownEditing";

export type SourceFormatWrap = {
  placeholder: string;
  prefix: string;
  suffix: string;
};

export type SourceParagraphCommandAction =
  | { action: "edit"; edit: TextEditResult }
  | { action: "insert"; markdown: string }
  | { action: "none" };

export type SourceTextareaContextMenuInfo = {
  isListItem: boolean;
  isTaskListItem: boolean;
  linkHref?: string;
  taskChecked?: boolean;
};

const markdownTaskListLinePattern = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+\[([ xX])\][ \t]*/;
const markdownListLinePattern = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/;

export function getSourceFormatWrap(
  command: TyporaFormatCommand,
): SourceFormatWrap | null {
  switch (command.type) {
    case "bold":
      return { placeholder: "加粗文本", prefix: "**", suffix: "**" };
    case "italic":
      return { placeholder: "斜体文本", prefix: "*", suffix: "*" };
    case "underline":
      return { placeholder: "下划线文本", prefix: "<u>", suffix: "</u>" };
    case "inlineCode":
      return { placeholder: "code", prefix: "`", suffix: "`" };
    case "strikethrough":
      return { placeholder: "删除线文本", prefix: "~~", suffix: "~~" };
    case "comment":
      return { placeholder: "注释", prefix: "<!-- ", suffix: " -->" };
    case "link":
      return {
        placeholder: "链接文本",
        prefix: "[",
        suffix: `](${command.href.trim() || "https://"})`,
      };
    default:
      return null;
  }
}

export function createSourceFormatCommandEdit({
  command,
  content,
  selectionEnd,
  selectionStart,
}: {
  command: TyporaFormatCommand;
  content: string;
  selectionEnd: number;
  selectionStart: number;
}): TextEditResult | null {
  const range = getSelectedLineRange(content, selectionStart, selectionEnd);
  const wrap = getSourceFormatWrap(command);

  if (wrap) {
    return createWrappedSelectionEdit(
      content,
      selectionStart,
      selectionEnd,
      wrap.prefix,
      wrap.suffix,
      wrap.placeholder,
    );
  }

  switch (command.type) {
    case "clearStyle":
      return createClearInlineStyleEdit(range);
    case "removeLink": {
      const link = findMarkdownLinkInRange(range);
      return link ? createRemoveMarkdownLinkEdit(content, link) : null;
    }
    case "imageAlign":
    case "imageResetSize":
      return createMarkdownImageEdit(range, {
        align: command.type === "imageAlign" ? command.align : undefined,
        resetWidth: command.type === "imageResetSize",
      });
    case "copyLink":
    case "openLink":
      return null;
  }

  return null;
}

export function createSourceEditCommandEdit({
  command,
  content,
  selectionEnd,
  selectionStart,
}: {
  command: TyporaEditCommand;
  content: string;
  selectionEnd: number;
  selectionStart: number;
}): TextEditResult | null {
  const range = getSelectedLineRange(content, selectionStart, selectionEnd);

  switch (command) {
    case "moveLineUp":
      return createMoveSelectedLinesEdit(range, "up");
    case "moveLineDown":
      return createMoveSelectedLinesEdit(range, "down");
    case "delete":
      return createDeleteSelectionOrLineEdit(range);
    case "copy":
    case "cut":
    case "paste":
    case "redo":
    case "undo":
      return null;
  }
}

export function createSourceParagraphCommandAction({
  command,
  content,
  selectionEnd,
  selectionStart,
}: {
  command: TyporaParagraphCommand;
  content: string;
  selectionEnd: number | undefined;
  selectionStart: number | undefined;
}): SourceParagraphCommandAction {
  if (command.type === "taskStatus") {
    if (selectionStart === undefined || selectionEnd === undefined) {
      return { action: "none" };
    }

    const result = updateMarkdownTaskStatus(
      content,
      selectionStart,
      selectionEnd,
      command.status,
    );

    if (!result) {
      return { action: "none" };
    }

    return {
      action: "edit",
      edit: {
        content: result.markdown,
        selectionEnd: result.selectionEnd,
        selectionStart: result.selectionStart,
      },
    };
  }

  const markdown = createParagraphCommandMarkdown(command, content);

  return markdown ? { action: "insert", markdown } : { action: "none" };
}

export function getSourceTextareaContextMenuInfo({
  content,
  selectionEnd,
  selectionStart,
}: {
  content: string;
  selectionEnd: number;
  selectionStart: number;
}): SourceTextareaContextMenuInfo {
  const range = getSelectedLineRange(content, selectionStart, selectionEnd);
  const line = range.content.slice(range.lineStart, range.lineEnd);
  const taskMatch = line.match(markdownTaskListLinePattern);
  const link = findMarkdownLinkInRange(range);

  return {
    isListItem: markdownListLinePattern.test(line),
    isTaskListItem: Boolean(taskMatch),
    linkHref: link?.href,
    taskChecked: taskMatch ? taskMatch[1]?.toLowerCase() === "x" : undefined,
  };
}

export function findSourceFormatCommandLink({
  content,
  selectionEnd,
  selectionStart,
}: {
  content: string;
  selectionEnd: number;
  selectionStart: number;
}): MarkdownLinkRange | null {
  return findMarkdownLinkInRange(
    getSelectedLineRange(content, selectionStart, selectionEnd),
  );
}
