import { describe, expect, it } from "vitest";
import {
  shouldCloseImmersiveSidebar,
  shouldResetImmersiveReveal,
} from "../immersiveModeState";

describe("immersive mode state helpers", () => {
  it("resets reveal state only after leaving immersive mode", () => {
    expect(shouldResetImmersiveReveal(false, "left")).toBe(true);
    expect(shouldResetImmersiveReveal(true, "left")).toBe(false);
    expect(shouldResetImmersiveReveal(false, null)).toBe(false);
  });

  it("closes the immersive sidebar only after leaving immersive mode", () => {
    expect(shouldCloseImmersiveSidebar(false, true)).toBe(true);
    expect(shouldCloseImmersiveSidebar(true, true)).toBe(false);
    expect(shouldCloseImmersiveSidebar(false, false)).toBe(false);
  });
});
