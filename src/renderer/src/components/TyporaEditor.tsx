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
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { commonmark, htmlSchema } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { $prose, insert, replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/kit/prose/gapcursor/style/gapcursor.css";
import "@milkdown/kit/prose/tables/style/tables.css";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "katex/dist/katex.min.css";
import {
  CircleAlert,
  FileText,
  Info,
  Lightbulb,
  OctagonAlert,
  Table2,
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
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import {
  formatCodeLanguageLabel,
  getCodeLanguageSuggestions,
  getCodeLanguageInputValue,
  isMermaidLanguage,
  normalizeCodeLanguageInput,
} from "../codeLanguage";
import { getNewEmptyCodeBlockFocusPosition } from "../codeBlockFocus";
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
import { isMindMapLanguage } from "../mindMapDocument";
import { isReactFlowLanguage } from "../reactFlowDocument";
import { isUniverSheetLanguage } from "../univerSheetDocument";
import {
  getAspectRatioResizeWidth,
  getProportionalHeight,
  getSafeAspectRatio,
} from "../mediaSizing";
import { MindMapDiagram } from "./MindMapDiagram";
import { ReactFlowDiagram } from "./ReactFlowDiagram";
import { UniverSheetPreview } from "./UniverSheetPreview";
import {
  createAssetFileName,
  isLocalAssetReference,
} from "../assetManager";
import type {
  ImageAlignment,
  TaskStatusCommand,
  TyporaAlertKind,
  TyporaEditCommand,
  TyporaFormatCommand,
  TyporaParagraphCommand,
} from "../editorCommands";
import {
  clampImageWidth,
  getExcalidrawDrawingId,
  getExcalidrawSceneReference,
  minImageWidth,
  parseImageMeta,
  patchExcalidrawSceneReference,
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
import {
  documentReferencePlugins,
  documentReferenceSchema,
  isDocumentReferenceNode,
  serializeDocumentReferenceToken,
} from "../documentReferenceNode";
import {
  collectClipboardImageTokens,
  writeMarkdownRichClipboard,
} from "../richClipboard";

export type {
  ImageAlignment,
  TaskStatusCommand,
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
  onEditUniverSheet?: (code: string) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onRequestDocumentReference?: () => void;
  onRequestTableInsert?: () => void;
  value: string;
};

type TyporaSearchRevealOptions = {
  occurrenceIndex: number;
  preserveRendered?: boolean;
  query: string;
};

const outlineAnchorMinOffset = 72;
const outlineAnchorMaxOffset = 140;
const outlineAnchorViewportRatio = 0.18;

type VideoToolbarState =
  | { visible: false }
  | {
      aspectRatio: number;
      displayWidth: number;
      left: number;
      pos: number;
      top: number;
      videoHeight: number;
      videoLeft: number;
      videoTop: number;
      videoWidth: number;
      visible: true;
      width?: number;
    };

type SlashCommandMenuState =
  | { visible: false }
  | {
      left: number;
      selectedIndex: number;
      top: number;
      triggerFrom: number;
      triggerTo: number;
      visible: true;
    };

type SlashCommandAction = "document" | "table";

const slashCommandItems: Array<{
  command: SlashCommandAction;
  description: string;
  icon: LucideIcon;
  title: string;
}> = [
  {
    command: "table",
    description: "插入一个 Markdown 表格",
    icon: Table2,
    title: "表格",
  },
  {
    command: "document",
    description: "选择文件并作为整体插入",
    icon: FileText,
    title: "引用文档",
  },
];

type DocumentReferenceInsertionPoint = {
  createdAt: number;
  documentId: string;
  from: number;
  source: "contextMenu" | "editor";
  to: number;
};

const DOCUMENT_REFERENCE_CONTEXT_ANCHOR_TTL_MS = 3000;

export type TyporaEditorHandle = {
  clearDocumentReferenceInsertionPoint: () => void;
  clearSearchHighlight: () => void;
  deleteContextDocumentReference: () => void;
  focusAtClientPoint: (clientX: number, clientY: number) => void;
  insertDocumentReference: (target: string, display?: string) => void;
  insertMarkdown: (markdown: string) => void;
  rememberDocumentReferenceInsertionPoint: () => void;
  prepareContextMenuTarget: (
    clientX: number,
    clientY: number,
    target: EventTarget | null,
  ) => void;
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
const videoControlsSafeZone = 44;
const fallbackVideoAspectRatio = 16 / 9;
const clickedHeadingUserScrollThreshold = 1;

function isWholeEditorSelection(selection: globalThis.Selection, root: HTMLElement) {
  const selectionText = selection.toString().trim();
  const rootText = root.innerText.trim();

  if (!selectionText || !rootText) {
    return false;
  }

  return selectionText.length >= rootText.length * 0.85;
}

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

function getStableRawHtmlPreviewHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${value.length}-${(hash >>> 0).toString(36)}`;
}

function getRawHtmlPreviewWidgetKey(
  value: string,
  filePath: string | undefined,
  index: number,
) {
  return [
    "typora-raw-html-preview",
    getStableRawHtmlPreviewHash(filePath ?? ""),
    getStableRawHtmlPreviewHash(value),
    index,
  ].join("-");
}

function isRawHtmlImage(value: string) {
  return rawHtmlImagePattern.test(value);
}

function getFirstRawHtmlImage(value: string) {
  const host = document.createElement("div");
  host.innerHTML = value.trim();

  return host.querySelector("img");
}

function getRawHtmlImageWidth(value: string) {
  const image = getFirstRawHtmlImage(value);

  if (!image) {
    return undefined;
  }

  const inlineWidth = image.style.width.trim();
  const styleMatch = inlineWidth.match(/^(\d+(?:\.\d+)?)px$/i);

  if (styleMatch) {
    return clampImageWidth(Number(styleMatch[1]));
  }

  const attrWidth = image.getAttribute("width");
  const attrMatch = attrWidth?.match(/^(\d+(?:\.\d+)?)$/);

  return attrMatch ? clampImageWidth(Number(attrMatch[1])) : undefined;
}

function getRawHtmlImageAlignment(value: string): ImageAlignment {
  const image = getFirstRawHtmlImage(value);

  if (!image) {
    return "left";
  }

  const display = image.style.display.trim().toLowerCase();
  const marginLeft = image.style.marginLeft.trim().toLowerCase();
  const marginRight = image.style.marginRight.trim().toLowerCase();
  const float = image.style.cssFloat.trim().toLowerCase();

  if (float === "right") {
    return "right";
  }

  if (float === "left") {
    return "left";
  }

  if (display !== "block") {
    return "left";
  }

  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }

  if (
    marginLeft === "auto" &&
    (marginRight === "0" || marginRight === "0px" || marginRight === "")
  ) {
    return "right";
  }

  return "left";
}

function applyRawHtmlImageAlignment(
  image: HTMLImageElement,
  align: ImageAlignment,
) {
  image.style.removeProperty("float");
  image.style.display = "block";

  if (align === "center") {
    image.style.marginLeft = "auto";
    image.style.marginRight = "auto";
    return;
  }

  if (align === "right") {
    image.style.marginLeft = "auto";
    image.style.marginRight = "0";
    return;
  }

  image.style.marginLeft = "0";
  image.style.marginRight = "auto";
}

function patchRawHtmlImage(
  value: string,
  patch: Partial<Pick<ImageMeta, "align" | "width">>,
) {
  const host = document.createElement("div");
  host.innerHTML = value.trim();
  const image = host.querySelector("img");

  if (!image) {
    return value;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "width")) {
    if (typeof patch.width === "number") {
      image.style.width = `${clampImageWidth(patch.width)}px`;
      image.style.height = "auto";
      image.style.maxWidth = "100%";
      image.style.removeProperty("zoom");
      image.removeAttribute("width");
      image.removeAttribute("height");
    } else {
      image.style.removeProperty("width");
      image.style.removeProperty("height");
      image.style.removeProperty("max-width");
      image.style.removeProperty("zoom");
      image.removeAttribute("width");
      image.removeAttribute("height");
    }
  }

  if (patch.align) {
    applyRawHtmlImageAlignment(image, patch.align);
  }

  if (!image.getAttribute("style")?.trim()) {
    image.removeAttribute("style");
  }

  return host.innerHTML;
}

function isRawHtmlVideo(value: string) {
  return /<video\b/i.test(value);
}

function getFirstRawHtmlVideo(value: string) {
  const host = document.createElement("div");
  host.innerHTML = value.trim();

  return host.querySelector("video");
}

function getRawHtmlVideoWidth(value: string) {
  const video = getFirstRawHtmlVideo(value);

  if (!video) {
    return undefined;
  }

  const inlineWidth = video.style.width.trim();
  const styleMatch = inlineWidth.match(/^(\d+(?:\.\d+)?)px$/i);

  if (styleMatch) {
    return clampImageWidth(Number(styleMatch[1]));
  }

  const attrWidth = video.getAttribute("width");
  const attrMatch = attrWidth?.match(/^(\d+(?:\.\d+)?)$/);

  return attrMatch ? clampImageWidth(Number(attrMatch[1])) : undefined;
}

function patchRawHtmlVideoWidth(
  value: string,
  width?: number,
  aspectRatio = fallbackVideoAspectRatio,
) {
  const host = document.createElement("div");
  host.innerHTML = value.trim();
  const video = host.querySelector("video");

  if (!video) {
    return value;
  }

  if (typeof width === "number") {
    const nextWidth = clampImageWidth(width);

    video.style.width = `${nextWidth}px`;
    video.style.height = `${getProportionalHeight(nextWidth, aspectRatio)}px`;
    video.style.maxWidth = "100%";
    video.style.maxHeight = "none";
    video.style.objectFit = "contain";
    video.removeAttribute("width");
    video.removeAttribute("height");
  } else {
    video.style.removeProperty("width");
    video.style.removeProperty("max-width");
    video.style.removeProperty("max-height");
    video.style.removeProperty("height");
    video.style.removeProperty("object-fit");
    video.removeAttribute("width");
    video.removeAttribute("height");

    if (!video.getAttribute("style")?.trim()) {
      video.removeAttribute("style");
    }
  }

  return host.innerHTML;
}

function getVideoElementAspectRatio(video: HTMLVideoElement) {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return getSafeAspectRatio(video.videoWidth / video.videoHeight);
  }

  const rect = video.getBoundingClientRect();

  if (rect.width > 0 && rect.height > 0) {
    return getSafeAspectRatio(rect.width / rect.height);
  }

  return fallbackVideoAspectRatio;
}

function replaceRawHtmlNodeValue(view: EditorView, pos: number, value: string) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || node.type.name !== "html") {
    return false;
  }

  const nextNode = node.type.create(
    { ...node.attrs, value },
    value ? view.state.schema.text(value) : null,
  );
  const transaction = view.state.tr.replaceWith(pos, pos + node.nodeSize, nextNode);

  view.dispatch(transaction);
  return true;
}

function createRenderedHtmlPreview(
  value: string,
  filePath?: string,
  sourcePos?: number,
): HTMLElement | null {
  const trimmedValue = value.trim();

  if (!trimmedValue || /<script\b/i.test(trimmedValue)) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "typora-raw-html-preview";
  wrapper.innerHTML = trimmedValue;

  if (typeof sourcePos === "number") {
    wrapper.dataset.typoraRawHtmlPos = String(sourcePos);
  }

  wrapper.dataset.typoraRawHtmlHash = getStableRawHtmlPreviewHash(value);

  if (isRawHtmlVideo(trimmedValue)) {
    wrapper.classList.add("typora-raw-html-preview-video");
  }

  if (isRawHtmlImage(trimmedValue)) {
    wrapper.classList.add("typora-raw-html-preview-image");
  }

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

  wrapper.querySelectorAll("video").forEach((element) => {
    if (!(element instanceof HTMLVideoElement)) {
      return;
    }

    if (!element.hasAttribute("controls")) {
      element.setAttribute("controls", "");
    }

    if (!element.hasAttribute("preload")) {
      element.setAttribute("preload", "metadata");
    }

    element.addEventListener("click", (event) => {
      const rect = element.getBoundingClientRect();

      if (event.clientY >= rect.bottom - videoControlsSafeZone) {
        return;
      }

      if (element.paused) {
        void element.play();
      } else {
        element.pause();
      }
    });
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
            let previewIndex = 0;

            state.doc.descendants((node: ProseMirrorNode, pos) => {
              if (node.type.name !== "html") {
                return;
              }

              const value = getRawHtmlValue(node);

              if (!value.trim() || /<script\b/i.test(value)) {
                return;
              }

              const widgetKey = getRawHtmlPreviewWidgetKey(
                value,
                filePathRef.current,
                previewIndex,
              );
              previewIndex += 1;

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "typora-raw-html-source-hidden",
                }),
                Decoration.widget(
                  pos + node.nodeSize,
                  () =>
                    createRenderedHtmlPreview(
                      value,
                      filePathRef.current,
                      pos,
                    ) ??
                    document.createTextNode(""),
                  {
                    ignoreSelection: true,
                    key: widgetKey,
                    side: -1,
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

type CodeBlockLanguagePromptState = {
  armedForPos: number | null;
  openForPos: number | null;
  query: string;
};

type CodeBlockLanguagePromptMeta = Partial<CodeBlockLanguagePromptState>;

const codeBlockLanguagePluginKey = new PluginKey<CodeBlockLanguagePromptState>(
  "typoraCodeBlockLanguagePrompt",
);

function isCodeLanguagePromptKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing &&
    /^[a-zA-Z0-9+#._-]$/.test(event.key)
  );
}

const codeBlockLanguageDecoration = $prose(
  () =>
    new Plugin<CodeBlockLanguagePromptState>({
      key: codeBlockLanguagePluginKey,
      state: {
        init: (): CodeBlockLanguagePromptState => ({
          armedForPos: null,
          openForPos: null,
          query: "",
        }),
        apply(transaction, pluginState) {
          const meta = transaction.getMeta(codeBlockLanguagePluginKey) as
            | CodeBlockLanguagePromptMeta
            | undefined;
          let armedForPos = pluginState.armedForPos;
          let openForPos = pluginState.openForPos;
          let query = pluginState.query;

          if (armedForPos !== null && transaction.docChanged) {
            armedForPos = transaction.mapping.map(armedForPos, -1);
            const armedNode = transaction.doc.nodeAt(armedForPos);

            if (
              armedNode?.type.name !== "code_block" ||
              armedNode.textContent.length > 0
            ) {
              armedForPos = null;
            }
          }

          if (openForPos !== null && transaction.docChanged) {
            openForPos = transaction.mapping.map(openForPos, -1);

            if (transaction.doc.nodeAt(openForPos)?.type.name !== "code_block") {
              openForPos = null;
              query = "";
            }
          }

          if (armedForPos !== null && transaction.selectionSet) {
            const armedNode = transaction.doc.nodeAt(armedForPos);

            if (
              armedNode?.type.name !== "code_block" ||
              !selectionTouchesRange(
                transaction.selection.from,
                transaction.selection.to,
                armedForPos,
                armedForPos + armedNode.nodeSize,
              )
            ) {
              armedForPos = null;
            }
          }

          if (meta) {
            if (Object.prototype.hasOwnProperty.call(meta, "armedForPos")) {
              armedForPos = meta.armedForPos ?? null;
            }

            if (Object.prototype.hasOwnProperty.call(meta, "openForPos")) {
              openForPos = meta.openForPos ?? null;
            }

            if (Object.prototype.hasOwnProperty.call(meta, "query")) {
              query = meta.query ?? "";
            }
          }

          return { armedForPos, openForPos, query };
        },
      },
      appendTransaction(transactions, oldState, newState) {
        if (
          !transactions.some((transaction) => transaction.docChanged) ||
          transactions.some((transaction) =>
            Boolean(transaction.getMeta(codeBlockLanguagePluginKey)),
          )
        ) {
          return null;
        }

        const codeBlock = getNewEmptyCodeBlockNearSelection(oldState, newState);

        if (!codeBlock) {
          return null;
        }

        return newState.tr.setMeta(codeBlockLanguagePluginKey, {
          armedForPos: codeBlock.pos,
        } satisfies CodeBlockLanguagePromptMeta);
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          const { from, to } = state.selection;
          const promptState = codeBlockLanguagePluginKey.getState(state);

          state.doc.descendants((node: ProseMirrorNode, pos) => {
            if (node.type.name !== "code_block") {
              return;
            }

            const rawLanguage =
              typeof node.attrs.language === "string" ? node.attrs.language.trim() : "";
            const normalizedLanguage = normalizeCodeLanguageInput(rawLanguage);
            const language = normalizedLanguage || "plain text";
            const codeStart = pos + 1;
            const codeEnd = pos + node.nodeSize - 1;
            const isActive =
              (state.selection instanceof NodeSelection && state.selection.from === pos) ||
              selectionTouchesRange(from, to, codeStart, codeEnd);
            const shouldOpenEditor = promptState?.openForPos === pos;
            const shouldShowLanguageEditor =
              isActive &&
              (node.textContent.length > 0 ||
                rawLanguage.length > 0 ||
                shouldOpenEditor);

            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: isActive
                  ? "typora-code-block typora-code-block-active"
                  : "typora-code-block",
                "data-code-language": language,
                "data-code-label": formatCodeLanguageLabel(language),
              }),
            );

            if (shouldShowLanguageEditor) {
              const seedQuery = shouldOpenEditor ? promptState?.query ?? "" : undefined;

              decorations.push(
                Decoration.widget(
                  pos + node.nodeSize - 1,
                  (view) => {
                    const marker = document.createElement("span");
                    const trigger = document.createElement("button");
                    const label = document.createElement("span");
                    const panel = document.createElement("span");
                    const input = document.createElement("input");
                    const list = document.createElement("span");
                    marker.className = "typora-code-language-editor";
                    marker.contentEditable = "false";
                    marker.dataset.codeLanguage = language;
                    marker.setAttribute("aria-label", "Code block language");
                    trigger.className = "typora-code-language-trigger";
                    trigger.type = "button";
                    trigger.title = "更改代码块语言";
                    label.className = "typora-code-language-label";
                    label.textContent = formatCodeLanguageLabel(language);
                    panel.className = "typora-code-language-popover";
                    panel.hidden = true;
                    input.className = "typora-code-language-input";
                    input.setAttribute("aria-label", "Code language");
                    input.autocomplete = "off";
                    input.spellcheck = false;
                    input.type = "text";
                    input.value = getCodeLanguageInputValue(rawLanguage);
                    list.className = "typora-code-language-suggestions";
                    trigger.append(label);
                    panel.append(input, list);
                    marker.append(trigger, panel);
                    let isEditing = false;
                    let activeSuggestionIndex = 0;
                    let suggestionValues = getCodeLanguageSuggestions(input.value);

                    function closeLanguagePrompt(transaction = view.state.tr) {
                      const currentPromptState =
                        codeBlockLanguagePluginKey.getState(view.state);

                      return currentPromptState?.openForPos === pos
                        ? transaction.setMeta(codeBlockLanguagePluginKey, {
                            armedForPos: null,
                            openForPos: null,
                            query: "",
                          } satisfies CodeBlockLanguagePromptMeta)
                        : transaction;
                    }

                    function syncCodeLanguage() {
                      const nextLanguage = normalizeCodeLanguageInput(input.value);
                      const codeNode = view.state.doc.nodeAt(pos);
                      let transaction = closeLanguagePrompt();
                      let shouldDispatch = Boolean(
                        transaction.getMeta(codeBlockLanguagePluginKey),
                      );

                      if (!codeNode || codeNode.type.name !== "code_block") {
                        if (shouldDispatch) {
                          view.dispatch(transaction);
                        }

                        return nextLanguage;
                      }

                      if ((codeNode.attrs.language ?? "") !== nextLanguage) {
                        transaction = transaction.setNodeMarkup(pos, undefined, {
                          ...codeNode.attrs,
                          language: nextLanguage,
                        });
                        shouldDispatch = true;
                      }

                      if (shouldDispatch) {
                        view.dispatch(transaction);
                      }

                      return nextLanguage;
                    }

                    function focusCodeBlockContent() {
                      view.focus();
                      view.dispatch(
                        view.state.tr.setSelection(
                          Selection.near(view.state.doc.resolve(pos + 1), 1),
                        ),
                      );
                    }

                    function setDisplayLanguage(languageValue: string) {
                      const normalizedDisplayLanguage =
                        normalizeCodeLanguageInput(languageValue);
                      const displayLanguage = normalizedDisplayLanguage || "plain text";
                      marker.dataset.codeLanguage = displayLanguage;
                      label.textContent = formatCodeLanguageLabel(displayLanguage);
                      input.value = getCodeLanguageInputValue(languageValue);
                    }

                    function updateActiveSuggestion() {
                      const buttons = Array.from(
                        list.querySelectorAll<HTMLButtonElement>(
                          ".typora-code-language-suggestion",
                        ),
                      );

                      buttons.forEach((button, index) => {
                        button.classList.toggle(
                          "typora-code-language-suggestion-active",
                          index === activeSuggestionIndex,
                        );
                      });
                    }

                    function applySuggestion(index: number) {
                      const suggestion = suggestionValues[index];

                      if (!suggestion) {
                        return false;
                      }

                      input.value = suggestion.value || "text";
                      return true;
                    }

                    function renderSuggestions() {
                      suggestionValues = getCodeLanguageSuggestions(input.value);
                      activeSuggestionIndex = Math.min(
                        activeSuggestionIndex,
                        Math.max(0, suggestionValues.length - 1),
                      );
                      list.replaceChildren();
                      list.hidden = suggestionValues.length === 0;

                      suggestionValues.forEach((suggestion, index) => {
                        const option = document.createElement("button");
                        const optionLabel = document.createElement("span");
                        const optionValue = document.createElement("small");
                        option.className = "typora-code-language-suggestion";
                        option.type = "button";
                        option.dataset.languageValue = suggestion.value;
                        optionLabel.textContent = suggestion.label;
                        optionValue.textContent = suggestion.value || "text";
                        option.append(optionLabel, optionValue);
                        option.addEventListener("mousedown", (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          activeSuggestionIndex = index;
                          applySuggestion(index);
                          exitEditing(true);
                          focusCodeBlockContent();
                        });
                        list.append(option);
                      });

                      updateActiveSuggestion();
                    }

                    function enterEditing(initialQuery?: string) {
                      if (isEditing) {
                        return;
                      }

                      const codeNode = view.state.doc.nodeAt(pos);
                      const hasInitialQuery = typeof initialQuery === "string";
                      const editableLanguage =
                        !hasInitialQuery &&
                        typeof codeNode?.attrs.language === "string" &&
                        codeNode.attrs.language.trim()
                          ? codeNode.attrs.language.trim()
                          : "";

                      isEditing = true;
                      marker.classList.add("typora-code-language-editor-editing");
                      trigger.hidden = true;
                      panel.hidden = false;
                      input.value = hasInitialQuery
                        ? initialQuery
                        : getCodeLanguageInputValue(editableLanguage);
                      activeSuggestionIndex = 0;
                      renderSuggestions();

                      requestAnimationFrame(() => {
                        input.focus();
                        if (hasInitialQuery) {
                          input.setSelectionRange(input.value.length, input.value.length);
                        } else {
                          input.select();
                        }
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

                      if (!shouldSave) {
                        const transaction = closeLanguagePrompt();

                        if (transaction.getMeta(codeBlockLanguagePluginKey)) {
                          view.dispatch(transaction);
                        }
                      }

                      isEditing = false;
                      marker.classList.remove("typora-code-language-editor-editing");
                      panel.hidden = true;
                      trigger.hidden = false;
                      setDisplayLanguage(String(nextLanguage ?? ""));
                    }

                    marker.addEventListener("mousedown", (event) => {
                      const target =
                        event.target instanceof Element ? event.target : null;

                      if (
                        isEditing &&
                        target?.closest(".typora-code-language-popover")
                      ) {
                        event.stopPropagation();
                        return;
                      }

                      event.preventDefault();
                      if (
                        !selectionTouchesRange(
                          view.state.selection.from,
                          view.state.selection.to,
                          codeStart,
                          codeEnd,
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
                    trigger.addEventListener("click", (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      enterEditing();
                    });
                    marker.addEventListener("keydown", (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        enterEditing();
                      }
                    });
                    input.addEventListener("input", () => {
                      activeSuggestionIndex = 0;
                      renderSuggestions();
                    });
                    input.addEventListener("blur", () => {
                      exitEditing(true);
                    });
                    input.addEventListener("keydown", (event) => {
                      event.stopPropagation();

                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        if (!suggestionValues.length) {
                          return;
                        }
                        activeSuggestionIndex = Math.min(
                          suggestionValues.length - 1,
                          activeSuggestionIndex + 1,
                        );
                        updateActiveSuggestion();
                        return;
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        if (!suggestionValues.length) {
                          return;
                        }
                        activeSuggestionIndex = Math.max(0, activeSuggestionIndex - 1);
                        updateActiveSuggestion();
                        return;
                      }

                      if (event.key !== "Enter" && event.key !== "Escape") {
                        return;
                      }

                      event.preventDefault();
                      if (event.key === "Enter") {
                        applySuggestion(activeSuggestionIndex);
                      }
                      exitEditing(event.key === "Enter");
                      focusCodeBlockContent();
                    });

                    if (shouldOpenEditor) {
                      requestAnimationFrame(() => {
                        const currentPromptState =
                          codeBlockLanguagePluginKey.getState(view.state);
                        const codeNode = view.state.doc.nodeAt(pos);

                        if (
                          currentPromptState?.openForPos === pos &&
                          codeNode?.type.name === "code_block"
                        ) {
                          enterEditing(seedQuery);
                        }
                      });
                    }

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
        handleDOMEvents: {
          keydown(view, event) {
            const keyboardEvent = event as KeyboardEvent;

            if (!isCodeLanguagePromptKey(keyboardEvent)) {
              return false;
            }

            const codeBlock = getActiveEmptyCodeBlock(view.state);
            const promptState = codeBlockLanguagePluginKey.getState(view.state);

            if (!codeBlock || promptState?.armedForPos !== codeBlock.pos) {
              return false;
            }

            keyboardEvent.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(codeBlockLanguagePluginKey, {
                armedForPos: null,
                openForPos: codeBlock.pos,
                query: keyboardEvent.key,
              } satisfies CodeBlockLanguagePromptMeta),
            );
            return true;
          },
        },
      },
    }),
);

type CodeBlockDomTarget = { node: ProseMirrorNode; pos: number };
type TaskListDomTarget = { node: ProseMirrorNode; pos: number };

function findCodeBlockAtDocumentPosition(
  view: EditorView,
  position: number,
): CodeBlockDomTarget | null {
  let result: CodeBlockDomTarget | null = null;

  view.state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || node.type.name !== "code_block") {
      return;
    }

    if (position >= pos && position <= pos + node.nodeSize) {
      result = { node, pos };
    }
  });

  return result;
}

function getCodeBlockAtDomTarget(
  view: EditorView,
  target: EventTarget | null,
): CodeBlockDomTarget | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const codeBlockElement = target.closest("pre.typora-code-block, pre");

  if (!codeBlockElement || !view.dom.contains(codeBlockElement)) {
    return null;
  }

  let result: CodeBlockDomTarget | null = null;

  view.state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (node.type.name !== "code_block") {
      return;
    }

    const nodeDOM = view.nodeDOM(pos);

    if (
      nodeDOM === codeBlockElement ||
      (nodeDOM instanceof Element &&
        (nodeDOM.contains(codeBlockElement) || codeBlockElement.contains(nodeDOM)))
    ) {
      result = result ?? { node, pos };
    }
  });

  return result as CodeBlockDomTarget | null;
}

function getCodeBlockAtMouseEvent(
  view: EditorView,
  event: MouseEvent,
): CodeBlockDomTarget | null {
  const domMatch = getCodeBlockAtDomTarget(view, event.target);

  if (domMatch) {
    return domMatch;
  }

  const position = view.posAtCoords({ left: event.clientX, top: event.clientY });

  return position ? findCodeBlockAtDocumentPosition(view, position.pos) : null;
}

function placeCursorInsideCodeBlock(view: EditorView, pos: number) {
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, pos + 1))
      .scrollIntoView(),
  );
  view.focus();
}

function getPixelValue(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTaskListItemNode(node: ProseMirrorNode) {
  return node.type.name === "list_item" && typeof node.attrs.checked === "boolean";
}

function getTaskListItemAtDomElement(
  view: EditorView,
  element: Element,
): TaskListDomTarget | null {
  let result: TaskListDomTarget | null = null;

  view.state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || !isTaskListItemNode(node)) {
      return;
    }

    const nodeDOM = view.nodeDOM(pos);

    if (
      nodeDOM === element ||
      (nodeDOM instanceof Element &&
        (nodeDOM.contains(element) || element.contains(nodeDOM)))
    ) {
      result = { node, pos };
    }
  });

  return result;
}

function getTaskListCheckboxTargetAtMouseEvent(
  view: EditorView,
  event: MouseEvent,
): TaskListDomTarget | null {
  if (!(event.target instanceof Element) || !view.dom.contains(event.target)) {
    return null;
  }

  const directTaskElement = event.target.closest<HTMLElement>('li[data-item-type="task"]');
  const taskElements = directTaskElement
    ? [directTaskElement]
    : Array.from(view.dom.querySelectorAll<HTMLElement>('li[data-item-type="task"]'));

  for (const taskElement of taskElements) {
    const pseudoStyle = window.getComputedStyle(taskElement, "::before");
    const elementStyle = window.getComputedStyle(taskElement);
    const fontSize = getPixelValue(elementStyle.fontSize, 16);
    const rect = taskElement.getBoundingClientRect();
    const checkboxLeft = rect.left + getPixelValue(pseudoStyle.left, -1.42 * fontSize);
    const checkboxTop = rect.top + getPixelValue(pseudoStyle.top, 0.39 * fontSize);
    const checkboxWidth = getPixelValue(pseudoStyle.width, 0.92 * fontSize);
    const checkboxHeight = getPixelValue(pseudoStyle.height, 0.92 * fontSize);
    const hitSlop = Math.max(5, fontSize * 0.22);
    const withinCheckbox =
      event.clientX >= checkboxLeft - hitSlop &&
      event.clientX <= checkboxLeft + checkboxWidth + hitSlop &&
      event.clientY >= checkboxTop - hitSlop &&
      event.clientY <= checkboxTop + checkboxHeight + hitSlop;

    if (!withinCheckbox) {
      continue;
    }

    const taskItem = getTaskListItemAtDomElement(view, taskElement);

    if (taskItem) {
      return taskItem;
    }
  }

  return null;
}

function setTaskListItemStatusAtPosition(
  view: EditorView,
  pos: number,
  status: TaskStatusCommand,
  scrollIntoView = false,
) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || !isTaskListItemNode(node)) {
    return false;
  }

  const checked =
    status === "toggle" ? node.attrs.checked !== true : status === "completed";
  let transaction = view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    checked,
  });

  if (scrollIntoView) {
    transaction = transaction.scrollIntoView();
  }

  view.dispatch(transaction);
  return true;
}

function toggleTaskListItemAtMouseEvent(view: EditorView, event: MouseEvent) {
  const taskItem = getTaskListCheckboxTargetAtMouseEvent(view, event);

  if (!taskItem) {
    return false;
  }

  const toggled = setTaskListItemStatusAtPosition(view, taskItem.pos, "toggle");

  if (toggled) {
    view.focus();
  }

  return toggled;
}

function isBlankMarkdown(value: string) {
  return value.trim().length === 0;
}

function focusDocumentStart(view: EditorView, scrollIntoView = true) {
  const transaction = view.state.tr.setSelection(Selection.atStart(view.state.doc));

  view.dispatch(scrollIntoView ? transaction.scrollIntoView() : transaction);
  view.focus();
}

function focusDocumentEnd(view: EditorView, scrollIntoView = true) {
  const transaction = view.state.tr.setSelection(Selection.atEnd(view.state.doc));

  view.dispatch(scrollIntoView ? transaction.scrollIntoView() : transaction);
  view.focus();
}

function isNonEditorControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, input, textarea, select, [contenteditable='false'], .milkdown-image-toolbar, .milkdown-table-toolbar, .milkdown-video-resize-handle",
      ),
    )
  );
}

function getRawHtmlPreviewSourcePosition(
  preview: HTMLElement,
  view?: EditorView,
) {
  const pos = Number(preview.dataset.typoraRawHtmlPos ?? NaN);

  if (!view) {
    return Number.isFinite(pos) ? pos : null;
  }

  const currentPos = Number.isFinite(pos) ? pos : null;
  const previewHash = preview.dataset.typoraRawHtmlHash;

  if (currentPos !== null) {
    const currentNode = view.state.doc.nodeAt(currentPos);

    if (
      currentNode?.type.name === "html" &&
      (!previewHash ||
        getStableRawHtmlPreviewHash(getRawHtmlValue(currentNode)) === previewHash)
    ) {
      return currentPos;
    }
  }

  let domPosition: number | null = null;

  try {
    domPosition = view.posAtDOM(preview, 0);
  } catch {
    domPosition = null;
  }

  let matchedPosition: number | null = null;
  let matchedDistance = Number.POSITIVE_INFINITY;

  view.state.doc.descendants((node: ProseMirrorNode, candidatePos) => {
    if (node.type.name !== "html") {
      return true;
    }

    const value = getRawHtmlValue(node);

    if (
      previewHash &&
      getStableRawHtmlPreviewHash(value) !== previewHash
    ) {
      return false;
    }

    const distance =
      domPosition === null
        ? 0
        : Math.abs(candidatePos + node.nodeSize - domPosition);

    if (distance < matchedDistance) {
      matchedDistance = distance;
      matchedPosition = candidatePos;
    }

    return false;
  });

  if (matchedPosition !== null) {
    preview.dataset.typoraRawHtmlPos = String(matchedPosition);
  }

  return matchedPosition;
}

function getEditableBlockCenter(view: EditorView, position: number, selectionPosition: number) {
  const dom = view.nodeDOM(position);

  if (dom instanceof HTMLElement) {
    const rect = dom.getBoundingClientRect();

    if (rect.height > 0) {
      return (rect.top + rect.bottom) / 2;
    }
  }

  try {
    const coords = view.coordsAtPos(selectionPosition);

    return (coords.top + coords.bottom) / 2;
  } catch {
    return null;
  }
}

function findRawHtmlPreviewAtMousePosition(
  event: ReactMouseEvent<HTMLElement>,
  root: HTMLElement,
) {
  const target = event.target instanceof Element ? event.target : null;
  const directPreview = target?.closest<HTMLElement>(".typora-raw-html-preview");

  if (directPreview && root.contains(directPreview)) {
    return directPreview;
  }

  return null;
}

function focusEditableParagraphAfterRawHtmlPreview(
  view: EditorView,
  pos: number,
  eventY?: number,
) {
  const paragraphType = view.state.schema.nodes.paragraph;

  if (!paragraphType) {
    return false;
  }

  const docSize = view.state.doc.content.size;
  const rawHtmlNode = view.state.doc.nodeAt(pos);
  const insertPosition = Math.min(
    docSize,
    pos + (rawHtmlNode?.nodeSize ?? 1),
  );
  const emptyParagraphs: Array<{
    center: number | null;
    position: number;
    selectionPosition: number;
  }> = [];

  for (
    let paragraphPosition = insertPosition;
    paragraphPosition <= docSize;
  ) {
    const node = view.state.doc.nodeAt(paragraphPosition);

    if (node?.type !== paragraphType || node.content.size !== 0) {
      break;
    }

    emptyParagraphs.push({
      center: getEditableBlockCenter(
        view,
        paragraphPosition,
        Math.min(paragraphPosition + 1, docSize),
      ),
      position: paragraphPosition,
      selectionPosition: Math.min(paragraphPosition + 1, docSize),
    });
    paragraphPosition += node.nodeSize;
  }

  if (emptyParagraphs.length) {
    const targetParagraph =
      typeof eventY === "number"
        ? emptyParagraphs.reduce((best, candidate) => {
            const bestCenter = best.center;
            const candidateCenter = candidate.center;

            if (bestCenter === null) {
              return candidate;
            }

            if (candidateCenter === null) {
              return best;
            }

            return Math.abs(eventY - candidateCenter) <
              Math.abs(eventY - bestCenter)
              ? candidate
              : best;
          }, emptyParagraphs[0])
        : emptyParagraphs[0];

    view.dispatch(
      view.state.tr
        .setSelection(
          TextSelection.create(view.state.doc, targetParagraph.selectionPosition),
        )
        .scrollIntoView(),
    );
    view.focus();
    return true;
  }

  const selection =
    Selection.findFrom(view.state.doc.resolve(insertPosition), 1, true) ??
    Selection.near(view.state.doc.resolve(insertPosition), 1);

  view.dispatch(
    view.state.tr.setSelection(selection).scrollIntoView(),
  );
  view.focus();
  return true;
}

function focusRawHtmlPreviewBoundary(
  view: EditorView,
  event: ReactMouseEvent<HTMLElement>,
  root: HTMLElement,
) {
  const preview = findRawHtmlPreviewAtMousePosition(event, root);

  if (!preview) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;

  if (target?.closest("img, video")) {
    return false;
  }

  const pos = getRawHtmlPreviewSourcePosition(preview, view);
  const node = pos === null ? null : view.state.doc.nodeAt(pos);

  if (pos === null || !node || node.type.name !== "html") {
    return false;
  }

  const media = preview.querySelector<HTMLElement>("img, video");
  const rect = media?.getBoundingClientRect() ?? preview.getBoundingClientRect();
  const shouldFocusBefore =
    event.clientY < rect.top ||
    (event.clientY <= rect.bottom && event.clientX < rect.left);

  if (!shouldFocusBefore && event.clientY >= rect.bottom) {
    return focusEditableParagraphAfterRawHtmlPreview(view, pos, event.clientY);
  }

  const nextPos = shouldFocusBefore ? pos : pos + node.nodeSize;
  const docSize = view.state.doc.content.size;
  const resolvedPos = view.state.doc.resolve(
    Math.min(docSize, Math.max(0, nextPos)),
  );
  const selection = Selection.near(resolvedPos, shouldFocusBefore ? -1 : 1);

  view.dispatch(view.state.tr.setSelection(selection));
  view.focus();
  return true;
}

function findEditableImagePosition(
  view: EditorView,
  imageElement: HTMLImageElement,
  coordinates?: { left: number; top: number },
) {
  let matchedPosition: number | null = null;

  view.state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (matchedPosition !== null) {
      return false;
    }

    if (node.type.name !== "image") {
      return true;
    }

    const nodeDom = view.nodeDOM(pos);
    const nodeImage =
      nodeDom instanceof HTMLImageElement
        ? nodeDom
        : nodeDom instanceof Element
          ? nodeDom.querySelector("img")
          : null;

    if (nodeImage === imageElement) {
      matchedPosition = pos;
    }

    return false;
  });

  if (matchedPosition !== null) {
    return matchedPosition;
  }

  const docSize = view.state.doc.content.size;
  const findNearbyImage = (position: number, radius: number) => {
    for (let offset = 0; offset <= radius; offset += 1) {
      for (const candidate of offset === 0 ? [position] : [position - offset, position + offset]) {
        if (candidate < 0 || candidate > docSize) {
          continue;
        }

        if (view.state.doc.nodeAt(candidate)?.type.name === "image") {
          return candidate;
        }
      }
    }

    return null;
  };

  try {
    const domPosition = view.posAtDOM(imageElement, 0);
    const imagePosition = findNearbyImage(domPosition, 4);

    if (imagePosition !== null) {
      return imagePosition;
    }
  } catch {
    // Fall through to coordinate-based lookup.
  }

  if (coordinates) {
    const position = view.posAtCoords(coordinates);

    if (position) {
      return findNearbyImage(position.pos, 8);
    }
  }

  return null;
}

function findDocumentReferencePosition(
  view: EditorView,
  referenceElement: HTMLElement,
  coordinates?: { left: number; top: number },
) {
  let matchedPosition: number | null = null;

  view.state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (matchedPosition !== null) {
      return false;
    }

    if (!isDocumentReferenceNode(node)) {
      return true;
    }

    const nodeDom = view.nodeDOM(pos);

    if (
      nodeDom === referenceElement ||
      (nodeDom instanceof Element && nodeDom.contains(referenceElement))
    ) {
      matchedPosition = pos;
      return false;
    }

    return true;
  });

  if (matchedPosition !== null) {
    return matchedPosition;
  }

  const docSize = view.state.doc.content.size;
  const findNearbyReference = (position: number, radius: number) => {
    for (let offset = 0; offset <= radius; offset += 1) {
      for (const candidate of offset === 0 ? [position] : [position - offset, position + offset]) {
        if (candidate < 0 || candidate > docSize) {
          continue;
        }

        if (isDocumentReferenceNode(view.state.doc.nodeAt(candidate))) {
          return candidate;
        }
      }
    }

    return null;
  };

  try {
    const domPosition = view.posAtDOM(referenceElement, 0);
    const referencePosition = findNearbyReference(domPosition, 4);

    if (referencePosition !== null) {
      return referencePosition;
    }
  } catch {
    // Fall through to coordinate-based lookup.
  }

  if (coordinates) {
    const position = view.posAtCoords(coordinates);

    if (position) {
      return findNearbyReference(position.pos, 8);
    }
  }

  return null;
}

function selectEditableImage(
  view: EditorView,
  imageElement: HTMLImageElement,
  event?: MouseEvent,
) {
  if (!view.dom.contains(imageElement)) {
    return false;
  }

  const imagePos = findEditableImagePosition(
    view,
    imageElement,
    event ? { left: event.clientX, top: event.clientY } : undefined,
  );

  if (imagePos === null) {
    return false;
  }

  event?.preventDefault();
  view.dispatch(
    view.state.tr.setSelection(NodeSelection.create(view.state.doc, imagePos)),
  );
  view.focus();
  return true;
}

function focusEditorAtMousePosition(view: EditorView, event: ReactMouseEvent<HTMLElement>) {
  const target = event.target instanceof Element ? event.target : null;
  const isRawHtmlPreviewInteraction = Boolean(
    target?.closest(".typora-raw-html-preview"),
  );

  if (
    event.button !== 0 ||
    (isNonEditorControl(event.target) &&
      !(event.target instanceof HTMLImageElement) &&
      !isRawHtmlPreviewInteraction)
  ) {
    return false;
  }

  const position = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });

  if (!position) {
    return false;
  }

  const resolvedPosition = view.state.doc.resolve(position.pos);
  const selection = resolvedPosition.parent.isTextblock
    ? TextSelection.create(view.state.doc, position.pos)
    : Selection.near(resolvedPosition);

  view.dispatch(view.state.tr.setSelection(selection));
  view.focus();
  return true;
}

function shouldRecoverEditorFocusOnMouseDown(
  event: ReactMouseEvent<HTMLElement>,
  root: HTMLElement,
) {
  if (event.button !== 0) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : root;
  const proseMirror = root.querySelector<HTMLElement>(".ProseMirror");

  if (!proseMirror || !proseMirror.contains(target)) {
    return false;
  }

  if (
    target.closest(
      "button, input, textarea, select, table, pre, .milkdown-image-toolbar, .milkdown-table-toolbar, .milkdown-video-resize-handle, .milkdown-image-resize-handle, .typora-code-language-editor",
    )
  ) {
    return false;
  }

  if (target instanceof HTMLImageElement) {
    return true;
  }

  return target === proseMirror;
}

function shouldFocusDocumentEndOnMouseDown(
  event: ReactMouseEvent<HTMLElement>,
  root: HTMLElement,
) {
  if (event.button !== 0 || isNonEditorControl(event.target)) {
    return false;
  }

  const target =
    event.target instanceof Element ? event.target : root;
  const proseMirror = root.querySelector<HTMLElement>(".ProseMirror");

  if (!proseMirror || !proseMirror.contains(target)) {
    return true;
  }

  const lastChild = Array.from(proseMirror.children)
    .filter((child) => child instanceof HTMLElement)
    .at(-1) as HTMLElement | undefined;

  return Boolean(
    lastChild && event.clientY > lastChild.getBoundingClientRect().bottom,
  );
}

function focusEmptyCodeBlock(view: EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || node.type.name !== "code_block" || node.textContent.length > 0) {
    return false;
  }

  const contentPosition = pos + 1;

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, contentPosition))
      .scrollIntoView(),
  );
  view.focus();
  return true;
}

function getActiveBlankCodeBlock(state: EditorState): CodeBlockDomTarget | null {
  const { from, to } = state.selection;
  let result: CodeBlockDomTarget | null = null;

  state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || node.type.name !== "code_block") {
      return false;
    }

    if (
      node.textContent.trim().length === 0 &&
      from >= pos &&
      to <= pos + node.nodeSize
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
}

function getActiveEmptyCodeBlock(state: EditorState): CodeBlockDomTarget | null {
  const { from, to } = state.selection;
  let result: CodeBlockDomTarget | null = null;

  state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || node.type.name !== "code_block") {
      return false;
    }

    if (
      node.textContent.length === 0 &&
      selectionTouchesRange(from, to, pos, pos + node.nodeSize)
    ) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
}

function getNodeAtSafe(state: EditorState, pos: number) {
  if (pos < 0 || pos > state.doc.content.size) {
    return null;
  }

  return state.doc.nodeAt(pos);
}

function getNewEmptyCodeBlockNearSelection(
  oldState: EditorState,
  newState: EditorState,
): CodeBlockDomTarget | null {
  const { from, to } = newState.selection;
  let result: CodeBlockDomTarget | null = null;

  newState.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || node.type.name !== "code_block") {
      return false;
    }

    const oldNode = getNodeAtSafe(oldState, pos);
    const focusPosition = getNewEmptyCodeBlockFocusPosition({
      block: {
        nodeSize: node.nodeSize,
        pos,
        textContent: node.textContent,
      },
      selection: { from, to },
      wasCodeBlockAtSamePosition: oldNode?.type.name === "code_block",
    });

    if (focusPosition !== null) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
}

function createEmptyCodeBlockFocusTransaction(
  state: EditorState,
  codeBlock: CodeBlockDomTarget,
) {
  if (codeBlock.node.textContent.length > 0) {
    return null;
  }

  const contentPosition = codeBlock.pos + 1;

  if (state.selection.empty && state.selection.from === contentPosition) {
    return null;
  }

  return state.tr
    .setSelection(TextSelection.create(state.doc, contentPosition))
    .scrollIntoView();
}

function getBlankCodeBlockForDeletion(
  state: EditorState,
  key: "Backspace" | "Delete",
): CodeBlockDomTarget | null {
  const activeCodeBlock = getActiveBlankCodeBlock(state);

  if (activeCodeBlock) {
    return activeCodeBlock;
  }

  const { selection } = state;

  if (!selection.empty) {
    return null;
  }

  const cursor = selection.from;
  let result: CodeBlockDomTarget | null = null;

  state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (result || node.type.name !== "code_block") {
      return false;
    }

    if (node.textContent.trim().length > 0) {
      return false;
    }

    const blockFrom = pos;
    const blockTo = pos + node.nodeSize;
    const isNextBlankBlock =
      key === "Delete" && (blockFrom === cursor || blockFrom === cursor + 1);
    const isPreviousBlankBlock =
      key === "Backspace" && (blockTo === cursor || blockTo === cursor - 1);

    if (isNextBlankBlock || isPreviousBlankBlock) {
      result = { node, pos };
      return false;
    }

    return true;
  });

  return result;
}

function deleteBlankCodeBlockForKey(
  view: EditorView,
  key: "Backspace" | "Delete",
) {
  const codeBlock = getBlankCodeBlockForDeletion(view.state, key);

  if (!codeBlock) {
    return false;
  }

  view.dispatch(
    view.state.tr
      .delete(codeBlock.pos, codeBlock.pos + codeBlock.node.nodeSize)
      .scrollIntoView(),
  );
  return true;
}

function createBlankCodeBlockBehavior(
  applyingExternalValueRef: MutableRefObject<boolean>,
) {
  return $prose(
    () => {
      let pendingDeleteKey: "Backspace" | "Delete" | null = null;

      return new Plugin({
        appendTransaction(transactions, oldState, newState) {
          const key = pendingDeleteKey;

          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          if (key) {
            pendingDeleteKey = null;
            const codeBlock = getBlankCodeBlockForDeletion(newState, key);

            return codeBlock
              ? newState.tr
                  .delete(codeBlock.pos, codeBlock.pos + codeBlock.node.nodeSize)
                  .scrollIntoView()
              : null;
          }

          if (applyingExternalValueRef.current) {
            return null;
          }

          const codeBlock =
            getActiveEmptyCodeBlock(newState) ??
            getNewEmptyCodeBlockNearSelection(oldState, newState);

          return codeBlock
            ? createEmptyCodeBlockFocusTransaction(newState, codeBlock)
            : null;
        },
        props: {
          handleDOMEvents: {
            keydown(view, event) {
              const keyboardEvent = event as KeyboardEvent;

              if (
                keyboardEvent.key !== "Backspace" &&
                keyboardEvent.key !== "Delete"
              ) {
                pendingDeleteKey = null;
                return false;
              }

              if (deleteBlankCodeBlockForKey(view, keyboardEvent.key)) {
                keyboardEvent.preventDefault();
                pendingDeleteKey = null;
                return true;
              }

              pendingDeleteKey = keyboardEvent.key;
              return false;
            },
          },
        },
      });
    },
  );
}

const emptyCodeBlockSelection = $prose(
  () =>
    new Plugin({
      props: {
        handleDOMEvents: {
          mousedown(view, event) {
            const mouseEvent = event as MouseEvent;

            if (mouseEvent.button !== 0) {
              return false;
            }

            if (
              event.target instanceof Element &&
              event.target.closest(".typora-code-language-editor")
            ) {
              return false;
            }

            const codeBlock = getCodeBlockAtMouseEvent(view, mouseEvent);

            if (!codeBlock || codeBlock.node.textContent.trim().length > 0) {
              return false;
            }

            event.preventDefault();
            placeCursorInsideCodeBlock(view, codeBlock.pos);
            return true;
          },
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

            if (
              !isMermaidLanguage(language) &&
              !isReactFlowLanguage(language) &&
              !isMindMapLanguage(language)
            ) {
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

                  if (isMindMapLanguage(language)) {
                    const container = document.createElement("div");
                    const root = createRoot(container);

                    container.className = "typora-mindmap-widget";
                    container.setAttribute("aria-label", "Mind map diagram");
                    container.title = "Click to edit mind map source";
                    container.addEventListener("mousedown", (event) => {
                      event.preventDefault();
                      view.dispatch(
                        view.state.tr.setSelection(
                          Selection.near(view.state.doc.resolve(pos + 1), 1),
                        ),
                      );
                      view.focus();
                    });
                    root.render(<MindMapDiagram code={node.textContent} />);

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
                        ".typora-mermaid-diagram, .typora-react-flow-widget, .typora-mindmap-widget",
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

type UniverSheetBlockRange = {
  from: number;
  to: number;
};

function findUniverSheetBlockRange(
  state: EditorView["state"],
): UniverSheetBlockRange | null {
  const { from, to } = state.selection;
  let range: UniverSheetBlockRange | null = null;

  state.doc.descendants((node: ProseMirrorNode, pos) => {
    if (range || node.type.name !== "code_block") {
      return;
    }

    const language =
      typeof node.attrs.language === "string" ? node.attrs.language : "";

    if (!isUniverSheetLanguage(language)) {
      return;
    }

    const blockFrom = pos;
    const blockTo = pos + node.nodeSize;

    if (selectionTouchesRange(from, to, blockFrom, blockTo)) {
      range = { from: blockFrom, to: blockTo };
    }
  });

  return range;
}

function createUniverSheetBlockDecoration(
  onEditUniverSheetRef: MutableRefObject<TyporaEditorProps["onEditUniverSheet"]>,
  filePathRef: MutableRefObject<string | undefined>,
) {
  return $prose(
    () =>
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "Backspace" && event.key !== "Delete") {
              return false;
            }

            const range = findUniverSheetBlockRange(view.state);

            if (!range) {
              return false;
            }

            event.preventDefault();
            view.dispatch(
              view.state.tr
                .delete(range.from, range.to)
                .scrollIntoView(),
            );
            return true;
          },
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node: ProseMirrorNode, pos) => {
              if (node.type.name !== "code_block") {
                return;
              }

              const language =
                typeof node.attrs.language === "string" ? node.attrs.language : "";

              if (!isUniverSheetLanguage(language)) {
                return;
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "typora-mermaid-source-hidden typora-univer-sheet-source-hidden",
                }),
                Decoration.widget(
                  pos + node.nodeSize,
                  () => {
                    const container = document.createElement("div");
                    const root = createRoot(container);

                    container.className = "typora-univer-sheet-widget";
                    container.setAttribute("aria-label", "Univer sheet");
                    root.render(
                      <UniverSheetPreview
                        code={node.textContent}
                        filePath={filePathRef.current}
                        onEdit={(code) => onEditUniverSheetRef.current?.(code)}
                      />,
                    );

                    return container;
                  },
                  {
                    ignoreSelection: true,
                    key: `${language}-${pos}-${node.textContent}`,
                    side: 1,
                    stopEvent: (event) =>
                      event.target instanceof Element &&
                      Boolean(event.target.closest(".typora-univer-sheet-widget")),
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
  () => {
    let isPointerFocusPending = false;

    function setMarkdownSyntaxFocused(view: EditorView, isFocused: boolean) {
      if (!view.dom.isConnected || (isFocused && !view.hasFocus())) {
        return;
      }

      view.dispatch(
        view.state.tr.setMeta(markdownSyntaxPluginKey, {
          isFocused,
          ...(isFocused ? {} : { suppressedInlineCodeAt: null }),
        } satisfies Partial<MarkdownSyntaxPluginState>),
      );
    }

    function scheduleMarkdownSyntaxFocus(view: EditorView, waitForPointerUp: boolean) {
      const focusAfterSelectionSettles = () => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            isPointerFocusPending = false;
            setMarkdownSyntaxFocused(view, true);
          });
        });
      };

      if (!waitForPointerUp) {
        focusAfterSelectionSettles();
        return;
      }

      const finishPointerFocus = () => {
        window.removeEventListener("mouseup", finishPointerFocus, true);
        window.removeEventListener("dragend", finishPointerFocus, true);
        focusAfterSelectionSettles();
      };

      window.addEventListener("mouseup", finishPointerFocus, true);
      window.addEventListener("dragend", finishPointerFocus, true);
    }

    return new Plugin<MarkdownSyntaxPluginState>({
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
          mousedown(view, event) {
            const mouseEvent = event as MouseEvent;

            if (mouseEvent.button === 0 && !view.hasFocus()) {
              isPointerFocusPending = true;
              setMarkdownSyntaxFocused(view, false);
              scheduleMarkdownSyntaxFocus(view, true);
            }

            return false;
          },
          blur(view, event) {
            const nextActiveElement = (event as FocusEvent).relatedTarget;

            if (
              nextActiveElement instanceof Node &&
              view.dom.contains(nextActiveElement)
            ) {
              return false;
            }

            isPointerFocusPending = false;
            setMarkdownSyntaxFocused(view, false);
            return false;
          },
          focus(view) {
            if (!isPointerFocusPending) {
              scheduleMarkdownSyntaxFocus(view, false);
            }

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
    });
  },
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
              const isExcalidrawImage = Boolean(getExcalidrawDrawingId(node.attrs.title));
              const className = [
                "typora-editable-image",
                isExcalidrawImage ? "typora-editable-image-excalidraw" : "",
                `typora-editable-image-${meta.align}`,
              ]
                .filter(Boolean)
                .join(" ");
              const attrs: Record<string, string> = {
                class: className,
                "data-image-align": meta.align,
              };

              if (isExcalidrawImage) {
                attrs["data-image-kind"] = "excalidraw";
              }

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
          const imageElement =
            nodeDom instanceof HTMLImageElement
              ? nodeDom
              : nodeDom instanceof Element
                ? nodeDom.querySelector("img")
                : null;

          if (
            !(imageElement instanceof HTMLImageElement) ||
            !imageElement.classList.contains("typora-editable-image")
          ) {
            return false;
          }

          return selectEditableImage(view, imageElement, event as MouseEvent);
        },
        handleDOMEvents: {
          mousedown(view, event) {
            if (!(event.target instanceof Element)) {
              return false;
            }

            const imageElement = event.target.closest<HTMLImageElement>(
              "img.typora-editable-image",
            );

            return imageElement
              ? selectEditableImage(view, imageElement, event as MouseEvent)
              : false;
          },
          click(view, event) {
            if (!(event.target instanceof Element)) {
              return false;
            }

            const imageElement = event.target.closest<HTMLImageElement>(
              "img.typora-editable-image",
            );

            return imageElement
              ? selectEditableImage(view, imageElement, event as MouseEvent)
              : false;
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

function findRenderedHeadingLineIndex(
  markdown: string,
  headings: Element[],
  activeHeading: Element,
) {
  const activeIndex = headings.indexOf(activeHeading);

  if (activeIndex < 0) {
    return -1;
  }

  const level = Number(activeHeading.tagName.slice(1));
  const title = normalizeHeadingTitle(activeHeading.textContent ?? "");
  let occurrence = 0;

  for (let index = 0; index <= activeIndex; index += 1) {
    const heading = headings[index];

    if (
      Number(heading.tagName.slice(1)) === level &&
      normalizeHeadingTitle(heading.textContent ?? "") === title
    ) {
      occurrence += 1;
    }
  }

  return findHeadingLineIndex(markdown, level, title, occurrence || 1);
}

function getOutlineAnchorOffset(viewportHeight: number) {
  return Math.min(
    outlineAnchorMaxOffset,
    Math.max(outlineAnchorMinOffset, viewportHeight * outlineAnchorViewportRatio),
  );
}

function getScrollTopForElementAtOutlineAnchor(
  root: HTMLElement,
  element: Element,
) {
  const rootRect = root.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const anchorOffset = getOutlineAnchorOffset(root.clientHeight);
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const nextScrollTop =
    root.scrollTop + elementRect.top - rootRect.top - anchorOffset;

  return Math.min(maxScrollTop, Math.max(0, nextScrollTop));
}

function appendMarkdown(currentValue: string, markdown: string) {
  const separator = currentValue.length > 0 && !currentValue.endsWith("\n") ? "\n" : "";

  return `${currentValue}${separator}${markdown}`;
}

function runBrowserEditCommand(command: "copy" | "cut" | "delete" | "paste") {
  return document.execCommand(command);
}

function VideoResizeHandle({
  onResizeStart,
  state,
}: {
  onResizeStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    state: Extract<VideoToolbarState, { visible: true }>,
  ) => void;
  state: VideoToolbarState;
}) {
  if (!state.visible) {
    return null;
  }

  return (
    <div
      className="milkdown-video-resize-handle"
      role="presentation"
      style={{
        left: state.videoLeft + state.videoWidth + 2,
        top: state.videoTop + state.videoHeight + 2,
      }}
      onPointerDown={(event) => onResizeStart(event, state)}
    />
  );
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

function applyRenderableImageMetaPatch(
  view: EditorView,
  pos: number,
  patch: Partial<Pick<ImageMeta, "align" | "width">>,
) {
  const node = view.state.doc.nodeAt(pos);

  if (!node) {
    return false;
  }

  if (node.type.name === "image") {
    return applyImageMetaPatch(view, pos, patch);
  }

  if (node.type.name !== "html") {
    return false;
  }

  const value = getRawHtmlValue(node);

  if (!isRawHtmlImage(value)) {
    return false;
  }

  const nextValue = patchRawHtmlImage(value, patch);

  if (nextValue === value) {
    return true;
  }

  return replaceRawHtmlNodeValue(view, pos, nextValue);
}

function applyImageNamePatch(
  view: EditorView,
  pos: number,
  name: string,
  src?: string,
  title?: string,
) {
  const node = view.state.doc.nodeAt(pos);

  if (!node || node.type.name !== "image") {
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      alt: name,
      ...(src ? { src } : {}),
      ...(title ? { title } : {}),
    }),
  );
  return true;
}

function createExcalidrawSceneFileName(imageFileName: string) {
  const extension = imageFileName.match(/\.[^.\\/]+$/)?.[0] ?? "";
  const baseName = imageFileName.slice(0, imageFileName.length - extension.length);

  return `${baseName || imageFileName}.excalidraw.json`;
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

function setCurrentTaskListItemStatus(
  view: EditorView,
  status: TaskStatusCommand,
) {
  const listItem = getCurrentNodeRange(view, "list_item");

  if (!listItem) {
    return false;
  }

  return setTaskListItemStatusAtPosition(view, listItem.pos, status, true);
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
    requestAnimationFrame(() => setCurrentTaskListItemStatus(view, "incomplete"));
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
  onEditUniverSheet,
  onRequestDocumentReference,
  onRequestTableInsert,
  rootRef,
  value,
  valueRef,
}: MilkdownRuntimeProps) {
  const applyingExternalValueRef = useRef(false);
  const pendingLocalMarkdownRef = useRef<string | null>(null);
  const filePathRef = useRef(filePath);
  const onEditUniverSheetRef = useRef(onEditUniverSheet);
  const onRequestDocumentReferenceRef = useRef(onRequestDocumentReference);
  const onRequestTableInsertRef = useRef(onRequestTableInsert);
  const documentReferenceInsertionPointRef =
    useRef<DocumentReferenceInsertionPoint | null>(null);
  const [imageToolbar, setImageToolbar] = useState<ImageToolbarState>({
    visible: false,
  });
  const contextImageTargetRef = useRef<{
    pos: number;
    source: "html" | "markdown";
  } | null>(null);
  const contextDocumentReferenceTargetRef = useRef<{
    pos: number;
  } | null>(null);
  const [tableToolbar, setTableToolbar] = useState<TableToolbarState>({
    visible: false,
  });
  const [videoToolbar, setVideoToolbar] = useState<VideoToolbarState>({
    visible: false,
  });
  const [slashCommandMenu, setSlashCommandMenu] = useState<SlashCommandMenuState>({
    visible: false,
  });
  const activeHeadingTimerRef = useRef<number | null>(null);
  const clickedHeadingRef = useRef<{
    lineIndex: number;
    scrollTop: number;
  } | null>(null);
  const clickedHeadingUserScrollRef = useRef(false);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  useEffect(() => {
    onEditUniverSheetRef.current = onEditUniverSheet;
  }, [onEditUniverSheet]);

  useEffect(() => {
    onRequestDocumentReferenceRef.current = onRequestDocumentReference;
  }, [onRequestDocumentReference]);

  useEffect(() => {
    onRequestTableInsertRef.current = onRequestTableInsert;
  }, [onRequestTableInsert]);

  function resetDocumentReferenceInsertionPoint() {
    documentReferenceInsertionPointRef.current = null;
  }

  function storeDocumentReferenceInsertionPoint(
    view: EditorView,
    source: DocumentReferenceInsertionPoint["source"] = "editor",
    options: { preserveRecentContextMenu?: boolean } = {},
  ) {
    const existing = documentReferenceInsertionPointRef.current;

    if (
      options.preserveRecentContextMenu &&
      existing?.documentId === documentId &&
      existing.source === "contextMenu" &&
      Date.now() - existing.createdAt < DOCUMENT_REFERENCE_CONTEXT_ANCHOR_TTL_MS
    ) {
      return true;
    }

    const { selection } = view.state;

    if (!(selection instanceof TextSelection)) {
      resetDocumentReferenceInsertionPoint();
      return false;
    }

    documentReferenceInsertionPointRef.current = {
      createdAt: Date.now(),
      documentId,
      from: selection.from,
      source,
      to: selection.to,
    };
    return true;
  }

  function takeDocumentReferenceInsertionRange(view: EditorView) {
    const insertionPoint = documentReferenceInsertionPointRef.current;

    documentReferenceInsertionPointRef.current = null;

    if (!insertionPoint || insertionPoint.documentId !== documentId) {
      return null;
    }

    const maxPosition = view.state.doc.content.size;
    const from = Math.max(0, Math.min(insertionPoint.from, maxPosition));
    const to = Math.max(from, Math.min(insertionPoint.to, maxPosition));

    return { from, to };
  }

  const previousDocumentIdRef = useRef(documentId);
  const pendingActiveHeadingRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const imageResizeRef = useRef<{
    pos: number;
    startWidth: number;
    startX: number;
    pendingWidth: number | null;
    frameId: number | null;
  } | null>(null);
  const videoResizeRef = useRef<{
    aspectRatio: number;
    pos: number;
    startWidth: number;
    startX: number;
    startY: number;
    pendingWidth: number | null;
    frameId: number | null;
  } | null>(null);

  function clearClickedHeadingLock() {
    clickedHeadingRef.current = null;
    clickedHeadingUserScrollRef.current = false;
  }

  function closeSlashCommandMenu() {
    setSlashCommandMenu({ visible: false });
  }

  function findSlashCommandMatchIndex(query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return 0;
    }

    return slashCommandItems.findIndex((item) => {
      const searchableText = `${item.title} ${item.description} ${item.command}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }

  function getSlashCommandQuery(
    view: EditorView,
    menu: Extract<SlashCommandMenuState, { visible: true }>,
  ) {
    const { selection } = view.state;

    if (!(selection instanceof TextSelection) || !selection.empty) {
      return null;
    }

    const cursor = selection.from;
    const slashFrom = Math.max(0, Math.min(menu.triggerFrom, view.state.doc.content.size));

    if (cursor < slashFrom + 1) {
      return null;
    }

    const triggerText = view.state.doc.textBetween(slashFrom, cursor, "\n", "\n");

    if (!triggerText.startsWith("/") || triggerText.includes("\n")) {
      return null;
    }

    return {
      cursor,
      query: triggerText.slice(1),
    };
  }

  function updateSlashCommandMenuFromView(view: EditorView) {
    setSlashCommandMenu((current) => {
      if (!current.visible) {
        return current;
      }

      const queryInfo = getSlashCommandQuery(view, current);

      if (!queryInfo) {
        return { visible: false };
      }

      const { cursor, query } = queryInfo;

      if (query !== query.trim()) {
        return { visible: false };
      }

      const matchedIndex = findSlashCommandMatchIndex(query);

      if (matchedIndex < 0) {
        return { visible: false };
      }

      if (current.selectedIndex === matchedIndex && current.triggerTo === cursor) {
        return current;
      }

      return {
        ...current,
        selectedIndex: matchedIndex,
        triggerTo: cursor,
      };
    });
  }

  function positionSlashCommandMenu(
    view: EditorView,
    triggerFrom: number,
    triggerTo: number,
    selectedIndex = 0,
  ) {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const cursorRect = view.coordsAtPos(triggerTo);
    const rootRect = root.getBoundingClientRect();

    setSlashCommandMenu({
      left: Math.max(16, cursorRect.left - rootRect.left),
      selectedIndex,
      top: Math.max(16, cursorRect.bottom - rootRect.top + 8),
      triggerFrom,
      triggerTo,
      visible: true,
    });
  }

  function openSlashCommandMenu(view: EditorView) {
    const { selection } = view.state;

    if (!(selection instanceof TextSelection)) {
      return false;
    }

    const triggerFrom = selection.from;
    const triggerTo = triggerFrom + 1;
    const tr = view.state.tr.insertText("/", selection.from, selection.to);

    view.dispatch(
      tr
        .setSelection(TextSelection.create(tr.doc, triggerTo))
        .scrollIntoView(),
    );
    view.focus();
    positionSlashCommandMenu(view, triggerFrom, triggerTo);
    return true;
  }

  function removeSlashCommandTrigger(
    view: EditorView,
    menu: Extract<SlashCommandMenuState, { visible: true }>,
  ) {
    const maxPosition = view.state.doc.content.size;
    const from = Math.max(0, Math.min(menu.triggerFrom, maxPosition));
    const to = Math.max(from, Math.min(menu.triggerTo, maxPosition));

    if (from === to || !view.state.doc.textBetween(from, to).startsWith("/")) {
      return;
    }

    const tr = view.state.tr.delete(from, to);
    const nextPos = Math.min(from, tr.doc.content.size);

    view.dispatch(
      tr
        .setSelection(TextSelection.create(tr.doc, nextPos))
        .scrollIntoView(),
    );
  }

  function selectSlashCommand(delta: number) {
    setSlashCommandMenu((current) => {
      if (!current.visible) {
        return current;
      }

      const nextIndex =
        (current.selectedIndex + delta + slashCommandItems.length) %
        slashCommandItems.length;

      return {
        ...current,
        selectedIndex: nextIndex,
      };
    });
  }

  function handleSlashCommandKeyDownCapture(
    event: ReactKeyboardEvent<HTMLElement>,
  ) {
    if (slashCommandMenu.visible) {
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        closeSlashCommandMenu();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectSlashCommand(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectSlashCommand(-1);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const item = slashCommandItems[slashCommandMenu.selectedIndex];

        event.preventDefault();

        if (item) {
          runSlashCommand(item.command);
        }

        return;
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const editor = get();

        requestAnimationFrame(() => {
          editor?.action((ctx) =>
            updateSlashCommandMenuFromView(ctx.get(editorViewCtx)),
          );
        });
      }
    }

    if (
      event.key !== "/" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      isNonEditorControl(event.target)
    ) {
      return;
    }

    const target =
      event.target instanceof Element ? event.target.closest(".ProseMirror") : null;

    if (!target) {
      return;
    }

    const editor = get();

    if (!editor) {
      return;
    }

    event.preventDefault();
    editor.action((ctx) => openSlashCommandMenu(ctx.get(editorViewCtx)));
  }

  function runSlashCommand(command: SlashCommandAction) {
    const menu = slashCommandMenu.visible ? slashCommandMenu : null;
    const editor = get();
    let didStoreDocumentReferencePoint = false;

    closeSlashCommandMenu();

    if (editor && menu) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        removeSlashCommandTrigger(view, menu);

        if (command === "document") {
          didStoreDocumentReferencePoint = storeDocumentReferenceInsertionPoint(
            view,
            "editor",
          );
        }
      });
    }

    if (command === "document") {
      if (!didStoreDocumentReferencePoint && editor) {
        editor.action((ctx) => {
          storeDocumentReferenceInsertionPoint(ctx.get(editorViewCtx), "editor");
        });
      }

      onRequestDocumentReferenceRef.current?.();
      return;
    }

    onRequestTableInsertRef.current?.();
  }

  useEffect(() => {
    if (!slashCommandMenu.visible) {
      return undefined;
    }

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".typora-slash-menu")
      ) {
        return;
      }

      closeSlashCommandMenu();
    };

    window.addEventListener("mousedown", closeOnOutsidePointer, true);

    return () => {
      window.removeEventListener("mousedown", closeOnOutsidePointer, true);
    };
  }, [slashCommandMenu.visible]);

  function shouldReleaseClickedHeadingLock() {
    const clickedHeading = clickedHeadingRef.current;
    const root = rootRef.current;

    if (!clickedHeading || !root || !clickedHeadingUserScrollRef.current) {
      return false;
    }

    const scrollDistance = Math.abs(root.scrollTop - clickedHeading.scrollTop);
    return scrollDistance > clickedHeadingUserScrollThreshold;
  }

  function publishActiveHeading(lineIndex: number) {
    const clickedHeading = clickedHeadingRef.current;

    if (clickedHeading) {
      if (!shouldReleaseClickedHeadingLock()) {
        if (lineIndex !== clickedHeading.lineIndex) {
          return;
        }
      } else {
        clearClickedHeadingLock();
      }
    }

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

    if (selection.empty) {
      return null;
    }

    const from = Math.max(0, selection.from);
    const to = Math.min(view.state.doc.content.size, selection.to);
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

  function getRawHtmlPreviewImageElement(pos: number) {
    const root = rootRef.current;
    const directMatch =
      root?.querySelector<HTMLImageElement>(
        `.typora-raw-html-preview[data-typora-raw-html-pos="${pos}"] img`,
      ) ?? null;

    if (directMatch) {
      return directMatch;
    }

    const editor = get();
    let matchedImage: HTMLImageElement | null = null;

    if (!root || !editor) {
      return null;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      root
        .querySelectorAll<HTMLElement>(".typora-raw-html-preview")
        .forEach((preview) => {
          if (matchedImage) {
            return;
          }

          if (getRawHtmlPreviewSourcePosition(preview, view) === pos) {
            matchedImage = preview.querySelector<HTMLImageElement>("img");
          }
        });
    });

    return matchedImage;
  }

  function updateImageToolbarFromRawHtmlImageElement(
    imageElement: HTMLImageElement | null,
  ) {
    const root = rootRef.current;

    if (!root || !imageElement || !root.contains(imageElement)) {
      setImageToolbar({ visible: false });
      return;
    }

    const editor = get();

    if (!editor) {
      setImageToolbar({ visible: false });
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const wrapper = imageElement.closest<HTMLElement>(".typora-raw-html-preview");
      const pos =
        wrapper instanceof HTMLElement
          ? getRawHtmlPreviewSourcePosition(wrapper, view)
          : null;

      if (pos === null) {
        setImageToolbar({ visible: false });
        return;
      }

      const node = view.state.doc.nodeAt(pos);
      const value = node ? getRawHtmlValue(node) : "";

      if (!node || node.type.name !== "html" || !isRawHtmlImage(value)) {
        setImageToolbar({ visible: false });
        return;
      }

      const overlay = getOverlayContainer(root);
      const rootRect = root.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const imageRect = imageElement.getBoundingClientRect();
      const visibleTop = rootRect.top + 8 - overlayRect.top;
      const maxLeft = overlay.clientWidth - 132;
      const rawLeft = imageRect.left - overlayRect.left;
      const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
      const top = Math.max(visibleTop, imageRect.top - overlayRect.top - 46);
      const name =
        imageElement.getAttribute("alt")?.trim() ||
        imageElement
          .getAttribute("src")
          ?.split(/[?#]/)[0]
          ?.split(/[\\/]/)
          .filter(Boolean)
          .pop() ||
        "HTML Image";

      setImageToolbar({
        align: getRawHtmlImageAlignment(value),
        displayWidth: clampImageWidth(imageRect.width || minImageWidth),
        imageHeight: imageRect.height,
        imageLeft: imageRect.left - overlayRect.left,
        imageTop: imageRect.top - overlayRect.top,
        imageWidth: imageRect.width,
        left,
        name,
        pos,
        source: "html",
        top,
        visible: true,
        width: getRawHtmlImageWidth(value),
      });
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

  function getVideoPreviewElement(pos: number) {
    const root = rootRef.current;
    const directMatch =
      root?.querySelector<HTMLVideoElement>(
        `.typora-raw-html-preview[data-typora-raw-html-pos="${pos}"] video`,
      ) ?? null;

    if (directMatch) {
      return directMatch;
    }

    const editor = get();
    let matchedVideo: HTMLVideoElement | null = null;

    if (!root || !editor) {
      return null;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      root
        .querySelectorAll<HTMLElement>(".typora-raw-html-preview")
        .forEach((preview) => {
          if (matchedVideo) {
            return;
          }

          if (getRawHtmlPreviewSourcePosition(preview, view) === pos) {
            matchedVideo = preview.querySelector<HTMLVideoElement>("video");
          }
        });
    });

    return matchedVideo;
  }

  function updateVideoToolbarFromElement(videoElement: HTMLVideoElement | null) {
    const root = rootRef.current;
    const editor = get();

    if (!root || !editor || !videoElement || !root.contains(videoElement)) {
      setVideoToolbar({ visible: false });
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const wrapper = videoElement.closest<HTMLElement>(".typora-raw-html-preview");
      const pos =
        wrapper instanceof HTMLElement
          ? getRawHtmlPreviewSourcePosition(wrapper, view)
          : null;

      if (pos === null) {
        setVideoToolbar({ visible: false });
        return;
      }

      const node = view.state.doc.nodeAt(pos);
      const value = node ? getRawHtmlValue(node) : "";

      if (!node || node.type.name !== "html" || !isRawHtmlVideo(value)) {
        setVideoToolbar({ visible: false });
        return;
      }

      const overlay = getOverlayContainer(root);
      const rootRect = root.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const videoRect = videoElement.getBoundingClientRect();
      const visibleTop = rootRect.top + 8 - overlayRect.top;
      const maxLeft = overlay.clientWidth - 152;
      const rawLeft = videoRect.left - overlayRect.left;
      const left = Math.max(8, Math.min(rawLeft, Math.max(8, maxLeft)));
      const top = Math.max(visibleTop, videoRect.top - overlayRect.top - 38);
      const width = getRawHtmlVideoWidth(value);

      setVideoToolbar({
        aspectRatio: getVideoElementAspectRatio(videoElement),
        displayWidth: clampImageWidth(videoRect.width || minImageWidth),
        left,
        pos,
        top,
        videoHeight: videoRect.height,
        videoLeft: videoRect.left - overlayRect.left,
        videoTop: videoRect.top - overlayRect.top,
        videoWidth: videoRect.width,
        visible: true,
        width,
      });
    });
  }

  function refreshVideoToolbar() {
    if (!videoToolbar.visible) {
      return;
    }

    updateVideoToolbarFromElement(getVideoPreviewElement(videoToolbar.pos));
  }

  function refreshImageToolbar() {
    const editor = get();

    if (!editor) {
      return;
    }

    if (imageToolbar.visible && imageToolbar.source === "html") {
      updateImageToolbarFromRawHtmlImageElement(
        getRawHtmlPreviewImageElement(imageToolbar.pos),
      );
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
      const node = view.state.doc.nodeAt(pos);

      if (node?.type.name === "html") {
        const value = getRawHtmlValue(node);
        const nextValue = patchRawHtmlImage(value, patch);

        if (nextValue === value) {
          requestAnimationFrame(() => {
            updateImageToolbarFromRawHtmlImageElement(getRawHtmlPreviewImageElement(pos));
          });
          return;
        }

        if (!replaceRawHtmlNodeValue(view, pos, nextValue)) {
          setImageToolbar({ visible: false });
          return;
        }

        requestAnimationFrame(() => {
          updateImageToolbarFromRawHtmlImageElement(getRawHtmlPreviewImageElement(pos));
        });
        return;
      }

      if (!applyImageMetaPatch(view, pos, patch)) {
        setImageToolbar({ visible: false });
        return;
      }

      requestAnimationFrame(() => updateImageToolbarFromView(view));
    });
  }

  function getEventTargetElement(target: EventTarget | null) {
    if (target instanceof Element) {
      return target;
    }

    if (target instanceof Node) {
      return target.parentElement;
    }

    return null;
  }

  function prepareContextMenuTargetForEditor(
    clientX: number,
    clientY: number,
    target: EventTarget | null,
  ) {
    const editor = get();

    if (!editor) {
      return;
    }

    const targetElement = getEventTargetElement(target);
    const editableImageElement = targetElement?.closest<HTMLImageElement>(
      "img.typora-editable-image",
    );
    const rawHtmlImageElement = targetElement?.closest<HTMLImageElement>(
      ".typora-raw-html-preview img",
    );
    const documentReferenceElement = targetElement?.closest<HTMLElement>(
      ".typora-document-reference-node",
    );

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      if (
        documentReferenceElement &&
        view.dom.contains(documentReferenceElement)
      ) {
        const referencePos = findDocumentReferencePosition(
          view,
          documentReferenceElement,
          {
            left: clientX,
            top: clientY,
          },
        );

        if (referencePos !== null) {
          contextDocumentReferenceTargetRef.current = {
            pos: referencePos,
          };
          contextImageTargetRef.current = null;
          setImageToolbar({ visible: false });
          setVideoToolbar({ visible: false });
          view.focus();
          return;
        }
      }

      if (editableImageElement && view.dom.contains(editableImageElement)) {
        const imagePos = findEditableImagePosition(view, editableImageElement, {
          left: clientX,
          top: clientY,
        });

        if (imagePos !== null) {
          contextDocumentReferenceTargetRef.current = null;
          contextImageTargetRef.current = {
            pos: imagePos,
            source: "markdown",
          };
          view.dispatch(
            view.state.tr.setSelection(NodeSelection.create(view.state.doc, imagePos)),
          );
          view.focus();
          setVideoToolbar({ visible: false });
          requestAnimationFrame(() => updateImageToolbarFromView(view));
          return;
        }
      }

      if (rawHtmlImageElement && rootRef.current?.contains(rawHtmlImageElement)) {
        const wrapper =
          rawHtmlImageElement.closest<HTMLElement>(".typora-raw-html-preview");
        const pos = wrapper ? getRawHtmlPreviewSourcePosition(wrapper) : null;
        const node = pos === null ? null : view.state.doc.nodeAt(pos);
        const value = node ? getRawHtmlValue(node) : "";

        if (pos !== null && node?.type.name === "html" && isRawHtmlImage(value)) {
          contextDocumentReferenceTargetRef.current = null;
          contextImageTargetRef.current = {
            pos,
            source: "html",
          };
          setVideoToolbar({ visible: false });
          requestAnimationFrame(() =>
            updateImageToolbarFromRawHtmlImageElement(rawHtmlImageElement),
          );
          return;
        }
      }

      contextDocumentReferenceTargetRef.current = null;
      contextImageTargetRef.current = null;

      const position = view.posAtCoords({ left: clientX, top: clientY });

      if (position) {
        const { selection } = view.state;

        if (
          selection.empty ||
          position.pos < selection.from ||
          position.pos > selection.to
        ) {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.near(view.state.doc.resolve(position.pos)))
              .scrollIntoView(),
          );
        }
      }

      storeDocumentReferenceInsertionPoint(view, "contextMenu");
      view.focus();
    });
  }

  async function renameImage(pos: number, name: string) {
    const editor = get();

    if (!editor) {
      return;
    }

    const selectedImageRef: {
      current: { node: ProseMirrorNode; view: EditorView } | null;
    } = { current: null };

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(pos);

      if (node) {
        selectedImageRef.current = { node, view };
      }
    });

    const selectedImage = selectedImageRef.current;

    if (!selectedImage || selectedImage.node.type.name !== "image") {
      setImageToolbar({ visible: false });
      return;
    }

    const node = selectedImage.node;
    const nextImageFileName = createAssetFileName(name, getImageDisplayName(node));
    let nextSrc =
      typeof node.attrs.src === "string" ? node.attrs.src : undefined;
    let nextTitle =
      typeof node.attrs.title === "string" ? node.attrs.title : undefined;

    if (
      nextSrc &&
      filePathRef.current &&
      isLocalAssetReference(nextSrc) &&
      window.desktop?.renameAsset
    ) {
      try {
        const renamedAsset = await window.desktop.renameAsset({
          documentFilePath: filePathRef.current,
          nextName: nextImageFileName,
          reference: nextSrc,
        });

        nextSrc = renamedAsset.reference;
      } catch {
        nextSrc = typeof node.attrs.src === "string" ? node.attrs.src : undefined;
      }
    }

    const sceneReference = getExcalidrawSceneReference(nextTitle);

    if (
      sceneReference &&
      filePathRef.current &&
      isLocalAssetReference(sceneReference) &&
      window.desktop?.renameAsset
    ) {
      try {
        const renamedScene = await window.desktop.renameAsset({
          documentFilePath: filePathRef.current,
          nextName: createExcalidrawSceneFileName(nextImageFileName),
          reference: sceneReference,
        });

        nextTitle = patchExcalidrawSceneReference(nextTitle, renamedScene.reference);
      } catch {
        nextTitle = typeof node.attrs.title === "string" ? node.attrs.title : undefined;
      }
    }

    editor.action((ctx) => {
      const nextView = ctx.get(editorViewCtx);

      if (!applyImageNamePatch(nextView, pos, name, nextSrc, nextTitle)) {
        setImageToolbar({ visible: false });
        return;
      }

      requestAnimationFrame(() => updateImageToolbarFromView(nextView));
    });
  }

  function flushPendingImageResize() {
    const resizeState = imageResizeRef.current;

    if (!resizeState || resizeState.pendingWidth === null) {
      return;
    }

    const nextWidth = resizeState.pendingWidth;

    if (resizeState.frameId !== null) {
      window.cancelAnimationFrame(resizeState.frameId);
      resizeState.frameId = null;
    }

    resizeState.pendingWidth = null;
    updateImageMeta(resizeState.pos, { width: nextWidth });
  }

  function scheduleImageResize(width: number) {
    const resizeState = imageResizeRef.current;

    if (!resizeState) {
      return;
    }

    resizeState.pendingWidth = width;

    if (resizeState.frameId !== null) {
      return;
    }

    resizeState.frameId = window.requestAnimationFrame(() => {
      const currentResizeState = imageResizeRef.current;

      if (!currentResizeState || currentResizeState.pendingWidth === null) {
        return;
      }

      const nextWidth = currentResizeState.pendingWidth;
      currentResizeState.pendingWidth = null;
      currentResizeState.frameId = null;
      updateImageMeta(currentResizeState.pos, { width: nextWidth });
    });
  }

  function stopImageResize(event?: PointerEvent) {
    if (event) {
      resizeSelectedImage(event);
    }

    flushPendingImageResize();
    imageResizeRef.current = null;
    window.removeEventListener("pointermove", resizeSelectedImage);
    window.removeEventListener("pointerup", stopImageResize);
  }

  function resizeSelectedImage(event: PointerEvent) {
    const resizeState = imageResizeRef.current;

    if (!resizeState) {
      return;
    }

    scheduleImageResize(resizeState.startWidth + event.clientX - resizeState.startX);
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
      pendingWidth: null,
      frameId: null,
    };
    window.addEventListener("pointermove", resizeSelectedImage);
    window.addEventListener("pointerup", stopImageResize);
  }

  function updateVideoWidth(
    pos: number,
    width?: number,
    aspectRatio = videoToolbar.visible && videoToolbar.pos === pos
      ? videoToolbar.aspectRatio
      : fallbackVideoAspectRatio,
  ) {
    const editor = get();

    if (!editor) {
      return;
    }

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(pos);
      const value = node ? getRawHtmlValue(node) : "";

      if (!node || node.type.name !== "html" || !isRawHtmlVideo(value)) {
        setVideoToolbar({ visible: false });
        return;
      }

      const nextValue = patchRawHtmlVideoWidth(value, width, aspectRatio);

      if (nextValue !== value) {
        replaceRawHtmlNodeValue(view, pos, nextValue);
      }

      requestAnimationFrame(() => {
        updateVideoToolbarFromElement(getVideoPreviewElement(pos));
      });
    });
  }

  function applyVideoPreviewResize(
    pos: number,
    width: number,
    aspectRatio: number,
  ) {
    const videoElement = getVideoPreviewElement(pos);

    if (!videoElement) {
      return;
    }

    const nextWidth = clampImageWidth(width);
    const nextHeight = getProportionalHeight(nextWidth, aspectRatio);

    videoElement.style.width = `${nextWidth}px`;
    videoElement.style.height = `${nextHeight}px`;
    videoElement.style.maxWidth = "100%";
    videoElement.style.maxHeight = "none";
    videoElement.style.objectFit = "contain";

    const rect = videoElement.getBoundingClientRect();
    const renderedWidth = rect.width || nextWidth;
    const renderedHeight = rect.height || nextHeight;

    setVideoToolbar((current) =>
      current.visible && current.pos === pos
        ? {
            ...current,
            aspectRatio: getSafeAspectRatio(aspectRatio),
            displayWidth: clampImageWidth(renderedWidth),
            videoHeight: renderedHeight,
            videoWidth: renderedWidth,
            width: nextWidth,
          }
        : current,
    );
  }

  function flushPendingVideoResize() {
    const resizeState = videoResizeRef.current;

    if (!resizeState || resizeState.pendingWidth === null) {
      return;
    }

    const nextWidth = resizeState.pendingWidth;

    if (resizeState.frameId !== null) {
      window.cancelAnimationFrame(resizeState.frameId);
      resizeState.frameId = null;
    }

    resizeState.pendingWidth = null;
    updateVideoWidth(resizeState.pos, nextWidth, resizeState.aspectRatio);
  }

  function scheduleVideoResize(width: number) {
    const resizeState = videoResizeRef.current;

    if (!resizeState) {
      return;
    }

    resizeState.pendingWidth = clampImageWidth(width);

    if (resizeState.frameId !== null) {
      return;
    }

    resizeState.frameId = window.requestAnimationFrame(() => {
      const currentResizeState = videoResizeRef.current;

      if (!currentResizeState || currentResizeState.pendingWidth === null) {
        return;
      }

      const nextWidth = currentResizeState.pendingWidth;
      currentResizeState.pendingWidth = null;
      currentResizeState.frameId = null;
      applyVideoPreviewResize(
        currentResizeState.pos,
        nextWidth,
        currentResizeState.aspectRatio,
      );
    });
  }

  function stopVideoResize(event?: PointerEvent) {
    if (event) {
      resizeSelectedVideo(event);
    }

    flushPendingVideoResize();
    videoResizeRef.current = null;
    window.removeEventListener("pointermove", resizeSelectedVideo);
    window.removeEventListener("pointerup", stopVideoResize);
  }

  function resizeSelectedVideo(event: PointerEvent) {
    const resizeState = videoResizeRef.current;

    if (!resizeState) {
      return;
    }

    scheduleVideoResize(
      clampImageWidth(getAspectRatioResizeWidth({
        aspectRatio: resizeState.aspectRatio,
        currentX: event.clientX,
        currentY: event.clientY,
        startWidth: resizeState.startWidth,
        startX: resizeState.startX,
        startY: resizeState.startY,
      })),
    );
  }

  function startVideoResize(
    event: ReactPointerEvent<HTMLDivElement>,
    state: Extract<VideoToolbarState, { visible: true }>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    videoResizeRef.current = {
      aspectRatio: state.aspectRatio || fallbackVideoAspectRatio,
      pos: state.pos,
      startWidth: state.displayWidth,
      startX: event.clientX,
      startY: event.clientY,
      pendingWidth: null,
      frameId: null,
    };
    window.addEventListener("pointermove", resizeSelectedVideo);
    window.addEventListener("pointerup", stopVideoResize);
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
              pendingLocalMarkdownRef.current = markdown;
              onChangeRef.current(markdown);
            }
          })
          .mounted((mountedCtx) => {
            requestAnimationFrame(() => {
              const view = mountedCtx.get(editorViewCtx);

              if (isBlankMarkdown(markdownRef.current)) {
                focusDocumentStart(view, false);
              } else {
                view.dom.blur();
              }

              updateImageToolbarFromView(view);
              updateTableToolbarFromView(view);
            });
          })
          .selectionUpdated((selectionCtx) => {
            requestAnimationFrame(() => {
              const view = selectionCtx.get(editorViewCtx);
              updateSlashCommandMenuFromView(view);
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
      .use(documentReferencePlugins)
      .use(math)
      .use(prism)
      .use(disableNativeWritingChecks)
      .use(codeBlockLanguageDecoration)
      .use(createBlankCodeBlockBehavior(applyingExternalValueRef))
      .use(emptyCodeBlockSelection)
      .use(mermaidBlockDecoration)
      .use(createUniverSheetBlockDecoration(onEditUniverSheetRef, filePathRef))
      .use(createRawHtmlPreviewDecoration(filePathRef))
      .use(markdownAlertDecoration)
      .use(markdownSyntaxDecoration)
      .use(searchHighlightDecoration)
      .use(editableImageSelection)
      .use(createEditableImageDecoration(filePathRef));
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const selectedRawHtmlImagePos =
      imageToolbar.visible && imageToolbar.source === "html"
        ? imageToolbar.pos
        : null;

    root
      .querySelectorAll<HTMLElement>(".typora-raw-html-preview-selected")
      .forEach((preview) => {
        const previewPos = getRawHtmlPreviewSourcePosition(preview);

        if (previewPos !== selectedRawHtmlImagePos) {
          preview.classList.remove("typora-raw-html-preview-selected");
        }
      });

    if (selectedRawHtmlImagePos === null) {
      return;
    }

    root
      .querySelector<HTMLElement>(
        `.typora-raw-html-preview[data-typora-raw-html-pos="${selectedRawHtmlImagePos}"]`,
      )
      ?.classList.add("typora-raw-html-preview-selected");
  }, [imageToolbar, rootRef]);

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

    const lineIndex = findRenderedHeadingLineIndex(
      markdownRef.current,
      headings,
      activeHeading,
    );

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
    const activationY = rootRect.top + getOutlineAnchorOffset(root.clientHeight);
    let activeHeading = headings[0];

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= activationY) {
        activeHeading = heading;
        continue;
      }

      break;
    }

    const lineIndex = findRenderedHeadingLineIndex(
      markdownRef.current,
      headings,
      activeHeading,
    );

    if (lineIndex >= 0) {
      publishActiveHeading(lineIndex);
    }
  }

  function reportActiveHeadingFromScrollWhenUnlocked() {
    if (clickedHeadingRef.current) {
      if (shouldReleaseClickedHeadingLock()) {
        clearClickedHeadingLock();
        reportActiveHeadingFromScroll();
      }

      return;
    }

    reportActiveHeadingFromScroll();
  }

  useEffect(() => {
    const editor = get();
    const isDifferentDocument = previousDocumentIdRef.current !== documentId;

    previousDocumentIdRef.current = documentId;

    if (isDifferentDocument) {
      clearClickedHeadingLock();
      pendingLocalMarkdownRef.current = null;
    }

    if (!editor) {
      return;
    }

    if (value === markdownRef.current) {
      pendingLocalMarkdownRef.current = null;

      if (isDifferentDocument) {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);

          requestAnimationFrame(() => {
            if (isBlankMarkdown(value)) {
              focusDocumentStart(view, false);
            } else {
              view.dom.blur();
            }
          });
        });
      }
      return;
    }

    if (
      !isDifferentDocument &&
      pendingLocalMarkdownRef.current === markdownRef.current
    ) {
      return;
    }

    applyingExternalValueRef.current = true;
    pendingLocalMarkdownRef.current = null;
    markdownRef.current = value;
    editor.action((ctx) => {
      replaceAll(value)(ctx);

      if (isDifferentDocument) {
        const view = ctx.get(editorViewCtx);

        requestAnimationFrame(() => {
          if (isBlankMarkdown(value)) {
            focusDocumentStart(view, false);
          } else {
            view.dom.blur();
          }
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
        reportActiveHeadingFromScrollWhenUnlocked();

        refreshImageToolbar();
        refreshTableToolbar();
      });
    };
    const markUserScrollIntent = () => {
      if (clickedHeadingRef.current) {
        clickedHeadingUserScrollRef.current = true;
      }
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    root.addEventListener("pointerdown", markUserScrollIntent, { passive: true });
    root.addEventListener("wheel", markUserScrollIntent, { passive: true });
    root.addEventListener("touchmove", markUserScrollIntent, { passive: true });
    window.requestAnimationFrame(reportActiveHeadingFromScrollWhenUnlocked);

    return () => {
      root.removeEventListener("scroll", handleScroll);
      root.removeEventListener("pointerdown", markUserScrollIntent);
      root.removeEventListener("wheel", markUserScrollIntent);
      root.removeEventListener("touchmove", markUserScrollIntent);

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
      focusAtClientPoint(clientX: number, clientY: number) {
        const editor = get();

        if (!editor) {
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const position = view.posAtCoords({ left: clientX, top: clientY });

          if (position) {
            const { selection } = view.state;

            if (
              selection.empty ||
              position.pos < selection.from ||
              position.pos > selection.to
            ) {
              view.dispatch(
                view.state.tr
                  .setSelection(
                    Selection.near(view.state.doc.resolve(position.pos)),
                  )
                  .scrollIntoView(),
              );
            }
          }

          view.focus();
        });
      },
      clearDocumentReferenceInsertionPoint() {
        resetDocumentReferenceInsertionPoint();
      },
      deleteContextDocumentReference() {
        const editor = get();
        const contextTarget = contextDocumentReferenceTargetRef.current;

        contextDocumentReferenceTargetRef.current = null;

        if (!editor || !contextTarget) {
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const pos = Math.max(
            0,
            Math.min(contextTarget.pos, view.state.doc.content.size),
          );
          const node = view.state.doc.nodeAt(pos);

          if (!isDocumentReferenceNode(node)) {
            return;
          }

          const tr = view.state.tr.delete(pos, pos + node.nodeSize);
          const nextPos = Math.min(pos, tr.doc.content.size);

          view.dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, nextPos))
              .scrollIntoView(),
          );
          view.focus();
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
      insertDocumentReference(target: string, display?: string) {
        const safeTarget = target.trim();
        const safeDisplay = display?.trim() || safeTarget;
        const raw = serializeDocumentReferenceToken({
          display: safeDisplay,
          target: safeTarget,
        });
        const editor = get();

        if (!safeTarget) {
          return;
        }

        if (!editor) {
          onChangeRef.current(appendMarkdown(valueRef.current, raw));
          return;
        }

        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const insertionRange = takeDocumentReferenceInsertionRange(view);
          const { from, to } = insertionRange ?? view.state.selection;
          const node = documentReferenceSchema.type(ctx).create({
            display: safeDisplay,
            raw,
            target: safeTarget,
          });
          const tr = view.state.tr.replaceRangeWith(from, to, node);
          const nextPos = Math.min(from + node.nodeSize, tr.doc.content.size);

          view.dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, nextPos))
              .scrollIntoView(),
          );
          view.focus();
        });
      },
      rememberDocumentReferenceInsertionPoint() {
        const editor = get();

        if (!editor) {
          return;
        }

        editor.action((ctx) => {
          storeDocumentReferenceInsertionPoint(ctx.get(editorViewCtx), "editor", {
            preserveRecentContextMenu: true,
          });
        });
      },
      prepareContextMenuTarget(clientX, clientY, target) {
        prepareContextMenuTargetForEditor(clientX, clientY, target);
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
                applyRenderableImageMetaPatch(view, image.pos, {
                  align: command.align,
                });
                requestAnimationFrame(() => updateImageToolbarFromView(view));
                break;
              }

              const contextImageTarget = contextImageTargetRef.current;

              if (
                contextImageTarget &&
                applyRenderableImageMetaPatch(view, contextImageTarget.pos, {
                  align: command.align,
                })
              ) {
                requestAnimationFrame(() => {
                  if (contextImageTarget.source === "html") {
                    updateImageToolbarFromRawHtmlImageElement(
                      getRawHtmlPreviewImageElement(contextImageTarget.pos),
                    );
                  } else {
                    updateImageToolbarFromView(view);
                  }
                });
                break;
              }
              break;
            }
            case "imageResetSize": {
              const image = getSelectedImage(view);

              if (image) {
                applyRenderableImageMetaPatch(view, image.pos, {
                  width: undefined,
                });
                requestAnimationFrame(() => updateImageToolbarFromView(view));
                break;
              }

              const contextImageTarget = contextImageTargetRef.current;

              if (
                contextImageTarget &&
                applyRenderableImageMetaPatch(view, contextImageTarget.pos, {
                  width: undefined,
                })
              ) {
                requestAnimationFrame(() => {
                  if (contextImageTarget.source === "html") {
                    updateImageToolbarFromRawHtmlImageElement(
                      getRawHtmlPreviewImageElement(contextImageTarget.pos),
                    );
                  } else {
                    updateImageToolbarFromView(view);
                  }
                });
                break;
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
              if (setCurrentBlockType(view, "code_block", { language: "" })) {
                const block = getActiveTopLevelBlock(view);

                if (block?.node.type.name === "code_block") {
                  if (!focusEmptyCodeBlock(view, block.start)) {
                    placeCursorInsideCodeBlock(view, block.start);
                  }
                  requestAnimationFrame(() => {
                    const latestBlock = getActiveTopLevelBlock(view);

                    if (
                      latestBlock?.node.type.name === "code_block" &&
                      latestBlock.node.textContent.length === 0
                    ) {
                      if (!focusEmptyCodeBlock(view, latestBlock.start)) {
                        placeCursorInsideCodeBlock(view, latestBlock.start);
                      }
                    }
                  });
                }
              }
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
            case "taskStatus":
              setCurrentTaskListItemStatus(view, command.status);
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

        if (headingElement) {
          const nextScrollTop = getScrollTopForElementAtOutlineAnchor(
            root,
            headingElement,
          );

          clickedHeadingRef.current = {
            lineIndex,
            scrollTop: nextScrollTop,
          };
          clickedHeadingUserScrollRef.current = false;

          root.scrollTo({
            top: nextScrollTop,
            behavior: "smooth",
          });
        } else {
          clickedHeadingRef.current = {
            lineIndex,
            scrollTop: root.scrollTop,
          };
          clickedHeadingUserScrollRef.current = false;
        }

        if (activeHeadingTimerRef.current !== null) {
          window.clearTimeout(activeHeadingTimerRef.current);
          activeHeadingTimerRef.current = null;
        }

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
        clearClickedHeadingLock();

        const target = event.target;
        const isTableInteraction =
          target instanceof Element &&
          (target.closest("table") || target.closest(".milkdown-table-toolbar"));
        const videoElement =
          target instanceof Element
            ? target.closest<HTMLVideoElement>(".typora-raw-html-preview video")
            : null;
        const rawHtmlImageElement =
          target instanceof Element
            ? target.closest<HTMLImageElement>(".typora-raw-html-preview img")
            : null;
        const isVideoInteraction =
          target instanceof Element &&
          Boolean(
            videoElement ||
              target.closest(".milkdown-video-resize-handle"),
          );

        if (!isTableInteraction) {
          setTableToolbar({ visible: false });
        }

        if (videoElement) {
          setImageToolbar({ visible: false });
          requestAnimationFrame(() => updateVideoToolbarFromElement(videoElement));
        } else if (rawHtmlImageElement) {
          setVideoToolbar({ visible: false });
          requestAnimationFrame(() =>
            updateImageToolbarFromRawHtmlImageElement(rawHtmlImageElement),
          );
        } else if (!isVideoInteraction) {
          setVideoToolbar({ visible: false });
        }

        reportActiveHeading();
        if (!rawHtmlImageElement) {
          requestAnimationFrame(refreshImageToolbar);
        }
        if (!rawHtmlImageElement && !videoElement) {
          requestAnimationFrame(refreshVideoToolbar);
        }

        if (isTableInteraction) {
          requestAnimationFrame(refreshTableToolbar);
        }
      }}
      onMouseDown={(event) => {
        const editor = get();
        let toggledTaskCheckbox = false;

        if (editor) {
          editor.action((ctx) => {
            toggledTaskCheckbox = toggleTaskListItemAtMouseEvent(
              ctx.get(editorViewCtx),
              event.nativeEvent,
            );
          });
        }

        if (toggledTaskCheckbox) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const root = rootRef.current;

        if (event.defaultPrevented) {
          return;
        }

        const targetElement =
          event.target instanceof Element ? event.target : null;
        const editableImageElement = targetElement?.closest<HTMLImageElement>(
          "img.typora-editable-image",
        );
        const rawHtmlImageElement = targetElement?.closest<HTMLImageElement>(
          ".typora-raw-html-preview img",
        );

        if (!editableImageElement && !rawHtmlImageElement) {
          contextImageTargetRef.current = null;
        }

        if (root && editor) {
          let didFocusRawHtmlBoundary = false;

          editor.action((ctx) => {
            didFocusRawHtmlBoundary = focusRawHtmlPreviewBoundary(
              ctx.get(editorViewCtx),
              event,
              root,
            );
          });

          if (didFocusRawHtmlBoundary) {
            event.preventDefault();
            setImageToolbar({ visible: false });
            setVideoToolbar({ visible: false });
            return;
          }
        }

        if (rawHtmlImageElement) {
          event.preventDefault();
          setVideoToolbar({ visible: false });
          requestAnimationFrame(() =>
            updateImageToolbarFromRawHtmlImageElement(rawHtmlImageElement),
          );
          return;
        }

        if (
          root &&
          editor &&
          shouldRecoverEditorFocusOnMouseDown(event, root)
        ) {
          let didFocus = false;

          editor.action((ctx) => {
            didFocus = focusEditorAtMousePosition(ctx.get(editorViewCtx), event);
          });

          if (didFocus) {
            event.preventDefault();
            return;
          }
        }

        if (
          !root ||
          !editor ||
          !(
            isBlankMarkdown(markdownRef.current) ||
            shouldFocusDocumentEndOnMouseDown(event, root)
          )
        ) {
          return;
        }

        event.preventDefault();
        editor.action((ctx) => focusDocumentEnd(ctx.get(editorViewCtx), false));
      }}
      onKeyUp={() => {
        clearClickedHeadingLock();
        reportActiveHeading();
        requestAnimationFrame(refreshImageToolbar);
        requestAnimationFrame(refreshTableToolbar);
        requestAnimationFrame(refreshVideoToolbar);
      }}
      onKeyDownCapture={handleSlashCommandKeyDownCapture}
    >
      <ImageNameEditor state={imageToolbar} onRename={renameImage} />
      <ImageResizeHandle state={imageToolbar} onResizeStart={startImageResize} />
      <VideoResizeHandle state={videoToolbar} onResizeStart={startVideoResize} />
      <TableToolbar state={tableToolbar} onResize={resizeSelectedTable} onRun={runTableCommand} />
      {slashCommandMenu.visible ? (
        <div
          className="typora-slash-menu"
          style={{ left: slashCommandMenu.left, top: slashCommandMenu.top }}
          onMouseDown={(event) => event.preventDefault()}
          role="menu"
        >
          {slashCommandItems.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === slashCommandMenu.selectedIndex;

            return (
              <button
                key={item.command}
                className={isSelected ? "is-selected" : undefined}
                type="button"
                onClick={() => runSlashCommand(item.command)}
                onMouseEnter={() =>
                  setSlashCommandMenu((current) =>
                    current.visible
                      ? {
                          ...current,
                          selectedIndex: index,
                        }
                      : current,
                  )
                }
                role="menuitem"
                aria-selected={isSelected}
              >
                <span className="typora-slash-menu-icon">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
          <div className="typora-slash-menu-hint">
            ↑↓ 切换 · Enter 插入 · Backspace 保留 /
          </div>
        </div>
      ) : null}
      <Milkdown />
    </div>
  );
}

export const TyporaEditor = forwardRef<TyporaEditorHandle, TyporaEditorProps>(
  function TyporaEditor(
    {
      documentId,
      filePath,
      onActiveLineChange,
      onChange,
      onContextMenu,
      onEditDrawing,
      onEditUniverSheet,
      onPaste,
      onRequestDocumentReference,
      onRequestTableInsert,
      value,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLElement | null>(null);
    const controllerRef = useRef<TyporaEditorHandle | null>(null);
    const markdownRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const onPasteRef = useRef(onPaste);
    const valueRef = useRef(value);

    onChangeRef.current = onChange;
    onPasteRef.current = onPaste;
    valueRef.current = value;

    useEffect(() => {
      const root = rootRef.current;

      if (!root) {
        return undefined;
      }

      const listener = (event: globalThis.ClipboardEvent) => {
        onPasteRef.current(event as unknown as ClipboardEvent<HTMLElement>);
      };

      root.addEventListener("paste", listener, true);

      return () => {
        root.removeEventListener("paste", listener, true);
      };
    }, []);

    function handleCopyCapture(event: ClipboardEvent<HTMLElement>) {
      const root = rootRef.current;
      const selection = window.getSelection();

      if (
        !root ||
        !selection ||
        selection.isCollapsed ||
        !selection.anchorNode ||
        !selection.focusNode ||
        !root.contains(selection.anchorNode) ||
        !root.contains(selection.focusNode) ||
        !filePath
      ) {
        return;
      }

      const markdown = isWholeEditorSelection(selection, root)
        ? markdownRef.current
        : selection.toString();
      const imageTokens = collectClipboardImageTokens(markdown);

      if (!imageTokens.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData("text/plain", markdown);

      void writeMarkdownRichClipboard(markdown, filePath);
    }

    useImperativeHandle(
      ref,
      () => ({
        clearDocumentReferenceInsertionPoint() {
          controllerRef.current?.clearDocumentReferenceInsertionPoint();
        },
        clearSearchHighlight() {
          controllerRef.current?.clearSearchHighlight();
        },
        deleteContextDocumentReference() {
          controllerRef.current?.deleteContextDocumentReference();
        },
        focusAtClientPoint(clientX: number, clientY: number) {
          controllerRef.current?.focusAtClientPoint(clientX, clientY);
        },
        insertDocumentReference(target: string, display?: string) {
          if (controllerRef.current) {
            controllerRef.current.insertDocumentReference(target, display);
            return;
          }

          const markdown = serializeDocumentReferenceToken({
            display: display?.trim() || target.trim(),
            target: target.trim(),
          });
          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
        },
        insertMarkdown(markdown: string) {
          if (controllerRef.current) {
            controllerRef.current.insertMarkdown(markdown);
            return;
          }

          onChangeRef.current(appendMarkdown(valueRef.current, markdown));
        },
        rememberDocumentReferenceInsertionPoint() {
          controllerRef.current?.rememberDocumentReferenceInsertionPoint();
        },
        prepareContextMenuTarget(
          clientX: number,
          clientY: number,
          target: EventTarget | null,
        ) {
          controllerRef.current?.prepareContextMenuTarget(clientX, clientY, target);
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
        data-testid="typora-editor"
        aria-label="Milkdown markdown editor"
        autoCapitalize="off"
        autoCorrect="off"
        onCopyCapture={handleCopyCapture}
        onContextMenu={(event) => {
          controllerRef.current?.prepareContextMenuTarget(
            event.clientX,
            event.clientY,
            event.target,
          );
          onContextMenu?.(event);
        }}
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
        onPasteCapture={onPaste}
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
            onEditUniverSheet={onEditUniverSheet}
            onPaste={onPaste}
            onRequestDocumentReference={onRequestDocumentReference}
            onRequestTableInsert={onRequestTableInsert}
            rootRef={rootRef}
            value={value}
            valueRef={valueRef}
          />
        </MilkdownProvider>
      </article>
    );
  },
);
