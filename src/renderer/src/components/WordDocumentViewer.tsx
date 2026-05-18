import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { getDocumentDisplayName } from "../documentModel";
import type { MarkdownDocument } from "../types";

type WordRenderState =
  | { status: "ready" }
  | { message: string; status: "error" }
  | { status: "loading" };

function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function WordDocumentViewer({ document }: { document: MarkdownDocument }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [renderState, setRenderState] = useState<WordRenderState>({
    status: "loading",
  });
  const title = getDocumentDisplayName(document);

  async function openExternally() {
    if (document.filePath) {
      await window.desktop?.openPath?.(document.filePath);
    }
  }

  useEffect(() => {
    let isDisposed = false;
    if (!bodyRef.current || !styleRef.current) {
      return undefined;
    }

    const bodyContainer = bodyRef.current;
    const styleContainer = styleRef.current;

    bodyContainer.replaceChildren();
    styleContainer.replaceChildren();

    if (!document.filePath) {
      setRenderState({
        message: "这个 Word 文档没有可访问的本地路径。",
        status: "error",
      });
      return undefined;
    }

    const filePath = document.filePath;

    async function renderWordDocument() {
      setRenderState({ status: "loading" });

      try {
        const base64 = await window.desktop?.readWordDocument?.(filePath);

        if (!base64) {
          throw new Error("当前运行环境无法读取 Word 文档。");
        }

        const data = base64ToUint8Array(base64);

        if (isDisposed) {
          return;
        }

        bodyContainer.replaceChildren();
        styleContainer.replaceChildren();
        await renderAsync(data, bodyContainer, styleContainer, {
          breakPages: true,
          className: "docx-preview",
          experimental: true,
          ignoreFonts: false,
          ignoreHeight: false,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          inWrapper: true,
          renderAltChunks: true,
          renderComments: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
          useBase64URL: true,
        });

        if (!isDisposed) {
          setRenderState({ status: "ready" });
        }
      } catch (error) {
        if (!isDisposed) {
          bodyContainer.replaceChildren();
          styleContainer.replaceChildren();
          setRenderState({
            message: error instanceof Error ? error.message : "Word 文档预览失败。",
            status: "error",
          });
        }
      }
    }

    void renderWordDocument();

    return () => {
      isDisposed = true;
      bodyContainer.replaceChildren();
      styleContainer.replaceChildren();
    };
  }, [document.filePath, document.updatedAt, reloadNonce]);

  return (
    <section className="word-document-viewer">
      <header className="readonly-document-header">
        <div>
          <FileText size={17} />
          <strong>{title}</strong>
        </div>
        <div className="readonly-document-actions">
          <button type="button" onClick={() => setReloadNonce((value) => value + 1)}>
            <RefreshCw size={15} />
            重新载入
          </button>
          <button type="button" disabled={!document.filePath} onClick={openExternally}>
            <ExternalLink size={15} />
            在 Word 中打开
          </button>
        </div>
      </header>

      <div className="word-document-stage">
        <div className="word-document-style-host" ref={styleRef} />
        <div className="word-document-body" ref={bodyRef} />

        {renderState.status === "loading" ? (
          <div className="readonly-document-state word-document-overlay">
            <RefreshCw className="readonly-document-loading" size={26} />
            <strong>正在读取 Word 文档</strong>
          </div>
        ) : null}

        {renderState.status === "error" ? (
          <div className="readonly-document-state readonly-document-error word-document-overlay">
            <FileText size={30} />
            <strong>无法显示 Word 文档</strong>
            <span>{renderState.message}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
