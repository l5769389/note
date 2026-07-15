import { describe, expect, it } from "vitest";
import {
  clampImageWidth,
  getExcalidrawDrawingId,
  getExcalidrawSceneReference,
  getDefaultImageFitMode,
  getImageResizeStartWidth,
  parseImageMeta,
  patchExcalidrawSceneReference,
  patchImageMetaTitle,
  serializeImageMeta,
} from "../imageMeta";

describe("image metadata helpers", () => {
  it("uses the current rendered width as the next resize baseline", () => {
    expect(getImageResizeStartWidth(438.4, 640)).toBe(438);
    expect(getImageResizeStartWidth(null, 640)).toBe(640);
    expect(getImageResizeStartWidth(undefined, undefined)).toBe(120);
  });

  it("keeps auto images contained by default", () => {
    expect(getDefaultImageFitMode(2400, 800)).toBe("contain");
    expect(getDefaultImageFitMode(480, 1200)).toBe("contain");
    expect(getDefaultImageFitMode(undefined, undefined)).toBe("contain");
  });

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
    expect(parseImageMeta("Inline preview fit=compact")).toEqual({
      align: "left",
      fit: "compact",
      hasExplicitAlign: false,
      hasExplicitFit: true,
      titleText: "Inline preview",
      width: undefined,
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
        fit: "compact",
        hasExplicitAlign: false,
        hasExplicitFit: true,
        titleText: "",
        width: undefined,
      }),
    ).toBe("fit=compact");
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
    expect(patchImageMetaTitle("Screenshot fit=compact", { width: 240, fit: "auto" })).toBe(
      "Screenshot width=240",
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
