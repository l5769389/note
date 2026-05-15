import {
  getDocumentDisplayName,
  getDocumentType,
} from "./documentModel";
import type { DocumentType, MarkdownDocument } from "./types";

export type MarkdownSearchMatch = {
  column: number;
  end: number;
  line: number;
  lineIndex: number;
  snippet: string;
  start: number;
};

export type WorkspaceSearchGroup = {
  document: MarkdownDocument;
  matches: MarkdownSearchMatch[];
};

type SearchIndexLine = {
  lineIndex: number;
  positions: number[];
  text: string;
};

function pushSearchText(
  text: string,
  sourceStart: number,
  target: string[],
  positions: number[],
) {
  for (let index = 0; index < text.length; index += 1) {
    target.push(text[index]);
    positions.push(sourceStart + index);
  }
}

function pushPlainMarkdownSearchText(
  text: string,
  sourceStart: number,
  target: string[],
  positions: number[],
) {
  const markerCharacters = new Set(["`", "*", "~", "$"]);

  for (let index = 0; index < text.length; index += 1) {
    if (markerCharacters.has(text[index])) {
      continue;
    }

    target.push(text[index]);
    positions.push(sourceStart + index);
  }
}

function getVisibleMarkdownLineStart(line: string) {
  let cursor = 0;

  while (cursor < line.length) {
    const rest = line.slice(cursor);
    const marker = rest.match(
      /^(?:\s{0,3}>\s?|\s{0,3}(?:[-+*]|\d+[.)])\s+|\s{0,3}#{1,6}\s+|\s{0,3}\[[ xX]\]\s+)/,
    );

    if (!marker) {
      break;
    }

    cursor += marker[0].length;
  }

  const alertMarker = line
    .slice(cursor)
    .match(/^\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);

  if (alertMarker) {
    cursor += alertMarker[0].length;
  }

  return cursor;
}

function getHtmlAttributeValue(source: string, attributeName: string) {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = source.match(pattern);

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function createMarkdownSearchLine(line: string, lineStartOffset: number) {
  const visible: string[] = [];
  const positions: number[] = [];
  const contentStart = getVisibleMarkdownLineStart(line);
  const content = line.slice(contentStart);
  const contentOffset = lineStartOffset + contentStart;
  const inlinePattern =
    /!\[([^\]]*)\]\(([^)]*)\)|\[([^\]]+)\]\(([^)]*)\)|<img\b[^>]*>|<[^>]+>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(content))) {
    if (match.index > cursor) {
      pushPlainMarkdownSearchText(
        content.slice(cursor, match.index),
        contentOffset + cursor,
        visible,
        positions,
      );
    }

    const token = match[0];

    if (token.startsWith("![")) {
      const altText = match[1] ?? "";
      const altStart = token.indexOf(altText);
      pushSearchText(
        altText,
        contentOffset + match.index + Math.max(0, altStart),
        visible,
        positions,
      );
    } else if (token.startsWith("[")) {
      const label = match[3] ?? "";
      const labelStart = token.indexOf(label);
      pushSearchText(
        label,
        contentOffset + match.index + Math.max(0, labelStart),
        visible,
        positions,
      );
    } else if (/^<img\b/i.test(token)) {
      const altText = getHtmlAttributeValue(token, "alt");
      const altStart = altText ? token.indexOf(altText) : -1;

      if (altText && altStart >= 0) {
        pushSearchText(
          altText,
          contentOffset + match.index + altStart,
          visible,
          positions,
        );
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < content.length) {
    pushPlainMarkdownSearchText(
      content.slice(cursor),
      contentOffset + cursor,
      visible,
      positions,
    );
  }

  return { positions, text: visible.join("") };
}

function createHtmlSearchLines(content: string): SearchIndexLine[] {
  const lines: SearchIndexLine[] = [];
  const visible: string[] = [];
  const positions: number[] = [];
  let cursor = 0;
  const tokenPattern = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(content))) {
    if (match.index > cursor) {
      pushSearchText(content.slice(cursor, match.index), cursor, visible, positions);
    }

    const token = match[0];

    if (/^<img\b/i.test(token)) {
      const altText = getHtmlAttributeValue(token, "alt");
      const altStart = altText ? token.indexOf(altText) : -1;

      if (altText && altStart >= 0) {
        pushSearchText(altText, match.index + altStart, visible, positions);
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < content.length) {
    pushSearchText(content.slice(cursor), cursor, visible, positions);
  }

  let lineText: string[] = [];
  let linePositions: number[] = [];
  let lineIndex = 0;

  visible.forEach((character, index) => {
    if (character === "\n") {
      if (lineText.join("").trim()) {
        lines.push({
          lineIndex,
          positions: linePositions,
          text: lineText.join(""),
        });
      }

      lineIndex += 1;
      lineText = [];
      linePositions = [];
      return;
    }

    lineText.push(character);
    linePositions.push(positions[index]);
  });

  if (lineText.join("").trim()) {
    lines.push({
      lineIndex,
      positions: linePositions,
      text: lineText.join(""),
    });
  }

  return lines;
}

function createMarkdownSearchLines(content: string): SearchIndexLine[] {
  const lines = content.split("\n");
  const searchLines: SearchIndexLine[] = [];
  let lineStartOffset = 0;
  let isFencedCode = false;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\r$/, "");
    const fenceMatch = line.match(/^\s*(```|~~~)/);

    if (fenceMatch) {
      isFencedCode = !isFencedCode;
      lineStartOffset += rawLine.length + (lineIndex < lines.length - 1 ? 1 : 0);
      return;
    }

    const searchLine = isFencedCode
      ? {
          positions: Array.from({ length: line.length }, (_, index) => lineStartOffset + index),
          text: line,
        }
      : createMarkdownSearchLine(line, lineStartOffset);

    if (searchLine.text.trim()) {
      searchLines.push({
        lineIndex,
        positions: searchLine.positions,
        text: searchLine.text,
      });
    }

    lineStartOffset += rawLine.length + (lineIndex < lines.length - 1 ? 1 : 0);
  });

  return searchLines;
}

function createDocumentSearchLines(
  content: string,
  documentType: DocumentType = "markdown",
) {
  if (
    documentType === "pdf" ||
    documentType === "word" ||
    documentType === "sheet" ||
    documentType === "drawing"
  ) {
    return [];
  }

  return documentType === "html"
    ? createHtmlSearchLines(content)
    : createMarkdownSearchLines(content);
}

function createVisibleSearchSnippet(text: string, start: number) {
  if (text.length <= 96) {
    return text.trim();
  }

  const snippetStart = Math.max(0, start - 36);
  const snippetEnd = Math.min(text.length, snippetStart + 96);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < text.length ? "..." : "";

  return `${prefix}${text.slice(snippetStart, snippetEnd).trim()}${suffix}`;
}

export function findMarkdownSearchMatches(
  content: string,
  query: string,
  documentType: DocumentType = "markdown",
): MarkdownSearchMatch[] {
  const normalizedNeedle = query.trim();

  if (!normalizedNeedle) {
    return [];
  }

  const normalizedQuery = normalizedNeedle.toLocaleLowerCase();
  const matches: MarkdownSearchMatch[] = [];
  const searchLines = createDocumentSearchLines(content, documentType);

  searchLines.forEach((line) => {
    const normalizedLine = line.text.toLocaleLowerCase();
    let searchFrom = 0;

    while (searchFrom <= normalizedLine.length) {
      const visibleStart = normalizedLine.indexOf(normalizedQuery, searchFrom);

      if (visibleStart < 0) {
        break;
      }

      const visibleEnd = visibleStart + normalizedNeedle.length;
      const start = line.positions[visibleStart];
      const last = line.positions[visibleEnd - 1];

      if (start !== undefined && last !== undefined) {
        matches.push({
          column: visibleStart,
          end: last + 1,
          line: line.lineIndex + 1,
          lineIndex: line.lineIndex,
          snippet: createVisibleSearchSnippet(line.text, visibleStart),
          start,
        });
      }

      searchFrom = visibleEnd;
    }
  });

  return matches;
}

function normalizeSearchPath(path?: string) {
  return path?.replace(/\\/g, "/").replace(/\/+$/, "").toLocaleLowerCase() ?? "";
}

export function isDocumentInsideWorkspace(
  document: MarkdownDocument,
  workspacePath?: string,
) {
  if (!document.filePath) {
    return false;
  }

  if (!workspacePath) {
    return true;
  }

  const rootPath = normalizeSearchPath(workspacePath);
  const filePath = normalizeSearchPath(document.filePath);

  return filePath === rootPath || filePath.startsWith(`${rootPath}/`);
}

export function getWorkspaceSearchGroups(
  documents: MarkdownDocument[],
  query: string,
  workspacePath?: string,
): WorkspaceSearchGroup[] {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return documents
    .filter((document) => isDocumentInsideWorkspace(document, workspacePath))
    .map((document) => ({
      document,
      matches: findMarkdownSearchMatches(
        document.content,
        normalizedQuery,
        getDocumentType(document),
      ),
    }))
    .filter((group) => group.matches.length > 0)
    .sort((first, second) => {
      const firstUpdatedAt = new Date(first.document.updatedAt).getTime();
      const secondUpdatedAt = new Date(second.document.updatedAt).getTime();

      if (firstUpdatedAt !== secondUpdatedAt) {
        return secondUpdatedAt - firstUpdatedAt;
      }

      return getDocumentDisplayName(first.document).localeCompare(
        getDocumentDisplayName(second.document),
        "zh-Hans-CN",
      );
    });
}

export function getWorkspaceSearchMatchCount(groups: WorkspaceSearchGroup[]) {
  return groups.reduce((total, group) => total + group.matches.length, 0);
}

export function getMatchOccurrenceIndex(
  document: MarkdownDocument,
  query: string,
  match: MarkdownSearchMatch,
) {
  const matches = findMarkdownSearchMatches(
    document.content,
    query,
    getDocumentType(document),
  );
  const exactIndex = matches.findIndex((item) => item.start === match.start);

  if (exactIndex >= 0) {
    return exactIndex;
  }

  const lineIndex = matches.findIndex(
    (item) => item.lineIndex === match.lineIndex && item.column === match.column,
  );

  return Math.max(0, lineIndex);
}
