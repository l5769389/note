export type ImageAlignment = "left" | "center" | "right";

export type TyporaEditCommand =
  | "copy"
  | "cut"
  | "delete"
  | "moveLineDown"
  | "moveLineUp"
  | "paste"
  | "redo"
  | "undo";

export type TyporaAlertKind = "caution" | "important" | "note" | "tip" | "warning";

export type TyporaFormatCommand =
  | { type: "bold" }
  | { type: "clearStyle" }
  | { type: "comment" }
  | { type: "copyLink" }
  | { type: "imageAlign"; align: ImageAlignment }
  | { type: "imageResetSize" }
  | { type: "inlineCode" }
  | { type: "italic" }
  | { type: "link"; href: string }
  | { type: "openLink" }
  | { type: "removeLink" }
  | { type: "strikethrough" }
  | { type: "underline" };

export type TyporaParagraphCommand =
  | { type: "alert"; kind: TyporaAlertKind }
  | { type: "blockquote" }
  | { type: "bulletList" }
  | { type: "codeBlock" }
  | { type: "demoteHeading" }
  | { type: "heading"; level: number }
  | { type: "horizontalRule" }
  | { type: "indentList" }
  | { type: "insertParagraphAfter" }
  | { type: "insertParagraphBefore" }
  | { type: "mathBlock" }
  | { type: "orderedList" }
  | { type: "outdentList" }
  | { type: "paragraph" }
  | { type: "promoteHeading" }
  | { type: "taskList" }
  | { type: "toc" };
