import { describe, expect, it } from "vitest";
import { createDiaryInitialContent } from "../diaryModel";
import {
  getRecentDocumentVisibilityKey,
  shouldShowInRecentDocuments,
} from "../recentDocuments";
import type { MarkdownDocument } from "../types";

function document(
  overrides: Partial<MarkdownDocument> = {},
): MarkdownDocument {
  return {
    content: "# 普通笔记\n\n内容",
    createdAt: "2026-07-09T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "/Users/jun/Notes/note.md",
    id: "note",
    title: "note",
    updatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("recent document visibility", () => {
  it("shows ordinary markdown documents", () => {
    const note = document();

    expect(
      shouldShowInRecentDocuments(note, "/Users/jun/Notes", new Set()),
    ).toBe(true);
  });

  it("hides documents the user cleared from recent records", () => {
    const note = document();
    const hiddenKeys = new Set([getRecentDocumentVisibilityKey(note)]);

    expect(
      shouldShowInRecentDocuments(note, "/Users/jun/Notes", hiddenKeys),
    ).toBe(false);
  });

  it("hides documents inside the diary folder", () => {
    const diary = document({
      filePath: "/Users/jun/Notes/日记/2026/07/2026-07-09.md",
      id: "diary-path",
      title: "2026-07-09",
    });

    expect(
      shouldShowInRecentDocuments(diary, "/Users/jun/Notes", new Set()),
    ).toBe(false);
  });

  it("hides markdown content marked as a diary", () => {
    const diary = document({
      content: createDiaryInitialContent("2026-07-09"),
      filePath: "/Users/jun/Notes/review.md",
      id: "diary-content",
      title: "review",
    });

    expect(
      shouldShowInRecentDocuments(diary, "/Users/jun/Notes", new Set()),
    ).toBe(false);
  });
});
