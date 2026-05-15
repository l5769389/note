import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { getDocumentDisplayName } from "../documentModel";
import { getLocalPreviewUrl } from "../localPreviewUrls";
import type { MarkdownDocument } from "../types";

export function PdfDocumentViewer({
  document,
  onReload,
}: {
  document: MarkdownDocument;
  onReload?: () => void;
}) {
  const previewUrl = getLocalPreviewUrl(document.filePath);

  async function openExternally() {
    if (document.filePath) {
      await window.desktop?.openPath?.(document.filePath);
    }
  }

  if (!previewUrl) {
    return (
      <section className="readonly-document-state">
        <FileText size={30} />
        <strong>无法显示 PDF</strong>
        <span>这个 PDF 没有可访问的本地路径。</span>
      </section>
    );
  }

  return (
    <section className="pdf-document-viewer">
      <header className="readonly-document-header">
        <div>
          <FileText size={17} />
          <strong>{getDocumentDisplayName(document)}</strong>
        </div>
        <div className="readonly-document-actions">
          {onReload ? (
            <button type="button" onClick={onReload}>
              <RefreshCw size={15} />
              重新载入
            </button>
          ) : null}
          <button type="button" onClick={openExternally}>
            <ExternalLink size={15} />
            在系统应用中打开
          </button>
        </div>
      </header>
      <iframe title={getDocumentDisplayName(document)} src={previewUrl} />
    </section>
  );
}
