import { describe, expect, it } from "vitest";
import {
  COMPACT_IMAGE_TITLE,
  createMarkdownImageToken,
} from "../markdownImages";

describe("markdown image helpers", () => {
  it("creates compact image markdown with escaped text", () => {
    expect(
      createMarkdownImageToken({
        alt: "shot ] one",
        source: ".assets/screenshot 1(2).png",
        title: COMPACT_IMAGE_TITLE,
      }),
    ).toBe('![shot \\] one](<.assets/screenshot 1(2).png> "fit=compact")');
  });

  it("escapes image titles and leaves simple sources unwrapped", () => {
    expect(
      createMarkdownImageToken({
        alt: "logo",
        source: ".assets/logo.png",
        title: 'Preview "small"',
      }),
    ).toBe('![logo](.assets/logo.png "Preview \\"small\\"")');
  });
});
