import { describe, expect, it } from "vitest";
import {
  getEmptyCodeBlockContentPosition,
  getNewEmptyCodeBlockFocusPosition,
  selectionIsInsideOrNearEmptyCodeBlock,
} from "../codeBlockFocus";

describe("empty code block focus helpers", () => {
  it("uses the first content position for an empty code block", () => {
    expect(
      getEmptyCodeBlockContentPosition({
        nodeSize: 2,
        pos: 10,
        textContent: "",
      }),
    ).toBe(11);
  });

  it("does not focus non-empty code blocks", () => {
    expect(
      getEmptyCodeBlockContentPosition({
        nodeSize: 8,
        pos: 10,
        textContent: "value",
      }),
    ).toBeNull();
  });

  it("treats a selection inside an empty code block as editable", () => {
    expect(
      selectionIsInsideOrNearEmptyCodeBlock(
        { from: 11, to: 11 },
        { nodeSize: 2, pos: 10, textContent: "" },
      ),
    ).toBe(true);
  });

  it("keeps newly created empty code blocks focusable when the input rule leaves the cursor nearby", () => {
    expect(
      getNewEmptyCodeBlockFocusPosition({
        block: { nodeSize: 2, pos: 10, textContent: "" },
        selection: { from: 13, to: 13 },
        wasCodeBlockAtSamePosition: false,
      }),
    ).toBe(11);
  });

  it("does not steal focus for existing unrelated empty code blocks", () => {
    expect(
      getNewEmptyCodeBlockFocusPosition({
        block: { nodeSize: 2, pos: 10, textContent: "" },
        selection: { from: 13, to: 13 },
        wasCodeBlockAtSamePosition: true,
      }),
    ).toBeNull();
  });

  it("does not focus empty code blocks far away from the cursor", () => {
    expect(
      getNewEmptyCodeBlockFocusPosition({
        block: { nodeSize: 2, pos: 10, textContent: "" },
        selection: { from: 30, to: 30 },
        wasCodeBlockAtSamePosition: false,
      }),
    ).toBeNull();
  });
});
