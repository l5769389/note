import { describe, expect, it } from "vitest";
import { writeWorkspaceDirtyDocuments } from "../workspaceAutosave";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "content",
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

describe("workspace autosave helpers", () => {
  it("skips writes when there is no writer or no dirty document", async () => {
    await expect(
      writeWorkspaceDirtyDocuments({
        acknowledgeSavedFileContent: () => {},
        documents: [],
        rememberInternalFileWrite: () => {},
      }),
    ).resolves.toBe(false);

    await expect(
      writeWorkspaceDirtyDocuments({
        acknowledgeSavedFileContent: () => {},
        documents: [document()],
        rememberInternalFileWrite: () => {},
      }),
    ).resolves.toBe(false);
  });

  it("marks internal writes before writing and acknowledges saved content after", async () => {
    const events: string[] = [];

    await expect(
      writeWorkspaceDirtyDocuments({
        acknowledgeSavedFileContent: (filePath, content) => {
          events.push(`ack:${filePath}:${content}`);
        },
        documents: [document({ content: "next" })],
        rememberInternalFileWrite: (filePath, content) => {
          events.push(`remember:${filePath}:${content}`);
        },
        writeMarkdownFile: async ({ content, filePath }) => {
          events.push(`write:${filePath}:${content}`);
        },
      }),
    ).resolves.toBe(true);

    expect(events).toEqual([
      "remember:D:/notes/doc.md:next",
      "write:D:/notes/doc.md:next",
      "ack:D:/notes/doc.md:next",
    ]);
  });
});
