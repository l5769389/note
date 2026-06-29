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

export type LineMoveDirection = "down" | "up";

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

export function getLineColumnAtOffset(content: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, content.length));
  const before = content.slice(0, safeOffset);
  const lines = before.split("\n");

  return {
    column: lines.at(-1)?.length ?? 0,
    lineIndex: lines.length - 1,
  };
}

export function getSelectedLineRange(
  content: string,
  selectionStart: number,
  selectionEnd: number,
): SelectedTextRange {
  const lineStart = content.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
  const rawLineEnd = content.indexOf("\n", selectionEnd);
  const lineEnd =
    rawLineEnd < 0 ? content.length : Math.min(rawLineEnd + 1, content.length);

  return { content, lineEnd, lineStart, selectionEnd, selectionStart };
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

export function createMoveSelectedLinesEdit(
  range: SelectedTextRange,
  direction: LineMoveDirection,
): TextEditResult | null {
  const selectedText = range.content.slice(range.lineStart, range.lineEnd);

  if (direction === "up") {
    if (range.lineStart === 0) {
      return null;
    }

    const previousLineStart = range.content.lastIndexOf("\n", range.lineStart - 2) + 1;
    const previousText = range.content.slice(previousLineStart, range.lineStart);

    return {
      content:
        range.content.slice(0, previousLineStart) +
        selectedText +
        previousText +
        range.content.slice(range.lineEnd),
      selectionEnd: previousLineStart + selectedText.length,
      selectionStart: previousLineStart,
    };
  }

  if (range.lineEnd >= range.content.length) {
    return null;
  }

  const nextLineEndIndex = range.content.indexOf("\n", range.lineEnd);
  const nextLineEnd =
    nextLineEndIndex < 0
      ? range.content.length
      : Math.min(nextLineEndIndex + 1, range.content.length);
  const nextText = range.content.slice(range.lineEnd, nextLineEnd);

  return {
    content:
      range.content.slice(0, range.lineStart) +
      nextText +
      selectedText +
      range.content.slice(nextLineEnd),
    selectionEnd: range.lineStart + nextText.length + selectedText.length,
    selectionStart: range.lineStart + nextText.length,
  };
}

export function createDeleteSelectionOrLineEdit(
  range: SelectedTextRange,
): TextEditResult {
  if (range.selectionStart !== range.selectionEnd) {
    return {
      content:
        range.content.slice(0, range.selectionStart) +
        range.content.slice(range.selectionEnd),
      selectionEnd: range.selectionStart,
      selectionStart: range.selectionStart,
    };
  }

  return {
    content:
      range.content.slice(0, range.lineStart) +
      range.content.slice(range.lineEnd),
    selectionEnd: range.lineStart,
    selectionStart: range.lineStart,
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
  const hasExplicitAlign = patch.align !== undefined
    ? true
    : meta.hasExplicitAlign;

  return serializeImageMeta({
    ...meta,
    align: patch.align ?? meta.align,
    hasExplicitAlign,
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
