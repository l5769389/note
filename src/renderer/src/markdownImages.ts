export const COMPACT_IMAGE_TITLE = "fit=compact";

function escapeMarkdownImageAlt(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

function escapeMarkdownImageTitle(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMarkdownImageSource(source: string) {
  return /[\s()<>]/.test(source) ? `<${source.replace(/>/g, "%3E")}>` : source;
}

export function createMarkdownImageToken({
  alt,
  source,
  title,
}: {
  alt: string;
  source: string;
  title?: string;
}) {
  const safeTitle = title?.trim();

  return `![${escapeMarkdownImageAlt(alt)}](${formatMarkdownImageSource(source)}${
    safeTitle ? ` "${escapeMarkdownImageTitle(safeTitle)}"` : ""
  })`;
}
