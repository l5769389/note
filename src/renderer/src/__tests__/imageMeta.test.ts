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
      fit: "auto",
      hasExplicitAlign: true,
      hasExplicitFit: false,
      titleText: "Cover image",
      width: 900,
    });
    expect(parseImageMeta("width=40 align=right")).toEqual({
      align: "right",
      fit: "auto",
      hasExplicitAlign: true,
      hasExplicitFit: false,
      titleText: "",
      width: 120,
    });
    expect(parseImageMeta()).toEqual({
      align: "left",
      fit: "auto",
      hasExplicitAlign: false,
      hasExplicitFit: false,
      titleText: "",
      width: undefined,
    });
    expect(parseImageMeta("Preview fit=cover width=500")).toEqual({
      align: "left",
      fit: "cover",
      hasExplicitAlign: false,
      hasExplicitFit: true,
      titleText: "Preview",
      width: 500,
    });
  });

  it("serializes metadata with clamped widths", () => {
    expect(clampImageWidth(240.6)).toBe(241);
    expect(
      serializeImageMeta({
        align: "right",
        fit: "auto",
        hasExplicitAlign: true,
        hasExplicitFit: false,
        titleText: "Logo",
        width: 1200,
      }),
    ).toBe("Logo width=900 align=right");
    expect(
      serializeImageMeta({
        align: "left",
        fit: "auto",
        hasExplicitAlign: true,
        hasExplicitFit: false,
        titleText: "",
        width: undefined,
      }),
    ).toBe("align=left");
    expect(
      serializeImageMeta({
        align: "left",
        fit: "auto",
        hasExplicitAlign: false,
        hasExplicitFit: false,
        titleText: "",
        width: undefined,
      }),
    ).toBe("");
    expect(
      serializeImageMeta({
        align: "left",
        fit: "contain",
        hasExplicitAlign: false,
        hasExplicitFit: true,
        titleText: "",
        width: undefined,
      }),
    ).toBe("fit=contain");
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
    expect(patchImageMetaTitle("Diagram width=320", { fit: "cover" })).toBe(
      "Diagram width=320 fit=cover",
    );
    expect(patchImageMetaTitle("Diagram fit=cover", { fit: "auto" })).toBe("Diagram");
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
