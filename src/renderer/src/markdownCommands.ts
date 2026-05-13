import type { TyporaParagraphCommand } from "./editorCommands";
import { createMarkdownAlert } from "./markdownAlerts";
import { createTableOfContentsMarkdown } from "./markdownStructure";

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
      return "";
  }
}
