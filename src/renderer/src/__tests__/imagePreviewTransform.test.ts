import { describe, expect, it } from "vitest";
import {
  clampImagePreviewScale,
  defaultImagePreviewTransform,
  translateImagePreview,
  zoomImagePreviewAtPoint,
  zoomImagePreviewFromGesture,
} from "../imagePreviewTransform";

const viewport = {
  height: 600,
  left: 100,
  top: 50,
  width: 800,
};

function contentCoordinateAtPoint(
  transform: { offsetX: number; offsetY: number; scale: number },
  point: { x: number; y: number },
) {
  const relativeX = point.x - viewport.left - viewport.width / 2;
  const relativeY = point.y - viewport.top - viewport.height / 2;

  return {
    x: (relativeX - transform.offsetX) / transform.scale,
    y: (relativeY - transform.offsetY) / transform.scale,
  };
}

describe("image preview transforms", () => {
  it("keeps the image content under the pointer while zooming", () => {
    const point = { x: 740, y: 410 };
    const before = contentCoordinateAtPoint(defaultImagePreviewTransform, point);
    const next = zoomImagePreviewAtPoint(
      defaultImagePreviewTransform,
      2,
      point,
      viewport,
    );
    const after = contentCoordinateAtPoint(next, point);

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.scale).toBe(2);
  });

  it("keeps pinch content anchored between start and current centers", () => {
    const startPoint = { x: 500, y: 350 };
    const currentPoint = { x: 560, y: 390 };
    const next = zoomImagePreviewFromGesture(
      defaultImagePreviewTransform,
      1.5,
      startPoint,
      currentPoint,
      viewport,
    );
    const startContent = contentCoordinateAtPoint(
      defaultImagePreviewTransform,
      startPoint,
    );
    const currentContent = contentCoordinateAtPoint(next, currentPoint);

    expect(currentContent.x).toBeCloseTo(startContent.x);
    expect(currentContent.y).toBeCloseTo(startContent.y);
  });

  it("clamps scale and translates offsets", () => {
    expect(clampImagePreviewScale(0.01)).toBe(0.25);
    expect(clampImagePreviewScale(20)).toBe(6);
    expect(translateImagePreview(defaultImagePreviewTransform, 12, -8)).toEqual({
      offsetX: 12,
      offsetY: -8,
      scale: 1,
    });
  });
});
