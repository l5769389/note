import * as Dialog from "@radix-ui/react-dialog";
import {
  ClipboardPaste,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { HomeDashboard } from "./HomeDashboard";
import { useHomeController } from "./useHomeController";
import type { MarkdownDocument } from "../../types";

type HomeWorkspaceProps = {
  activeDocument?: MarkdownDocument | null;
  logoUrl: string;
  noteDialogRequestId?: number;
  onCreateDocument: () => void;
  onOpenKnowledgeRelations: () => void;
  onOpenRecentDocument: (document: MarkdownDocument) => void | Promise<void>;
  onOpenRecentDocumentContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    document: MarkdownDocument,
  ) => void;
  onOpenWorkspaceFolder: () => void | Promise<void>;
  recentDocuments: MarkdownDocument[];
  getDocumentPathLabel?: (document: MarkdownDocument) => string;
  showNotePanel?: boolean;
  showTodoPanel?: boolean;
  workspacePath?: string;
};

export function HomeWorkspace({
  activeDocument,
  logoUrl,
  noteDialogRequestId = 0,
  onCreateDocument,
  onOpenKnowledgeRelations,
  onOpenRecentDocument,
  onOpenRecentDocumentContextMenu,
  onOpenWorkspaceFolder,
  recentDocuments,
  getDocumentPathLabel,
  showNotePanel = true,
  showTodoPanel = true,
  workspacePath,
}: HomeWorkspaceProps) {
  const home = useHomeController({ recentDocuments });
  const lastHandledNoteDialogRequestIdRef = useRef(0);

  useEffect(() => {
    if (
      noteDialogRequestId > 0 &&
      noteDialogRequestId !== lastHandledNoteDialogRequestIdRef.current
    ) {
      lastHandledNoteDialogRequestIdRef.current = noteDialogRequestId;
      home.noteDialog.setOpen(true);
    }
  }, [home.noteDialog.setOpen, noteDialogRequestId]);

  return (
    <>
      <HomeDashboard
        {...home.dashboardState}
        activeDocument={activeDocument}
        logoUrl={logoUrl}
        onCreateDocument={onCreateDocument}
        onOpenKnowledgeRelations={onOpenKnowledgeRelations}
        onOpenRecentDocument={onOpenRecentDocument}
        onOpenRecentDocumentContextMenu={onOpenRecentDocumentContextMenu}
        onOpenWorkspaceFolder={onOpenWorkspaceFolder}
        getDocumentPathLabel={getDocumentPathLabel}
        showNotePanel={showNotePanel}
        showTodoPanel={showTodoPanel}
        workspacePath={workspacePath}
      />

      {home.noteDialog.isOpen ? (
        <Dialog.Root
          open={home.noteDialog.isOpen}
          onOpenChange={home.noteDialog.setOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="home-note-dialog">
              <div className="create-file-header">
                <div className="create-file-heading">
                  <span className="create-file-icon">
                    <ClipboardPaste size={18} />
                  </span>
                  <div>
                    <Dialog.Title className="create-file-title">
                      灵感便签
                    </Dialog.Title>
                    <Dialog.Description>
                      记录临时想法、截图或参考片段，保存后会回到首页便签列表。
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="icon-button" type="button" aria-label="关闭">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="home-note-editor">
                <textarea
                  aria-label="便签内容"
                  autoFocus
                  placeholder="写下一个想法，也可以直接粘贴截图。"
                  value={home.noteDialog.note}
                  onChange={(event) => home.noteDialog.setNote(event.target.value)}
                  onPaste={(event) => void home.noteDialog.onPaste(event)}
                />

                {home.noteDialog.images.length ? (
                  <div
                    className="home-draft-images home-note-dialog-images"
                    aria-label="便签草稿图片"
                  >
                    {home.noteDialog.images.map((image) => (
                      <span className="home-draft-image" key={image.id}>
                        <button
                          className="home-draft-image-preview"
                          type="button"
                          aria-label={`浏览图片 ${image.fileName}`}
                          onClick={() => home.imagePreview.setImage(image)}
                        >
                          <img
                            alt={image.fileName}
                            src={image.dataUrl}
                            draggable={false}
                          />
                        </button>
                        <button
                          className="home-draft-image-remove"
                          type="button"
                          aria-label="移除图片"
                          onClick={() => home.noteDialog.removeImage(image.id)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="note-dialog-actions home-note-dialog-actions">
                <Dialog.Close asChild>
                  <button className="secondary-button" type="button">
                    取消
                  </button>
                </Dialog.Close>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!home.noteDialog.canSave}
                  onClick={home.noteDialog.save}
                >
                  保存便签
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}

      {home.imagePreview.image ? (
        <Dialog.Root
          open={Boolean(home.imagePreview.image)}
          onOpenChange={(open) => {
            if (!open) {
              home.imagePreview.close();
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="home-image-preview-dialog">
              <Dialog.Title className="sr-only">
                {home.imagePreview.image.fileName}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="home-image-preview-close"
                  type="button"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
              <div
                className="home-image-preview-viewport"
                onWheel={(event) => {
                  event.preventDefault();
                  home.imagePreview.setZoom(event.deltaY < 0 ? 0.1 : -0.1);
                }}
              >
                <img
                  alt={home.imagePreview.image.fileName}
                  src={home.imagePreview.image.dataUrl}
                  draggable={false}
                  style={{
                    transform: `scale(${home.imagePreview.zoom})`,
                  }}
                />
              </div>
              <div className="home-image-preview-toolbar" aria-label="图片缩放">
                <button
                  type="button"
                  aria-label="缩小图片"
                  onClick={() => home.imagePreview.setZoom(-0.1)}
                >
                  <Minus size={16} />
                </button>
                <button
                  className="home-image-preview-zoom-value"
                  type="button"
                  onClick={home.imagePreview.resetZoom}
                >
                  {Math.round(home.imagePreview.zoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label="放大图片"
                  onClick={() => home.imagePreview.setZoom(0.1)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </>
  );
}
