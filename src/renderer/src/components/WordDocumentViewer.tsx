import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDocumentDisplayName } from "../documentModel";
import type { MarkdownDocument } from "../types";

type WordRenderState =
  | { html: string; messages: Array<{ message: string; type: string }>; status: "ready" }
  | { message: string; status: "error" }
  | { status: "loading" };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createWordPreviewDocument(body: string, title: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base target="_blank">
<title>${escapeHtml(title)}</title>
<style>
:root{color:#182033;background:#f5f7fb;font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
body{margin:0;padding:34px}
.word-page{max-width:860px;min-height:calc(100vh - 68px);box-sizing:border-box;margin:0 auto;background:#fff;border:1px solid #e4e8f0;border-radius:12px;box-shadow:0 18px 42px rgba(15,23,42,.09);padding:58px 66px;color:#182033;font-size:15px;line-height:1.72}
.word-page :first-child{margin-top:0}
h1,h2,h3{color:#111827;line-height:1.25}
h1{margin:0 0 1.15em;font-size:30px}
h2{margin:1.6em 0 .75em;font-size:23px;border-bottom:1px solid #e5e7eb;padding-bottom:.35em}
h3{margin:1.35em 0 .65em;font-size:18px}
p{margin:.75em 0}
.subtitle{color:#667085;font-size:18px}
img{max-width:100%;height:auto}
table{width:100%;border-collapse:collapse;margin:1.1em 0}
td,th{border:1px solid #d7dce5;padding:8px 10px;vertical-align:top}
th{background:#f3f6fb;font-weight:700}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
ul,ol{padding-left:1.6em}
blockquote{margin:1em 0;border-left:4px solid #d0d7e2;padding:.4em 1em;color:#475467;background:#f8fafc}
</style>
</head>
<body><main class="word-page">${body || "<p>这个 Word 文档没有可显示的文本内容。</p>"}</main></body>
</html>`;
}

export function WordDocumentViewer({ document }: { document: MarkdownDocument }) {
  const [renderState, setRenderState] = useState<WordRenderState>({ status: "loading" });
  const title = getDocumentDisplayName(document);
  const srcDoc = useMemo(
    () =>
      renderState.status === "ready"
        ? createWordPreviewDocument(renderState.html, title)
        : "",
    [renderState, title],
  );

  async function loadWordDocument() {
    if (!document.filePath) {
      setRenderState({ message: "这个 Word 文档没有可访问的本地路径。", status: "error" });
      return;
    }

    setRenderState({ status: "loading" });

    try {
      const result = await window.desktop?.renderWordDocument?.(document.filePath);

      if (!result) {
        throw new Error("当前运行环境无法读取 Word 文档。");
      }

      setRenderState({
        html: result.html,
        messages: result.messages,
        status: "ready",
      });
    } catch (error) {
      setRenderState({
        message: error instanceof Error ? error.message : "Word 文档预览失败。",
        status: "error",
      });
    }
  }

  async function openExternally() {
    if (document.filePath) {
      await window.desktop?.openPath?.(document.filePath);
    }
  }

  useEffect(() => {
    void loadWordDocument();
  }, [document.filePath, document.updatedAt]);

  return (
    <section className="word-document-viewer">
      <header className="readonly-document-header">
        <div>
          <FileText size={17} />
          <strong>{title}</strong>
        </div>
        <div className="readonly-document-actions">
          <button type="button" onClick={() => void loadWordDocument()}>
            <RefreshCw size={15} />
            重新载入
          </button>
          <button type="button" disabled={!document.filePath} onClick={openExternally}>
            <ExternalLink size={15} />
            在 Word 中打开
          </button>
        </div>
      </header>

      {renderState.status === "loading" ? (
        <div className="readonly-document-state">
          <RefreshCw className="readonly-document-loading" size={26} />
          <strong>正在读取 Word 文档</strong>
        </div>
      ) : renderState.status === "error" ? (
        <div className="readonly-document-state readonly-document-error">
          <FileText size={30} />
          <strong>无法显示 Word 文档</strong>
          <span>{renderState.message}</span>
        </div>
      ) : (
        <>
          {renderState.messages.length ? (
            <div className="word-document-message">
              已显示文档内容，部分 Word 样式可能被简化。
            </div>
          ) : null}
          <iframe title={title} srcDoc={srcDoc} />
        </>
      )}
    </section>
  );
}
