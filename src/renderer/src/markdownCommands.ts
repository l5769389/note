import type { TaskStatusCommand, TyporaParagraphCommand } from "./editorCommands";
import { createMarkdownAlert } from "./markdownAlerts";
import { createTableOfContentsMarkdown } from "./markdownStructure";

const taskListLinePattern = /^([ \t]*(?:[-+*]|\d+[.)])[ \t]+\[)([ xX])(\][ \t]*)/gm;

function getTaskStatusMarker(currentMarker: string, status: TaskStatusCommand) {
  switch (status) {
    case "completed":
      return "x";
    case "incomplete":
      return " ";
    case "toggle":
      return currentMarker.toLowerCase() === "x" ? " " : "x";
  }
}

export function updateMarkdownTaskStatus(
  markdown: string,
  selectionStart: number,
  selectionEnd: number,
  status: TaskStatusCommand,
) {
  const normalizedStart = Math.min(selectionStart, selectionEnd);
  const normalizedEnd = Math.max(selectionStart, selectionEnd);
  const lineStart =
    markdown.lastIndexOf("\n", Math.max(normalizedStart - 1, 0)) + 1;
  const lineEndSearchIndex =
    normalizedEnd > normalizedStart ? Math.max(normalizedEnd - 1, normalizedStart) : normalizedEnd;
  const rawLineEnd = markdown.indexOf("\n", lineEndSearchIndex);
  const lineEnd = rawLineEnd < 0 ? markdown.length : rawLineEnd;
  const selectedLines = markdown.slice(lineStart, lineEnd);
  let changed = false;
  const nextLines = selectedLines.replace(
    taskListLinePattern,
    (_match, prefix: string, marker: string, suffix: string) => {
      const nextMarker = getTaskStatusMarker(marker, status);

      if (nextMarker !== marker) {
        changed = true;
      }

      return `${prefix}${nextMarker}${suffix}`;
    },
  );

  if (!changed) {
    return null;
  }

  return {
    markdown: `${markdown.slice(0, lineStart)}${nextLines}${markdown.slice(lineEnd)}`,
    selectionEnd: normalizedStart + (normalizedEnd - normalizedStart),
    selectionStart: normalizedStart,
  };
}

export function createParagraphCommandMarkdown(
  command: TyporaParagraphCommand,
  currentMarkdown = "",
) {
  switch (command.type) {
    case "heading":
      return `${"#".repeat(command.level)} `;
    case "paragraph":
      return "\n";
    case "mathBlock":
      return "\n$$\n\n$$\n";
    case "codeBlock":
      return "\n```\n\n```\n";
    case "blockquote":
      return "> ";
    case "orderedList":
      return "1. ";
    case "bulletList":
      return "- ";
    case "taskList":
      return "- [ ] ";
    case "alert":
      return createMarkdownAlert(command.kind);
    case "insertParagraphBefore":
    case "insertParagraphAfter":
      return "\n";
    case "horizontalRule":
      return "\n---\n";
    case "toc":
      return createTableOfContentsMarkdown(currentMarkdown);
    case "demoteHeading":
    case "indentList":
    case "outdentList":
    case "promoteHeading":
    case "taskStatus":
      return "";
  }
}
