import { ExternalLink, FileText, GitBranch, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MarkdownDocument } from "../types";
import {
  parseXmindDocument,
  type XmindDocumentModel,
  type XmindTopicNode,
} from "../xmindDocument";

type XmindDocumentViewerProps = {
  document: MarkdownDocument;
};

type XmindParseState =
  | { status: "loading" }
  | { model: XmindDocumentModel; status: "ready" }
  | { message: string; status: "error" };

function getDisplayName(document: MarkdownDocument) {
  return document.filePath?.split(/[\\/]/).pop() ?? `${document.title}.xmind`;
}

function splitBranches(children: XmindTopicNode[]) {
  const middle = Math.ceil(children.length / 2);

  return {
    left: children.slice(0, middle),
    right: children.slice(middle),
  };
}

function XmindBranch({
  side,
  topic,
}: {
  side: "left" | "right";
  topic: XmindTopicNode;
}) {
  return (
    <div className={`xmind-branch xmind-branch-${side}`}>
      <article className="xmind-topic-card">
        <strong>{topic.title}</strong>
        {topic.notes ? <p>{topic.notes}</p> : null}
        {topic.labels.length ? (
          <div className="xmind-topic-labels">
            {topic.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}
      </article>
      {topic.children.length ? (
        <div className="xmind-branch-children">
          {topic.children.map((child) => (
            <XmindBranch key={child.id} side={side} topic={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function XmindMap({ rootTopic }: { rootTopic: XmindTopicNode }) {
  const branches = splitBranches(rootTopic.children);

  return (
    <div className="xmind-map">
      <div className="xmind-map-side xmind-map-side-left">
        {branches.left.map((topic) => (
          <XmindBranch key={topic.id} side="left" topic={topic} />
        ))}
      </div>
      <article className="xmind-root-topic">
        <GitBranch size={22} />
        <strong>{rootTopic.title}</strong>
        {rootTopic.notes ? <p>{rootTopic.notes}</p> : null}
      </article>
      <div className="xmind-map-side xmind-map-side-right">
        {branches.right.map((topic) => (
          <XmindBranch key={topic.id} side="right" topic={topic} />
        ))}
      </div>
    </div>
  );
}

export function XmindDocumentViewer({ document }: XmindDocumentViewerProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [parseState, setParseState] = useState<XmindParseState>({ status: "loading" });
  const displayName = getDisplayName(document);

  useEffect(() => {
    let isDisposed = false;

    setActiveSheetIndex(0);
    setParseState({ status: "loading" });

    parseXmindDocument(document.content)
      .then((model) => {
        if (!isDisposed) {
          setParseState({ model, status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (!isDisposed) {
          setParseState({
            message: error instanceof Error ? error.message : "Unable to read this XMind file.",
            status: "error",
          });
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [document.content, document.id]);

  const activeSheet = useMemo(() => {
    if (parseState.status !== "ready") {
      return null;
    }

    return parseState.model.sheets[activeSheetIndex] ?? parseState.model.sheets[0] ?? null;
  }, [activeSheetIndex, parseState]);

  function openInXmind() {
    if (document.filePath) {
      void window.desktop?.openPath?.(document.filePath);
    }
  }

  return (
    <section className="xmind-document-viewer">
      <header className="xmind-viewer-header">
        <div className="xmind-viewer-title">
          <FileText size={18} />
          <div>
            <span>XMind</span>
            <strong>{displayName}</strong>
          </div>
        </div>
        <div className="xmind-viewer-actions">
          {parseState.status === "ready" && parseState.model.sheets.length > 1 ? (
            <div className="xmind-sheet-tabs" role="tablist" aria-label="XMind sheets">
              {parseState.model.sheets.map((sheet, index) => (
                <button
                  className={index === activeSheetIndex ? "xmind-sheet-tab-active" : undefined}
                  key={sheet.id}
                  type="button"
                  role="tab"
                  aria-selected={index === activeSheetIndex}
                  onClick={() => setActiveSheetIndex(index)}
                >
                  {sheet.title}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" disabled={!document.filePath} onClick={openInXmind}>
            <ExternalLink size={16} />
            用 XMind 编辑
          </button>
        </div>
      </header>

      {parseState.status === "loading" ? (
        <div className="xmind-viewer-state">
          <Loader2 className="xmind-loading-icon" size={22} />
          <span>正在读取 XMind 文件</span>
        </div>
      ) : parseState.status === "error" ? (
        <div className="xmind-viewer-state xmind-viewer-error">
          <strong>无法显示这个 XMind 文件</strong>
          <span>{parseState.message}</span>
          <button type="button" disabled={!document.filePath} onClick={openInXmind}>
            <ExternalLink size={16} />
            用 XMind 打开
          </button>
        </div>
      ) : activeSheet ? (
        <div className="xmind-canvas" aria-label={activeSheet.title}>
          <XmindMap rootTopic={activeSheet.rootTopic} />
        </div>
      ) : (
        <div className="xmind-viewer-state xmind-viewer-error">
          <strong>没有可显示的画布</strong>
        </div>
      )}
    </section>
  );
}
