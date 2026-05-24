import { describe, expect, it } from "vitest";
import {
  clampFindMatchIndex,
  shouldClearFindHighlight,
} from "../findMatchState";

describe("find match state helpers", () => {
  it("clamps the active match index to available matches", () => {
    expect(clampFindMatchIndex(4, 3)).toBe(2);
    expect(clampFindMatchIndex(-1, 3)).toBe(0);
    expect(clampFindMatchIndex(1, 0)).toBe(0);
  });

  it("clears highlights when the find panel cannot show a match", () => {
    expect(
      shouldClearFindHighlight({
        findQuery: "todo",
        isFindReplaceOpen: true,
        matchCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldClearFindHighlight({
        findQuery: "",
        isFindReplaceOpen: true,
        matchCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldClearFindHighlight({
        findQuery: "todo",
        isFindReplaceOpen: false,
        matchCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldClearFindHighlight({
        findQuery: "todo",
        isFindReplaceOpen: true,
        matchCount: 0,
      }),
    ).toBe(true);
  });
});
