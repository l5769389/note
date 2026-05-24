import { describe, expect, it } from "vitest";
import {
  getTagInputValues,
  normalizeDocumentMetadata,
} from "../documentMetadata";
import type { DocumentMetadata } from "../types";

describe("document metadata helpers", () => {
  it("parses tag input into normalized unique tags", () => {
    expect(getTagInputValues(" Inbox,project  inbox #Daily ")).toEqual([
      "Inbox",
      "project",
      "Daily",
    ]);
  });

  it("normalizes metadata tags, properties, and document links", () => {
    const metadata: DocumentMetadata = {
      documentLinks: [
        {
          createdAt: "",
          documentType: "markdown",
          filePath: " D:/Notes/A.md ",
          title: "",
        },
        {
          createdAt: "older",
          documentType: "markdown",
          filePath: "d:/notes/a.md",
          title: "Duplicate",
        },
        {
          createdAt: "",
          documentType: "markdown",
          filePath: "",
          title: "",
        },
      ],
      properties: [
        { key: " Status ", value: " Draft " },
        { key: "status", value: "Final" },
        { key: " ", value: "Ignored" },
      ],
      tags: [" Inbox ", "#inbox", "Project"],
    };

    expect(normalizeDocumentMetadata(metadata, () => "now")).toEqual({
      documentLinks: [
        {
          createdAt: "now",
          documentType: "markdown",
          filePath: "D:/Notes/A.md",
          title: "A.md",
        },
      ],
      properties: [{ key: "Status", value: "Draft" }],
      tags: ["Inbox", "Project"],
    });
  });
});
