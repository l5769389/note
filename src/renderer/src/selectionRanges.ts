export function selectionTouchesRange(
  selectionFrom: number,
  selectionTo: number,
  rangeFrom: number,
  rangeTo: number,
) {
  if (selectionFrom === selectionTo) {
    return selectionFrom >= rangeFrom && selectionFrom <= rangeTo;
  }

  return selectionFrom < rangeTo && selectionTo > rangeFrom;
}

export function selectionTouchesInlineCodeRange(
  selectionFrom: number,
  selectionTo: number,
  rangeFrom: number,
  rangeTo: number,
) {
  if (selectionFrom === selectionTo) {
    return selectionFrom >= rangeFrom && selectionFrom <= rangeTo + 1;
  }

  return selectionTouchesRange(selectionFrom, selectionTo, rangeFrom, rangeTo);
}
