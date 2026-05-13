export type MarkdownOutlineEntry = {
  id: string;
  level: number;
  lineIndex: number;
  title: string;
};

export type MarkdownHeadingReference = {
  level: number;
  title: string;
};

export const markdownHeadingPattern = /^(#{1,6})\s+(.+)$/;

export function normalizeMarkdownHeadingTitle(value: string) {
  return value
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMarkdownOutline(markdown: string): MarkdownOutlineEntry[] {
  return markdown
    .split("\n")
    .map((line, lineIndex) => {
      const match = line.match(markdownHeadingPattern);

      if (!match) {
        return null;
      }

      const title = normalizeMarkdownHeadingTitle(match[2]);

      if (!title) {
        return null;
      }

      return {
        id: `${lineIndex}-${title}`,
        level: match[1].length,
        lineIndex,
        title,
      };
    })
    .filter((entry): entry is MarkdownOutlineEntry => Boolean(entry));
}

export function createTableOfContentsMarkdown(markdown: string) {
  const outline = getMarkdownOutline(markdown);

  if (!outline.length) {
    return "\n- \n";
  }

  const minLevel = Math.min(...outline.map((entry) => entry.level));

  return `\n${outline
    .map((entry) => `${"  ".repeat(entry.level - minLevel)}- ${entry.title}`)
    .join("\n")}\n`;
}

export function getMarkdownHeadingAtLine(
  markdown: string,
  lineIndex: number,
): MarkdownHeadingReference | null {
  const line = markdown.split("\n")[lineIndex] ?? "";
  const match = line.match(markdownHeadingPattern);

  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    title: normalizeMarkdownHeadingTitle(match[2]),
  };
}

export function countMarkdownWords(markdown: string) {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_\-~|[\](){}:"'.,;!?，。；：！？、]/g, " ");
  const cjkCharacters =
    plainText.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    )?.length ?? 0;
  const latinWords =
    plainText
      .replace(
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
        " ",
      )
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;

  return cjkCharacters + latinWords;
}
