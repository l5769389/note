import { useEffect, useMemo, useRef } from "react";
import { getDocumentDisplayName } from "../documentModel";
import { getDirectoryPath } from "../localPreviewUrls";
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

  const normalizedPath = directoryPath.replace(/\\/g, "/");
  const pathWithLeadingSlash =
    normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  const pathWithTrailingSlash = pathWithLeadingSlash.endsWith("/")
    ? pathWithLeadingSlash
    : `${pathWithLeadingSlash}/`;

  return encodeURI(`file://${pathWithTrailingSlash}`);
}

export function createHtmlPreviewDocument(content: string, filePath?: string) {
  const baseHref = getFileBaseHref(filePath);
  const runtime = createReactFlowHtmlRuntime();
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

export function HtmlDocumentViewer({
  document,
  onEditReactFlow,
}: {
  document: MarkdownDocument;
  onEditReactFlow?: (payload: { code: string; index: number }) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const srcDoc = useMemo(
    () => createHtmlPreviewDocument(document.content, document.filePath),
    [document.content, document.filePath],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        event.data.source !== "markdown-studio" ||
        event.data.type !== "typora-react-flow-edit"
      ) {
        return;
      }

      if (typeof event.data.code === "string" && typeof event.data.index === "number") {
        onEditReactFlow?.({ code: event.data.code, index: event.data.index });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEditReactFlow]);

  return (
    <div className="html-document-viewer">
      <iframe
        ref={iframeRef}
        title={getDocumentDisplayName(document)}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
        srcDoc={srcDoc}
      />
    </div>
  );
}
