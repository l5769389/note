import { useEffect, useMemo, useRef } from "react";
import { getDocumentDisplayName } from "../documentModel";
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
  const runtime = `${createReactFlowHtmlRuntime()}${createMindMapHtmlRuntime()}`;
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

export function HtmlDocumentViewer({
  document,
  onEditMindMap,
  onEditReactFlow,
}: {
  document: MarkdownDocument;
  onEditMindMap?: (payload: { code: string; index: number }) => void;
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
        !["typora-react-flow-edit", "typora-mindmap-edit"].includes(event.data.type)
      ) {
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
  }, [onEditMindMap, onEditReactFlow]);

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
