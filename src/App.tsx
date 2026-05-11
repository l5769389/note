import {
  BookOpen,
  BookOpenText,
  Code2,
  Cloud,
  FilePlus2,
  ImagePlus,
  PanelRight,
  Pencil,
  Save,
  SplitSquareHorizontal,
  UploadCloud,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import {
  TyporaEditor,
  type TyporaEditorHandle,
} from "./components/TyporaEditor";
import { createCloudBackupProvider } from "./services/cloudBackup";
import { uploadImage } from "./services/imageUpload";
import {
  createDocument,
  loadWorkspace,
  renameFromMarkdown,
  saveWorkspace,
} from "./storage";
import type {
  DrawingAsset,
  EditorMode,
  MarkdownDocument,
  SaveState,
  WorkspaceSnapshot,
} from "./types";

const backupProvider = createCloudBackupProvider();
const DrawingModal = lazy(() =>
  import("./components/DrawingModal").then((module) => ({
    default: module.DrawingModal,
  })),
);

const now = () => new Date().toISOString();

function updateDocument(
  snapshot: WorkspaceSnapshot,
  document: MarkdownDocument,
): WorkspaceSnapshot {
  return {
    ...snapshot,
    documents: snapshot.documents.map((item) =>
      item.id === document.id ? document : item,
    ),
  };
}

function readFileInput(fileInput: HTMLInputElement | null) {
  fileInput?.click();
}

export function App() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [mode, setMode] = useState<EditorMode>("typora");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [backupMessage, setBackupMessage] = useState("本地自动保存已启用");
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [uploadState, setUploadState] = useState("图片可自动嵌入");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument = useMemo(
    () =>
      workspace.documents.find((item) => item.id === workspace.activeDocumentId) ??
      workspace.documents[0],
    [workspace],
  );

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        saveWorkspace(workspace);
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [workspace]);

  function setActiveDocument(documentId: string) {
    setWorkspace((current) => ({
      ...current,
      activeDocumentId: documentId,
    }));
  }

  function createNewDocument() {
    const document = createDocument(`新文档 ${workspace.documents.length + 1}`);

    setWorkspace((current) => ({
      ...current,
      activeDocumentId: document.id,
      documents: [document, ...current.documents],
    }));
  }

  function patchActiveDocument(patch: Partial<MarkdownDocument>) {
    setWorkspace((current) => {
      const currentDocument =
        current.documents.find((item) => item.id === current.activeDocumentId) ??
        current.documents[0];
      const nextDocument = {
        ...currentDocument,
        ...patch,
        updatedAt: now(),
      };

      return updateDocument(current, nextDocument);
    });
  }

  function updateMarkdown(content: string) {
    patchActiveDocument({
      content,
      title: renameFromMarkdown(content, activeDocument.title),
    });
  }

  function insertMarkdown(markdown: string) {
    if (mode === "typora") {
      typoraEditorRef.current?.insertMarkdown(markdown);
      return;
    }

    const editor = editorRef.current;
    const content = activeDocument.content;

    if (!editor) {
      updateMarkdown(`${content}\n${markdown}`);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextContent = `${content.slice(0, start)}${markdown}${content.slice(end)}`;

    updateMarkdown(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + markdown.length;
      editor.setSelectionRange(cursor, cursor);
    });
  }

  async function handleImageFile(file: File) {
    try {
      setUploadState("图片处理中");
      const result = await uploadImage(file);
      insertMarkdown(`\n![${file.name}](${result.url})\n`);
      setUploadState(result.storage === "remote" ? "图片已上传" : "图片已嵌入");
    } catch (error) {
      setUploadState(error instanceof Error ? error.message : "图片处理失败");
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );

    if (!image) {
      return;
    }

    event.preventDefault();
    await handleImageFile(image);
  }

  async function backupNow() {
    try {
      setBackupMessage("正在备份");
      const result = await backupProvider.backup(workspace);
      setBackupMessage(result.message);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "云备份失败");
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "保存中"
      : saveState === "failed"
        ? "保存失败"
        : "已保存";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">
            <BookOpen size={18} />
          </div>
          <div>
            <strong>Markdown Studio</strong>
            <span>Local first editor</span>
          </div>
        </div>

        <button className="new-doc-button" type="button" onClick={createNewDocument}>
          <FilePlus2 size={16} />
          新建文档
        </button>

        <div className="document-list" aria-label="文档列表">
          {workspace.documents.map((document) => (
            <button
              className={
                document.id === activeDocument.id
                  ? "document-item document-item-active"
                  : "document-item"
              }
              key={document.id}
              type="button"
              onClick={() => setActiveDocument(document.id)}
            >
              <span>{document.title}</span>
              <time>{new Date(document.updatedAt).toLocaleString()}</time>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="document-title">
            <Pencil size={17} />
            <input
              aria-label="文档标题"
              value={activeDocument.title}
              onChange={(event) => patchActiveDocument({ title: event.target.value })}
            />
          </div>

          <div className="toolbar-actions" aria-label="编辑器操作">
            <div className="segmented-control">
              <button
                className={mode === "typora" ? "active" : ""}
                type="button"
                onClick={() => setMode("typora")}
                title="实时渲染"
              >
                <BookOpenText size={16} />
              </button>
              <button
                className={mode === "source" ? "active" : ""}
                type="button"
                onClick={() => setMode("source")}
                title="源码"
              >
                <Code2 size={16} />
              </button>
              <button
                className={mode === "split" ? "active" : ""}
                type="button"
                onClick={() => setMode("split")}
                title="分栏"
              >
                <SplitSquareHorizontal size={16} />
              </button>
              <button
                className={mode === "preview" ? "active" : ""}
                type="button"
                onClick={() => setMode("preview")}
                title="预览"
              >
                <PanelRight size={16} />
              </button>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={() => setIsDrawingOpen(true)}
              title="插入 Excalidraw 流程图"
            >
              <Pencil size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => readFileInput(imageInputRef.current)}
              title="插入图片"
            >
              <ImagePlus size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={backupNow}
              title="立即云备份"
            >
              <UploadCloud size={16} />
            </button>
          </div>
        </header>

        <div className="statusbar">
          <span>
            <Save size={14} />
            {saveLabel}
          </span>
          <span>
            <ImagePlus size={14} />
            {uploadState}
          </span>
          <span>
            <Cloud size={14} />
            {backupMessage}
          </span>
        </div>

        <div className={`editor-layout editor-layout-${mode}`}>
          {mode === "typora" && (
            <TyporaEditor
              ref={typoraEditorRef}
              value={activeDocument.content}
              onChange={updateMarkdown}
              onPaste={handlePaste}
            />
          )}

          {(mode === "source" || mode === "split") && (
            <textarea
              ref={editorRef}
              className="markdown-input"
              spellCheck={false}
              value={activeDocument.content}
              onChange={(event) => updateMarkdown(event.target.value)}
              onPaste={handlePaste}
            />
          )}

          {(mode === "split" || mode === "preview") && (
            <article className="markdown-preview">
              <MarkdownRenderer>{activeDocument.content}</MarkdownRenderer>
            </article>
          )}
        </div>
      </section>

      <input
        ref={imageInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void handleImageFile(file);
          }
        }}
      />

      {isDrawingOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <Suspense
            fallback={
              <section className="drawing-modal drawing-loading">
                正在加载画板
              </section>
            }
          >
            <DrawingModal
              assetIndex={Object.keys(activeDocument.drawings).length + 1}
              onClose={() => setIsDrawingOpen(false)}
              onInsert={(asset: DrawingAsset) => {
                patchActiveDocument({
                  drawings: {
                    ...activeDocument.drawings,
                    [asset.id]: asset,
                  },
                });
                insertMarkdown(
                  `\n![${asset.name}](${asset.dataUrl})\n<!-- excalidraw:${asset.id} -->\n`,
                );
              }}
            />
          </Suspense>
        </div>
      )}
    </main>
  );
}
