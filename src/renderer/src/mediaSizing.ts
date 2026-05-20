const defaultAspectRatio = 16 / 9;

export function getSafeAspectRatio(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : defaultAspectRatio;
}

export function getProportionalHeight(width: number, aspectRatio: number) {
  return Math.max(1, Math.round(width / getSafeAspectRatio(aspectRatio)));
}

export function getAspectRatioResizeWidth({
  aspectRatio,
  currentX,
  currentY,
  startWidth,
  startX,
  startY,
}: {
  aspectRatio: number;
  currentX: number;
  currentY: number;
  startWidth: number;
  startX: number;
  startY: number;
}) {
  const safeAspectRatio = getSafeAspectRatio(aspectRatio);
  const deltaX = currentX - startX;
  const deltaYAsWidth = (currentY - startY) * safeAspectRatio;
  const dominantDelta =
    Math.abs(deltaX) >= Math.abs(deltaYAsWidth) ? deltaX : deltaYAsWidth;

  return startWidth + dominantDelta;
}
