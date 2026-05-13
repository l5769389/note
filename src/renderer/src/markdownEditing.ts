import type { ImageAlignment } from "./editorCommands";
import { parseImageMeta, serializeImageMeta } from "./imageMeta";

export type TextEditResult = {
  content: string;
  selectionEnd: number;
  selectionStart: number;
};

export type SelectedTextRange = {
  content: string;
  lineEnd: number;
  lineStart: number;
  selectionEnd: number;
  selectionStart: number;
};

export type MarkdownLinkRange = {
  from: number;
  href: string;
  text: string;
  to: number;
};

function selectionTouchesRange(
  selectionStart: number,
  selectionEnd: number,
  from: number,
  to: number,
) {
  return selectionStart === selectionEnd
    ? selectionStart >= from && selectionStart <= to
    : selectionStart < to && selectionEnd > from;
}

export function createWrappedSelectionEdit(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  placeholder: string,
): TextEditResult {
  const selectedText = content.slice(selectionStart, selectionEnd);
  const body = selectedText || placeholder;
  const insertion = `${prefix}${body}${suffix}`;
  const nextSelectionStart = selectionStart + prefix.length;

  return {
    content: `${content.slice(0, selectionStart)}${insertion}${content.slice(selectionEnd)}`,
    selectionEnd: nextSelectionStart + body.length,
    selectionStart: nextSelectionStart,
  };
}

export function stripInlineMarkdownStyle(value: string) {
  return value
    .replace(/<!--\s*([\s\S]*?)\s*-->/g, "$1")
    .replace(/<u>([\s\S]*?)<\/u>/gi, "$1")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

export function createClearInlineStyleEdit(range: SelectedTextRange): TextEditResult {
  const from =
    range.selectionStart === range.selectionEnd
      ? range.lineStart
      : range.selectionStart;
  const to =
    range.selectionStart === range.selectionEnd ? range.lineEnd : range.selectionEnd;
  const cleanedText = stripInlineMarkdownStyle(range.content.slice(from, to));

  return {
    content: `${range.content.slice(0, from)}${cleanedText}${range.content.slice(to)}`,
    selectionEnd: from + cleanedText.length,
    selectionStart: from,
  };
}

export function findMarkdownLinkInRange(range: SelectedTextRange): MarkdownLinkRange | null {
  const line = range.content.slice(range.lineStart, range.lineEnd);
  const linkPattern = /\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(line))) {
    const from = range.lineStart + match.index;
    const to = from + match[0].length;

    if (
      selectionTouchesRange(range.selectionStart, range.selectionEnd, from, to)
    ) {
      return {
        from,
        href: match[2],
        text: match[1],
        to,
      };
    }
  }

  return null;
}

export function createRemoveMarkdownLinkEdit(
  content: string,
  link: MarkdownLinkRange,
): TextEditResult {
  return {
    content: `${content.slice(0, link.from)}${link.text}${content.slice(link.to)}`,
    selectionEnd: link.from + link.text.length,
    selectionStart: link.from,
  };
}

export function patchMarkdownImageTitle(
  title: string | undefined,
  patch: { align?: ImageAlignment; resetWidth?: boolean },
) {
  const meta = parseImageMeta(title);

  return serializeImageMeta({
    ...meta,
    align: patch.align ?? meta.align,
    width: patch.resetWidth ? undefined : meta.width,
  });
}

export function createMarkdownImageEdit(
  range: SelectedTextRange,
  patch: { align?: ImageAlignment; resetWidth?: boolean },
): TextEditResult | null {
  const line = range.content.slice(range.lineStart, range.lineEnd);
  const imagePattern = /!\[([^\]]*)]\((\S+?)(?:\s+"([^"]*)")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(line))) {
    const from = range.lineStart + match.index;
    const to = from + match[0].length;

    if (
      !selectionTouchesRange(range.selectionStart, range.selectionEnd, from, to)
    ) {
      continue;
    }

    const nextTitle = patchMarkdownImageTitle(match[3], patch);
    const nextImage = `![${match[1]}](${match[2]}${nextTitle ? ` "${nextTitle}"` : ""})`;
    const cursor = from + nextImage.length;

    return {
      content: `${range.content.slice(0, from)}${nextImage}${range.content.slice(to)}`,
      selectionEnd: cursor,
      selectionStart: cursor,
    };
  }

  return null;
}
