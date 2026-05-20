import { describe, expect, it } from "vitest";
import {
  getAspectRatioResizeWidth,
  getProportionalHeight,
  getSafeAspectRatio,
} from "../mediaSizing";

describe("media sizing helpers", () => {
  it("keeps resized media height proportional to the width", () => {
    expect(getProportionalHeight(640, 16 / 9)).toBe(360);
    expect(getProportionalHeight(300, 4 / 3)).toBe(225);
  });

  it("falls back to a stable aspect ratio for unloaded videos", () => {
    expect(getSafeAspectRatio(0)).toBeCloseTo(16 / 9);
    expect(getSafeAspectRatio(Number.NaN)).toBeCloseTo(16 / 9);
  });

  it("allows vertical drag to drive proportional bottom-right video resizing", () => {
    expect(
      getAspectRatioResizeWidth({
        aspectRatio: 16 / 9,
        currentX: 0,
        currentY: 90,
        startWidth: 320,
        startX: 0,
        startY: 0,
      }),
    ).toBe(480);
  });
});
