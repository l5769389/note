import { describe, expect, it } from "vitest";
import { getImageDisplayName } from "../components/ImageToolbar";

function imageNode(attrs: Record<string, unknown>) {
  return { attrs } as Parameters<typeof getImageDisplayName>[0];
}

describe("image toolbar helpers", () => {
  it("prefers image alt text as the display name", () => {
    expect(getImageDisplayName(imageNode({ alt: "Architecture", src: "x.png" }))).toBe(
      "Architecture",
    );
  });

  it("uses decoded filenames for ordinary image sources", () => {
    expect(
      getImageDisplayName(
        imageNode({ alt: "", src: "D:/assets/flow%20chart.png?version=1" }),
      ),
    ).toBe("flow chart.png");
  });

  it("labels embedded Excalidraw images distinctly", () => {
    expect(
      getImageDisplayName(
        imageNode({
          src: "data:image/png;base64,abc",
          title: "excalidraw:drawing-1 align=left",
        }),
      ),
    ).toBe("Excalidraw");
  });
});

