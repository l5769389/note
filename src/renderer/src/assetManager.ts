const localSchemePattern = /^[a-z][a-z\d+.-]*:/i;
const markdownImagePattern = /!\[([^\]]*)]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"([^"]*)")?\s*\)/g;
const htmlResourcePattern =
  /<(?:img|source|video|audio)\b[^>]*\s(?:src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const htmlLinkPattern =
  /<link\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const univerSheetBlockPattern =
  /```(?:univer-sheet|univer|spreadsheet)\s*\n([\s\S]*?)\n```/gi;
const excalidrawScenePattern = /(?:^|\s)scene=([^\s"]+)(?=\s|$)/i;

export const workspaceAssetsDirectoryName = ".assets";

export type AssetReferenceKind = "drawing" | "html" | "image" | "sheet";

export type AssetReference = {
  kind: AssetReferenceKind;
  reference: string;
};

function stripAngleBrackets(value: string) {
  return value.startsWith("<") && value.endsWith(">")
    ? value.slice(1, -1)
    : value;
}

export function splitResourceReference(reference: string) {
  const match = reference.match(/^([^?#]*)([?#].*)?$/);

  return {
    path: match?.[1] ?? reference,
    suffix: match?.[2] ?? "",
  };
}

export function isLocalAssetReference(reference?: string) {
  if (!reference) {
    return false;
  }

  const { path } = splitResourceReference(stripAngleBrackets(reference).trim());

  if (
    !path ||
    path.startsWith("#") ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    localSchemePattern.test(path)
  ) {
    return false;
  }

  return path
    .replace(/\\/g, "/")
    .split("/")
    .some((segment) => segment === workspaceAssetsDirectoryName);
}

export function normalizeAssetReference(reference: string) {
  return stripAngleBrackets(reference).trim().replace(/\\/g, "/");
}

export function createAssetFileName(originalName: string, fallbackName: string) {
  const normalizedName = originalName.trim() || fallbackName;
  const extensionMatch = normalizedName.match(/\.[^.\\/]+$/);
  const extension = extensionMatch?.[0] ?? "";
  const baseName = normalizedName
    .slice(0, normalizedName.length - extension.length)
    .replace(/\s+/g, " ")
    .trim();

  return `${baseName || fallbackName}${extension}`;
}

export function extractLocalAssetReferences(markdown: string): AssetReference[] {
  const references: AssetReference[] = [];
  const seenReferences = new Set<string>();

  function addReference(kind: AssetReferenceKind, rawReference: string) {
    const reference = normalizeAssetReference(rawReference);

    if (isLocalAssetReference(reference)) {
      const key = `${kind}:${reference.toLowerCase()}`;

      if (seenReferences.has(key)) {
        return;
      }

      seenReferences.add(key);
      references.push({ kind, reference });
    }
  }

  markdown.replace(
    markdownImagePattern,
    (_match, _alt: string, rawSrc: string, title?: string) => {
      addReference("image", rawSrc);

      const sceneReference = title?.match(excalidrawScenePattern)?.[1];

      if (sceneReference) {
        addReference("drawing", sceneReference);
      }

      return _match;
    },
  );

  markdown.replace(htmlResourcePattern, (_match, first: string, second: string, third: string) => {
    addReference("html", first ?? second ?? third ?? "");

    return _match;
  });

  markdown.replace(htmlLinkPattern, (_match, first: string, second: string, third: string) => {
    addReference("html", first ?? second ?? third ?? "");

    return _match;
  });

  markdown.replace(univerSheetBlockPattern, (_match, code: string) => {
    try {
      const parsed = JSON.parse(code.trim()) as { assetPath?: unknown };
      const assetPath =
        typeof parsed.assetPath === "string" ? parsed.assetPath : "";

      if (assetPath) {
        addReference("sheet", assetPath);
      }
    } catch {
      // Inline workbook JSON is not an asset reference.
    }

    return _match;
  });

  return references;
}

export function replaceAssetReference(
  markdown: string,
  previousReference: string,
  nextReference: string,
) {
  const previous = normalizeAssetReference(previousReference);
  const next = normalizeAssetReference(nextReference);

  if (!previous || previous === next) {
    return markdown;
  }

  return markdown.replaceAll(previous, next);
}
