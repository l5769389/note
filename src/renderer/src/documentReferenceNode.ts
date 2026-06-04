import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import {
  NodeSelection,
  Plugin,
  TextSelection,
} from "@milkdown/kit/prose/state";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, $nodeSchema, $prose, $remark, $view } from "@milkdown/kit/utils";
import { findWikiLinkTokensInText } from "./wikiLinkTokens";

export const documentReferenceNodeName = "document_reference";
export const documentReferenceMarkdownType = "documentReference";

type DocumentReferenceMarkdownNode = {
  children?: DocumentReferenceMarkdownNode[];
  display?: string;
  raw?: string;
  target?: string;
  type: string;
  value?: string;
  [key: string]: unknown;
};

type DocumentReferenceAttrs = {
  display?: string;
  raw?: string;
  target?: string;
};

function getStringAttr(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function serializeDocumentReferenceToken(attrs: DocumentReferenceAttrs) {
  if (attrs.raw?.startsWith("[[") && attrs.raw.endsWith("]]")) {
    return attrs.raw;
  }

  const target = attrs.target?.trim() ?? "";
  const display = attrs.display?.trim() ?? "";

  if (!target && !display) {
    return "[[]]";
  }

  if (target && display && target !== display) {
    return `[[${target}|${display}]]`;
  }

  return `[[${display || target}]]`;
}

export function splitWikiLinkTextNode(value: string): DocumentReferenceMarkdownNode[] {
  const tokens = findWikiLinkTokensInText(value, 0);

  if (!tokens.length) {
    return [{ type: "text", value }];
  }

  const nodes: DocumentReferenceMarkdownNode[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.from > cursor) {
      nodes.push({
        type: "text",
        value: value.slice(cursor, token.from),
      });
    }

    nodes.push({
      type: documentReferenceMarkdownType,
      display: token.display,
      raw: token.raw,
      target: token.target,
    });

    cursor = token.to;
  }

  if (cursor < value.length) {
    nodes.push({
      type: "text",
      value: value.slice(cursor),
    });
  }

  return nodes;
}

export function transformDocumentReferenceMarkdownTree(
  node: DocumentReferenceMarkdownNode,
) {
  if (!Array.isArray(node.children)) {
    return;
  }

  const nextChildren: DocumentReferenceMarkdownNode[] = [];

  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      nextChildren.push(...splitWikiLinkTextNode(child.value));
      continue;
    }

    transformDocumentReferenceMarkdownTree(child);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

function createDocumentReferenceElement(attrs: DocumentReferenceAttrs) {
  const display = attrs.display || attrs.target || "Untitled document";
  const target = attrs.target || display;
  const raw = serializeDocumentReferenceToken({ ...attrs, display, target });
  const card = document.createElement("span");
  card.className = "typora-wiki-link-card typora-document-reference-node";
  card.contentEditable = "false";
  card.dataset.display = display;
  card.dataset.raw = raw;
  card.dataset.target = target;
  card.dataset.type = documentReferenceNodeName;
  card.title = `Document reference: ${display}`;

  const icon = document.createElement("span");
  icon.className = "typora-wiki-link-card-icon";
  icon.setAttribute("aria-hidden", "true");

  const title = document.createElement("span");
  title.className = "typora-wiki-link-card-title";
  title.textContent = display;

  card.append(icon, title);
  return card;
}

export const documentReferenceRemarkPlugin = $remark(
  "documentReferenceRemark",
  () => () => (tree: unknown) => {
    transformDocumentReferenceMarkdownTree(tree as DocumentReferenceMarkdownNode);
  },
);

export const documentReferenceSchema = $nodeSchema(
  documentReferenceNodeName,
  () => ({
    atom: true,
    attrs: {
      display: { default: "" },
      raw: { default: "" },
      target: { default: "" },
    },
    group: "inline",
    inline: true,
    selectable: false,
    draggable: false,
    parseDOM: [
      {
        tag: `span[data-type="${documentReferenceNodeName}"]`,
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }

          return {
            display: dom.dataset.display ?? "",
            raw: dom.dataset.raw ?? "",
            target: dom.dataset.target ?? "",
          };
        },
      },
    ],
    toDOM: (node) => createDocumentReferenceElement(node.attrs),
    parseMarkdown: {
      match: (node) => node.type === documentReferenceMarkdownType,
      runner: (state, node, type) => {
        const target = getStringAttr(node.target);
        const display = getStringAttr(node.display) || target;
        const raw = getStringAttr(node.raw);
        state.addNode(type, { display, raw, target });
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === documentReferenceNodeName,
      runner: (state, node) => {
        state.addNode(
          "text",
          undefined,
          serializeDocumentReferenceToken({
            display: getStringAttr(node.attrs.display),
            raw: getStringAttr(node.attrs.raw),
            target: getStringAttr(node.attrs.target),
          }),
        );
      },
    },
  }),
);

export const documentReferenceView = $view(
  documentReferenceSchema.node,
  () => (node, view, getPos) => {
    const dom = createDocumentReferenceElement(node.attrs);

    dom.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const pos = typeof getPos === "function" ? getPos() : undefined;

      if (typeof pos !== "number") {
        return;
      }

      event.preventDefault();
      const rect = dom.getBoundingClientRect();
      const boundaryHitArea = Math.min(36, Math.max(16, rect.width * 0.22));

      if (event.clientX <= rect.left + boundaryHitArea) {
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(view.state.doc, pos))
            .scrollIntoView(),
        );
      } else if (event.clientX >= rect.right - boundaryHitArea) {
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(view.state.doc, pos + node.nodeSize))
            .scrollIntoView(),
        );
      } else {
        const targetPos =
          event.clientX < rect.left + rect.width / 2
            ? pos
            : pos + node.nodeSize;

        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(view.state.doc, targetPos))
            .scrollIntoView(),
        );
      }

      view.focus();
    });

    return {
      dom,
      selectNode() {
        dom.classList.add("typora-wiki-link-card-selected");
      },
      deselectNode() {
        dom.classList.remove("typora-wiki-link-card-selected");
      },
      stopEvent(event) {
        return event.type === "mousedown";
      },
    };
  },
);

export const documentReferenceInputRule = $inputRule(
  (ctx) =>
    new InputRule(/\[\[([^\]\n]+)\]\]$/, (state, match, start, end) => {
      const raw = match[0] ?? "";
      const [token] = findWikiLinkTokensInText(raw, 0);

      if (!token) {
        return null;
      }

      const node = documentReferenceSchema.type(ctx).create({
        display: token.display,
        raw: token.raw,
        target: token.target,
      });

      return state.tr.replaceWith(start, end, node);
    }),
);

export const documentReferenceKeyboardPlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          const { selection } = view.state;

          if (
            event.key !== "Backspace" &&
            event.key !== "Delete" &&
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight"
          ) {
            return false;
          }

          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
          ) {
            return false;
          }

          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            selection instanceof NodeSelection &&
            selection.node.type.name === documentReferenceNodeName
          ) {
            event.preventDefault();
            view.dispatch(
              view.state.tr
                .setSelection(
                  TextSelection.create(
                    view.state.doc,
                    event.key === "ArrowLeft" ? selection.from : selection.to,
                  ),
                )
                .scrollIntoView(),
            );
            return true;
          }

          if (
            selection instanceof NodeSelection &&
            selection.node.type.name === documentReferenceNodeName
          ) {
            event.preventDefault();
            view.dispatch(
              view.state.tr.delete(selection.from, selection.to).scrollIntoView(),
            );
            return true;
          }

          if (!selection.empty || !(selection instanceof TextSelection)) {
            return false;
          }

          const $from = selection.$from;

          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const node =
              event.key === "ArrowLeft" ? $from.nodeBefore : $from.nodeAfter;

            if (node?.type.name !== documentReferenceNodeName) {
              return false;
            }

            event.preventDefault();
            view.dispatch(
              view.state.tr
                .setSelection(
                  TextSelection.create(
                    view.state.doc,
                    event.key === "ArrowLeft"
                      ? selection.from - node.nodeSize
                      : selection.from + node.nodeSize,
                  ),
                )
                .scrollIntoView(),
            );
            return true;
          }

          const node =
            event.key === "Backspace" ? $from.nodeBefore : $from.nodeAfter;

          if (node?.type.name !== documentReferenceNodeName) {
            return false;
          }

          const from =
            event.key === "Backspace"
              ? selection.from - node.nodeSize
              : selection.from;
          const to =
            event.key === "Backspace"
              ? selection.from
              : selection.from + node.nodeSize;

          event.preventDefault();
          view.dispatch(view.state.tr.delete(from, to).scrollIntoView());
          return true;
        },
        handleTextInput(view, from, to, text) {
          const { selection } = view.state;

          if (
            selection instanceof NodeSelection &&
            selection.node.type.name === documentReferenceNodeName
          ) {
            view.dispatch(
              view.state.tr
                .insertText(text, selection.from, selection.to)
                .scrollIntoView(),
            );
            return true;
          }

          if (
            !selection.empty ||
            !(selection instanceof TextSelection) ||
            from !== to ||
            from !== selection.from
          ) {
            return false;
          }

          const $from = selection.$from;

          if (
            $from.nodeBefore?.type.name !== documentReferenceNodeName &&
            $from.nodeAfter?.type.name !== documentReferenceNodeName
          ) {
            return false;
          }

          view.dispatch(
            view.state.tr
              .insertText(text, selection.from, selection.to)
              .scrollIntoView(),
          );
          return true;
        },
      },
    }),
);

export const documentReferencePlugins = [
  documentReferenceRemarkPlugin,
  documentReferenceSchema,
  documentReferenceView,
  documentReferenceInputRule,
  documentReferenceKeyboardPlugin,
].flat();

export function isDocumentReferenceNode(
  node: ProseMirrorNode | null | undefined,
): node is ProseMirrorNode {
  return node?.type.name === documentReferenceNodeName;
}
