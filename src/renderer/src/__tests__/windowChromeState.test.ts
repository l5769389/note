import { describe, expect, it } from "vitest";
import { isValidWindowZoomFactor } from "../windowChromeState";

describe("window chrome state helpers", () => {
  it("accepts only finite numeric zoom factors", () => {
    expect(isValidWindowZoomFactor(1)).toBe(true);
    expect(isValidWindowZoomFactor(1.25)).toBe(true);
    expect(isValidWindowZoomFactor(Number.NaN)).toBe(false);
    expect(isValidWindowZoomFactor(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidWindowZoomFactor("1")).toBe(false);
  });
});
