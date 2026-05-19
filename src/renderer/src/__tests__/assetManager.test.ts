import { describe, expect, it } from "vitest";
import {
  createAssetFileName,
  extractLocalAssetReferences,
  isLocalAssetReference,
  replaceAssetReference,
} from "../assetManager";

describe("assetManager", () => {
  it("recognizes local workspace asset references", () => {
    expect(isLocalAssetReference(".assets/image.png")).toBe(true);
    expect(isLocalAssetReference("./.assets/sheet.univer.json")).toBe(true);
    expect(isLocalAssetReference("https://example.com/image.png")).toBe(false);
    expect(isLocalAssetReference("notes/image.png")).toBe(false);
  });

  it("extracts image, html, and sheet asset references from markdown", () => {
    const references = extractLocalAssetReferences(`
![demo](.assets/demo.png "align=center")
![sketch](.assets/sketch.png "excalidraw:drawing-1 scene=.assets/sketch.excalidraw.json align=center")
<img src="./.assets/raw.svg" alt="raw" />
\`\`\`univer-sheet
{"title":"Sheet","version":1,"assetPath":".assets/sheet.univer.json"}
\`\`\`
`);

    expect(references).toEqual([
      { kind: "image", reference: ".assets/demo.png" },
      { kind: "image", reference: ".assets/sketch.png" },
      { kind: "drawing", reference: ".assets/sketch.excalidraw.json" },
      { kind: "html", reference: "./.assets/raw.svg" },
      { kind: "sheet", reference: ".assets/sheet.univer.json" },
    ]);
  });

  it("normalizes generated asset names and reference updates", () => {
    expect(createAssetFileName("  Demo  Card.png  ", "asset")).toBe("Demo Card.png");
    expect(replaceAssetReference("![x](.assets/a.png)", ".assets/a.png", ".assets/b.png")).toBe(
      "![x](.assets/b.png)",
    );
  });
});
