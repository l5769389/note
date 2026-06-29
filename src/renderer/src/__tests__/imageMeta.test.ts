import { describe, expect, it } from "vitest";
import {
  clampImageWidth,
  getExcalidrawDrawingId,
  getExcalidrawSceneReference,
  parseImageMeta,
  patchExcalidrawSceneReference,
  patchImageMetaTitle,
  serializeImageMeta,
} from "../imageMeta";

describe("image metadata helpers", () => {
  it("parses image titles, width, and alignment metadata", () => {
    expect(parseImageMeta("Cover image width=2048px align=Center")).toEqual({
      align: "center",
      hasExplicitAlign: true,
      titleText: "Cover image",
      width: 900,
    });
    expect(parseImageMeta("width=40 align=right")).toEqual({
      align: "right",
      hasExplicitAlign: true,
      titleText: "",
      width: 120,
    });
    expect(parseImageMeta()).toEqual({
      align: "left",
      hasExplicitAlign: false,
      titleText: "",
      width: undefined,
    });
  });

  it("serializes metadata with clamped widths", () => {
    expect(clampImageWidth(240.6)).toBe(241);
    expect(
      serializeImageMeta({
        align: "right",
        hasExplicitAlign: true,
        titleText: "Logo",
        width: 1200,
      }),
    ).toBe("Logo width=900 align=right");
    expect(
      serializeImageMeta({
        align: "left",
        hasExplicitAlign: true,
        titleText: "",
        width: undefined,
      }),
    ).toBe("align=left");
    expect(
      serializeImageMeta({
        align: "left",
        hasExplicitAlign: false,
        titleText: "",
        width: undefined,
      }),
    ).toBe("");
  });

  it("patches image width and alignment without losing the human title", () => {
    expect(patchImageMetaTitle("Diagram width=320 align=left", { align: "center" })).toBe(
      "Diagram width=320 align=center",
    );
    expect(patchImageMetaTitle("Diagram width=320 align=right", { width: undefined })).toBe(
      "Diagram align=right",
    );
    expect(patchImageMetaTitle("Diagram width=320", { width: 400 })).toBe(
      "Diagram width=400",
    );
    expect(patchImageMetaTitle("Diagram width=320", { align: "center" })).toBe(
      "Diagram width=320 align=center",
    );
  });

  it("reads and updates Excalidraw scene references inside title text", () => {
    expect(getExcalidrawDrawingId("Sketch excalidraw:drawing-1 width=320")).toBe(
      "drawing-1",
    );
    expect(getExcalidrawSceneReference("Sketch scene=.assets/scene.json")).toBe(
      ".assets/scene.json",
    );

    expect(
      patchExcalidrawSceneReference(
        "Sketch scene=.assets/old.json width=240 align=center",
        ".assets/new.json",
      ),
    ).toBe("Sketch scene=.assets/new.json width=240 align=center");
  });
});
