import { describe, expect, it } from "vitest";
import {
  selectionTouchesInlineCodeRange,
  selectionTouchesRange,
} from "../selectionRanges";

describe("selection range helpers", () => {
  it("uses strict range boundaries for ordinary selections", () => {
    expect(selectionTouchesRange(10, 10, 5, 10)).toBe(true);
    expect(selectionTouchesRange(11, 11, 5, 10)).toBe(false);
  });

  it("keeps inline code syntax active just after the closing marker", () => {
    expect(selectionTouchesInlineCodeRange(10, 10, 5, 10)).toBe(true);
    expect(selectionTouchesInlineCodeRange(11, 11, 5, 10)).toBe(true);
    expect(selectionTouchesInlineCodeRange(12, 12, 5, 10)).toBe(false);
  });
});
