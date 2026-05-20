export type HtmlAnnotationStyle =
  | "highlight"
  | "emphasis"
  | "underline"
  | "wavy"
  | "note";

export type HtmlAnnotationSelector =
  | {
      type: "TextPositionSelector";
      start: number;
      end: number;
    }
  | {
      type: "TextQuoteSelector";
      exact: string;
      prefix: string;
      suffix: string;
    };

export type HtmlAnnotation = {
  id: string;
  type: "Annotation";
  motivation: "highlighting" | "commenting";
  style: HtmlAnnotationStyle;
  created: string;
  updated: string;
  body?: {
    type: "TextualBody";
    value: string;
    format: "text/plain";
    purpose: "commenting";
  };
  target: {
    source?: string;
    selector: HtmlAnnotationSelector[];
  };
};

export type HtmlAnnotationDocument = {
  version: 1;
  sourceFilePath?: string;
  updatedAt: string;
  annotations: HtmlAnnotation[];
};

export const htmlAnnotationDocumentVersion = 1;

export function getHtmlAnnotationAssetReference(filePath?: string) {
  const fileName =
    filePath
      ?.split(/[\\/]/)
      .filter(Boolean)
      .pop()
      ?.trim() || "document.html";
  const safeFileName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");

  return `.assets/${safeFileName || "document.html"}.annotations.json`;
}

function isHtmlAnnotationStyle(value: unknown): value is HtmlAnnotationStyle {
  return (
    value === "highlight" ||
    value === "emphasis" ||
    value === "underline" ||
    value === "wavy" ||
    value === "note"
  );
}

function normalizeSelector(selector: unknown): HtmlAnnotationSelector | null {
  if (!selector || typeof selector !== "object") {
    return null;
  }

  const candidate = selector as Partial<HtmlAnnotationSelector>;

  if (
    candidate.type === "TextPositionSelector" &&
    typeof candidate.start === "number" &&
    typeof candidate.end === "number" &&
    Number.isFinite(candidate.start) &&
    Number.isFinite(candidate.end)
  ) {
    const start = Math.max(0, Math.trunc(candidate.start));
    const end = Math.max(start, Math.trunc(candidate.end));

    return { type: "TextPositionSelector", start, end };
  }

  if (candidate.type === "TextQuoteSelector") {
    return {
      type: "TextQuoteSelector",
      exact:
        typeof candidate.exact === "string" ? candidate.exact.slice(0, 2048) : "",
      prefix:
        typeof candidate.prefix === "string" ? candidate.prefix.slice(0, 160) : "",
      suffix:
        typeof candidate.suffix === "string" ? candidate.suffix.slice(0, 160) : "",
    };
  }

  return null;
}

function normalizeAnnotation(annotation: unknown): HtmlAnnotation | null {
  if (!annotation || typeof annotation !== "object") {
    return null;
  }

  const candidate = annotation as Partial<HtmlAnnotation>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";

  if (!id || !isHtmlAnnotationStyle(candidate.style)) {
    return null;
  }

  const selectors = Array.isArray(candidate.target?.selector)
    ? candidate.target.selector
        .map(normalizeSelector)
        .filter((selector): selector is HtmlAnnotationSelector => Boolean(selector))
    : [];

  if (!selectors.some((selector) => selector.type === "TextPositionSelector")) {
    return null;
  }

  const noteValue =
    typeof candidate.body?.value === "string" ? candidate.body.value.trim() : "";
  const now = new Date().toISOString();

  return {
    id,
    type: "Annotation",
    motivation: candidate.style === "note" ? "commenting" : "highlighting",
    style: candidate.style,
    created:
      typeof candidate.created === "string" && candidate.created
        ? candidate.created
        : now,
    updated:
      typeof candidate.updated === "string" && candidate.updated
        ? candidate.updated
        : now,
    ...(noteValue
      ? {
          body: {
            type: "TextualBody",
            value: noteValue,
            format: "text/plain",
            purpose: "commenting",
          },
        }
      : {}),
    target: {
      source:
        typeof candidate.target?.source === "string"
          ? candidate.target.source
          : undefined,
      selector: selectors,
    },
  };
}

export function parseHtmlAnnotationDocument(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<HtmlAnnotationDocument>;
    const rawAnnotations = Array.isArray(parsed.annotations)
      ? parsed.annotations
      : [];

    return rawAnnotations
      .map(normalizeAnnotation)
      .filter((annotation): annotation is HtmlAnnotation => Boolean(annotation));
  } catch {
    return [];
  }
}

export function serializeHtmlAnnotationDocument(
  annotations: HtmlAnnotation[],
  sourceFilePath?: string,
) {
  const document: HtmlAnnotationDocument = {
    version: htmlAnnotationDocumentVersion,
    sourceFilePath,
    updatedAt: new Date().toISOString(),
    annotations,
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}

export function getHtmlAnnotationPosition(annotation: HtmlAnnotation) {
  return annotation.target.selector.find(
    (selector): selector is Extract<
      HtmlAnnotationSelector,
      { type: "TextPositionSelector" }
    > => selector.type === "TextPositionSelector",
  );
}
