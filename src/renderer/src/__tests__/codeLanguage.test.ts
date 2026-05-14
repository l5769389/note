import { describe, expect, it } from "vitest";
import {
  formatCodeLanguageLabel,
  isMermaidLanguage,
  normalizeCodeLanguageInput,
} from "../codeLanguage";

describe("code language helpers", () => {
  it("formats common language aliases for display", () => {
    expect(formatCodeLanguageLabel("js")).toBe("JavaScript");
    expect(formatCodeLanguageLabel("tsx")).toBe("TSX");
    expect(formatCodeLanguageLabel("custom-lang")).toBe("CustomLang");
  });

  it("normalizes editable language input", () => {
    expect(normalizeCodeLanguageInput(" Plain Text ")).toBe("");
    expect(normalizeCodeLanguageInput("TypeScript")).toBe("typescript");
  });

  it("detects mermaid code blocks case-insensitively", () => {
    expect(isMermaidLanguage(" Mermaid ")).toBe(true);
    expect(isMermaidLanguage("markdown")).toBe(false);
  });
});

