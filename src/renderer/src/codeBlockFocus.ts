import { selectionTouchesRange } from "./selectionRanges";

export type EmptyCodeBlockFocusCandidate = {
  nodeSize: number;
  pos: number;
  textContent: string;
};

export type EmptyCodeBlockSelection = {
  from: number;
  to: number;
};

export function getEmptyCodeBlockContentPosition(
  block: EmptyCodeBlockFocusCandidate,
) {
  return block.textContent.length === 0 ? block.pos + 1 : null;
}

export function selectionIsInsideOrNearEmptyCodeBlock(
  selection: EmptyCodeBlockSelection,
  block: EmptyCodeBlockFocusCandidate,
  margin = 2,
) {
  if (block.textContent.length > 0) {
    return false;
  }

  const blockFrom = block.pos;
  const blockTo = block.pos + block.nodeSize;
  const selectionFrom = Math.min(selection.from, selection.to);
  const selectionTo = Math.max(selection.from, selection.to);

  if (selectionTouchesRange(selectionFrom, selectionTo, blockFrom, blockTo)) {
    return true;
  }

  if (selectionFrom !== selectionTo) {
    return false;
  }

  return selectionFrom >= blockFrom - margin && selectionFrom <= blockTo + margin;
}

export function getNewEmptyCodeBlockFocusPosition({
  block,
  selection,
  wasCodeBlockAtSamePosition,
}: {
  block: EmptyCodeBlockFocusCandidate;
  selection: EmptyCodeBlockSelection;
  wasCodeBlockAtSamePosition: boolean;
}) {
  if (wasCodeBlockAtSamePosition) {
    return null;
  }

  if (!selectionIsInsideOrNearEmptyCodeBlock(selection, block)) {
    return null;
  }

  return getEmptyCodeBlockContentPosition(block);
}
