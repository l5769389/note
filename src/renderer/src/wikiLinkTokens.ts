export type WikiLinkToken = {
  display: string;
  from: number;
  inner: string;
  raw: string;
  target: string;
  to: number;
};

export type TextRange = {
  from: number;
  to: number;
};

const wikiLinkDisplayExtensionPattern =
  /\.(?:md|markdown|html?|pdf|docx?|xlsx?|univer|excalidraw(?:\.json)?)$/i;
const markdownCodeRegionPattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

function isEscapedAt(text: string, index: number) {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function getDisplayFromTarget(target: string) {
  return (
    target
      .split("#")[0]
      ?.replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(wikiLinkDisplayExtensionPattern, "")
      .trim() || target
  );
}

export function parseWikiLinkInner(inner: string) {
  const separatorIndex = inner.indexOf("|");
  const target =
    separatorIndex >= 0 ? inner.slice(0, separatorIndex).trim() : inner.trim();
  const explicitDisplay =
    separatorIndex >= 0 ? inner.slice(separatorIndex + 1).trim() : "";

  return {
    display: explicitDisplay || getDisplayFromTarget(target),
    target,
  };
}

export function findWikiLinkTokensInText(text: string, offset = 0) {
  const tokens: WikiLinkToken[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf("[[", cursor);

    if (start < 0) {
      break;
    }

    if (isEscapedAt(text, start)) {
      cursor = start + 2;
      continue;
    }

    const end = text.indexOf("]]", start + 2);

    if (end < 0) {
      break;
    }

    const inner = text.slice(start + 2, end);

    if (
      inner.length >= 1 &&
      inner.length <= 180 &&
      !inner.includes("[") &&
      !inner.includes("]") &&
      !/[\r\n]/.test(inner)
    ) {
      const { display, target } = parseWikiLinkInner(inner);

      if (target) {
        tokens.push({
          display,
          from: offset + start,
          inner,
          raw: text.slice(start, end + 2),
          target,
          to: offset + end + 2,
        });
      }
    }

    cursor = end + 2;
  }

  return tokens;
}

export function findWikiLinkTokensInMarkdown(markdown: string) {
  const tokens: WikiLinkToken[] = [];
  let cursor = 0;

  for (const match of markdown.matchAll(markdownCodeRegionPattern)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      tokens.push(...findWikiLinkTokensInText(markdown.slice(cursor, index), cursor));
    }

    cursor = index + match[0].length;
  }

  if (cursor < markdown.length) {
    tokens.push(...findWikiLinkTokensInText(markdown.slice(cursor), cursor));
  }

  return tokens;
}

export function findWikiLinkTokenAtPosition(
  tokens: WikiLinkToken[],
  position: number,
  direction: "inside" | "backward" | "forward" = "inside",
) {
  return tokens.find((token) => {
    if (direction === "backward") {
      return token.to === position || (token.from < position && position <= token.to);
    }

    if (direction === "forward") {
      return token.from === position || (token.from <= position && position < token.to);
    }

    return token.from <= position && position <= token.to;
  });
}

export function expandRangeToWikiLinkTokens(
  tokens: WikiLinkToken[],
  from: number,
  to: number,
): TextRange | null {
  const touched = tokens.filter((token) => {
    if (from === to) {
      return from >= token.from && from <= token.to;
    }

    return from < token.to && to > token.from;
  });

  if (!touched.length) {
    return null;
  }

  return {
    from: Math.min(...touched.map((token) => token.from), from),
    to: Math.max(...touched.map((token) => token.to), to),
  };
}

export function getWikiLinkTokenDeleteRange(
  tokens: WikiLinkToken[],
  selection: TextRange,
  key: "Backspace" | "Delete",
): TextRange | null {
  if (selection.from !== selection.to) {
    return expandRangeToWikiLinkTokens(tokens, selection.from, selection.to);
  }

  const token = findWikiLinkTokenAtPosition(
    tokens,
    selection.from,
    key === "Backspace" ? "backward" : "forward",
  );

  return token ? { from: token.from, to: token.to } : null;
}
