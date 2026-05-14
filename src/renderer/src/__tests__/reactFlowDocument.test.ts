import { describe, expect, it } from "vitest";
import {
  createDefaultReactFlowDiagram,
  createReactFlowHtmlEmbed,
  createReactFlowMarkdown,
  isReactFlowLanguage,
  parseReactFlowDiagramData,
  replaceReactFlowHtmlEmbed,
  replaceReactFlowMarkdownBlock,
  serializeReactFlowDiagramData,
} from "../reactFlowDocument";

describe("reactFlowDocument", () => {
  it("parses and normalizes React Flow diagram data", () => {
    const data = parseReactFlowDiagramData(
      JSON.stringify({
        nodes: [{ id: "a", position: { x: 10, y: 20 }, data: { label: "A" } }],
        edges: [{ source: "a", target: "b" }],
      }),
    );

    expect(data.nodes[0].data.label).toBe("A");
    expect(data.edges[0].id).toBe("edge-1");
  });

  it("recognizes supported fenced code languages", () => {
    expect(isReactFlowLanguage("react-flow")).toBe(true);
    expect(isReactFlowLanguage("reactflow")).toBe(true);
    expect(isReactFlowLanguage("mermaid")).toBe(false);
  });

  it("replaces markdown and html embeds", () => {
    const initial = createDefaultReactFlowDiagram();
    const next = {
      ...initial,
      nodes: [{ ...initial.nodes[0], data: { label: "Next" } }],
      edges: [],
    };
    const markdown = createReactFlowMarkdown(initial);
    const html = createReactFlowHtmlEmbed(initial);

    expect(
      replaceReactFlowMarkdownBlock(markdown, serializeReactFlowDiagramData(initial), next),
    ).toContain('"Next"');
    expect(replaceReactFlowHtmlEmbed(html, 0, next)).toContain('"Next"');
  });
});
