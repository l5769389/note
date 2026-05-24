import { describe, expect, it } from "vitest";
import { getPendingWorkspaceSearchRevealDecision } from "../workspaceSearchReveal";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/doc.md",
    id: "doc",
    title: "Doc",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const pendingReveal = {
  filePath: "D:/notes/doc.md",
  match: {
    column: 1,
    end: 4,
    line: 1,
    lineIndex: 0,
    snippet: "Doc",
    start: 0,
  },
  query: "Doc",
};

describe("workspace search reveal helpers", () => {
  it("waits until the requested document is active", () => {
    expect(
      getPendingWorkspaceSearchRevealDecision(
        pendingReveal,
        document({ filePath: "D:/notes/other.md" }),
      ),
    ).toEqual({
      shouldClear: false,
      shouldReveal: false,
    });
  });

  it("reveals matching markdown documents and clears non-markdown matches", () => {
    expect(
      getPendingWorkspaceSearchRevealDecision(pendingReveal, document()),
    ).toEqual({
      shouldClear: true,
      shouldReveal: true,
    });
    expect(
      getPendingWorkspaceSearchRevealDecision(
        pendingReveal,
        document({ documentType: "html", filePath: "D:/notes/doc.md" }),
      ),
    ).toEqual({
      shouldClear: true,
      shouldReveal: false,
    });
  });
});
