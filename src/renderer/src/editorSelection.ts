import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { AllSelection, Selection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { selectionTouchesRange } from "./selectionRanges";

export function selectionTouchesNode(
  selection: Selection,
  pos: number,
  node: ProseMirrorNode,
) {
  const from = pos;
  const to = pos + node.nodeSize;

  if (selectionTouchesRange(selection.from, selection.to, from, to)) {
    return true;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    if (selection.$from.before(depth) === pos) {
      return true;
    }
  }

  for (let depth = selection.$to.depth; depth > 0; depth -= 1) {
    if (selection.$to.before(depth) === pos) {
      return true;
    }
  }

  return false;
}

export function isSelectAllShortcut(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === "a" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function selectEntireDocument(view: EditorView) {
  view.dispatch(
    view.state.tr
      .setSelection(new AllSelection(view.state.doc))
      .scrollIntoView(),
  );
  view.focus();
}

