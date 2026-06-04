import { describe, expect, it } from "vitest";
import {
  documentReferenceMarkdownType,
  serializeDocumentReferenceToken,
  splitWikiLinkTextNode,
  transformDocumentReferenceMarkdownTree,
} from "../documentReferenceNode";

describe("documentReferenceNode", () => {
  it("splits plain wiki links into document reference markdown nodes", () => {
    expect(splitWikiLinkTextNode("See [[Guide.md|Guide]] today.")).toEqual([
      { type: "text", value: "See " },
      {
        display: "Guide",
        raw: "[[Guide.md|Guide]]",
        target: "Guide.md",
        type: documentReferenceMarkdownType,
      },
      { type: "text", value: " today." },
    ]);
  });

  it("keeps escaped wiki links as text", () => {
    expect(splitWikiLinkTextNode(String.raw`\[[Guide]] and [[Real]]`)).toEqual([
      { type: "text", value: String.raw`\[[Guide]] and ` },
      {
        display: "Real",
        raw: "[[Real]]",
        target: "Real",
        type: documentReferenceMarkdownType,
      },
    ]);
  });

  it("does not rewrite inline code markdown nodes", () => {
    const tree = {
      type: "root",
      children: [
        { type: "inlineCode", value: "[[Code]]" },
        { type: "paragraph", children: [{ type: "text", value: "[[Doc]]" }] },
      ],
    };

    transformDocumentReferenceMarkdownTree(tree);

    expect(tree.children[0]).toEqual({ type: "inlineCode", value: "[[Code]]" });
    expect(tree.children[1]).toEqual({
      type: "paragraph",
      children: [
        {
          display: "Doc",
          raw: "[[Doc]]",
          target: "Doc",
          type: documentReferenceMarkdownType,
        },
      ],
    });
  });

  it("serializes document references back to wiki link markdown", () => {
    expect(
      serializeDocumentReferenceToken({
        display: "Guide",
        target: "docs/Guide.md",
      }),
    ).toBe("[[docs/Guide.md|Guide]]");

    expect(serializeDocumentReferenceToken({ display: "Guide", target: "Guide" })).toBe(
      "[[Guide]]",
    );
  });
});
