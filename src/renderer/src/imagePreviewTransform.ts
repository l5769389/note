export type ImagePreviewPoint = {
  x: number;
  y: number;
};

export type ImagePreviewTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

export const defaultImagePreviewTransform: ImagePreviewTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

export const minImagePreviewScale = 0.25;
export const maxImagePreviewScale = 6;

export function clampImagePreviewScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return 1;
  }

  return Math.min(maxImagePreviewScale, Math.max(minImagePreviewScale, scale));
}

export function translateImagePreview(
  transform: ImagePreviewTransform,
  deltaX: number,
  deltaY: number,
): ImagePreviewTransform {
  return {
    ...transform,
    offsetX: transform.offsetX + deltaX,
    offsetY: transform.offsetY + deltaY,
  };
}

export function zoomImagePreviewAtPoint(
  transform: ImagePreviewTransform,
  nextScale: number,
  point: ImagePreviewPoint,
  viewport: DOMRect | { left: number; top: number; width: number; height: number },
): ImagePreviewTransform {
  const scale = clampImagePreviewScale(nextScale);
  const relativeX = point.x - viewport.left - viewport.width / 2;
  const relativeY = point.y - viewport.top - viewport.height / 2;

  return {
    offsetX:
      relativeX -
      scale * ((relativeX - transform.offsetX) / transform.scale),
    offsetY:
      relativeY -
      scale * ((relativeY - transform.offsetY) / transform.scale),
    scale,
  };
}

export function zoomImagePreviewFromGesture(
  startTransform: ImagePreviewTransform,
  nextScale: number,
  startPoint: ImagePreviewPoint,
  currentPoint: ImagePreviewPoint,
  viewport: DOMRect | { left: number; top: number; width: number; height: number },
): ImagePreviewTransform {
  const scale = clampImagePreviewScale(nextScale);
  const startRelativeX = startPoint.x - viewport.left - viewport.width / 2;
  const startRelativeY = startPoint.y - viewport.top - viewport.height / 2;
  const currentRelativeX = currentPoint.x - viewport.left - viewport.width / 2;
  const currentRelativeY = currentPoint.y - viewport.top - viewport.height / 2;

  return {
    offsetX:
      currentRelativeX -
      scale * ((startRelativeX - startTransform.offsetX) / startTransform.scale),
    offsetY:
      currentRelativeY -
      scale * ((startRelativeY - startTransform.offsetY) / startTransform.scale),
    scale,
  };
}
