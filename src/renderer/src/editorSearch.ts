import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { InlineCodeRange } from "./editorPluginState";

export function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase();
}

export function findVisibleSearchRange(
  doc: ProseMirrorNode,
  query: string,
  occurrenceIndex: number,
): InlineCodeRange | null {
  if (!query) {
    return null;
  }

  let visibleText = "";
  const positions: number[] = [];

  doc.descendants((node: ProseMirrorNode, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    for (let index = 0; index < node.text.length; index += 1) {
      visibleText += node.text[index];
      positions.push(pos + index);
    }
  });

  const normalizedText = normalizeSearchText(visibleText);
  const normalizedQuery = normalizeSearchText(query);
  const targetOccurrence = Math.max(0, occurrenceIndex);
  let searchFrom = 0;
  let seen = 0;

  while (searchFrom <= normalizedText.length) {
    const start = normalizedText.indexOf(normalizedQuery, searchFrom);

    if (start < 0) {
      return null;
    }

    const end = start + query.length;

    if (seen === targetOccurrence) {
      const from = positions[start];
      const last = positions[end - 1];

      if (from === undefined || last === undefined) {
        return null;
      }

      return { from, to: last + 1 };
    }

    seen += 1;
    searchFrom = end;
  }

  return null;
}

export function centerEditorRangeInView(
  view: EditorView,
  scrollRoot: HTMLElement | null,
  range: InlineCodeRange,
) {
  requestAnimationFrame(() => {
    const root =
      scrollRoot ?? (view.dom.closest(".typora-editor") as HTMLElement | null);

    if (!root) {
      return;
    }

    try {
      const docSize = view.state.doc.content.size;
      const from = Math.max(0, Math.min(range.from, docSize));
      const to = Math.max(from, Math.min(range.to, docSize));
      const fromCoords = view.coordsAtPos(from);
      const toCoords = view.coordsAtPos(to);
      const targetCenter = (fromCoords.top + toCoords.bottom) / 2;
      const rootRect = root.getBoundingClientRect();
      const viewportCenter = rootRect.top + root.clientHeight / 2;
      const nextTop = root.scrollTop + targetCenter - viewportCenter;

      root.scrollTo({
        behavior: "smooth",
        top: Math.max(0, nextTop),
      });
    } catch {
      const highlighted = view.dom.querySelector(".typora-search-active-highlight");

      highlighted?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  });
}

