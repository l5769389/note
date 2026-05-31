import { describe, expect, it } from "vitest";
import {
  formatCodeLanguageLabel,
  getCodeLanguageSuggestions,
  getCodeLanguageInputValue,
  isMermaidLanguage,
  normalizeCodeLanguageInput,
} from "../codeLanguage";

describe("code language helpers", () => {
  it("formats common language aliases for display", () => {
    expect(formatCodeLanguageLabel("js")).toBe("JavaScript");
    expect(formatCodeLanguageLabel("tsx")).toBe("TSX");
    expect(formatCodeLanguageLabel("cpp")).toBe("C++");
    expect(formatCodeLanguageLabel("")).toBe("PlainText");
    expect(formatCodeLanguageLabel("custom-lang")).toBe("CustomLang");
  });

  it("normalizes editable language input", () => {
    expect(normalizeCodeLanguageInput(" Plain Text ")).toBe("");
    expect(normalizeCodeLanguageInput("TypeScript")).toBe("typescript");
    expect(normalizeCodeLanguageInput("C++")).toBe("cpp");
  });

  it("uses readable labels in the editable language field", () => {
    expect(getCodeLanguageInputValue("cpp")).toBe("C++");
    expect(getCodeLanguageInputValue("c++")).toBe("C++");
    expect(getCodeLanguageInputValue("typescript")).toBe("TypeScript");
    expect(getCodeLanguageInputValue("custom-lang")).toBe("custom-lang");
    expect(getCodeLanguageInputValue("")).toBe("Plain Text");
  });

  it("returns fuzzy language suggestions", () => {
    expect(getCodeLanguageSuggestions("js", 3).map((item) => item.value)).toContain(
      "javascript",
    );
    expect(getCodeLanguageSuggestions("pwrsh", 1)[0]).toMatchObject({
      value: "powershell",
    });
  });

  it("detects mermaid code blocks case-insensitively", () => {
    expect(isMermaidLanguage(" Mermaid ")).toBe(true);
    expect(isMermaidLanguage("markdown")).toBe(false);
  });
});
