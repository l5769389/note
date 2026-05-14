import { describe, expect, it } from "vitest";
import { findVisibleSearchRange, normalizeSearchText } from "../editorSearch";

function textDoc(chunks: Array<{ pos: number; text: string }>) {
  return {
    descendants(callback: (node: { isText: boolean; text: string }, pos: number) => void) {
      chunks.forEach((chunk) => callback({ isText: true, text: chunk.text }, chunk.pos));
    },
  } as Parameters<typeof findVisibleSearchRange>[0];
}

describe("editor search helpers", () => {
  it("normalizes text case using locale lower casing", () => {
    expect(normalizeSearchText("Hello")).toBe("hello");
  });

  it("finds visible text ranges across text nodes", () => {
    expect(
      findVisibleSearchRange(
        textDoc([
          { pos: 3, text: "Hello " },
          { pos: 15, text: "world" },
        ]),
        "world",
        0,
      ),
    ).toEqual({ from: 15, to: 20 });
  });
});

