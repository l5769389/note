import { describe, expect, it } from "vitest";
import {
  addMindMapChild,
  addMindMapSibling,
  createDefaultMindMapDiagram,
  createMindMapHtmlEmbed,
  createMindMapMarkdown,
  deleteMindMapNode,
  isMindMapLanguage,
  layoutMindMapDiagram,
  parseMindMapDiagramData,
  replaceMindMapHtmlEmbed,
  replaceMindMapMarkdownBlock,
  serializeMindMapDiagramData,
  updateMindMapNode,
} from "../mindMapDocument";

describe("mindMapDocument", () => {
  it("recognizes mindmap fenced code languages", () => {
    expect(isMindMapLanguage("mindmap")).toBe(true);
    expect(isMindMapLanguage("mind-map")).toBe(true);
    expect(isMindMapLanguage("xmind-map")).toBe(true);
    expect(isMindMapLanguage("react-flow")).toBe(false);
  });

  it("parses markdown outlines into a semantic mind map tree", () => {
    const data = parseMindMapDiagramData(`# Root
## A
### A1
## B`);

    expect(data.root.text).toBe("Root");
    expect(data.root.children?.map((child) => child.text)).toEqual(["A", "B"]);
    expect(data.root.children?.[0].children?.[0].text).toBe("A1");
  });

  it("normalizes JSON and assigns balanced root sides", () => {
    const data = parseMindMapDiagramData(
      JSON.stringify({
        root: {
          text: "Center",
          children: [{ text: "A" }, { text: "B" }, { text: "C" }],
        },
      }),
    );

    expect(data.root.children?.map((child) => child.side)).toEqual([
      "right",
      "left",
      "right",
    ]);
  });

  it("creates flow nodes and edges from the mind map tree", () => {
    const layout = layoutMindMapDiagram(createDefaultMindMapDiagram());

    expect(layout.nodes.some((node) => node.data.level === 0)).toBe(true);
    expect(layout.edges.length).toBeGreaterThan(0);
  });

  it("supports editing tree operations", () => {
    let data = createDefaultMindMapDiagram();
    const child = addMindMapChild(data, data.root.id, "Feature");
    data = child.data;
    const sibling = addMindMapSibling(data, child.nodeId, "Peer");
    data = sibling.data;
    data = updateMindMapNode(data, child.nodeId, { text: "Updated" });

    expect(serializeMindMapDiagramData(data)).toContain("Updated");

    data = deleteMindMapNode(data, child.nodeId);

    expect(serializeMindMapDiagramData(data)).not.toContain("Updated");
  });

  it("replaces markdown and html embeds", () => {
    const initial = createDefaultMindMapDiagram();
    const next = updateMindMapNode(initial, initial.root.id, { text: "Next" });
    const markdown = createMindMapMarkdown(initial);
    const html = createMindMapHtmlEmbed(initial);

    expect(
      replaceMindMapMarkdownBlock(markdown, serializeMindMapDiagramData(initial), next),
    ).toContain("Next");
    expect(replaceMindMapHtmlEmbed(html, 0, next)).toContain("Next");
  });
});
