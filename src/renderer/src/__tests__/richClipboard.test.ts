import { describe, expect, it } from "vitest";
import {
  collectClipboardImageTokens,
  createPlainClipboardText,
} from "../richClipboard";

describe("rich clipboard", () => {
  it("extracts markdown image references", () => {
    const markdown =
      'before ![image.png](.assets/image.png "width=327 align=left") after';
    const tokens = collectClipboardImageTokens(markdown);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      alt: "image.png",
      source: ".assets/image.png",
      width: 327,
    });
    expect(createPlainClipboardText(markdown, tokens)).toBe(
      "before [图片: image.png] after",
    );
  });

  it("extracts raw html image references", () => {
    const markdown =
      '<img src=".assets/image.png" alt="image.png" title="width=327" />';
    const tokens = collectClipboardImageTokens(markdown);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      alt: "image.png",
      source: ".assets/image.png",
      width: 327,
    });
  });
});
