import {
  isLocalAssetReference,
  normalizeAssetReference,
} from "./assetManager";

const clipboardMarkdownImagePattern =
  /!\[([^\]]*)]\(\s*(<[^>]+>|[^\s)]+)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/g;
const clipboardHtmlImagePattern = /<img\b[^>]*>/gi;

export type ClipboardImageToken = {
  alt: string;
  index: number;
  length: number;
  source: string;
  title?: string;
  width?: number;
};

function escapeClipboardHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripClipboardReferenceBrackets(value: string) {
  const trimmed = value.trim();

  return trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1)
    : trimmed;
}

function getClipboardHtmlAttribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = tag.match(pattern);

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function getClipboardImageWidth(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(?:^|\s)width=(\d{2,5})(?=\s|$)/i);
  const parsed = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function collectClipboardImageTokens(markdown: string) {
  const tokens: ClipboardImageToken[] = [];

  clipboardMarkdownImagePattern.lastIndex = 0;
  markdown.replace(
    clipboardMarkdownImagePattern,
    (
      match,
      alt: string,
      rawSource: string,
      doubleTitle?: string,
      singleTitle?: string,
      offset?: number,
    ) => {
      const title = doubleTitle ?? singleTitle ?? "";

      tokens.push({
        alt,
        index: typeof offset === "number" ? offset : 0,
        length: match.length,
        source: stripClipboardReferenceBrackets(rawSource),
        title,
        width: getClipboardImageWidth(title),
      });

      return match;
    },
  );

  clipboardHtmlImagePattern.lastIndex = 0;
  markdown.replace(clipboardHtmlImagePattern, (match, offset?: number) => {
    const source = getClipboardHtmlAttribute(match, "src");

    if (!source) {
      return match;
    }

    tokens.push({
      alt: getClipboardHtmlAttribute(match, "alt"),
      index: typeof offset === "number" ? offset : 0,
      length: match.length,
      source: stripClipboardReferenceBrackets(source),
      title: getClipboardHtmlAttribute(match, "title"),
      width:
        getClipboardImageWidth(getClipboardHtmlAttribute(match, "title")) ??
        getClipboardImageWidth(getClipboardHtmlAttribute(match, "style")) ??
        getClipboardImageWidth(`width=${getClipboardHtmlAttribute(match, "width")}`),
    });

    return match;
  });

  return tokens
    .sort((first, second) => first.index - second.index)
    .filter((token, index, sortedTokens) => {
      const previous = sortedTokens[index - 1];

      return !previous || token.index >= previous.index + previous.length;
    });
}

function getClipboardAssetKey(source: string) {
  return normalizeAssetReference(source).toLowerCase();
}

function createClipboardImageHtml(
  token: ClipboardImageToken,
  assetDataUrls: Map<string, string>,
) {
  const source = isLocalAssetReference(token.source)
    ? assetDataUrls.get(getClipboardAssetKey(token.source)) || token.source
    : token.source;
  const width = token.width ? ` width="${token.width}"` : "";
  const title = token.title ? ` title="${escapeClipboardHtml(token.title)}"` : "";

  return [
    `<img src="${escapeClipboardHtml(source)}"`,
    ` alt="${escapeClipboardHtml(token.alt)}"`,
    title,
    width,
    ' style="max-width: 100%; height: auto; vertical-align: middle;"',
    " />",
  ].join("");
}

function createRichClipboardHtml(
  markdown: string,
  tokens: ClipboardImageToken[],
  assetDataUrls: Map<string, string>,
) {
  let html = "";
  let cursor = 0;

  for (const token of tokens) {
    html += escapeClipboardHtml(markdown.slice(cursor, token.index));
    html += createClipboardImageHtml(token, assetDataUrls);
    cursor = token.index + token.length;
  }

  html += escapeClipboardHtml(markdown.slice(cursor));

  return `<div style="white-space: pre-wrap; line-height: 1.6;">${html}</div>`;
}

export function createPlainClipboardText(
  markdown: string,
  tokens: ClipboardImageToken[],
) {
  let text = "";
  let cursor = 0;

  for (const token of tokens) {
    text += markdown.slice(cursor, token.index);
    text += token.alt ? `[图片: ${token.alt}]` : "[图片]";
    cursor = token.index + token.length;
  }

  return text + markdown.slice(cursor);
}

export async function writeMarkdownRichClipboard(
  markdown: string,
  documentFilePath: string,
) {
  const tokens = collectClipboardImageTokens(markdown);

  if (!tokens.length || !window.desktop?.writeRichHtmlToClipboard) {
    return false;
  }

  const assetDataUrls = new Map<string, string>();
  const localReferences = Array.from(
    new Set(
      tokens
        .filter((token) => isLocalAssetReference(token.source))
        .map((token) => token.source),
    ),
  );

  await Promise.all(
    localReferences.map(async (reference) => {
      try {
        const asset = await window.desktop?.readAssetAsDataUrl?.({
          documentFilePath,
          reference,
        });

        if (asset?.dataUrl) {
          assetDataUrls.set(getClipboardAssetKey(reference), asset.dataUrl);
        }
      } catch {
        // Keep the original source in the rich clipboard if an asset was removed.
      }
    }),
  );

  return window.desktop.writeRichHtmlToClipboard({
    html: createRichClipboardHtml(markdown, tokens, assetDataUrls),
    text: markdown,
  });
}
