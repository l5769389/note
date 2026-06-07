import { describe, expect, it } from "vitest";
import {
  createDefaultExcalidrawScene,
  createDrawingAssetFromDocument,
  createExcalidrawImageTitle,
  findExcalidrawMarkdownImage,
} from "../drawingDocument";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "drawing",
    drawings: {},
    id: "drawing-1",
    title: "Sketch",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("drawing document helpers", () => {
  it("creates an empty Excalidraw scene", () => {
    expect(JSON.parse(createDefaultExcalidrawScene())).toMatchObject({
      type: "excalidraw",
      version: 2,
      appState: {
        viewBackgroundColor: "#ffffff",
      },
    });
  });

  it("creates a drawing asset from a document", () => {
    expect(
      createDrawingAssetFromDocument(document({ content: '{"type":"custom"}' })),
    ).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "drawing-1",
      name: "Sketch",
      sceneJSON: '{"type":"custom"}',
    });
  });

  it("finds Excalidraw markdown images by drawing id", () => {
    const title = createExcalidrawImageTitle(
      "drawing-1",
      ".assets/sketch.excalidraw",
      "Original width=320 align=center",
    );

    expect(
      findExcalidrawMarkdownImage(
        `![Sketch](preview.png "${title}")`,
        "drawing-1",
      ),
    ).toEqual({
      alt: "Sketch",
      sceneReference: ".assets/sketch.excalidraw",
      src: "preview.png",
      title,
    });
  });

  it("replaces stale drawing markers while preserving image layout metadata", () => {
    expect(
      createExcalidrawImageTitle(
        "next",
        "scene.json",
        "Old excalidraw:prev scene=old.json width=240 align=right",
      ),
    ).toBe("Old excalidraw:next scene=scene.json width=240 align=right");
  });

  it("uses a readable default preview size for newly inserted drawings", () => {
    expect(createExcalidrawImageTitle("next", "scene.json")).toBe(
      "excalidraw:next scene=scene.json width=640 align=center",
    );
  });
});
