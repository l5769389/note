import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentKnowledgeBar } from "../components/DocumentKnowledgeBar";
import type { DocumentKnowledge, NoteWikiLink } from "../noteKnowledge";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    id: "doc",
    title: "Document",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function wikiLink(overrides: Partial<NoteWikiLink> = {}): NoteWikiLink {
  return {
    display: "Target",
    index: 0,
    normalizedTarget: "target",
    raw: "[[Target]]",
    target: "Target",
    ...overrides,
  };
}

function renderKnowledgeBar(
  overrides: Partial<Parameters<typeof DocumentKnowledgeBar>[0]> = {},
) {
  const sourceDocument = document({
    content: "# Source",
    filePath: "D:/notes/source.md",
    id: "source",
    title: "Source",
  });
  const targetDocument = document({
    filePath: "D:/notes/target.md",
    id: "target",
    title: "Target",
  });
  const knowledge: DocumentKnowledge = {
    document: sourceDocument,
    frontmatterTags: [],
    inlineTags: [],
    links: [],
    metadataProperties: [{ key: "status", value: "draft" }],
    metadataTags: ["project"],
    properties: [{ key: "status", value: "draft" }],
    tags: ["project"],
  };

  return renderToStaticMarkup(
    <DocumentKnowledgeBar
      activeDocument={sourceDocument}
      activeSuggestion={null}
      backlinks={[]}
      isEditorOpen={false}
      knowledge={knowledge}
      missingLinks={[]}
      newTagName=""
      outgoingLinks={[wikiLink({ targetDocument })]}
      propertyKeyDraft=""
      propertyKeySuggestions={[]}
      propertyValueDraft=""
      propertyValueSuggestions={[]}
      relatedDocuments={[
        {
          document: targetDocument,
          link: {
            createdAt: "2026-01-01T00:00:00.000Z",
            documentType: "markdown",
            filePath: "D:/notes/target.md",
            title: "Target",
          },
        },
      ]}
      tagSuggestions={[]}
      wikiLinkInputRef={createRef<HTMLInputElement>()}
      wikiLinkTargetDraft=""
      onAddTag={() => {}}
      onCreateMissingWikiLink={() => {}}
      onInsertWikiLink={() => {}}
      onOpenDocument={() => {}}
      onOpenDocumentLinkPicker={() => {}}
      onOpenRelatedDocument={() => {}}
      onOpenWikiLinkInsertForm={() => {}}
      onRemoveDocumentLink={() => {}}
      onRemoveProperty={() => {}}
      onRemoveTag={() => {}}
      onSaveProperty={() => {}}
      onSetActiveSuggestion={() => {}}
      onSetEditorOpen={() => {}}
      onSetNewTagName={() => {}}
      onSetPropertyKeyDraft={() => {}}
      onSetPropertyValueDraft={() => {}}
      onSetWikiLinkTargetDraft={() => {}}
      {...overrides}
    />,
  );
}

describe("DocumentKnowledgeBar", () => {
  it("renders compact relation counts", () => {
    const html = renderKnowledgeBar();

    expect(html).toContain("笔记链接 1");
    expect(html).toContain("相关文档 1");
    expect(html).toContain("编辑");
  });

  it("renders expanded metadata editor and suggestions", () => {
    const html = renderKnowledgeBar({
      activeSuggestion: "tag",
      isEditorOpen: true,
      newTagName: "pro",
      tagSuggestions: ["project"],
    });

    expect(html).toContain("文档信息");
    expect(html).toContain("#project");
    expect(html).toContain("status");
    expect(html).toContain("添加相关文档");
  });

  it("renders metadata editor for non-markdown documents", () => {
    const pdfDocument = document({
      documentType: "pdf",
      fileExtension: ".pdf",
      filePath: "D:/notes/spec.pdf",
      id: "spec",
      metadata: {
        documentLinks: [],
        properties: [{ key: "status", value: "reference" }],
        tags: ["asset"],
      },
      title: "Spec",
    });
    const knowledge: DocumentKnowledge = {
      document: pdfDocument,
      frontmatterTags: [],
      inlineTags: [],
      links: [],
      metadataProperties: [{ key: "status", value: "reference" }],
      metadataTags: ["asset"],
      properties: [{ key: "status", value: "reference" }],
      tags: ["asset"],
    };

    const html = renderKnowledgeBar({
      activeDocument: pdfDocument,
      isEditorOpen: true,
      knowledge,
      outgoingLinks: [],
      relatedDocuments: [],
    });

    expect(html).toContain("#asset");
    expect(html).toContain("status");
    expect(html).toContain("添加相关文档");
    expect(html).not.toContain("插入笔记链接");
  });

  it("can hide missing relation hints in dialog mode", () => {
    const html = renderKnowledgeBar({
      isEditorOpen: true,
      missingLinks: [
        wikiLink({ display: "Missing", raw: "[[Missing]]", target: "Missing" }),
      ],
      showMissingRelations: false,
    });

    expect(html).not.toContain("缺失");
    expect(html).not.toContain("[[Missing]]");
  });
});
