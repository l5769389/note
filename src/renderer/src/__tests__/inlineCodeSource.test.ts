import { describe, expect, it } from "vitest";
import { isWellFormedInlineCodeSource } from "../inlineCodeSource";

describe("inline code source helpers", () => {
  it("accepts a single inline code source pair with content", () => {
    expect(isWellFormedInlineCodeSource("`code`")).toBe(true);
  });

  it("rejects empty or nested backtick source", () => {
    expect(isWellFormedInlineCodeSource("``")).toBe(false);
    expect(isWellFormedInlineCodeSource("`a`b`")).toBe(false);
    expect(isWellFormedInlineCodeSource("code")).toBe(false);
  });
});

