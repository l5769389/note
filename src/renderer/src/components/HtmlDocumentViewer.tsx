import {
  Edit3,
  MessageSquareText,
  Trash2,
  X,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDocumentDisplayName } from "../documentModel";
import {
  getHtmlAnnotationAssetReference,
  getHtmlAnnotationPosition,
  parseHtmlAnnotationDocument,
  serializeHtmlAnnotationDocument,
  type HtmlAnnotation,
  type HtmlAnnotationStyle,
} from "../htmlAnnotations";
import type { EditorShortcutEvent } from "../editorShortcuts";
import { getDirectoryPath, getLocalPreviewUrl } from "../localPreviewUrls";
import type { MarkdownDocument } from "../types";

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getFileBaseHref(filePath?: string) {
  const directoryPath = getDirectoryPath(filePath);

  if (!directoryPath) {
    return undefined;
  }

  const baseUrl = getLocalPreviewUrl(directoryPath);
  return baseUrl ? `${baseUrl}/` : undefined;
}

export function createHtmlPreviewDocument(content: string, filePath?: string) {
  const baseHref = getFileBaseHref(filePath);
  const runtime = [
    createHtmlAnchorRuntime(),
    createHtmlOutlineRuntime(),
    createHtmlAnnotationRuntime(),
    /\bdata-react-flow\b/i.test(content) ? createReactFlowHtmlRuntime() : "",
    /\bdata-mindmap\b/i.test(content) ? createMindMapHtmlRuntime() : "",
  ].join("");
  const htmlWithBase =
    !baseHref || /<base\s/i.test(content)
      ? content
      : /<head\b[^>]*>/i.test(content)
        ? content.replace(
            /<head\b([^>]*)>/i,
            `<head$1><base href="${escapeHtmlAttribute(baseHref)}">`,
          )
        : /<html\b[^>]*>/i.test(content)
          ? content.replace(
              /<html\b([^>]*)>/i,
              `<html$1><head><base href="${escapeHtmlAttribute(baseHref)}"></head>`,
            )
          : `<!doctype html><html><head><base href="${escapeHtmlAttribute(baseHref)}"></head><body>${content}</body></html>`;

  if (!runtime) {
    return htmlWithBase;
  }

  if (/<\/head>/i.test(htmlWithBase)) {
    return htmlWithBase.replace(/<\/head>/i, `${runtime}</head>`);
  }

  if (/<html\b[^>]*>/i.test(htmlWithBase)) {
    return htmlWithBase.replace(
      /<html\b([^>]*)>/i,
      `<html$1><head>${runtime}</head>`,
    );
  }

  return `<!doctype html><html><head>${runtime}</head><body>${htmlWithBase}</body></html>`;
}

const annotationMessageSource = "markdown-studio";
const annotationSetMessageType = "notedock-html-annotations:set";
const annotationCommandMessageType = "notedock-html-annotations:command";
const annotationReadyMessageType = "notedock-html-annotations:ready";
const annotationChangedMessageType = "notedock-html-annotations:changed";
const annotationSelectionMessageType = "notedock-html-annotations:selection-change";
const annotationSelectMessageType = "notedock-html-annotations:select";
const annotationToggleListMessageType = "notedock-html-annotations:toggle-list";
const appShortcutMessageType = "notedock-app-shortcut";
const htmlOutlineActiveMessageType = "notedock-html-outline:active";
const htmlOutlineScrollMessageType = "notedock-html-outline:scroll";

const annotationStyleLabels: Record<HtmlAnnotationStyle, string> = {
  emphasis: "着重",
  highlight: "高亮",
  note: "批注",
  underline: "下划线",
  wavy: "波浪线",
};

function createHtmlAnnotationRuntime() {
  return `<style data-notedock-html-annotation-runtime>
.notedock-html-annotation{border-radius:.12em;cursor:pointer;transition:background-color .16s ease,box-shadow .16s ease,text-decoration-color .16s ease}
.notedock-html-annotation[data-notedock-html-annotation-style="highlight"]{background:linear-gradient(transparent 42%,rgba(255,213,79,.72) 42%,rgba(255,213,79,.72) 88%,transparent 88%);box-shadow:inset 0 -.1em rgba(217,119,6,.18)}
.notedock-html-annotation[data-notedock-html-annotation-style="emphasis"]{text-emphasis:filled circle #b45309;text-emphasis-position:under right}
.notedock-html-annotation[data-notedock-html-annotation-style="underline"]{text-decoration:underline;text-decoration-color:#2563eb;text-decoration-thickness:.11em;text-underline-offset:.2em}
.notedock-html-annotation[data-notedock-html-annotation-style="wavy"]{text-decoration:underline wavy #dc2626;text-decoration-thickness:.08em;text-underline-offset:.22em}
.notedock-html-annotation[data-notedock-html-annotation-style="note"]{background:linear-gradient(transparent 0,transparent 50%,rgba(147,197,253,.38) 50%,rgba(147,197,253,.38) 92%,transparent 92%);text-decoration:underline dotted #2563eb;text-decoration-thickness:.12em;text-underline-offset:.24em}
.notedock-html-annotation[data-notedock-html-annotation-selected="true"]{background-color:rgba(37,99,235,.1);box-shadow:inset 0 -.28em rgba(37,99,235,.18)}
.notedock-html-annotation-menu{position:fixed;z-index:2147483647;display:grid;width:228px;gap:2px;border:1px solid rgba(148,163,184,.38);border-radius:10px;background:rgba(255,255,255,.96);padding:6px;box-shadow:0 18px 44px rgba(15,23,42,.18);font:13px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;backdrop-filter:blur(12px)}
.notedock-html-annotation-menu button{display:grid;grid-template-columns:minmax(0,1fr) auto;width:100%;align-items:center;gap:10px;border:0;border-radius:7px;background:transparent;color:inherit;padding:8px 9px;text-align:left;font:inherit;cursor:pointer}
.notedock-html-annotation-menu button:hover:not(:disabled),.notedock-html-annotation-menu button:focus-visible{background:#eef4ff;color:#174ea6;outline:0}
.notedock-html-annotation-menu button:disabled{cursor:not-allowed;opacity:.42}
.notedock-html-annotation-menu kbd{color:#64748b;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.notedock-html-annotation-menu-separator{height:1px;margin:3px 4px;background:#e2e8f0}
</style><script data-notedock-html-annotation-runtime>
(() => {
  if (window.__notedockHtmlAnnotationRuntime) return;
  window.__notedockHtmlAnnotationRuntime = true;

  const source = "markdown-studio";
  const setType = "notedock-html-annotations:set";
  const commandType = "notedock-html-annotations:command";
  const readyType = "notedock-html-annotations:ready";
  const changedType = "notedock-html-annotations:changed";
  const selectionType = "notedock-html-annotations:selection-change";
  const selectType = "notedock-html-annotations:select";
  const toggleListType = "notedock-html-annotations:toggle-list";
  const appShortcutType = "notedock-app-shortcut";
  const selector = ".notedock-html-annotation[data-notedock-html-annotation]";
  let annotations = [];
  let lastRange = null;
  let selectedAnnotationId = null;
  let contextMenu = null;

  function post(type, payload) {
    window.parent.postMessage(Object.assign({ source, type }, payload || {}), "*");
  }

  function now() {
    return new Date().toISOString();
  }

  function createId() {
    return crypto && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "html-annotation-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function getRoot() {
    return document.body || document.documentElement;
  }

  function isIgnoredTextNode(node) {
    const parent = node.parentElement;
    return !parent || Boolean(parent.closest("script,style,noscript,template,[data-notedock-ignore-annotations]"));
  }

  function getTextNodes() {
    const root = getRoot();
    const nodes = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.nodeValue && !isIgnoredTextNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      },
    );
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  function getDocumentText() {
    return getTextNodes().map((node) => node.nodeValue || "").join("");
  }

  function getBoundaryOffset(container, offset) {
    const root = getRoot();
    const range = document.createRange();
    try {
      range.setStart(root, 0);
      range.setEnd(container, offset);
      return Math.max(0, range.toString().length);
    } catch {
      return null;
    }
  }

  function isUsableRange(range) {
    const root = getRoot();
    return (
      range &&
      !range.collapsed &&
      root.contains(range.commonAncestorContainer) &&
      range.toString().trim().length > 0
    );
  }

  function getActiveRange() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      if (isUsableRange(range)) {
        lastRange = range.cloneRange();
        return range.cloneRange();
      }
    }

    return lastRange && isUsableRange(lastRange) ? lastRange.cloneRange() : null;
  }

  function getRangePosition(range) {
    const start = getBoundaryOffset(range.startContainer, range.startOffset);
    const end = getBoundaryOffset(range.endContainer, range.endOffset);

    if (start === null || end === null) {
      return null;
    }

    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
  }

  function unwrapAnnotations() {
    document.querySelectorAll(selector).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
      parent.normalize();
    });
  }

  function getPositionSelector(annotation) {
    const selectors = annotation && annotation.target && Array.isArray(annotation.target.selector)
      ? annotation.target.selector
      : [];
    return selectors.find((item) => item && item.type === "TextPositionSelector");
  }

  function getAnnotationNote(annotation) {
    return annotation && annotation.body && typeof annotation.body.value === "string"
      ? annotation.body.value
      : "";
  }

  function getAnnotationById(annotationId) {
    return annotations.find((annotation) => annotation.id === annotationId) || null;
  }

  function emitSelectedAnnotation(annotationId) {
    selectedAnnotationId = annotationId || null;
    renderAnnotations();
    post(selectType, { annotationId: selectedAnnotationId });
  }

  function promptForNote(annotation) {
    return window.prompt("批注内容", getAnnotationNote(annotation));
  }

  function wrapSegment(node, start, end, annotation) {
    if (!node.parentNode || start >= end) return;
    const length = (node.nodeValue || "").length;
    let target = node;

    if (end < length) {
      target.splitText(end);
    }

    if (start > 0) {
      target = target.splitText(start);
    }

    const span = document.createElement("span");
    span.className = "notedock-html-annotation";
    span.dataset.notedockHtmlAnnotation = annotation.id;
    span.dataset.notedockHtmlAnnotationStyle = annotation.style || "highlight";

    if (annotation.id === selectedAnnotationId) {
      span.dataset.notedockHtmlAnnotationSelected = "true";
    }

    const note = getAnnotationNote(annotation);
    if (note) {
      span.title = note;
    }

    target.parentNode.insertBefore(span, target);
    span.appendChild(target);
  }

  function renderAnnotation(annotation) {
    const position = getPositionSelector(annotation);
    if (!position || position.end <= position.start) return;

    let cursor = 0;
    const segments = [];
    for (const node of getTextNodes()) {
      const text = node.nodeValue || "";
      const nodeStart = cursor;
      const nodeEnd = cursor + text.length;
      cursor = nodeEnd;

      if (position.end <= nodeStart) break;
      if (position.start >= nodeEnd) continue;

      segments.push({
        node,
        start: Math.max(0, position.start - nodeStart),
        end: Math.min(text.length, position.end - nodeStart),
      });
    }

    segments.forEach((segment) => {
      wrapSegment(segment.node, segment.start, segment.end, annotation);
    });
  }

  function renderAnnotations() {
    unwrapAnnotations();
    annotations.forEach(renderAnnotation);
  }

  function sanitizeAnnotation(annotation) {
    if (!annotation || typeof annotation !== "object" || typeof annotation.id !== "string") {
      return null;
    }
    const position = getPositionSelector(annotation);
    if (!position || !Number.isFinite(position.start) || !Number.isFinite(position.end)) {
      return null;
    }
    return annotation;
  }

  function setAnnotations(nextAnnotations) {
    annotations = Array.isArray(nextAnnotations)
      ? nextAnnotations.map(sanitizeAnnotation).filter(Boolean)
      : [];
    if (selectedAnnotationId && !annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
      selectedAnnotationId = null;
    }
    renderAnnotations();
  }

  function emitAnnotationsChanged() {
    post(changedType, { annotations });
  }

  function createAnnotation(style, note) {
    hideContextMenu();
    const range = getActiveRange();
    if (!range) {
      post(selectionType, { hasSelection: false });
      return;
    }

    const position = getRangePosition(range);
    const exact = range.toString();
    if (!position || position.end <= position.start || !exact.trim()) {
      post(selectionType, { hasSelection: false });
      return;
    }

    const fullText = getDocumentText();
    const timestamp = now();
    const annotation = {
      id: createId(),
      type: "Annotation",
      motivation: style === "note" ? "commenting" : "highlighting",
      style,
      created: timestamp,
      updated: timestamp,
      target: {
        selector: [
          {
            type: "TextPositionSelector",
            start: position.start,
            end: position.end,
          },
          {
            type: "TextQuoteSelector",
            exact,
            prefix: fullText.slice(Math.max(0, position.start - 80), position.start),
            suffix: fullText.slice(position.end, position.end + 80),
          },
        ],
      },
    };

    if (typeof note === "string" && note.trim()) {
      annotation.body = {
        type: "TextualBody",
        value: note.trim(),
        format: "text/plain",
        purpose: "commenting",
      };
    }

    annotations = annotations.concat(annotation);
    selectedAnnotationId = annotation.id;
    renderAnnotations();
    window.getSelection()?.removeAllRanges();
    lastRange = null;
    post(selectionType, { hasSelection: false });
    post(selectType, { annotationId: selectedAnnotationId });
    emitAnnotationsChanged();
  }

  function applyAnnotationStyle(style) {
    const note = style === "note" ? promptForNote(null) : undefined;

    if (style === "note" && note === null) {
      return;
    }

    createAnnotation(style, note);
  }

  function editAnnotationNote(annotationId) {
    hideContextMenu();
    const annotation = getAnnotationById(annotationId);

    if (!annotation) {
      return;
    }

    const note = promptForNote(annotation);

    if (note === null) {
      return;
    }

    const trimmedNote = note.trim();
    annotations = annotations.map((item) =>
      item.id === annotationId
        ? Object.assign({}, item, {
            motivation: trimmedNote ? "commenting" : item.motivation,
            updated: now(),
            body: trimmedNote
              ? {
                  type: "TextualBody",
                  value: trimmedNote,
                  format: "text/plain",
                  purpose: "commenting",
                }
              : undefined,
          })
        : item,
    );
    selectedAnnotationId = annotationId;
    renderAnnotations();
    post(selectType, { annotationId });
    emitAnnotationsChanged();
  }

  function removeIntersectingSelectionAnnotations() {
    hideContextMenu();
    const range = getActiveRange();
    const position = range ? getRangePosition(range) : null;

    if (!position) return;

    const nextAnnotations = annotations.filter((annotation) => {
      const annotationPosition = getPositionSelector(annotation);
      return !annotationPosition ||
        annotationPosition.end <= position.start ||
        annotationPosition.start >= position.end;
    });

    if (nextAnnotations.length === annotations.length) return;
    annotations = nextAnnotations;
    selectedAnnotationId = null;
    renderAnnotations();
    emitAnnotationsChanged();
  }

  function deleteAnnotation(annotationId) {
    hideContextMenu();
    if (!annotationId) return;
    const nextAnnotations = annotations.filter((annotation) => annotation.id !== annotationId);
    if (nextAnnotations.length === annotations.length) return;
    annotations = nextAnnotations;
    if (selectedAnnotationId === annotationId) {
      selectedAnnotationId = null;
    }
    renderAnnotations();
    post(selectType, { annotationId: selectedAnnotationId });
    emitAnnotationsChanged();
  }

  function scrollToAnnotation(annotationId) {
    selectedAnnotationId = annotationId || null;
    renderAnnotations();
    const target = selectedAnnotationId
      ? document.querySelector('.notedock-html-annotation[data-notedock-html-annotation="' + CSS.escape(selectedAnnotationId) + '"]')
      : null;
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function createMenuButton(label, shortcut, disabled, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = Boolean(disabled);
    button.innerHTML = "<span>" + label + "</span>" + (shortcut ? "<kbd>" + shortcut + "</kbd>" : "");
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!button.disabled) {
        action();
      }
    });
    return button;
  }

  function createMenuSeparator() {
    const separator = document.createElement("div");
    separator.className = "notedock-html-annotation-menu-separator";
    return separator;
  }

  function hideContextMenu() {
    contextMenu?.remove();
    contextMenu = null;
  }

  function showContextMenu(x, y, annotationId) {
    const hasSelection = Boolean(getActiveRange());
    const hasAnnotation = Boolean(annotationId);

    if (!hasSelection && !hasAnnotation) {
      return false;
    }

    hideContextMenu();

    contextMenu = document.createElement("div");
    contextMenu.className = "notedock-html-annotation-menu";
    contextMenu.dataset.notedockIgnoreAnnotations = "true";
    contextMenu.append(
      createMenuButton("高亮", "Ctrl+Alt+H", !hasSelection, () => applyAnnotationStyle("highlight")),
      createMenuButton("着重符号", "Ctrl+Alt+E", !hasSelection, () => applyAnnotationStyle("emphasis")),
      createMenuButton("下划线", "Ctrl+Alt+U", !hasSelection, () => applyAnnotationStyle("underline")),
      createMenuButton("波浪线", "Ctrl+Alt+W", !hasSelection, () => applyAnnotationStyle("wavy")),
      createMenuButton("批注文字", "Ctrl+Alt+N", !hasSelection, () => applyAnnotationStyle("note")),
      createMenuSeparator(),
      createMenuButton("显示批注列表", "Ctrl+Alt+A", false, () => {
        post(toggleListType);
        hideContextMenu();
      }),
      createMenuButton("清除所选批注", "Ctrl+Alt+Backspace", !hasSelection, removeIntersectingSelectionAnnotations),
    );

    if (hasAnnotation) {
      contextMenu.append(
        createMenuSeparator(),
        createMenuButton("编辑批注文字", "", false, () => editAnnotationNote(annotationId)),
        createMenuButton("删除这条批注", "Ctrl+Alt+Delete", false, () => deleteAnnotation(annotationId)),
      );
    }

    document.body.append(contextMenu);

    const margin = 10;
    const rect = contextMenu.getBoundingClientRect();
    const left = Math.min(Math.max(margin, x), window.innerWidth - rect.width - margin);
    const top = Math.min(Math.max(margin, y), window.innerHeight - rect.height - margin);
    contextMenu.style.left = left + "px";
    contextMenu.style.top = top + "px";
    return true;
  }

  document.addEventListener("selectionchange", () => {
    const range = getActiveRange();
    post(selectionType, { hasSelection: Boolean(range) });
  });

  document.addEventListener("contextmenu", (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest(selector)
      : null;
    const annotationId = target?.dataset?.notedockHtmlAnnotation || null;

    if (annotationId) {
      selectedAnnotationId = annotationId;
      renderAnnotations();
      post(selectType, { annotationId });
    }

    if (showContextMenu(event.clientX, event.clientY, annotationId)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (contextMenu && !contextMenu.contains(event.target)) {
      hideContextMenu();
    }

    const target = event.target && event.target.closest
      ? event.target.closest(selector)
      : null;
    if (!target) return;
    emitSelectedAnnotation(target.dataset.notedockHtmlAnnotation || null);
  }, true);

  function hasNoShortcutModifier(event) {
    return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  }

  function isEditableShortcutTarget(target) {
    return target instanceof Element
      ? Boolean(target.closest("input,textarea,select,[contenteditable='true']"))
      : false;
  }

  function shouldForwardAppShortcut(event) {
    if (event.defaultPrevented || event.isComposing || isEditableShortcutTarget(event.target)) {
      return false;
    }

    if (
      (event.key === "F11" || event.key === "Escape") &&
      hasNoShortcutModifier(event)
    ) {
      return true;
    }

    const usesAppModifier = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey);
    if (!usesAppModifier || event.altKey) {
      return false;
    }

    const key = event.key.toLowerCase();
    const digit = /^Digit[1-3]$/.test(event.code)
      ? event.code.slice("Digit".length)
      : /^[1-3]$/.test(event.key)
        ? event.key
        : "";

    if (event.shiftKey) {
      return key === "n" ||
        key === "s" ||
        key === "l" ||
        key === "f" ||
        Boolean(digit);
    }

    return key === "s" ||
      key === "n" ||
      key === "o" ||
      key === "f" ||
      key === "h" ||
      event.key === "," ||
      event.code === "Comma";
  }

  function forwardAppShortcut(event) {
    event.preventDefault();
    post(appShortcutType, {
      shortcut: {
        altKey: event.altKey,
        code: event.code,
        ctrlKey: event.ctrlKey,
        isComposing: event.isComposing,
        key: event.key,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      },
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const hadContextMenu = Boolean(contextMenu);
      hideContextMenu();
      if (hadContextMenu) {
        return;
      }
    }

    const isAnnotationShortcut = event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey;

    if (isAnnotationShortcut) {
      const key = event.key.toLowerCase();
      const shortcutStyles = {
        h: "highlight",
        e: "emphasis",
        u: "underline",
        w: "wavy",
        n: "note",
      };
      const style = shortcutStyles[key];

      if (style) {
        event.preventDefault();
        applyAnnotationStyle(style);
        return;
      }

      if (key === "a") {
        event.preventDefault();
        post(toggleListType);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        removeIntersectingSelectionAnnotations();
        return;
      }

      if (event.key === "Delete" && selectedAnnotationId) {
        event.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }
    }

    if (shouldForwardAppShortcut(event)) {
      forwardAppShortcut(event);
    }
  }, true);

  window.addEventListener("scroll", hideContextMenu, true);
  window.addEventListener("blur", hideContextMenu);

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.source !== source) return;

    if (data.type === setType) {
      setAnnotations(data.annotations);
      return;
    }

    if (data.type !== commandType) return;

    if (data.command === "apply") {
      createAnnotation(data.style || "highlight", data.note);
      return;
    }

    if (data.command === "clearSelection") {
      removeIntersectingSelectionAnnotations();
      return;
    }

    if (data.command === "delete") {
      deleteAnnotation(data.annotationId);
      return;
    }

    if (data.command === "scrollTo") {
      scrollToAnnotation(data.annotationId);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderAnnotations();
      post(readyType);
    });
  } else {
    renderAnnotations();
    post(readyType);
  }
})();
</script>`;
}

function createHtmlAnchorRuntime() {
  return `<script data-notedock-html-anchor-runtime>
(() => {
  function getHashTarget(hash) {
    if (!hash || hash === "#") return document.scrollingElement || document.documentElement;
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Keep the raw hash body when it is not valid URI-encoded text.
    }
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    const anchor = target && target.closest ? target.closest("a[href]") : null;

    if (!anchor) {
      return;
    }

    const rawHref = anchor.getAttribute("href") || "";

    if (!rawHref.startsWith("#")) {
      return;
    }

    const hashTarget = getHashTarget(rawHref);

    if (!hashTarget) {
      return;
    }

    event.preventDefault();

    if (rawHref === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    hashTarget.scrollIntoView({ block: "start", behavior: "smooth" });
  }, true);
})();
</script>`;
}

function createHtmlOutlineRuntime() {
  return `<script data-notedock-html-outline-runtime>
(() => {
  const source = "markdown-studio";
  const activeType = "notedock-html-outline:active";
  const scrollType = "notedock-html-outline:scroll";
  const outlineAttribute = "data-notedock-html-outline-id";
  let outlineEntries = [];
  let activeOutlineId = null;
  let pendingFrame = 0;

  function post(type, payload) {
    window.parent.postMessage(Object.assign({ source, type }, payload || {}), "*");
  }

  function getHeadingTitle(heading) {
    return (heading.textContent || "").replace(/\\s+/g, " ").trim();
  }

  function refreshOutlineEntries() {
    outlineEntries = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .map((element) => ({ element, title: getHeadingTitle(element) }))
      .filter((entry) => entry.title)
      .map((entry, index) => {
        const outlineId = "html-outline-" + index;
        entry.element.setAttribute(outlineAttribute, outlineId);
        return Object.assign(entry, { outlineId });
      });
  }

  function emitActiveOutline(outlineId) {
    if (activeOutlineId === outlineId) {
      return;
    }

    activeOutlineId = outlineId;
    post(activeType, { outlineId });
  }

  function reportActiveOutline() {
    if (!outlineEntries.length) {
      refreshOutlineEntries();
    }

    if (!outlineEntries.length) {
      emitActiveOutline(null);
      return;
    }

    const activationY = Math.min(140, Math.max(72, window.innerHeight * 0.18));
    let activeEntry = outlineEntries[0];

    for (const entry of outlineEntries) {
      if (entry.element.getBoundingClientRect().top <= activationY) {
        activeEntry = entry;
      } else {
        break;
      }
    }

    emitActiveOutline(activeEntry.outlineId);
  }

  function scheduleActiveOutlineReport() {
    if (pendingFrame) {
      return;
    }

    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = 0;
      reportActiveOutline();
    });
  }

  function scrollToOutline(outlineId) {
    if (!outlineId) {
      return;
    }

    if (!outlineEntries.length) {
      refreshOutlineEntries();
    }

    const target = outlineEntries.find((entry) => entry.outlineId === outlineId)
      || document.querySelector("[" + outlineAttribute + "=\\"" + CSS.escape(outlineId) + "\\"]");
    const element = target && target.element ? target.element : target;

    if (element && element.scrollIntoView) {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
      emitActiveOutline(outlineId);
    }
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== source || data.type !== scrollType) {
      return;
    }

    scrollToOutline(data.outlineId);
  });

  window.addEventListener("scroll", scheduleActiveOutlineReport, { passive: true });
  window.addEventListener("resize", scheduleActiveOutlineReport);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      refreshOutlineEntries();
      scheduleActiveOutlineReport();
    });
  } else {
    refreshOutlineEntries();
    scheduleActiveOutlineReport();
  }
})();
</script>`;
}

function createMindMapHtmlRuntime() {
  return `<style data-mindmap-runtime>
.mindmap-html-viewer{position:relative;min-height:320px;margin:1rem 0;border:1px solid #d8dee8;border-radius:10px;background:#f8fafc;overflow:auto}
.mindmap-html-canvas{position:relative;margin:26px;min-width:720px;min-height:280px}
.mindmap-html-canvas svg{position:absolute;inset:0;overflow:visible;pointer-events:none}
.mindmap-html-node{position:absolute;display:flex;min-width:132px;max-width:190px;min-height:42px;align-items:center;justify-content:center;border:1px solid #b7c6d7;border-radius:999px;background:#fff;padding:9px 14px;box-shadow:0 8px 18px rgba(15,23,42,.08);font:700 14px/1.25 system-ui,sans-serif;color:#172033;text-align:center;white-space:normal}
.mindmap-html-root{border-color:#2563eb;background:#2563eb;color:#fff;font-size:15px}
.mindmap-html-edge{fill:none;stroke:#8aa0b8;stroke-width:2.2}
.mindmap-html-edit{position:absolute;top:10px;right:10px;z-index:2;border:0;border-radius:7px;background:#2563eb;color:#fff;padding:7px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}
.mindmap-html-error{padding:18px;color:#b91c1c;font:13px system-ui,sans-serif}
</style><script data-mindmap-runtime>
(() => {
  const hGap = 230;
  const vGap = 78;
  const rootWidth = 190;
  const branchWidth = 172;
  const nodeHeight = 46;
  function normalize(data) {
    const root = data && data.root ? data.root : { id: "root", text: "中心主题", children: [] };
    const children = Array.isArray(root.children) ? root.children : [];
    let left = children.filter((child) => child.side === "left").length;
    let right = children.filter((child) => child.side === "right").length;
    root.children = children.map((child) => {
      if (child.side === "left" || child.side === "right") return child;
      const side = right <= left ? "right" : "left";
      if (side === "right") right += 1; else left += 1;
      return { ...child, side };
    });
    return root;
  }
  function countLeaves(node) {
    const children = node.collapsed ? [] : Array.isArray(node.children) ? node.children : [];
    return children.length ? children.reduce((total, child) => total + countLeaves(child), 0) : 1;
  }
  function layout(root) {
    const nodes = [];
    const edges = [];
    function push(node, cx, cy, level, side) {
      const width = level === 0 ? rootWidth : branchWidth;
      nodes.push({ id: node.id || "node-" + nodes.length, text: node.text || node.label || "主题", level, side, x: cx - width / 2, y: cy - nodeHeight / 2, width });
    }
    function walk(node, parentId, depth, side, leafY) {
      const leaves = countLeaves(node);
      const cy = leafY + ((leaves - 1) * vGap) / 2;
      const cx = (side === "left" ? -1 : 1) * depth * hGap;
      push(node, cx, cy, depth, side);
      edges.push({ source: parentId, target: node.id, side });
      if (!node.collapsed) {
        let nextY = leafY;
        (Array.isArray(node.children) ? node.children : []).forEach((child) => {
          nextY = walk(child, node.id, depth + 1, side, nextY);
        });
      }
      return leafY + leaves * vGap;
    }
    push(root, 0, 0, 0, "root");
    ["left", "right"].forEach((side) => {
      const children = (Array.isArray(root.children) ? root.children : []).filter((child) => (child.side || "right") === side);
      const leafCount = children.reduce((total, child) => total + countLeaves(child), 0);
      let y = -((Math.max(1, leafCount) - 1) * vGap) / 2;
      children.forEach((child) => { y = walk(child, root.id, 1, side, y); });
    });
    return { nodes, edges };
  }
  function escapeText(value) {
    return String(value).replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
  }
  function render(script, index) {
    const code = script.textContent || "";
    const host = script.parentElement && script.parentElement.matches("[data-mindmap]") ? script.parentElement : script;
    host.innerHTML = "";
    try {
      const root = normalize(JSON.parse(code || "{}"));
      const graph = layout(root);
      const xs = graph.nodes.map((node) => node.x);
      const ys = graph.nodes.map((node) => node.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...graph.nodes.map((node) => node.x + node.width)) - minX + 80;
      const maxY = Math.max(...graph.nodes.map((node) => node.y + nodeHeight)) - minY + 80;
      const viewer = document.createElement("section");
      viewer.className = "mindmap-html-viewer";
      const edit = document.createElement("button");
      edit.className = "mindmap-html-edit";
      edit.type = "button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => {
        window.parent.postMessage({ code, index, source: "markdown-studio", type: "typora-mindmap-edit" }, "*");
      });
      const canvas = document.createElement("div");
      canvas.className = "mindmap-html-canvas";
      canvas.style.width = Math.max(720, maxX) + "px";
      canvas.style.height = Math.max(280, maxY) + "px";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", String(Math.max(720, maxX)));
      svg.setAttribute("height", String(Math.max(280, maxY)));
      const byId = new Map(graph.nodes.map((node) => [node.id, node]));
      graph.edges.forEach((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;
        const sx = source.x - minX + source.width / 2 + 40;
        const sy = source.y - minY + nodeHeight / 2 + 40;
        const tx = target.x - minX + target.width / 2 + 40;
        const ty = target.y - minY + nodeHeight / 2 + 40;
        const mid = sx + (tx - sx) / 2;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "mindmap-html-edge");
        path.setAttribute("d", "M " + sx + " " + sy + " C " + mid + " " + sy + ", " + mid + " " + ty + ", " + tx + " " + ty);
        svg.append(path);
      });
      canvas.append(svg);
      graph.nodes.forEach((node) => {
        const element = document.createElement("div");
        element.className = "mindmap-html-node" + (node.level === 0 ? " mindmap-html-root" : "");
        element.innerHTML = escapeText(node.text);
        element.style.left = (node.x - minX + 40) + "px";
        element.style.top = (node.y - minY + 40) + "px";
        element.style.width = node.width + "px";
        canvas.append(element);
      });
      viewer.append(edit, canvas);
      host.append(viewer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mind map render failed";
      host.innerHTML = '<pre class="mindmap-html-error">' + escapeText(message) + "</pre>";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('script[type="application/json"][data-mindmap]').forEach(render);
  });
})();
</script>`;
}

function createReactFlowHtmlRuntime() {
  return `<style data-react-flow-runtime>
.react-flow-html-viewer{position:relative;min-height:280px;margin:1rem 0;border:1px solid #d8dee8;border-radius:10px;background:#f8fafc;overflow:auto}
.react-flow-html-canvas{position:relative;margin:24px;min-width:640px;min-height:240px}
.react-flow-html-canvas svg{position:absolute;inset:0;overflow:visible;pointer-events:none}
.react-flow-html-node{position:absolute;min-width:132px;max-width:180px;border:1px solid #9ca3af;border-radius:8px;background:#fff;padding:10px 12px;box-shadow:0 8px 18px rgba(15,23,42,.09);font:600 14px/1.25 system-ui,sans-serif;color:#172033;text-align:center}
.react-flow-html-edge{fill:none;stroke:#64748b;stroke-width:2.2}
.react-flow-html-edit{position:absolute;top:10px;right:10px;z-index:2;border:0;border-radius:7px;background:#2563eb;color:#fff;padding:7px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}
.react-flow-html-error{padding:18px;color:#b91c1c;font:13px system-ui,sans-serif}
</style><script data-react-flow-runtime>
(() => {
  const nodeWidth = 156;
  const nodeHeight = 48;
  function parse(script) {
    return JSON.parse(script.textContent || "{}");
  }
  function nodeLabel(node) {
    return node && node.data && typeof node.data.label === "string" ? node.data.label : node.id || "Node";
  }
  function render(script, index) {
    const code = script.textContent || "";
    const host = script.parentElement && script.parentElement.matches("[data-react-flow]") ? script.parentElement : script;
    host.innerHTML = "";
    try {
      const data = parse(script);
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      const edges = Array.isArray(data.edges) ? data.edges : [];
      if (!nodes.length) throw new Error("No nodes found.");
      const xs = nodes.map((node) => Number(node.position && node.position.x) || 0);
      const ys = nodes.map((node) => Number(node.position && node.position.y) || 0);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs) - minX + nodeWidth + 80;
      const maxY = Math.max(...ys) - minY + nodeHeight + 80;
      const viewer = document.createElement("section");
      viewer.className = "react-flow-html-viewer";
      const edit = document.createElement("button");
      edit.className = "react-flow-html-edit";
      edit.type = "button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => {
        window.parent.postMessage({ code, index, source: "markdown-studio", type: "typora-react-flow-edit" }, "*");
      });
      const canvas = document.createElement("div");
      canvas.className = "react-flow-html-canvas";
      canvas.style.width = Math.max(640, maxX) + "px";
      canvas.style.height = Math.max(240, maxY) + "px";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", String(Math.max(640, maxX)));
      svg.setAttribute("height", String(Math.max(240, maxY)));
      const byId = new Map(nodes.map((node) => [node.id, node]));
      edges.forEach((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;
        const sx = (Number(source.position && source.position.x) || 0) - minX + nodeWidth / 2 + 40;
        const sy = (Number(source.position && source.position.y) || 0) - minY + nodeHeight / 2 + 40;
        const tx = (Number(target.position && target.position.x) || 0) - minX + nodeWidth / 2 + 40;
        const ty = (Number(target.position && target.position.y) || 0) - minY + nodeHeight / 2 + 40;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const mid = sx + (tx - sx) / 2;
        path.setAttribute("class", "react-flow-html-edge");
        path.setAttribute("d", "M " + sx + " " + sy + " C " + mid + " " + sy + ", " + mid + " " + ty + ", " + tx + " " + ty);
        svg.append(path);
      });
      canvas.append(svg);
      nodes.forEach((node) => {
        const element = document.createElement("div");
        element.className = "react-flow-html-node";
        element.textContent = nodeLabel(node);
        element.style.left = ((Number(node.position && node.position.x) || 0) - minX + 40) + "px";
        element.style.top = ((Number(node.position && node.position.y) || 0) - minY + 40) + "px";
        canvas.append(element);
      });
      viewer.append(edit, canvas);
      host.append(viewer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "React Flow render failed";
      host.innerHTML = '<pre class="react-flow-html-error">' + message.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char])) + "</pre>";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('script[type="application/json"][data-react-flow]').forEach(render);
  });
})();
</script>`;
}

export type HtmlDocumentViewerHandle = {
  scrollToOutlineEntry: (outlineId: string) => void;
};

type HtmlDocumentViewerProps = {
  document: MarkdownDocument;
  onActiveOutlineChange?: (outlineId: string | null) => void;
  onAppShortcut?: (event: EditorShortcutEvent) => void;
  onEditMindMap?: (payload: { code: string; index: number }) => void;
  onEditReactFlow?: (payload: { code: string; index: number }) => void;
};

type AnnotationSaveState = "idle" | "saving" | "failed";

export const HtmlDocumentViewer = forwardRef<
  HtmlDocumentViewerHandle,
  HtmlDocumentViewerProps
>(function HtmlDocumentViewer(
  {
  document,
  onActiveOutlineChange,
  onAppShortcut,
  onEditMindMap,
  onEditReactFlow,
  },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const annotationDirtyRef = useRef(false);
  const annotationDocumentKeyRef = useRef("");
  const [annotations, setAnnotations] = useState<HtmlAnnotation[]>([]);
  const [isAnnotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annotationSaveState, setAnnotationSaveState] =
    useState<AnnotationSaveState>("idle");
  const srcDoc = useMemo(
    () => createHtmlPreviewDocument(document.content, document.filePath),
    [document.content, document.filePath],
  );
  const iframeLoadKey = `${document.id}:${document.filePath ?? ""}:${document.updatedAt}:${document.content.length}`;
  const [loadedIframeKey, setLoadedIframeKey] = useState("");
  const isIframeLoading = loadedIframeKey !== iframeLoadKey;
  const sortedAnnotations = useMemo(
    () =>
      [...annotations].sort((first, second) => {
        const firstPosition = getHtmlAnnotationPosition(first);
        const secondPosition = getHtmlAnnotationPosition(second);

        return (firstPosition?.start ?? 0) - (secondPosition?.start ?? 0);
      }),
    [annotations],
  );

  function getAnnotationDocumentKey() {
    return document.filePath || document.id;
  }

  function getLocalAnnotationStorageKey() {
    return `notedock:html-annotations:${document.id}`;
  }

  function postAnnotationMessage(payload: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(
      { source: annotationMessageSource, ...payload },
      "*",
    );
  }

  function postOutlineMessage(payload: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(
      { source: annotationMessageSource, ...payload },
      "*",
    );
  }

  useImperativeHandle(
    ref,
    () => ({
      scrollToOutlineEntry(outlineId) {
        postOutlineMessage({
          outlineId,
          type: htmlOutlineScrollMessageType,
        });
      },
    }),
    [],
  );

  function syncAnnotationsToFrame(nextAnnotations = annotations) {
    postAnnotationMessage({
      type: annotationSetMessageType,
      annotations: nextAnnotations,
    });
  }

  function commitAnnotations(nextAnnotations: HtmlAnnotation[]) {
    annotationDirtyRef.current = true;
    setAnnotationSaveState("saving");
    setAnnotations(nextAnnotations);
    syncAnnotationsToFrame(nextAnnotations);
  }

  function runAnnotationCommand(
    command:
      | { command: "apply"; style: HtmlAnnotationStyle; note?: string }
      | { command: "clearSelection" }
      | { command: "delete"; annotationId: string }
      | { command: "scrollTo"; annotationId: string },
  ) {
    postAnnotationMessage({
      type: annotationCommandMessageType,
      ...command,
    });
  }

  function getAnnotationSnippet(annotation: HtmlAnnotation) {
    const quote = annotation.target.selector.find(
      (selector): selector is Extract<
        HtmlAnnotation["target"]["selector"][number],
        { type: "TextQuoteSelector" }
      > => selector.type === "TextQuoteSelector",
    );

    return quote?.exact?.trim() || "未命名选区";
  }

  function editAnnotationNote(annotation: HtmlAnnotation) {
    const nextNote = window.prompt("批注内容", annotation.body?.value ?? "");

    if (nextNote === null) {
      return;
    }

    const trimmedNote = nextNote.trim();
    const nextAnnotations = annotations.map((item) =>
      item.id === annotation.id
        ? {
            ...item,
            motivation: trimmedNote ? "commenting" : item.motivation,
            updated: new Date().toISOString(),
            ...(trimmedNote
              ? {
                  body: {
                    type: "TextualBody" as const,
                    value: trimmedNote,
                    format: "text/plain" as const,
                    purpose: "commenting" as const,
                  },
                }
              : { body: undefined }),
          }
        : item,
    );

    commitAnnotations(nextAnnotations);
  }

  function deleteAnnotation(annotationId: string) {
    commitAnnotations(annotations.filter((annotation) => annotation.id !== annotationId));
    setSelectedAnnotationId((current) =>
      current === annotationId ? null : current,
    );
  }

  async function loadAnnotations() {
    const documentKey = getAnnotationDocumentKey();
    annotationDocumentKeyRef.current = documentKey;
    annotationDirtyRef.current = false;
    setAnnotationSaveState("idle");
    setSelectedAnnotationId(null);
    setAnnotationPanelOpen(false);

    let nextAnnotations: HtmlAnnotation[] = [];

    if (document.filePath && window.desktop?.readTextAsset) {
      try {
        const content = await window.desktop.readTextAsset({
          documentFilePath: document.filePath,
          reference: getHtmlAnnotationAssetReference(document.filePath),
        });
        nextAnnotations = parseHtmlAnnotationDocument(content);
      } catch {
        nextAnnotations = [];
      }
    } else {
      nextAnnotations = parseHtmlAnnotationDocument(
        window.localStorage.getItem(getLocalAnnotationStorageKey()),
      );
    }

    if (annotationDocumentKeyRef.current !== documentKey) {
      return;
    }

    annotationDirtyRef.current = false;
    setAnnotations(nextAnnotations);
    syncAnnotationsToFrame(nextAnnotations);
  }

  async function saveAnnotations(nextAnnotations: HtmlAnnotation[]) {
    const content = serializeHtmlAnnotationDocument(
      nextAnnotations,
      document.filePath,
    );

    if (document.filePath && window.desktop?.writeTextAsset) {
      await window.desktop.writeTextAsset({
        content,
        documentFilePath: document.filePath,
        reference: getHtmlAnnotationAssetReference(document.filePath),
      });
      return;
    }

    window.localStorage.setItem(getLocalAnnotationStorageKey(), content);
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        event.data.source !== annotationMessageSource
      ) {
        return;
      }

      if (event.data.type === annotationReadyMessageType) {
        syncAnnotationsToFrame();
        return;
      }

      if (
        event.data.type === annotationSelectionMessageType &&
        typeof event.data.hasSelection === "boolean"
      ) {
        return;
      }

      if (event.data.type === annotationSelectMessageType) {
        const annotationId =
          typeof event.data.annotationId === "string"
            ? event.data.annotationId
            : null;
        setSelectedAnnotationId(annotationId);
        if (annotationId) {
          setAnnotationPanelOpen(true);
        }
        return;
      }

      if (event.data.type === annotationToggleListMessageType) {
        setAnnotationPanelOpen((current) => !current);
        return;
      }

      if (event.data.type === htmlOutlineActiveMessageType) {
        onActiveOutlineChange?.(
          typeof event.data.outlineId === "string" ? event.data.outlineId : null,
        );
        return;
      }

      if (event.data.type === appShortcutMessageType) {
        const shortcut = event.data.shortcut;
        if (
          shortcut &&
          typeof shortcut === "object" &&
          typeof shortcut.key === "string"
        ) {
          onAppShortcut?.({
            altKey: Boolean(shortcut.altKey),
            code: typeof shortcut.code === "string" ? shortcut.code : "",
            ctrlKey: Boolean(shortcut.ctrlKey),
            isComposing: Boolean(shortcut.isComposing),
            key: shortcut.key,
            metaKey: Boolean(shortcut.metaKey),
            shiftKey: Boolean(shortcut.shiftKey),
          });
        }
        return;
      }

      if (
        event.data.type === annotationChangedMessageType &&
        Array.isArray(event.data.annotations)
      ) {
        annotationDirtyRef.current = true;
        setAnnotationSaveState("saving");
        setAnnotations(event.data.annotations);
        return;
      }

      if (!["typora-react-flow-edit", "typora-mindmap-edit"].includes(event.data.type)) {
        return;
      }

      if (typeof event.data.code === "string" && typeof event.data.index === "number") {
        if (event.data.type === "typora-mindmap-edit") {
          onEditMindMap?.({ code: event.data.code, index: event.data.index });
          return;
        }

        onEditReactFlow?.({ code: event.data.code, index: event.data.index });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    annotations,
    onActiveOutlineChange,
    onAppShortcut,
    onEditMindMap,
    onEditReactFlow,
  ]);

  useEffect(() => {
    void loadAnnotations();
  }, [document.id, document.filePath]);

  useEffect(() => {
    syncAnnotationsToFrame();
  }, [annotations, srcDoc]);

  useEffect(() => {
    if (!annotationDirtyRef.current) {
      return;
    }

    const documentKey = getAnnotationDocumentKey();
    const timer = window.setTimeout(() => {
      void saveAnnotations(annotations)
        .then(() => {
          if (annotationDocumentKeyRef.current === documentKey) {
            annotationDirtyRef.current = false;
            setAnnotationSaveState("idle");
          }
        })
        .catch(() => {
          if (annotationDocumentKeyRef.current === documentKey) {
            setAnnotationSaveState("failed");
          }
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [annotations, document.id, document.filePath]);

  return (
    <div className="html-document-viewer">
      <div className="html-document-viewer-body">
        <iframe
          key={iframeLoadKey}
          ref={iframeRef}
          title={getDocumentDisplayName(document)}
          onLoad={() => setLoadedIframeKey(iframeLoadKey)}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
          srcDoc={srcDoc}
        />
        {isIframeLoading ? (
          <div className="document-loading-overlay html-document-loading">
            <div className="document-loading-card" role="status" aria-live="polite">
              <span className="document-loading-spinner" aria-hidden="true" />
              <div>
                <strong>正在渲染 HTML</strong>
                <span>{getDocumentDisplayName(document)}</span>
              </div>
            </div>
          </div>
        ) : null}
        {annotations.length && !isAnnotationPanelOpen ? (
          <button
            className="html-annotation-list-toggle"
            type="button"
            title="显示批注列表 (Ctrl+Alt+A)"
            aria-label="显示批注列表"
            onClick={() => setAnnotationPanelOpen(true)}
          >
            <span className="html-annotation-list-toggle-icon">
              <MessageSquareText size={16} />
            </span>
            <span className="html-annotation-list-toggle-label">批注</span>
            <span className="html-annotation-list-toggle-count">
              {annotations.length}
            </span>
          </button>
        ) : null}
        {isAnnotationPanelOpen ? (
          <aside
            className="html-annotation-sidebar"
            aria-label="HTML 批注列表"
            data-notedock-ignore-annotations
          >
            <div className="html-annotation-sidebar-header">
              <div className="html-annotation-sidebar-title">
                <strong>HTML 批注</strong>
                <span>
                  {annotationSaveState === "failed"
                    ? "保存失败"
                    : `${annotations.length} 条`}
                </span>
              </div>
              <button
                type="button"
                title="隐藏批注列表"
                aria-label="隐藏批注列表"
                onClick={() => setAnnotationPanelOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            {sortedAnnotations.length ? (
              sortedAnnotations.map((annotation) => (
                <article
                  className={
                    selectedAnnotationId === annotation.id
                      ? "html-annotation-card html-annotation-card-active"
                      : "html-annotation-card"
                  }
                  data-annotation-style={annotation.style}
                  key={annotation.id}
                >
                  <button
                    className="html-annotation-card-main"
                    type="button"
                    onClick={() => {
                      setSelectedAnnotationId(annotation.id);
                      runAnnotationCommand({
                        command: "scrollTo",
                        annotationId: annotation.id,
                      });
                    }}
                  >
                    <span className="html-annotation-style-pill">
                      {annotationStyleLabels[annotation.style]}
                    </span>
                    <strong>{getAnnotationSnippet(annotation)}</strong>
                    {annotation.body?.value ? <small>{annotation.body.value}</small> : null}
                  </button>
                  <div className="html-annotation-card-actions">
                    <button
                      type="button"
                      title="编辑批注文字"
                      aria-label="编辑批注文字"
                      onClick={() => editAnnotationNote(annotation)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      title="删除批注"
                      aria-label="删除批注"
                      onClick={() => deleteAnnotation(annotation.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="html-annotation-empty">暂无 HTML 批注</div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
});
