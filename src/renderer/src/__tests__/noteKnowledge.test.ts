import { describe, expect, it } from "vitest";
import {
  addMarkdownTag,
  createMarkdownNoteContent,
  createWorkspaceKnowledge,
  parseDocumentKnowledge,
  removeMarkdownProperty,
  removeMarkdownTag,
  upsertMarkdownProperty,
} from "../noteKnowledge";
import type { MarkdownDocument } from "../types";

function documentFixture(
  id: string,
  title: string,
  content: string,
  filePath = `D:\\notes\\${title}.md`,
): MarkdownDocument {
  return {
    id,
    title,
    content,
    createdAt: "2026-05-21T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    fileExtension: ".md",
    filePath,
    updatedAt: "2026-05-21T00:00:00.000Z",
  };
}

describe("noteKnowledge", () => {
  it("extracts frontmatter tags, inline tags, properties, and wiki links", () => {
    const knowledge = parseDocumentKnowledge(
      documentFixture(
        "a",
        "Project",
        [
          "---",
          "tags: [work, idea]",
          "status: active",
          "---",
          "",
          "# Project",
          "Linked to [[Daily Note|today]] and #research.",
        ].join("\n"),
      ),
    );

    expect(knowledge.tags).toEqual(["work", "idea", "research"]);
    expect(knowledge.properties).toEqual([{ key: "status", value: "active" }]);
    expect(knowledge.links).toMatchObject([
      {
        display: "today",
        normalizedTarget: "daily note",
        target: "Daily Note",
      },
    ]);
  });

  it("builds outgoing links and backlinks across the workspace", () => {
    const project = documentFixture(
      "project",
      "Project",
      "See [[Daily Note]] and [[Missing Note]].",
    );
    const daily = documentFixture(
      "daily",
      "Daily Note",
      "# Daily Note",
      "D:\\notes\\journal\\Daily Note.md",
    );

    const knowledge = createWorkspaceKnowledge([project, daily]);

    expect(
      knowledge.outgoingLinksByDocumentId
        .get(project.id)
        ?.map((link) => link.targetDocument?.id ?? null),
    ).toEqual(["daily", null]);
    expect(
      knowledge.backlinksByDocumentId
        .get(daily.id)
        ?.map((backlink) => backlink.sourceDocument.id),
    ).toEqual(["project"]);
  });

  it("updates tags and simple properties in frontmatter", () => {
    const content = [
      "---",
      "tags:",
      "  - inbox",
      "status: draft",
      "---",
      "",
      "# Note",
    ].join("\n");

    const withTag = addMarkdownTag(content, "work");
    expect(withTag).toContain("tags: [inbox, work]");

    const withoutTag = removeMarkdownTag(withTag, "inbox");
    expect(withoutTag).toContain("tags: [work]");

    const withProperty = upsertMarkdownProperty(withoutTag, "review state", "ready");
    expect(withProperty).toContain("review-state: ready");

    expect(removeMarkdownProperty(withProperty, "status")).not.toContain(
      "status:",
    );
  });

  it("creates a note with title, tags, and capture metadata", () => {
    expect(
      createMarkdownNoteContent({
        body: "Captured text",
        properties: { source: "quick-capture" },
        tags: ["inbox"],
        title: "Idea",
      }),
    ).toBe(
      [
        "---",
        "tags: [inbox]",
        "source: quick-capture",
        "---",
        "",
        "# Idea",
        "",
        "Captured text",
        "",
      ].join("\n"),
    );
  });
});
