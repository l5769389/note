import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import type { MarkdownDocument } from "./types";

type MarkdownExportOptions = {
  document: MarkdownDocument;
  theme: string;
};

const exportStyles = `
  @page {
    size: A4;
    margin: 18mm 17mm;
  }

  :root {
    color-scheme: light;
    font-family:
      "Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC",
      Arial, sans-serif;
    line-height: 1.65;
    color: #1f2937;
    background: #f4f6fb;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background:
      radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 34%),
      #f4f6fb;
  }

  .markdown-export-page {
    max-width: 940px;
    margin: 36px auto;
    border: 1px solid #e7ebf2;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.11);
    padding: 54px 62px 62px;
  }

  .markdown-export-header {
    margin-bottom: 34px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 18px;
  }

  .markdown-export-title {
    margin: 0;
    color: #111827;
    font-size: 32px;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .markdown-export-meta {
    margin-top: 10px;
    color: #8a93a3;
    font-size: 13px;
  }

  .markdown-export-document {
    color: #2d3748;
    font-size: 15.5px;
    line-height: 1.78;
    overflow-wrap: break-word;
  }

  .markdown-export-document > :first-child {
    margin-top: 0;
  }

  .markdown-export-document > :last-child {
    margin-bottom: 0;
  }

  .markdown-export-document h1,
  .markdown-export-document h2,
  .markdown-export-document h3,
  .markdown-export-document h4,
  .markdown-export-document h5,
  .markdown-export-document h6 {
    color: #111827;
    line-height: 1.28;
    page-break-after: avoid;
  }

  .markdown-export-document h1 {
    margin: 0 0 0.9em;
    font-size: 2.15em;
  }

  .markdown-export-document h2 {
    margin: 1.7em 0 0.7em;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.28em;
    font-size: 1.48em;
  }

  .markdown-export-document h3 {
    margin: 1.45em 0 0.55em;
    font-size: 1.24em;
  }

  .markdown-export-document h4,
  .markdown-export-document h5,
  .markdown-export-document h6 {
    margin: 1.25em 0 0.45em;
  }

  .markdown-export-document p {
    margin: 0.85em 0;
  }

  .markdown-export-document a {
    color: #4f46e5;
    text-decoration: none;
  }

  .markdown-export-document a:hover {
    text-decoration: underline;
  }

  .markdown-export-document ul,
  .markdown-export-document ol {
    margin: 0.8em 0;
    padding-left: 1.55em;
  }

  .markdown-export-document li + li {
    margin-top: 0.28em;
  }

  .markdown-export-document code {
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: #f1f4f8;
    color: #15305b;
    font-family:
      "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
      monospace;
    font-size: 0.88em;
    padding: 0.12em 0.34em;
  }

  .markdown-export-document pre {
    overflow: auto;
    margin: 1.15em 0;
    border: 1px solid #e3e8ef;
    border-radius: 9px;
    background: #f6f8fa;
    color: #24292f;
    padding: 17px 19px;
    page-break-inside: avoid;
  }

  .markdown-export-document pre code {
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    white-space: pre;
  }

  .markdown-export-document blockquote {
    margin: 1.1em 0;
    border: 1px solid #e3e8ef;
    border-left: 4px solid #8b9bb4;
    border-radius: 9px;
    background: linear-gradient(90deg, #f8fafc 0%, #ffffff 100%);
    color: #475569;
    padding: 12px 18px 12px 20px;
    page-break-inside: avoid;
  }

  .markdown-export-document blockquote > :first-child {
    margin-top: 0;
  }

  .markdown-export-document blockquote > :last-child {
    margin-bottom: 0;
  }

  .markdown-export-document blockquote.markdown-alert {
    --alert-accent: #3b82f6;
    --alert-bg: #eff6ff;
    --alert-border: #bfdbfe;
    --alert-title: #1d4ed8;
    --alert-text: #1f2a44;
    border-color: var(--alert-border);
    border-left-color: var(--alert-accent);
    background: var(--alert-bg);
    color: var(--alert-text);
  }

  .markdown-export-document .markdown-alert-note {
    --alert-accent: #3b82f6;
    --alert-bg: #eff6ff;
    --alert-border: #bfdbfe;
    --alert-title: #1d4ed8;
  }

  .markdown-export-document .markdown-alert-tip {
    --alert-accent: #10b981;
    --alert-bg: #ecfdf5;
    --alert-border: #a7f3d0;
    --alert-title: #047857;
  }

  .markdown-export-document .markdown-alert-important {
    --alert-accent: #8b5cf6;
    --alert-bg: #f5f3ff;
    --alert-border: #ddd6fe;
    --alert-title: #6d28d9;
  }

  .markdown-export-document .markdown-alert-warning {
    --alert-accent: #f59e0b;
    --alert-bg: #fffbeb;
    --alert-border: #fde68a;
    --alert-title: #b45309;
  }

  .markdown-export-document .markdown-alert-caution {
    --alert-accent: #ef4444;
    --alert-bg: #fef2f2;
    --alert-border: #fecaca;
    --alert-title: #b91c1c;
  }

  .markdown-export-document .markdown-alert-title {
    display: block;
    margin-bottom: 6px;
    color: var(--alert-title);
    font-weight: 700;
  }

  .markdown-export-document table {
    width: 100%;
    margin: 1.15em 0;
    border-collapse: collapse;
    table-layout: fixed;
    page-break-inside: avoid;
  }

  .markdown-export-document th,
  .markdown-export-document td {
    border: 1px solid #d8d8d8;
    padding: 8px 12px;
    vertical-align: top;
  }

  .markdown-export-document th {
    background: #d9d9d9;
    color: #1f2937;
    font-weight: 700;
  }

  .markdown-export-document tbody tr:nth-child(2n) {
    background: #f4f4f4;
  }

  .markdown-export-document img,
  .markdown-export-document svg {
    max-width: 100%;
  }

  .markdown-export-document img {
    border: 1px solid #e1e6ee;
    border-radius: 8px;
  }

  .markdown-export-document hr {
    height: 1px;
    margin: 2em 0;
    border: 0;
    background: #e5e7eb;
  }

  .markdown-export-document .mermaid-diagram {
    margin: 1.25em 0;
    border: 1px solid #e4e7ec;
    border-radius: 10px;
    background: #ffffff;
    padding: 18px;
    text-align: center;
    page-break-inside: avoid;
  }

  .markdown-export-document .mermaid-diagram-error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
    text-align: left;
  }

  .markdown-export-document .token.comment,
  .markdown-export-document .token.prolog,
  .markdown-export-document .token.doctype,
  .markdown-export-document .token.cdata {
    color: #6e7781;
  }

  .markdown-export-document .token.punctuation {
    color: #57606a;
  }

  .markdown-export-document .token.property,
  .markdown-export-document .token.tag,
  .markdown-export-document .token.constant,
  .markdown-export-document .token.symbol,
  .markdown-export-document .token.deleted {
    color: #cf222e;
  }

  .markdown-export-document .token.boolean,
  .markdown-export-document .token.number {
    color: #0550ae;
  }

  .markdown-export-document .token.selector,
  .markdown-export-document .token.attr-name,
  .markdown-export-document .token.string,
  .markdown-export-document .token.char,
  .markdown-export-document .token.builtin,
  .markdown-export-document .token.inserted {
    color: #0a7f42;
  }

  .markdown-export-document .token.operator,
  .markdown-export-document .token.entity,
  .markdown-export-document .token.url,
  .markdown-export-document .token.variable {
    color: #953800;
  }

  .markdown-export-document .token.atrule,
  .markdown-export-document .token.attr-value,
  .markdown-export-document .token.function,
  .markdown-export-document .token.class-name {
    color: #8250df;
  }

  .markdown-export-document .token.keyword {
    color: #cf222e;
  }

  .markdown-export-document .token.regex,
  .markdown-export-document .token.important {
    color: #116329;
  }

  @media print {
    :root,
    body {
      background: #ffffff;
    }

    .markdown-export-page {
      max-width: none;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      padding: 0;
    }

    .markdown-export-header {
      margin-bottom: 28px;
    }
  }
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function getDirectoryPath(filePath: string) {
  return filePath.replace(/[\\/][^\\/]*$/, "");
}

function filePathToFileUrl(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";

  return (
    prefix +
    normalized
      .split("/")
      .map((part) => encodeURIComponent(part).replace(/%3A/gi, ":"))
      .join("/")
  );
}

function getBaseHref(filePath?: string) {
  if (!filePath) {
    return document.baseURI;
  }

  const directoryPath = getDirectoryPath(filePath);
  return filePathToFileUrl(`${directoryPath}/`);
}

function delay(timeout: number) {
  return new Promise((resolve) => window.setTimeout(resolve, timeout));
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        image.complete ||
        new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
}

async function waitForMermaid(container: HTMLElement) {
  const deadline = Date.now() + 3200;

  while (Date.now() < deadline) {
    if (!container.querySelector(".mermaid-diagram-loading")) {
      return;
    }

    await delay(80);
  }
}

async function renderMarkdownToHtml(markdown: string, filePath?: string) {
  const container = document.createElement("div");

  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "920px";
  container.style.pointerEvents = "none";

  document.body.append(container);

  const root = createRoot(container);

  flushSync(() => {
    root.render(
      <article className="markdown-preview markdown-export-render-surface">
        <MarkdownRenderer filePath={filePath}>{markdown}</MarkdownRenderer>
      </article>,
    );
  });

  await nextFrame();
  await nextFrame();
  await waitForMermaid(container);
  await waitForImages(container);

  const html =
    container.querySelector(".markdown-export-render-surface")?.innerHTML ?? "";

  root.unmount();
  container.remove();

  return html;
}

export async function createMarkdownExportHtml({
  document: markdownDocument,
  theme,
}: MarkdownExportOptions) {
  const contentHtml = await renderMarkdownToHtml(
    markdownDocument.content,
    markdownDocument.filePath,
  );
  const title = markdownDocument.title || "Untitled";
  const exportedAt = new Date().toLocaleString("zh-CN");
  const updatedAt = formatDate(markdownDocument.updatedAt);
  const baseHref = getBaseHref(markdownDocument.filePath);

  return `<!doctype html>
<html lang="zh-CN" data-source-theme="${escapeAttribute(theme)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${escapeAttribute(baseHref)}" />
  <title>${escapeHtml(title)}</title>
  <style>${exportStyles}</style>
</head>
<body>
  <main class="markdown-export-page">
    <header class="markdown-export-header">
      <h1 class="markdown-export-title">${escapeHtml(title)}</h1>
      <div class="markdown-export-meta">更新于 ${escapeHtml(updatedAt)} · 导出于 ${escapeHtml(exportedAt)}</div>
    </header>
    <article class="markdown-export-document markdown-preview">
${contentHtml}
    </article>
  </main>
</body>
</html>`;
}
