import { describe, expect, it } from "vitest";
import {
  getHtmlAnnotationAssetReference,
  parseHtmlAnnotationDocument,
  serializeHtmlAnnotationDocument,
  type HtmlAnnotation,
} from "../htmlAnnotations";

const annotation: HtmlAnnotation = {
  id: "annotation-1",
  type: "Annotation",
  motivation: "commenting",
  style: "note",
  created: "2026-05-20T00:00:00.000Z",
  updated: "2026-05-20T00:00:00.000Z",
  body: {
    type: "TextualBody",
    value: "Needs another pass",
    format: "text/plain",
    purpose: "commenting",
  },
  target: {
    source: "D:/notes/index.html",
    selector: [
      { type: "TextPositionSelector", start: 8, end: 22 },
      {
        type: "TextQuoteSelector",
        exact: "annotated text",
        prefix: "before ",
        suffix: " after",
      },
    ],
  },
};

describe("html annotations", () => {
  it("uses a deterministic sidecar asset path for html files", () => {
    expect(getHtmlAnnotationAssetReference("D:/notes/site/index.html")).toBe(
      ".assets/index.html.annotations.json",
    );
  });

  it("serializes and parses W3C-style annotation selectors", () => {
    const serialized = serializeHtmlAnnotationDocument(
      [annotation],
      "D:/notes/index.html",
    );
    const parsed = parseHtmlAnnotationDocument(serialized);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "annotation-1",
      motivation: "commenting",
      style: "note",
      body: {
        value: "Needs another pass",
      },
      target: {
        selector: [
          { type: "TextPositionSelector", start: 8, end: 22 },
          { type: "TextQuoteSelector", exact: "annotated text" },
        ],
      },
    });
  });

  it("drops malformed annotations instead of throwing", () => {
    const parsed = parseHtmlAnnotationDocument(
      JSON.stringify({
        version: 1,
        annotations: [
          annotation,
          { id: "missing-position", style: "highlight", target: { selector: [] } },
        ],
      }),
    );

    expect(parsed.map((item) => item.id)).toEqual(["annotation-1"]);
  });
});
