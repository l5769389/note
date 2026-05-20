export type HtmlOutlineEntry = {
  anchor?: string;
  id: string;
  level: number;
  title: string;
};

const ignoredHtmlBlockPattern =
  /<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi;
const htmlHeadingPattern = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const htmlTagPattern = /<[^>]+>/g;
const htmlCommentPattern = /<!--[\s\S]*?-->/g;

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
    (entity, body: string) => {
      const normalized = body.toLowerCase();

      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }

      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }

      return htmlEntityMap[normalized] ?? entity;
    },
  );
}

function stripHtmlTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(htmlCommentPattern, " ")
      .replace(/<br\b[^>]*>/gi, " ")
      .replace(htmlTagPattern, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function getHtmlAttribute(attributes: string, name: string) {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  );
  const match = attributes.match(pattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";

  return decodeHtmlEntities(value.trim()) || undefined;
}

function getNestedAnchor(body: string) {
  const match = body.match(/<a\b([^>]*)>/i);

  if (!match) {
    return undefined;
  }

  return getHtmlAttribute(match[1], "id") ?? getHtmlAttribute(match[1], "name");
}

export function getHtmlOutline(html: string): HtmlOutlineEntry[] {
  const searchableHtml = html.replace(ignoredHtmlBlockPattern, " ");
  const outline: HtmlOutlineEntry[] = [];

  for (const match of searchableHtml.matchAll(htmlHeadingPattern)) {
    const level = Number(match[1]);
    const attributes = match[2] ?? "";
    const body = match[3] ?? "";
    const title = stripHtmlTags(body);

    if (!title) {
      continue;
    }

    const anchor =
      getHtmlAttribute(attributes, "id") ??
      getHtmlAttribute(attributes, "name") ??
      getNestedAnchor(body);

    outline.push({
      ...(anchor ? { anchor } : {}),
      id: `html-outline-${outline.length}`,
      level,
      title,
    });
  }

  return outline;
}
