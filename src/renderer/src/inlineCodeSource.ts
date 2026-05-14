import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import {
  Selection,
  TextSelection,
  type EditorState,
} from "@milkdown/kit/prose/state";
import {
  markdownSyntaxPluginKey,
  type InlineCodeRange,
  type MarkdownSyntaxPluginState,
} from "./editorPluginState";

function getInlineCodeMarkTypeFromState(state: EditorState) {
  return Object.values(state.schema.marks).find(
    (markType) => markType.name === "inlineCode" || markType.spec.code,
  );
}

function getInlineCodeRanges(doc: ProseMirrorNode) {
  const ranges: InlineCodeRange[] = [];

  doc.descendants((node: ProseMirrorNode, pos) => {
    if (
      !node.isText ||
      !node.marks.some(
        (mark) => mark.type.name === "inlineCode" || mark.type.spec.code,
      )
    ) {
      return;
    }

    const range = { from: pos, to: pos + node.nodeSize };
    const previousRange = ranges.at(-1);

    if (previousRange && previousRange.to === range.from) {
      previousRange.to = range.to;
      return;
    }

    ranges.push(range);
  });

  return ranges;
}

function getInlineCodeText(doc: ProseMirrorNode, range: InlineCodeRange) {
  return doc.textBetween(range.from, range.to, "\n", "\n");
}

export function isWellFormedInlineCodeSource(source: string) {
  return (
    source.length >= 2 &&
    source.startsWith("`") &&
    source.endsWith("`") &&
    !source.slice(1, -1).includes("`") &&
    source.slice(1, -1).length > 0
  );
}

function getInlineCodeSourceCursorPosition(
  source: string,
  documentPosition: number,
  range: InlineCodeRange,
) {
  if (documentPosition <= range.from) {
    return 1;
  }

  if (documentPosition >= range.to) {
    return source.length;
  }

  return Math.max(1, Math.min(source.length - 1, documentPosition - range.from + 1));
}

function getInlineCodeCommit(
  state: EditorState,
  source: string,
) {
  const markType = getInlineCodeMarkTypeFromState(state);
  const isWellFormedInlineCode =
    Boolean(markType) &&
    isWellFormedInlineCodeSource(source);

  if (!isWellFormedInlineCode) {
    return {
      content: source,
      isInlineCode: false,
      size: source.length,
    };
  }

  const content = source.slice(1, -1);

  if (!content) {
    return {
      content: source,
      isInlineCode: false,
      size: source.length,
    };
  }

  return {
    content,
    isInlineCode: true,
    size: content.length,
  };
}

function selectionIsInsideInlineCodeSource(
  selection: Selection,
  range: InlineCodeRange,
) {
  return selection.from >= range.from && selection.to <= range.to;
}

export function shouldKeepInlineCodeSourceExpanded(
  state: EditorState,
  range: InlineCodeRange,
) {
  const { selection } = state;

  if (!selectionIsInsideInlineCodeSource(selection, range)) {
    return false;
  }

  if (!selection.empty) {
    return true;
  }

  const source = getInlineCodeText(state.doc, range);

  if (selection.from === range.to) {
    return true;
  }

  if (selection.from === range.from) {
    return !isWellFormedInlineCodeSource(source);
  }

  return true;
}

export function findInlineCodeRangeForSelection(
  state: EditorState,
  suppressedPosition: number | null,
) {
  const { selection } = state;

  if (selection.empty && suppressedPosition === selection.from) {
    return null;
  }

  return getInlineCodeRanges(state.doc).find((range) =>
    selectionIsInsideInlineCodeSource(selection, range),
  ) ?? null;
}

export function expandInlineCodeSourceTransaction(
  state: EditorState,
  range: InlineCodeRange,
) {
  const source = `\`${getInlineCodeText(state.doc, range)}\``;
  const selectionFrom = getInlineCodeSourceCursorPosition(
    source,
    state.selection.from,
    range,
  );
  const selectionTo = state.selection.empty
    ? selectionFrom
    : getInlineCodeSourceCursorPosition(source, state.selection.to, range);
  const sourceRange = {
    from: range.from,
    to: range.from + source.length,
  };
  const nextSelectionFrom = sourceRange.from + Math.min(selectionFrom, selectionTo);
  const nextSelectionTo = sourceRange.from + Math.max(selectionFrom, selectionTo);
  let transaction = state.tr.replaceWith(
    range.from,
    range.to,
    state.schema.text(source),
  );

  transaction = transaction
    .setSelection(
      TextSelection.create(
        transaction.doc,
        nextSelectionFrom,
        nextSelectionTo,
      ),
    )
    .setMeta(markdownSyntaxPluginKey, {
      expandedInlineCode: sourceRange,
      suppressedInlineCodeAt: null,
    } satisfies Partial<MarkdownSyntaxPluginState>)
    .setMeta("addToHistory", false);

  return transaction;
}

function normalizeInlineCodeSourceRangeForCommit(
  state: EditorState,
  range: InlineCodeRange,
) {
  let from = Math.max(0, Math.min(range.from, state.doc.content.size));
  let to = Math.max(from, Math.min(range.to, state.doc.content.size));
  let source = getInlineCodeText(state.doc, { from, to });

  if (
    !source.startsWith("`") &&
    from > 0 &&
    state.doc.textBetween(from - 1, from, "\n", "\n") === "`"
  ) {
    from -= 1;
    source = getInlineCodeText(state.doc, { from, to });
  }

  if (
    !source.endsWith("`") &&
    to < state.doc.content.size &&
    state.doc.textBetween(to, to + 1, "\n", "\n") === "`"
  ) {
    to += 1;
  }

  return { from, to };
}

export function collapseInlineCodeSourceTransaction(
  state: EditorState,
  range: InlineCodeRange,
) {
  const commitRange = normalizeInlineCodeSourceRangeForCommit(state, range);
  const source = state.doc.textBetween(commitRange.from, commitRange.to, "\n", "\n");
  const markType = getInlineCodeMarkTypeFromState(state);
  const commit = getInlineCodeCommit(state, source);
  let transaction = state.tr;

  if (!commit.content) {
    transaction = transaction.delete(commitRange.from, commitRange.to);
  } else if (commit.isInlineCode && markType) {
    transaction = transaction.replaceWith(
      commitRange.from,
      commitRange.to,
      state.schema.text(commit.content, [markType.create()]),
    );
  } else if (commit.content !== source) {
    transaction = transaction.replaceWith(
      commitRange.from,
      commitRange.to,
      state.schema.text(commit.content),
    );
  }

  const suppressedInlineCodeAt = state.selection.empty
    ? transaction.mapping.map(state.selection.from, 1)
    : null;

  return transaction
    .setMeta(markdownSyntaxPluginKey, {
      expandedInlineCode: null,
      suppressedInlineCodeAt,
    } satisfies Partial<MarkdownSyntaxPluginState>)
    .setMeta("addToHistory", false);
}

export function findPlainInlineCodeSourceForSelection(state: EditorState) {
  const markType = getInlineCodeMarkTypeFromState(state);
  const { selection } = state;

  if (!markType || !selection.empty) {
    return null;
  }

  const { $from } = selection;

  if (!$from.parent.inlineContent || $from.parent.type.name === "code_block") {
    return null;
  }

  const blockStart = $from.start();
  const textBeforeCursor = state.doc.textBetween(
    blockStart,
    selection.from,
    "\n",
    "\n",
  );

  if (!textBeforeCursor.endsWith("`")) {
    return null;
  }

  const openingMarkerIndex = textBeforeCursor.lastIndexOf(
    "`",
    textBeforeCursor.length - 2,
  );

  if (openingMarkerIndex < 0) {
    return null;
  }

  const content = textBeforeCursor.slice(openingMarkerIndex + 1, -1);

  if (!content || content.includes("`") || content.includes("\n")) {
    return null;
  }

  const from = selection.from - (textBeforeCursor.length - openingMarkerIndex);
  const to = selection.from;
  const source = state.doc.textBetween(from, to, "\n", "\n");

  if (!isWellFormedInlineCodeSource(source)) {
    return null;
  }

  let hasInlineCodeMark = false;

  state.doc.nodesBetween(from, to, (node) => {
    if (
      node.isText &&
      node.marks.some(
        (mark) => mark.type.name === "inlineCode" || mark.type.spec.code,
      )
    ) {
      hasInlineCodeMark = true;
    }
  });

  return hasInlineCodeMark ? null : { from, to };
}

export function convertPlainInlineCodeSourceTransaction(
  state: EditorState,
  range: InlineCodeRange,
) {
  const markType = getInlineCodeMarkTypeFromState(state);
  const commit = getInlineCodeCommit(
    state,
    state.doc.textBetween(range.from, range.to, "\n", "\n"),
  );

  if (!markType || !commit.isInlineCode) {
    return null;
  }

  const selectionPosition = range.from + commit.size;

  const transaction = state.tr.replaceWith(
    range.from,
    range.to,
    state.schema.text(commit.content, [markType.create()]),
  );

  return transaction
    .setSelection(TextSelection.create(transaction.doc, selectionPosition))
    .setMeta(markdownSyntaxPluginKey, {
      expandedInlineCode: null,
      suppressedInlineCodeAt: selectionPosition,
    } satisfies Partial<MarkdownSyntaxPluginState>);
}

