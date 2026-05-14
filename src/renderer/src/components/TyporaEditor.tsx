import { defaultValueCtx, editorViewCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { math } from "@milkdown/plugin-math";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { prism, prismConfig } from "@milkdown/plugin-prism";
import {
  findTable,
  isInTable,
} from "@milkdown/kit/prose/tables";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { lift, setBlockType, toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import { redo, undo } from "@milkdown/kit/prose/history";
import { liftListItem, sinkListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import {
  NodeSelection,
  Plugin,
  Selection,
  TextSelection,
} from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { commonmark, htmlSchema } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { $prose, insert, replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "katex/dist/katex.min.css";
import {
  CircleAlert,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import {
  formatCodeLanguageLabel,
  isMermaidLanguage,
  normalizeCodeLanguageInput,
} from "../codeLanguage";
import {
  markdownSyntaxPluginKey,
  searchHighlightPluginKey,
  type MarkdownSyntaxPluginState,
  type SearchHighlightPluginState,
} from "../editorPluginState";
import {
  centerEditorRangeInView,
  findVisibleSearchRange,
} from "../editorSearch";
import {
  isSelectAllShortcut,
  selectEntireDocument,
  selectionTouchesNode,
} from "../editorSelection";
import {
  collapseInlineCodeSourceTransaction,
  convertPlainInlineCodeSourceTransaction,
  expandInlineCodeSourceTransaction,
  findInlineCodeRangeForSelection,
  findPlainInlineCodeSourceForSelection,
  shouldKeepInlineCodeSourceExpanded,
} from "../inlineCodeSource";
import {
  getImageDisplayName,
  ImageNameEditor,
  ImageResizeHandle,
  ImageToolbar,
  type ImageToolbarState,
} from "./ImageToolbar";
import {
  createResizedTableNode,
  getTableSize,
  TableToolbar,
  type TableCommand,
  type TableSize,
  type TableToolbarState,
} from "./TableToolbar";
import { registerMarkdownLanguages } from "../syntaxHighlighting";
import { createMermaidRenderId, renderMermaidSvg } from "../mermaid";
import { isReactFlowLanguage } from "../reactFlowDocument";
import { ReactFlowDiagram } from "./ReactFlowDiagram";
import type {
  ImageAlignment,
  TyporaAlertKind,
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "../editorCommands";
import {
  clampImageWidth,
  getExcalidrawDrawingId,
  minImageWidth,
  parseImageMeta,
  patchImageMetaTitle,
  type ImageMeta,
} from "../imageMeta";
import {
  createMarkdownAlert,
  getMarkdownAlertByMarker,
  getMarkdownAlertByPrefix,
} from "../markdownAlerts";
import { resolveDocumentResourceUrl } from "../localPreviewUrls";
import {
  createTableOfContentsMarkdown,
  getMarkdownHeadingAtLine as getHeadingAtLine,
  markdownHeadingPattern as headingPattern,
  normalizeMarkdownHeadingTitle as normalizeHeadingTitle,
} from "../markdownStructure";
import {
  selectionTouchesRange,
} from "../selectionRanges";

export type {
  ImageAlignment,
  TyporaAlertKind,
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "../editorCommands";

type TyporaEditorProps = {
  documentId: string;
  filePath?: string;
  onActiveLineChange?: (lineIndex: number) => void;
  onChange: (value: string) => void;
  onEditDrawing?: (drawingId: string) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  value: string;
};

type TyporaSearchRevealOptions = {
  occurrenceIndex: number;
  preserveRendered?: boolean;
  query: string;
};

export type TyporaEditorHandle = {
  clearSearchHighlight: () => void;
  insertMarkdown: (markdown: string) => void;
  revealSearchResult: (options: TyporaSearchRevealOptions) => boolean;
  runEditCommand: (command: TyporaEditCommand) => void;
  runFormatCommand: (command: TyporaFormatCommand) => void;
  runParagraphCommand: (command: TyporaParagraphCommand) => void;
  scrollToLine: (lineIndex: number) => void;
};

const typoraAlertIcons: Record<TyporaAlertKind, LucideIcon> = {
  caution: OctagonAlert,
  important: CircleAlert,
  note: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
};

function createTyporaAlertTitle(kind: TyporaAlertKind, title: string) {
  const Icon = typoraAlertIcons[kind] ?? Info;
  const element = document.createElement("div");
  const icon = document.createElement("span");
  const label = document.createElement("span");

  element.className = "typora-alert-title";
  element.contentEditable = "false";
  icon.className = "markdown-alert-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = renderToStaticMarkup(<Icon size={15} strokeWidth={2.35} />);
  label.textContent = title;
  element.append(icon, label);

  return element;
}

const rawHtmlImagePattern = /^\s*<img\b[\s\S]*\/?>\s*$/i;

function getRawHtmlImageSource(node: ProseMirrorNode) {
  if (node.type.name !== "html") {
    return null;
  }

  const value = typeof node.attrs.value === "string" ? node.attrs.value : "";

  return rawHtmlImagePattern.test(value) ? value : null;
}

function getRawHtmlValue(node: ProseMirrorNode) {
  return typeof node.attrs.value === "string"
    ? node.attrs.value
    : node.textContent;
}

function createRenderedHtmlPreview(
  value: string,
  filePath?: string,
): HTMLElement | null {
  const trimmedValue = value.trim();

  if (!trimmedValue || /<script\b/i.test(trimmedValue)) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "typora-raw-html-preview";
  wrapper.innerHTML = trimmedValue;

  wrapper.querySelectorAll("[src]").forEach((element) => {
    const source = element.getAttribute("src");
    const resolvedSource = resolveDocumentResourceUrl(source ?? undefined, filePath);

    if (resolvedSource) {
      element.setAttribute("src", resolvedSource);
    }
  });

  wrapper.querySelectorAll("[href]").forEach((element) => {
    const href = element.getAttribute("href");
    const resolvedHref = resolveDocumentResourceUrl(href ?? undefined, filePath);

    if (resolvedHref) {
      element.setAttribute("href", resolvedHref);
    }
  });

  return wrapper;
}

function createRawHtmlPreviewDecoration(
  filePathRef: MutableRefObject<string | undefined>,
) {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node: ProseMirrorNode, pos) => {
              if (node.type.name !== "html") {
                return;
              }

              const value = getRawHtmlValue(node);

              if (!value.trim() || /<script\b/i.test(value)) {
                return;
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "typora-raw-html-source-hidden",
                }),
                Decoration.widget(
                  pos + node.nodeSize,
                  () =>
                    createRenderedHtmlPreview(value, filePathRef.current) ??
                    document.createTextNode(""),
                  {
                    ignoreSelection: true,
                    key: `typora-raw-html-preview-${pos}-${value}`,
                    side: 1,
                    stopEvent: (event) =>
                      event.type === "click" ||
                      event.type === "mousedown" ||
                      event.type === "mouseup",
                  },
                ),
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
  );
}

const editableHtmlSchema = htmlSchema.extendSchema((previousSchema) => (ctx) => {
  const schema = previousSchema(ctx);

  return {
    ...schema,
    atom: false,
    content: "text*",
    selectable: false,
    toDOM: (node) => {
      const value =
        node.textContent || (typeof node.attrs.value === "string" ? node.attrs.value : "");
      const attrs: Record<string, string> = {
        "data-type": "html",
        "data-value": value,
      };

      if (getRawHtmlImageSource(node)) {
        attrs.class = "typora-raw-html-image-source";
      }

      return ["span", attrs, 0];
    },
    parseDOM: [
      {
        tag: 'span[data-type="html"]',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }

          return {
            value: dom.textContent ?? dom.dataset.value ?? "",
          };
        },
      },
    ],
    parseMarkdown: {
      match: ({ type }) => type === "html",
      runner: (state, node, type) => {
        const value = typeof node.value === "string" ? node.value : "";

        state.openNode(type, { value });

        if (value) {
          state.addText(value);
        }

        state.closeNode();
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === "html",
      runner: (state, node) => {
        const value =
          node.textContent ||
          (typeof node.attrs.value === "string" ? node.attrs.value : "");

        state.addNode("html", undefined, value);
      },
    },
  };
});

const searchHighlightDecoration = $prose(
  () =>
    new Plugin<SearchHighlightPluginState>({
      key: searchHighlightPluginKey,
      state: {
        init: (): SearchHighlightPluginState => ({
          range: null,
        }),
        apply(transaction, pluginState) {
          const meta = transaction.getMeta(searchHighlightPluginKey) as
            | Partial<SearchHighlightPluginState>
            | undefined;
          const mappedRange =
            pluginState.range && transaction.docChanged
              ? {
                  from: transaction.mapping.map(pluginState.range.from, -1),
                  to: transaction.mapping.map(pluginState.range.to, 1),
                }
              : pluginState.range;
          const nextRange = meta ? meta.range ?? null : mappedRange;

          return {
            range:
              nextRange && nextRange.from < nextRange.to ? nextRange : null,
          };
        },
      },
      props: {
        decorations(state) {
          const pluginState = searchHighlightPluginKey.getState(state);

          if (!pluginState?.range) {
            return DecorationSet.empty;
          }

          return DecorationSet.create(state.doc, [
            Decoration.inline(pluginState.range.from, pluginState.range.to, {
              class: "typora-search-active-highlight",
            }),
          ]);
        },
      },
    }),
);

const codeBlockLanguageDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          const { from, to } = state.selection;

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "code_block") {
              return;
            }

            const rawLanguage =
              typeof node.attrs.language === "string" ? node.attrs.language.trim() : "";
            const language = (rawLanguage || "plain text").toLowerCase();
            const isActive = selectionTouchesRange(from, to, pos, pos + node.nodeSize);

            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: isActive
                  ? "typora-code-block typora-code-block-active"
                  : "typora-code-block",
                "data-code-language": language,
                "data-code-label": formatCodeLanguageLabel(language),
              }),
            );

            if (isActive) {
              decorations.push(
                Decoration.widget(
                  pos + node.nodeSize - 1,
                  (view) => {
                    const marker = document.createElement("span");
                    const label = document.createElement("span");
                    const input = document.createElement("input");
                    marker.className = "typora-code-language-editor";
                    marker.contentEditable = "false";
                    marker.dataset.codeLanguage = language;
                    marker.setAttribute("aria-label", "Code block language");
                    marker.setAttribute("role", "button");
                    marker.tabIndex = 0;
                    label.className = "typora-code-language-label";
                    label.textContent = formatCodeLanguageLabel(language);
                    input.className = "typora-code-language-input";
                    input.hidden = true;
                    input.spellcheck = false;
                    input.type = "text";
                    input.value = rawLanguage || "text";
                    marker.append(label, input);
                    let isEditing = false;

                    function syncCodeLanguage() {
                      const nextLanguage = normalizeCodeLanguageInput(input.value);
                      const codeNode = view.state.doc.nodeAt(pos);

                      if (!codeNode || codeNode.type.name !== "code_block") {
                        return nextLanguage;
                      }

                      if ((codeNode.attrs.language ?? "") !== nextLanguage) {
                        view.dispatch(
                          view.state.tr.setNodeMarkup(pos, undefined, {
                            ...codeNode.attrs,
                            language: nextLanguage,
                          }),
                        );
                      }

                      return nextLanguage;
                    }

                    function setDisplayLanguage(languageValue: string) {
                      const displayLanguage = languageValue || "plain text";
                      marker.dataset.codeLanguage = displayLanguage;
                      label.textContent = formatCodeLanguageLabel(displayLanguage);
                      input.value = languageValue || "text";
                    }

                    function enterEditing() {
                      if (isEditing) {
                        return;
                      }

                      const codeNode = view.state.doc.nodeAt(pos);
                      const editableLanguage =
                        typeof codeNode?.attrs.language === "string" &&
                        codeNode.attrs.language.trim()
                          ? codeNode.attrs.language.trim()
                          : "text";

                      isEditing = true;
                      marker.classList.add("typora-code-language-editor-editing");
                      marker.removeAttribute("role");
                      label.hidden = true;
                      input.hidden = false;
                      input.value = editableLanguage;

                      requestAnimationFrame(() => {
                        input.focus();
                        input.select();
                      });
                    }

                    function exitEditing(shouldSave: boolean) {
                      if (!isEditing) {
                        return;
                      }

                      const nextLanguage = shouldSave
                        ? syncCodeLanguage()
                        : typeof view.state.doc.nodeAt(pos)?.attrs.language === "string"
                          ? view.state.doc.nodeAt(pos)?.attrs.language
                          : "";

                      isEditing = false;
                      marker.setAttribute("role", "button");
                      marker.classList.remove("typora-code-language-editor-editing");
                      input.hidden = true;
                      label.hidden = false;
                      setDisplayLanguage(String(nextLanguage ?? ""));
                    }

                    marker.addEventListener("mousedown", (event) => {
                      if (event.target === input && isEditing) {
                        event.stopPropagation();
                        return;
                      }

                      event.preventDefault();
                      if (
                        !selectionTouchesRange(
                          view.state.selection.from,
                          view.state.selection.to,
                          pos,
                          pos + node.nodeSize,
                        )
                      ) {
                        view.dispatch(
                          view.state.tr.setSelection(
                            Selection.near(view.state.doc.resolve(pos + 1), 1),
                          ),
                        );
                      }
                      enterEditing();
                    });
                    marker.addEventListener("keydown", (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        enterEditing();
                      }
                    });
                    input.addEventListener("blur", () => {
                      exitEditing(true);
                    });
                    input.addEventListener("keydown", (event) => {
                      event.stopPropagation();

                      if (event.key !== "Enter" && event.key !== "Escape") {
                        return;
                      }

                      event.preventDefault();
                      exitEditing(event.key === "Enter");
                      view.focus();
                      view.dispatch(
                        view.state.tr.setSelection(
                          Selection.near(view.state.doc.resolve(pos + node.nodeSize), 1),
                        ),
                      );
                    });

                    return marker;
                  },
                  {
                    ignoreSelection: true,
                    side: 1,
                    stopEvent: (event) =>
                      event.target instanceof Element &&
                      Boolean(event.target.closest(".typora-code-language-editor")),
                  },
                ),
              );
            }
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const mermaidBlockDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "code_block") {
              return;
            }

            const language =
              typeof node.attrs.language === "string" ? node.attrs.language : "";

            if (!isMermaidLanguage(language) && !isReactFlowLanguage(language)) {
              return;
            }

            const isActive = selectionTouchesNode(state.selection, pos, node);
            const nodeDecorations = isActive
              ? []
              : [
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "typora-mermaid-source-hidden",
                  }),
                ];

            decorations.push(
              ...nodeDecorations,
              Decoration.widget(
                pos + node.nodeSize,
                (view) => {
                  if (isReactFlowLanguage(language)) {
                    const container = document.createElement("div");
                    const root = createRoot(container);

                    container.className = "typora-react-flow-widget";
                    container.setAttribute("aria-label", "React Flow diagram");
                    container.title = "Click to edit React Flow source";
                    container.addEventListener("mousedown", (event) => {
                      event.preventDefault();
                      view.dispatch(
                        view.state.tr.setSelection(
                          Selection.near(view.state.doc.resolve(pos + 1), 1),
                        ),
                      );
                      view.focus();
                    });
                    root.render(<ReactFlowDiagram code={node.textContent} />);

                    return container;
                  }

                  const container = document.createElement("div");
                  const renderId = createMermaidRenderId(
                    `milkdown-mermaid-${pos}`,
                    node.textContent,
                  );

                  container.className =
                    "typora-mermaid-diagram mermaid-diagram mermaid-diagram-loading";
                  container.setAttribute("aria-label", "Mermaid diagram");
                  container.title = "Click to edit Mermaid source";

                  container.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    view.dispatch(
                      view.state.tr.setSelection(
                        Selection.near(view.state.doc.resolve(pos + 1), 1),
                      ),
                    );
                    view.focus();
                  });

                  renderMermaidSvg(renderId, node.textContent)
                    .then((svg) => {
                      if (!container.isConnected) {
                        return;
                      }

                      container.classList.remove("mermaid-diagram-loading");
                      container.innerHTML = svg;
                    })
                    .catch((error: unknown) => {
                      if (!container.isConnected) {
                        return;
                      }

                      const message =
                        error instanceof Error ? error.message : "Mermaid render failed";
                      container.classList.remove("mermaid-diagram-loading");
                      container.classList.add("mermaid-diagram-error");
                      container.textContent = message;
                    });

                  return container;
                },
                {
                  ignoreSelection: true,
                  key: `${language}-${pos}-${node.textContent}`,
                  side: 1,
                  stopEvent: (event) =>
                    event.target instanceof Element &&
                    Boolean(
                      event.target.closest(
                        ".typora-mermaid-diagram, .typora-react-flow-widget",
                      ),
                    ),
                },
              ),
            );
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const markdownAlertDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "blockquote" || node.childCount === 0) {
              return;
            }

            const markerNode = node.child(0);
            const markerText = markerNode.textContent;
            const alert = getMarkdownAlertByPrefix(markerText);

            if (!alert) {
              return;
            }

            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: `typora-alert-block typora-alert-${alert.kind}`,
              }),
              Decoration.widget(
                pos + 1,
                () => createTyporaAlertTitle(alert.kind, alert.title),
                { side: -1 },
              ),
            );

            if (getMarkdownAlertByMarker(markerText)) {
              decorations.push(
                Decoration.node(pos + 1, pos + 1 + markerNode.nodeSize, {
                  class: "typora-alert-marker-line",
                }),
              );
              return;
            }

            const markerPrefix = markerText.match(
              /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
            )?.[0];

            if (markerPrefix) {
              const markerStart = pos + 2;
              decorations.push(
                Decoration.inline(markerStart, markerStart + markerPrefix.length, {
                  class: "typora-alert-marker-inline",
                }),
              );
            }
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const markdownSyntaxDecoration = $prose(
  () =>
    new Plugin<MarkdownSyntaxPluginState>({
      key: markdownSyntaxPluginKey,
      state: {
        init: (): MarkdownSyntaxPluginState => ({
          expandedInlineCode: null,
          isFocused: false,
          suppressedInlineCodeAt: null,
        }),
        apply(transaction, pluginState, _oldState, newState) {
          const mappedExpandedInlineCode =
            pluginState.expandedInlineCode && transaction.docChanged
              ? {
                  from: transaction.mapping.map(pluginState.expandedInlineCode.from, -1),
                  to: transaction.mapping.map(pluginState.expandedInlineCode.to, 1),
                }
              : pluginState.expandedInlineCode;
          let nextPluginState: MarkdownSyntaxPluginState = {
            ...pluginState,
            expandedInlineCode:
              mappedExpandedInlineCode &&
              mappedExpandedInlineCode.from < mappedExpandedInlineCode.to
                ? mappedExpandedInlineCode
                : null,
          };
          const meta = transaction.getMeta(markdownSyntaxPluginKey) as
            | Partial<MarkdownSyntaxPluginState>
            | undefined;

          if (meta) {
            nextPluginState = { ...nextPluginState, ...meta };
          }

          if (
            nextPluginState.suppressedInlineCodeAt !== null &&
            (transaction.docChanged || transaction.selectionSet) &&
            newState.selection.from !== nextPluginState.suppressedInlineCodeAt
          ) {
            return { ...nextPluginState, suppressedInlineCodeAt: null };
          }

          return nextPluginState;
        },
      },
      appendTransaction(transactions, _oldState, newState) {
        if (
          !transactions.some(
            (transaction) =>
              transaction.docChanged ||
              transaction.selectionSet ||
              transaction.getMeta(markdownSyntaxPluginKey),
          )
        ) {
          return null;
        }

        const pluginState = markdownSyntaxPluginKey.getState(newState);

        if (!pluginState) {
          return null;
        }

        if (pluginState.expandedInlineCode) {
          if (
            pluginState.isFocused &&
            shouldKeepInlineCodeSourceExpanded(newState, pluginState.expandedInlineCode)
          ) {
            return null;
          }

          return collapseInlineCodeSourceTransaction(
            newState,
            pluginState.expandedInlineCode,
          );
        }

        if (!pluginState.isFocused) {
          return null;
        }

        const plainInlineCodeRange = findPlainInlineCodeSourceForSelection(newState);

        if (plainInlineCodeRange) {
          return convertPlainInlineCodeSourceTransaction(
            newState,
            plainInlineCodeRange,
          );
        }

        const inlineCodeRange = findInlineCodeRangeForSelection(
          newState,
          pluginState.suppressedInlineCodeAt,
        );

        return inlineCodeRange
          ? expandInlineCodeSourceTransaction(newState, inlineCodeRange)
          : null;
      },
      props: {
        handleDOMEvents: {
          blur(view, event) {
            const nextActiveElement = (event as FocusEvent).relatedTarget;

            if (
              nextActiveElement instanceof Node &&
              view.dom.contains(nextActiveElement)
            ) {
              return false;
            }

            view.dispatch(
              view.state.tr.setMeta(markdownSyntaxPluginKey, {
                isFocused: false,
                suppressedInlineCodeAt: null,
              } satisfies Partial<MarkdownSyntaxPluginState>),
            );
            return false;
          },
          focus(view) {
            view.dispatch(
              view.state.tr.setMeta(markdownSyntaxPluginKey, {
                isFocused: true,
              } satisfies Partial<MarkdownSyntaxPluginState>),
            );
            return false;
          },
        },
        handleKeyDown(view, event) {
          if (!isSelectAllShortcut(event)) {
            return false;
          }

          event.preventDefault();
          selectEntireDocument(view);
          return true;
        },
        decorations(state) {
          const decorations: Decoration[] = [];
          const { from, to } = state.selection;
          const pluginState = markdownSyntaxPluginKey.getState(state);
          const shouldShowMarkdownSyntax = pluginState?.isFocused ?? false;

          if (pluginState?.expandedInlineCode) {
            const { from: codeFrom, to: codeTo } = pluginState.expandedInlineCode;

            if (codeFrom < codeTo && codeTo <= state.doc.content.size) {
              decorations.push(
                Decoration.inline(codeFrom, codeTo, {
                  class: "typora-inline-code-source",
                }),
              );
            }
          }

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (/^heading$/i.test(node.type.name)) {
              const level =
                typeof node.attrs.level === "number" ? node.attrs.level : 1;
              const rangeFrom = pos;
              const rangeTo = pos + node.nodeSize;

              if (
                shouldShowMarkdownSyntax &&
                selectionTouchesRange(from, to, rangeFrom, rangeTo)
              ) {
                decorations.push(
                  Decoration.widget(
                    pos + 1,
                    (view, getPos) => {
                      const marker = document.createElement("span");
                      marker.className = "typora-heading-prefix-marker";
                      marker.contentEditable = "true";
                      marker.spellcheck = false;
                      marker.textContent = `${"#".repeat(level)} `;
                      marker.setAttribute("aria-label", "Heading markdown marker");

                      function syncHeadingLevel() {
                        const markerText = marker.textContent ?? "";
                        const nextLevel = Math.min(
                          6,
                          Math.max(1, markerText.match(/^#+/)?.[0].length ?? 1),
                        );
                        const markerPosition = getPos();
                        const headingPosition =
                          typeof markerPosition === "number" ? markerPosition - 1 : pos;
                        const headingNode = view.state.doc.nodeAt(headingPosition);

                        if (!headingNode || !/^heading$/i.test(headingNode.type.name)) {
                          return;
                        }

                        if (headingNode.attrs.level !== nextLevel) {
                          view.dispatch(
                            view.state.tr.setNodeMarkup(headingPosition, undefined, {
                              ...headingNode.attrs,
                              level: nextLevel,
                            }),
                          );
                        }
                      }

                      marker.addEventListener("input", syncHeadingLevel);
                      marker.addEventListener("keydown", (event) => {
                        if (isSelectAllShortcut(event)) {
                          event.preventDefault();
                          selectEntireDocument(view);
                          return;
                        }

                        if (event.key !== "Enter" && event.key !== "ArrowRight") {
                          return;
                        }

                        const markerPosition = getPos();

                        if (typeof markerPosition === "number") {
                          event.preventDefault();
                          view.focus();
                          view.dispatch(
                            view.state.tr.setSelection(
                              Selection.near(view.state.doc.resolve(markerPosition), 1),
                            ),
                          );
                        }
                      });

                      return marker;
                    },
                    { side: -1 },
                  ),
                );
              }
            }

          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const disableNativeWritingChecks = $prose(
  () =>
    new Plugin({
      props: {
        attributes: {
          autocapitalize: "off",
          autocomplete: "off",
          autocorrect: "off",
          spellcheck: "false",
        },
      },
    }),
);

function createEditableImageDecoration(
  filePathRef: MutableRefObject<string | undefined>,
) {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node: ProseMirrorNode, pos) => {
              if (node.type.name !== "image") {
                return;
              }

              const meta = parseImageMeta(node.attrs.title);
              const className = [
                "typora-editable-image",
                `typora-editable-image-${meta.align}`,
              ].join(" ");
              const attrs: Record<string, string> = {
                class: className,
                "data-image-align": meta.align,
              };
              const resolvedSrc = resolveDocumentResourceUrl(
                node.attrs.src,
                filePathRef.current,
              );

              if (resolvedSrc) {
                attrs.src = resolvedSrc;
              }

              if (meta.width) {
                attrs.style = `width: ${meta.width}px;`;
                attrs["data-image-width"] = String(meta.width);
              }

              decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
  );
}

const editableImageSelection = $prose(
  () =>
    new Plugin({
      props: {
        handleClickOn(view, _pos, node, nodePos, event) {
          if (node.type.name !== "image") {
            return false;
          }

          const nodeDom = view.nodeDOM(nodePos);

          if (
            !(nodeDom instanceof HTMLImageElement) ||
            !nodeDom.classList.contains("typora-editable-image")
          ) {
            return false;
          }

          event.preventDefault();
          view.dispatch(
            view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)),
          );
          view.focus();
          return true;
        },
        handleDOMEvents: {
          click(view, event) {
            if (!(event.target instanceof Element)) {
              return false;
            }

            const imageElement = event.target.closest("img");

            if (
              !imageElement ||
              !view.dom.contains(imageElement) ||
              !imageElement.classList.contains("typora-editable-image")
            ) {
              return false;
            }

            try {
              const pos = view.posAtDOM(imageElement, 0);
              const docSize = view.state.doc.content.size;
              const imagePos = [pos, pos - 1, pos + 1].find((candidate) => {
                if (candidate < 0 || candidate > docSize) {
                  return false;
                }

                return view.state.doc.nodeAt(candidate)?.type.name === "image";
              });

              if (imagePos === undefined) {
                return false;
              }

              event.preventDefault();
              view.dispatch(
                view.state.tr.setSelection(
                  NodeSelection.create(view.state.doc, imagePos),
                ),
              );
              view.focus();
              return true;
            } catch {
              return false;
            }
          },
        },
      },
    }),
);

function getHeadingOccurrence(markdown: string, lineIndex: number) {
  const target = getHeadingAtLine(markdown, lineIndex);

  if (!target) {
    return 0;
  }

  return markdown
    .split("\n")
    .slice(0, lineIndex + 1)
    .filter((line) => {
      const match = line.match(headingPattern);

      return (
        match &&
        match[1].length === target.level &&
        normalizeHeadingTitle(match[2]) === target.title
      );
    }).length;
}

function findHeadingLineIndex(
  markdown: string,
  level: number,
  title: string,
  occurrence: number,
) {
  let seen = 0;

  return markdown.split("\n").findIndex((line) => {
    const match = line.match(headingPattern);

    if (
      !match ||
      match[1].length !== level ||
      normalizeHeadingTitle(match[2]) !== title
    ) {
      return false;
    }

    seen += 1;
    return seen === occurrence;
  });
}

function getHeadingElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
}

function getOverlayContainer(root: HTMLElement) {
  return root.querySelector<HTMLElement>(".typora-milkdown-content") ?? root;
}

function getElementFromSelection() {
  const anchorNode = window.getSelection()?.anchorNode;

  if (!anchorNode) {
    return null;
  }

  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as Element)
    : anchorNode.parentElement;
}

function isBeforeOrEqual(source: Element, target: Element) {
  if (source === target || source.contains(target)) {
    return true;
  }

  return Boolean(
    source.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function appendMarkdown(currentValue: string, markdown: string) {
  const separator = currentValue.length > 0 && !currentValue.endsWith("\n") ? "\n" : "";

  return `${currentValue}${separator}${markdown}`;
}

function runBrowserEditCommand(command: "copy" | "cut" | "delete" | "paste") {
  return document.execCommand(command);
}

function getActiveTopLevelBlock(view: EditorView) {
  const { $from } = view.state.selection;

  if ($from.depth < 1) {
    return null;
  }

  return {
    end: $from.after(1),
    index: $from.index(0),
    node: $from.node(1),
    start: $from.before(1),
  };
}

function getCurrentNodeRange(view: EditorView, typeName: string) {
  const { $from } = view.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return {
        node: $from.node(depth),
        pos: $from.before(depth),
      };
    }
  }

  return null;
}

function runProseCommand(
  view: EditorView,
  command: (
    state: EditorView["state"],
    dispatch?: EditorView["dispatch"],
    view?: EditorView,
  ) => boolean,
) {
  return command(view.state, view.dispatch.bind(view), view);
}

function toggleInlineMark(
  view: EditorView,
  markName: "emphasis" | "inlineCode" | "strike_through" | "strong",
) {
  const markType = view.state.schema.marks[markName];

  if (!markType) {
    return false;
  }

  return runProseCommand(
    view,
    toggleMark(markType, null, { includeWhitespace: true }),
  );
}

function insertWrappedMarkdown(
  ctx: Parameters<Parameters<Editor["action"]>[0]>[0],
  view: EditorView,
  prefix: string,
  suffix: string,
  placeholder: string,
) {
  const { from, to } = view.state.selection;
  const selectedText = from === to ? "" : view.state.doc.textBetween(from, to, "\n");

  insert(`${prefix}${selectedText || placeholder}${suffix}`)(ctx);
  return true;
}

function clearInlineMarks(view: EditorView) {
  const { from, to, empty } = view.state.selection;
  const markTypes = Object.values(view.state.schema.marks);
  const transaction = view.state.tr;

  if (empty) {
    transaction.setStoredMarks([]);
  } else {
    markTypes.forEach((markType) => {
      transaction.removeMark(from, to, markType);
    });
  }

  view.dispatch(transaction.scrollIntoView());
  return true;
}

type MarkRange = {
  attrs: Record<string, unknown>;
  from: number;
  to: number;
};

function getMarkRangeAtSelection(
  view: EditorView,
  markName: string,
): MarkRange | null {
  const markType = view.state.schema.marks[markName];

  if (!markType) {
    return null;
  }

  const { selection } = view.state;
  const from = selection.empty ? Math.max(0, selection.from - 1) : selection.from;
  const to = selection.empty
    ? Math.min(view.state.doc.content.size, selection.to + 1)
    : selection.to;
  let range: MarkRange | null = null;

  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) {
      return true;
    }

    const mark = node.marks.find((candidate) => candidate.type === markType);

    if (!mark) {
      return true;
    }

    const nodeFrom = pos;
    const nodeTo = pos + node.nodeSize;

    if (
      selection.empty &&
      (selection.from < nodeFrom || selection.from > nodeTo)
    ) {
      return true;
    }

    range = {
      attrs: mark.attrs,
      from: nodeFrom,
      to: nodeTo,
    };
    return false;
  });

  return range;
}

function setLinkMark(view: EditorView, href: string) {
  const linkMark = view.state.schema.marks.link;
  const normalizedHref = href.trim();

  if (!linkMark || !normalizedHref) {
    return false;
  }

  const { from, to, empty } = view.state.selection;

  if (empty) {
    return false;
  }

  const transaction = view.state.tr
    .removeMark(from, to, linkMark)
    .addMark(from, to, linkMark.create({ href: normalizedHref, title: null }))
    .scrollIntoView();

  view.dispatch(transaction);
  return true;
}

function removeLinkMark(view: EditorView) {
  const linkMark = view.state.schema.marks.link;
  const range = getMarkRangeAtSelection(view, "link");

  if (!linkMark || !range) {
    return false;
  }

  view.dispatch(
    view.state.tr.removeMark(range.from, range.to, linkMark).scrollIntoView(),
  );
  return true;
}

function getSelectedLinkHref(view: EditorView) {
  const range = getMarkRangeAtSelection(view, "link");
  const href = range?.attrs.href;

  return typeof href === "string" ? href : "";
}

function applyImageMetaPatch(
  view: EditorView,
  pos: number,
  patch: Partial<Pick<ImageMeta, "align" | "width">>,
) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || node.type.name !== "image") {
    return false;
  }

  view.dispatch(
    view.state.tr
      .setNodeMarkup(pos, undefined, {
        ...node.attrs,
        title: patchImageMetaTitle(node.attrs.title, patch),
      })
      .scrollIntoView(),
  );
  view.focus();
  return true;
}

function applyImageNamePatch(view: EditorView, pos: number, name: string) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || node.type.name !== "image") {
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      alt: name,
    }),
  );
  return true;
}

function setCurrentBlockType(
  view: EditorView,
  typeName: string,
  attrs: Record<string, unknown> | null = null,
) {
  const nodeType = view.state.schema.nodes[typeName];

  if (!nodeType) {
    return false;
  }

  return runProseCommand(view, setBlockType(nodeType, attrs));
}

function changeHeadingLevel(view: EditorView, direction: "demote" | "promote") {
  const block = getActiveTopLevelBlock(view);
  const headingType = view.state.schema.nodes.heading;
  const paragraphType = view.state.schema.nodes.paragraph;

  if (!block || !headingType || !paragraphType || block.node.type.name !== "heading") {
    return false;
  }

  const currentLevel =
    typeof block.node.attrs.level === "number" ? block.node.attrs.level : 1;
  const nextLevel = currentLevel + (direction === "demote" ? 1 : -1);

  if (nextLevel < 1) {
    view.dispatch(view.state.tr.setNodeMarkup(block.start, paragraphType, {}));
    return true;
  }

  if (nextLevel > 6) {
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(block.start, headingType, {
      ...block.node.attrs,
      level: nextLevel,
    }),
  );
  return true;
}

function toggleBlockquote(view: EditorView) {
  const blockquoteType = view.state.schema.nodes.blockquote;

  if (!blockquoteType) {
    return false;
  }

  if (getCurrentNodeRange(view, "blockquote")) {
    return runProseCommand(view, lift);
  }

  return runProseCommand(view, wrapIn(blockquoteType));
}

function setCurrentTaskListItem(view: EditorView, checked = false) {
  const listItem = getCurrentNodeRange(view, "list_item");

  if (!listItem) {
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(listItem.pos, undefined, {
      ...listItem.node.attrs,
      checked,
    }),
  );
  return true;
}

function wrapCurrentSelectionInList(
  view: EditorView,
  listTypeName: "bullet_list" | "ordered_list",
  task = false,
) {
  const listType = view.state.schema.nodes[listTypeName];

  if (!listType) {
    return false;
  }

  const wrapped = runProseCommand(view, wrapInList(listType));

  if (task) {
    requestAnimationFrame(() => setCurrentTaskListItem(view, false));
  }

  return wrapped;
}

function indentCurrentListItem(view: EditorView, direction: "in" | "out") {
  const listItemType = view.state.schema.nodes.list_item;

  if (!listItemType) {
    return false;
  }

  return runProseCommand(
    view,
    direction === "in" ? sinkListItem(listItemType) : liftListItem(listItemType),
  );
}

function insertParagraphRelative(view: EditorView, placement: "after" | "before") {
  const paragraphType = view.state.schema.nodes.paragraph;

  if (!paragraphType) {
    return false;
  }

  const block = getActiveTopLevelBlock(view);
  const insertPosition =
    placement === "before"
      ? block?.start ?? 0
      : block?.end ?? view.state.doc.content.size;
  const transaction = view.state.tr.insert(insertPosition, paragraphType.create());
  const selectionPosition = Math.min(insertPosition + 1, transaction.doc.content.size);
  const nextSelection = Selection.findFrom(
    transaction.doc.resolve(selectionPosition),
    1,
    true,
  );

  if (nextSelection) {
    transaction.setSelection(nextSelection);
  }

  view.dispatch(transaction.scrollIntoView());
  return true;
}

function insertHorizontalRule(view: EditorView) {
  const horizontalRuleType = view.state.schema.nodes.hr;

  if (!horizontalRuleType) {
    return false;
  }

  view.dispatch(
    view.state.tr.replaceSelectionWith(horizontalRuleType.create()).scrollIntoView(),
  );
  return true;
}

function moveActiveBlock(view: EditorView, direction: "down" | "up") {
  const block = getActiveTopLevelBlock(view);

  if (!block) {
    return false;
  }

  const { doc } = view.state;
  const blockContent = doc.slice(block.start, block.end).content;

  if (direction === "up") {
    if (block.index <= 0) {
      return false;
    }

    const previousNode = doc.child(block.index - 1);
    const previousStart = block.start - previousNode.nodeSize;
    const tr = view.state.tr
      .delete(block.start, block.end)
      .insert(previousStart, blockContent);

    tr.setSelection(Selection.near(tr.doc.resolve(previousStart + 1), 1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  if (block.index >= doc.childCount - 1) {
    return false;
  }

  const nextNode = doc.child(block.index + 1);
  const insertPosition = block.start + nextNode.nodeSize;
  const tr = view.state.tr.delete(block.start, block.end).insert(insertPosition, blockContent);

  tr.setSelection(Selection.near(tr.doc.resolve(insertPosition + 1), 1));
  view.dispatch(tr.scrollIntoView());
  return true;
}

function deleteActiveBlockOrSelection(view: EditorView) {
  const { selection } = view.state;

  if (!selection.empty) {
    view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
    return true;
  }

  const block = getActiveTopLevelBlock(view);

  if (!block) {
    return runBrowserEditCommand("delete");
  }

  view.dispatch(view.state.tr.delete(block.start, block.end).scrollIntoView());
  return true;
}

type MilkdownRuntimeProps = TyporaEditorProps & {
  controllerRef: MutableRefObject<TyporaEditorHandle | null>;
  markdownRef: MutableRefObject<string>;
  onChangeRef: MutableRefObject<(value: string) => void>;
  rootRef: MutableRefObject<HTMLElement | null>;
  valueRef: MutableRefObject<string>;
};

function MilkdownRuntime({
  controllerRef,
  documentId,
  filePath,
  markdownRef,
  onActiveLineChange,
  onChangeRef,
  onEditDrawing,
  rootRef,
  value,
  valueRef,
}: MilkdownRuntimeProps) {
  const applyingExternalValueRef = useRef(false);
  const filePathRef = useRef(filePath);
  const [imageToolbar, setImageToolbar] = useState<ImageToolbarState>({
    visible: false,
  });
  const [tableToolbar, setTableToolbar] = useState<TableToolbarState>({
    visible: false,
  });
  const activeHeadingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);
  const previousDocumentIdRef = useRef(documentId);
  const pendingActiveHeadingRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const imageResizeRef = useRef<{
    pos: number;
    startWidth: number;
    startX: number;
  } | null>(null);

  function publishActiveHeading(lineIndex: number) {
    pendingActiveHeadingRef.current = lineIndex;

    if (activeHeadingTimerRef.current !== null) {
      window.clearTimeout(activeHeadingTimerRef.current);
    }

    activeHeadingTimerRef.current = window.setTimeout(() => {
      activeHeadingTimerRef.current = null;

      if (pendingActiveHeadingRef.current !== null) {
        onActiveLineChange?.(pendingActiveHeadingRef.current);
      }
    }, 90);
  }

  function getSelectedImage(view: EditorView) {
    const { selection } = view.state;
    const selectedNode = (selection as unknown as { node?: ProseMirrorNode }).node;

    if (selectedNode?.type.name === "image") {
      return {
        node: selectedNode,
        pos: selection.from,
      };
    }

    const from = Math.max(0, selection.from - 1);
    const to = Math.min(view.state.doc.content.size, selection.to + 1);
    let nearbyImage: { node: ProseMirrorNode; pos: number } | null = null;

    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "image") {
        nearbyImage = { node, pos };
        return false;
      }

      return true;
    });

    return nearbyImage;
  }

  function updateImageToolbarFromView(view?: EditorView) {
    const root = rootRef.current;

    if (!root || !view) {
      setImageToolbar({ visible: false });
      return;
    }

    const image = getSelectedImage(view);

    if (!image) {
      setImageToolbar({ visible: false });
      return;
    }

    const imageNodeDom = view.nodeDOM(image.pos);
    const imageDom =
      imageNodeDom instanceof HTMLImageElement
        ? imageNodeDom
        : imageNodeDom instanceof Element
          ? imageNodeDom.querySelector("img")
          : null;

    if (!imageDom || !root.contains(imageDom)) {
      setImageToolbar({ visible: false });
      return;
    }

    const overlay = getOverlayContainer(root);
    const rootRect = root.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const imageRect = imageDom.getBoundingClientRect();
    const visibleTop = rootRect.top + 8 - overlayRect.top;
    const maxLeft = overlay.clientWidth - 132;
    const rawLeft = imageRect.left - overlayRect.left;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      visibleTop,
      imageRect.top - overlayRect.top - 46,
    );
    const meta = parseImageMeta(image.node.attrs.title);

    setImageToolbar({
      align: meta.align,
      displayWidth: clampImageWidth(imageRect.width || minImageWidth),
      drawingId: getExcalidrawDrawingId(image.node.attrs.title) ?? undefined,
      imageHeight: imageRect.height,
      imageLeft: imageRect.left - overlayRect.left,
      imageTop: imageRect.top - overlayRect.top,
      imageWidth: imageRect.width,
      left,
      name: getImageDisplayName(image.node),
      pos: image.pos,
      top,
      visible: true,
      width: meta.width,
    });
  }

  function updateTableToolbarFromView(view?: EditorView) {
    const root = rootRef.current;

    if (!root || !view || !isInTable(view.state)) {
      setTableToolbar({ visible: false });
      return;
    }

    const domAtSelection = view.domAtPos(view.state.selection.from);
    const selectionElement =
      domAtSelection.node.nodeType === Node.ELEMENT_NODE
        ? (domAtSelection.node as Element)
        : domAtSelection.node.parentElement;
    const cell = selectionElement?.closest("td, th");
    const table = cell?.closest("table");

    if (!cell || !table || !root.contains(table)) {
      setTableToolbar({ visible: false });
      return;
    }

    const tableInfo = findTable(view.state.selection.$from);

    if (!tableInfo) {
      setTableToolbar({ visible: false });
      return;
    }

    const overlay = getOverlayContainer(root);
    const rootRect = root.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const visibleTop = rootRect.top + 8 - overlayRect.top;
    const width = Math.max(220, Math.min(tableRect.width, overlay.clientWidth - 16));
    const maxLeft = overlay.clientWidth - width - 8;
    const rawLeft = tableRect.left - overlayRect.left;
    const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
    const top = Math.max(
      visibleTop,
      tableRect.top - overlayRect.top - 34,
    );
    const size = getTableSize(tableInfo.node);

    setTableToolbar({ ...size, left, top, visible: true, width });
  }

  function refreshImageToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      updateImageToolbarFromView(ctx.get(editorViewCtx));
    });
  }

  function refreshTableToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      updateTableToolbarFromView(ctx.get(editorViewCtx));
    });
  }

  function updateImageMeta(pos: number, patch: Partial<Pick<ImageMeta, "align" | "width">>) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      if (!applyImageMetaPatch(view, pos, patch)) {
        setImageToolbar({ visible: false });
        return;
      }

      requestAnimationFrame(() => updateImageToolbarFromView(view));
    });
  }

  function setImageAlignment(pos: number, align: ImageAlignment) {
    updateImageMeta(pos, { align });
  }

  function setImageWidth(pos: number, width: number) {
    updateImageMeta(pos, { width });
  }

  function resetImageWidth(pos: number) {
    updateImageMeta(pos, { width: undefined });
  }

  function renameImage(pos: number, name: string) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      if (!applyImageNamePatch(view, pos, name)) {
        setImageToolbar({ visible: false });
        return;
      }

      requestAnimationFrame(() => updateImageToolbarFromView(view));
    });
  }

  function stopImageResize() {
    imageResizeRef.current = null;
    window.removeEventListener("pointermove", resizeSelectedImage);
    window.removeEventListener("pointerup", stopImageResize);
  }

  function resizeSelectedImage(event: PointerEvent) {
    const resizeState = imageResizeRef.current;

    if (!resizeState) {
      return;
    }

    updateImageMeta(resizeState.pos, {
      width: resizeState.startWidth + event.clientX - resizeState.startX,
    });
  }

  function startImageResize(
    event: ReactPointerEvent<HTMLDivElement>,
    state: Extract<ImageToolbarState, { visible: true }>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    imageResizeRef.current = {
      pos: state.pos,
      startWidth: state.displayWidth,
      startX: event.clientX,
    };
    window.addEventListener("pointermove", resizeSelectedImage);
    window.addEventListener("pointerup", stopImageResize);
  }

  function runTableCommand(command: TableCommand) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      command(view.state, view.dispatch.bind(view), view);
      view.focus();
      requestAnimationFrame(() => updateTableToolbarFromView(view));
    });
  }

  function resizeSelectedTable(size: TableSize) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tableInfo = findTable(view.state.selection.$from);

      if (!tableInfo) {
        setTableToolbar({ visible: false });
        return;
      }

      const nextTable = createResizedTableNode(view.state, tableInfo.node, size);
      const transaction = view.state.tr.replaceWith(
        tableInfo.pos,
        tableInfo.pos + tableInfo.node.nodeSize,
        nextTable,
      );
      const selectionPosition = Math.min(tableInfo.pos + 3, transaction.doc.content.size);
      const nextSelection = Selection.findFrom(
        transaction.doc.resolve(selectionPosition),
        1,
        true,
      );

      if (nextSelection) {
        transaction.setSelection(nextSelection);
      }

      view.dispatch(transaction.scrollIntoView());
      view.focus();
      requestAnimationFrame(() => updateTableToolbarFromView(view));
    });
  }

  const { get, loading } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, markdownRef.current);
        ctx.set(prismConfig.key, {
          configureRefractor(refractor) {
            registerMarkdownLanguages(refractor);
          },
        });
        ctx
          .get(listenerCtx)
          .markdownUpdated((_, markdown) => {
            markdownRef.current = markdown;

            if (!applyingExternalValueRef.current) {
              onChangeRef.current(markdown);
            }
          })
          .mounted((mountedCtx) => {
            requestAnimationFrame(() => {
              const view = mountedCtx.get(editorViewCtx);
              view.dom.blur();
              updateImageToolbarFromView(view);
              updateTableToolbarFromView(view);
            });
          })
          .selectionUpdated((selectionCtx) => {
            requestAnimationFrame(() => {
              const view = selectionCtx.get(editorViewCtx);
              updateImageToolbarFromView(view);
              updateTableToolbarFromView(view);
            });
          });
      })
      .use(commonmark)
      .use(editableHtmlSchema)
      .use(listener)
      .use(history)
      .use(trailing)
      .use(clipboard)
      .use(gfm)
      .use(math)
      .use(prism)
      .use(disableNativeWritingChecks)
      .use(codeBlockLanguageDecoration)
      .use(mermaidBlockDecoration)
      .use(createRawHtmlPreviewDecoration(filePathRef))
      .use(markdownAlertDecoration)
      .use(markdownSyntaxDecoration)
      .use(searchHighlightDecoration)
      .use(editableImageSelection)
      .use(createEditableImageDecoration(filePathRef));
  }, []);

  function reportActiveHeading() {
    const root = rootRef.current;
    const activeElement = getElementFromSelection();

    if (!root || !activeElement || !root.contains(activeElement)) {
      return;
    }

    const headings = getHeadingElements(root);
    let activeHeading: Element | null = null;

    for (const heading of headings) {
      if (isBeforeOrEqual(heading, activeElement)) {
        activeHeading = heading;
        continue;
      }

      break;
    }

    if (!activeHeading) {
      publishActiveHeading(0);
      return;
    }

    const level = Number(activeHeading.tagName.slice(1));
    const title = normalizeHeadingTitle(activeHeading.textContent ?? "");
    const occurrence =
      headings
        .slice(0, headings.indexOf(activeHeading) + 1)
        .filter(
          (heading) =>
            Number(heading.tagName.slice(1)) === level &&
            normalizeHeadingTitle(heading.textContent ?? "") === title,
        ).length || 1;
    const lineIndex = findHeadingLineIndex(markdownRef.current, level, title, occurrence);

    if (lineIndex >= 0) {
      publishActiveHeading(lineIndex);
    }
  }

  function reportActiveHeadingFromScroll() {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const headings = getHeadingElements(root);

    if (!headings.length) {
      publishActiveHeading(0);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const activationY = rootRect.top + Math.min(140, root.clientHeight * 0.24);
    let activeHeading = headings[0];

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= activationY) {
        activeHeading = heading;
        continue;
      }

      break;
    }

    const level = Number(activeHeading.tagName.slice(1));
    const title = normalizeHeadingTitle(activeHeading.textContent ?? "");
    const occurrence =
      headings
        .slice(0, headings.indexOf(activeHeading) + 1)
        .filter(
          (heading) =>
            Number(heading.tagName.slice(1)) === level &&
            normalizeHeadingTitle(heading.textContent ?? "") === title,
        ).length || 1;
    const lineIndex = findHeadingLineIndex(markdownRef.current, level, title, occurrence);

    if (lineIndex >= 0) {
      publishActiveHeading(lineIndex);
    }
  }

  useEffect(() => {
    const editor = get();
    const isDifferentDocument = previousDocumentIdRef.current !== documentId;

    previousDocumentIdRef.current = documentId;

    if (!editor) {
      return;
    }

    if (value === markdownRef.current) {
      if (isDifferentDocument) {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);

          requestAnimationFrame(() => {
            view.dom.blur();
          });
        });
      }
      return;
    }

    applyingExternalValueRef.current = true;
    markdownRef.current = value;
    editor.action((ctx) => {
      replaceAll(value)(ctx);

      if (isDifferentDocument) {
        const view = ctx.get(editorViewCtx);

        requestAnimationFrame(() => {
          view.dom.blur();
        });
      }
    });
    queueMicrotask(() => {
      applyingExternalValueRef.current = false;
    });
  }, [documentId, get, loading, markdownRef, value]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        reportActiveHeadingFromScroll();
        refreshImageToolbar();
        refreshTableToolbar();
      });
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    window.requestAnimationFrame(reportActiveHeadingFromScroll);

    return () => {
      root.removeEventListener("scroll", handleScroll);

      if (activeHeadingTimerRef.current !== null) {
        window.clearTimeout(activeHeadingTimerRef.current);
        activeHeadingTimerRef.current = null;
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [get, rootRef]);

  useEffect(() => {
    controllerRef.current = {
      clearSearchHighlight() {
        const editor = get();

        if (!editor) {
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const selection = view.state.selection;
          const position = Math.max(
            0,
            Math.min(selection.to, view.state.doc.content.size),
          );
          let transaction = view.state.tr.setMeta(searchHighlightPluginKey, {
            range: null,
          } satisfies Partial<SearchHighlightPluginState>);

          if (!selection.empty) {
            transaction = transaction.setSelection(
              Selection.near(transaction.doc.resolve(position), -1),
            );
          }

          view.dispatch(transaction);
        });
      },
      insertMarkdown(markdown: string) {
        const editor = get();

        if (!editor) {
          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
          return;
        }

        editor.action((ctx) => {
          ctx.get(editorViewCtx).focus();
          insert(markdown)(ctx);
        });
      },
      revealSearchResult(options: TyporaSearchRevealOptions) {
        const editor = get();
        let didReveal = false;

        if (!editor) {
          return false;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const range = findVisibleSearchRange(
            view.state.doc,
            options.query,
            options.occurrenceIndex,
          );

          if (!range) {
            view.dispatch(
              view.state.tr.setMeta(searchHighlightPluginKey, {
                range: null,
              } satisfies Partial<SearchHighlightPluginState>),
            );
            return;
          }

          if (options.preserveRendered) {
            view.dispatch(
              view.state.tr
                .setMeta(searchHighlightPluginKey, {
                  range,
                } satisfies Partial<SearchHighlightPluginState>)
                .setMeta(markdownSyntaxPluginKey, {
                  isFocused: false,
                  suppressedInlineCodeAt: null,
                } satisfies Partial<MarkdownSyntaxPluginState>),
            );
            const activeElement = document.activeElement;

            if (activeElement instanceof HTMLElement && view.dom.contains(activeElement)) {
              activeElement.blur();
            }
          } else {
            view.dispatch(
              view.state.tr
                .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
                .setMeta(searchHighlightPluginKey, {
                  range,
                } satisfies Partial<SearchHighlightPluginState>)
                .scrollIntoView(),
            );
            view.focus();
          }

          const currentRange =
            searchHighlightPluginKey.getState(view.state)?.range ?? range;
          centerEditorRangeInView(view, rootRef.current, currentRange);
          didReveal = true;
        });

        return didReveal;
      },
      runEditCommand(command: TyporaEditCommand) {
        const editor = get();

        if (!editor) {
          if (
            command === "copy" ||
            command === "cut" ||
            command === "delete" ||
            command === "paste"
          ) {
            runBrowserEditCommand(command);
          }
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);

          view.focus();

          switch (command) {
            case "undo":
              undo(view.state, view.dispatch);
              break;
            case "redo":
              redo(view.state, view.dispatch);
              break;
            case "moveLineUp":
              moveActiveBlock(view, "up");
              break;
            case "moveLineDown":
              moveActiveBlock(view, "down");
              break;
            case "delete":
              deleteActiveBlockOrSelection(view);
              break;
            case "copy":
            case "cut":
            case "paste":
              runBrowserEditCommand(command);
              break;
          }
        });
      },
      runFormatCommand(command: TyporaFormatCommand) {
        const editor = get();

        if (!editor) {
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);

          view.focus();

          switch (command.type) {
            case "bold":
              toggleInlineMark(view, "strong");
              break;
            case "italic":
              toggleInlineMark(view, "emphasis");
              break;
            case "inlineCode":
              toggleInlineMark(view, "inlineCode");
              break;
            case "strikethrough":
              toggleInlineMark(view, "strike_through");
              break;
            case "underline":
              insertWrappedMarkdown(ctx, view, "<u>", "</u>", "下划线文本");
              break;
            case "comment":
              insertWrappedMarkdown(ctx, view, "<!-- ", " -->", "注释");
              break;
            case "link":
              if (!setLinkMark(view, command.href)) {
                insert(`[链接文本](${command.href.trim() || "https://"})`)(ctx);
              }
              break;
            case "removeLink":
              removeLinkMark(view);
              break;
            case "copyLink": {
              const href = getSelectedLinkHref(view);

              if (href) {
                void navigator.clipboard?.writeText(href);
              }
              break;
            }
            case "openLink": {
              const href = getSelectedLinkHref(view);

              if (href) {
                window.open(href, "_blank", "noopener,noreferrer");
              }
              break;
            }
            case "clearStyle":
              clearInlineMarks(view);
              break;
            case "imageAlign": {
              const image = getSelectedImage(view);

              if (image) {
                applyImageMetaPatch(view, image.pos, { align: command.align });
                requestAnimationFrame(() => updateImageToolbarFromView(view));
              }
              break;
            }
            case "imageResetSize": {
              const image = getSelectedImage(view);

              if (image) {
                applyImageMetaPatch(view, image.pos, { width: undefined });
                requestAnimationFrame(() => updateImageToolbarFromView(view));
              }
              break;
            }
          }
        });
      },
      runParagraphCommand(command: TyporaParagraphCommand) {
        const editor = get();

        if (!editor) {
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);

          view.focus();

          switch (command.type) {
            case "heading":
              setCurrentBlockType(view, "heading", { level: command.level });
              break;
            case "paragraph":
              setCurrentBlockType(view, "paragraph");
              break;
            case "promoteHeading":
              changeHeadingLevel(view, "promote");
              break;
            case "demoteHeading":
              changeHeadingLevel(view, "demote");
              break;
            case "mathBlock":
              insert("\n$$\n\n$$\n")(ctx);
              break;
            case "codeBlock":
              setCurrentBlockType(view, "code_block", { language: "" });
              break;
            case "blockquote":
              toggleBlockquote(view);
              break;
            case "orderedList":
              wrapCurrentSelectionInList(view, "ordered_list");
              break;
            case "bulletList":
              wrapCurrentSelectionInList(view, "bullet_list");
              break;
            case "taskList":
              wrapCurrentSelectionInList(view, "bullet_list", true);
              break;
            case "alert":
              insert(createMarkdownAlert(command.kind))(ctx);
              break;
            case "indentList":
              indentCurrentListItem(view, "in");
              break;
            case "outdentList":
              indentCurrentListItem(view, "out");
              break;
            case "insertParagraphBefore":
              insertParagraphRelative(view, "before");
              break;
            case "insertParagraphAfter":
              insertParagraphRelative(view, "after");
              break;
            case "horizontalRule":
              insertHorizontalRule(view);
              break;
            case "toc":
              insert(createTableOfContentsMarkdown(markdownRef.current))(ctx);
              break;
          }
        });
      },
      scrollToLine(lineIndex: number) {
        const root = rootRef.current;
        const heading = getHeadingAtLine(markdownRef.current, lineIndex);

        if (!root || !heading) {
          return;
        }

        const occurrence = getHeadingOccurrence(markdownRef.current, lineIndex);
        const headingElement = getHeadingElements(root)
          .filter(
            (element) =>
              Number(element.tagName.slice(1)) === heading.level &&
              normalizeHeadingTitle(element.textContent ?? "") === heading.title,
          )
          .at(occurrence - 1);

        headingElement?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        pendingActiveHeadingRef.current = lineIndex;
        onActiveLineChange?.(lineIndex);
      },
    };

    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, get, markdownRef, onActiveLineChange, onChangeRef, rootRef, valueRef]);

  return (
    <div
      className="typora-milkdown-content"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onClick={(event) => {
        const target = event.target;
        const isTableInteraction =
          target instanceof Element &&
          (target.closest("table") || target.closest(".milkdown-table-toolbar"));

        if (!isTableInteraction) {
          setTableToolbar({ visible: false });
        }

        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);

        if (isTableInteraction) {
          requestAnimationFrame(refreshTableToolbar);
        }
      }}
      onKeyUp={() => {
        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);
        requestAnimationFrame(refreshTableToolbar);
      }}
    >
      <ImageToolbar
        state={imageToolbar}
        onEditDrawing={onEditDrawing}
        onResetWidth={resetImageWidth}
        onSetAlign={setImageAlignment}
        onSetWidth={setImageWidth}
      />
      <ImageNameEditor state={imageToolbar} onRename={renameImage} />
      <ImageResizeHandle state={imageToolbar} onResizeStart={startImageResize} />
      <TableToolbar state={tableToolbar} onResize={resizeSelectedTable} onRun={runTableCommand} />
      <Milkdown />
    </div>
  );
}

export const TyporaEditor = forwardRef<TyporaEditorHandle, TyporaEditorProps>(
  function TyporaEditor(
    { documentId, filePath, onActiveLineChange, onChange, onEditDrawing, onPaste, value },
    ref,
  ) {
    const rootRef = useRef<HTMLElement | null>(null);
    const controllerRef = useRef<TyporaEditorHandle | null>(null);
    const markdownRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);

    onChangeRef.current = onChange;
    valueRef.current = value;

    useImperativeHandle(
      ref,
      () => ({
        clearSearchHighlight() {
          controllerRef.current?.clearSearchHighlight();
        },
        insertMarkdown(markdown: string) {
          if (controllerRef.current) {
            controllerRef.current.insertMarkdown(markdown);
            return;
          }

          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
        },
        revealSearchResult(options: TyporaSearchRevealOptions) {
          return controllerRef.current?.revealSearchResult(options) ?? false;
        },
        runEditCommand(command: TyporaEditCommand) {
          controllerRef.current?.runEditCommand(command);
        },
        runFormatCommand(command: TyporaFormatCommand) {
          controllerRef.current?.runFormatCommand(command);
        },
        runParagraphCommand(command: TyporaParagraphCommand) {
          controllerRef.current?.runParagraphCommand(command);
        },
        scrollToLine(lineIndex: number) {
          controllerRef.current?.scrollToLine(lineIndex);
        },
      }),
      [],
    );

    return (
      <article
        ref={rootRef}
        className="typora-editor typora-rich-editor"
        aria-label="Milkdown markdown editor"
        autoCapitalize="off"
        autoCorrect="off"
        onDoubleClick={(event) => {
          if (!onEditDrawing || !(event.target instanceof Element)) {
            return;
          }

          const imageElement = event.target.closest("img.typora-editable-image");
          const drawingId = getExcalidrawDrawingId(
            imageElement?.getAttribute("title") ?? undefined,
          );

          if (!drawingId) {
            return;
          }

          event.preventDefault();
          onEditDrawing(drawingId);
        }}
        onPaste={onPaste}
        spellCheck={false}
      >
        <MilkdownProvider>
          <MilkdownRuntime
            controllerRef={controllerRef}
            documentId={documentId}
            filePath={filePath}
            markdownRef={markdownRef}
            onActiveLineChange={onActiveLineChange}
            onChange={onChange}
            onChangeRef={onChangeRef}
            onEditDrawing={onEditDrawing}
            onPaste={onPaste}
            rootRef={rootRef}
            value={value}
            valueRef={valueRef}
          />
        </MilkdownProvider>
      </article>
    );
  },
);
