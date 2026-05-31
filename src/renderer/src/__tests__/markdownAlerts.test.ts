import { describe, expect, it } from "vitest";
import {
  createMarkdownAlert,
  getMarkdownAlertByMarker,
  getMarkdownAlertByPrefix,
  markdownAlertByKind,
  stripMarkdownAlertMarker,
} from "../markdownAlerts";

describe("markdown alert helpers", () => {
  it("creates alert blockquote markdown for the requested kind", () => {
    expect(createMarkdownAlert("tip")).toBe(
      `\n> [!TIP]\n>\n> ${markdownAlertByKind.tip.contentLabel}\n`,
    );
    expect(createMarkdownAlert("note")).toContain("[!NOTE]");
  });

  it("finds alert metadata from complete markers and line prefixes", () => {
    expect(getMarkdownAlertByMarker("  [!warning]  ")?.kind).toBe("warning");
    expect(getMarkdownAlertByMarker("[!unknown]")).toBeNull();
    expect(getMarkdownAlertByPrefix("[!IMPORTANT] keep this")?.kind).toBe(
      "important",
    );
    expect(getMarkdownAlertByPrefix("plain text")).toBeNull();
  });

  it("strips only the alert marker prefix from blockquote content", () => {
    expect(stripMarkdownAlertMarker("[!CAUTION] check permissions")).toBe(
      "check permissions",
    );
    expect(stripMarkdownAlertMarker("no marker")).toBe("no marker");
  });
});
