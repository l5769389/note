import type { TyporaAlertKind } from "./editorCommands";

export type MarkdownAlertType =
  | "CAUTION"
  | "IMPORTANT"
  | "NOTE"
  | "TIP"
  | "WARNING";

export type MarkdownAlertMeta = {
  contentLabel: string;
  kind: TyporaAlertKind;
  markdownType: MarkdownAlertType;
  title: string;
};

export const markdownAlertOptions: MarkdownAlertMeta[] = [
  {
    contentLabel: "提醒内容",
    kind: "note",
    markdownType: "NOTE",
    title: "提醒",
  },
  {
    contentLabel: "建议内容",
    kind: "tip",
    markdownType: "TIP",
    title: "建议",
  },
  {
    contentLabel: "重要内容",
    kind: "important",
    markdownType: "IMPORTANT",
    title: "重要",
  },
  {
    contentLabel: "警告内容",
    kind: "warning",
    markdownType: "WARNING",
    title: "警告",
  },
  {
    contentLabel: "注意内容",
    kind: "caution",
    markdownType: "CAUTION",
    title: "注意",
  },
];

export const markdownAlertByKind = Object.fromEntries(
  markdownAlertOptions.map((option) => [option.kind, option]),
) as Record<TyporaAlertKind, MarkdownAlertMeta>;

export const markdownAlertByType = Object.fromEntries(
  markdownAlertOptions.map((option) => [option.markdownType, option]),
) as Record<MarkdownAlertType, MarkdownAlertMeta>;

const alertMarkerPattern = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const alertMarkerPrefixPattern =
  /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

export function createMarkdownAlert(kind: TyporaAlertKind) {
  const alert = markdownAlertByKind[kind] ?? markdownAlertByKind.note;

  return `\n> [!${alert.markdownType}]\n>\n> ${alert.contentLabel}\n`;
}

export function getMarkdownAlertByMarker(text: string) {
  const match = text.match(alertMarkerPattern);

  if (!match) {
    return null;
  }

  return markdownAlertByType[match[1].toUpperCase() as MarkdownAlertType] ?? null;
}

export function getMarkdownAlertByPrefix(text: string) {
  const match = text.match(alertMarkerPrefixPattern);

  if (!match) {
    return null;
  }

  return markdownAlertByType[match[1].toUpperCase() as MarkdownAlertType] ?? null;
}

export function stripMarkdownAlertMarker(text: string) {
  return text.replace(alertMarkerPrefixPattern, "");
}
