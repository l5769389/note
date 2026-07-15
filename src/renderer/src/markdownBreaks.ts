const hasHtmlBreakPattern = /<br\s*\/?>/i;
const inlineHtmlBreakPattern = /[ \t]*<br\s*\/?>[ \t]*/gi;
const standaloneHtmlBreakPattern = /^[\t ]*<br\s*\/?>[\t ]*$/i;
const fencedCodeBoundaryPattern = /^ {0,3}(`{3,}|~{3,})/;

function normalizeHtmlBreaksInLine(line: string) {
  if (!hasHtmlBreakPattern.test(line)) {
    return line;
  }

  if (standaloneHtmlBreakPattern.test(line)) {
    return "";
  }

  return line.replace(inlineHtmlBreakPattern, "\n");
}

export function normalizeMarkdownHtmlBreaks(markdown: string) {
  if (!hasHtmlBreakPattern.test(markdown)) {
    return markdown;
  }

  const parts = markdown.split(/(\r\n|\n|\r)/);
  let fenceMarker = "";
  let fenceLength = 0;

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? "";

    if (fenceMarker) {
      const fenceMatch = line.match(fencedCodeBoundaryPattern);

      if (
        fenceMatch &&
        fenceMatch[1]?.[0] === fenceMarker &&
        fenceMatch[1].length >= fenceLength
      ) {
        fenceMarker = "";
        fenceLength = 0;
      }

      continue;
    }

    const fenceMatch = line.match(fencedCodeBoundaryPattern);

    if (fenceMatch) {
      fenceMarker = fenceMatch[1]?.[0] ?? "";
      fenceLength = fenceMatch[1]?.length ?? 0;
      continue;
    }

    parts[index] = normalizeHtmlBreaksInLine(line);
  }

  return parts.join("");
}
