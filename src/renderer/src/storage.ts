import type { DocumentType, MarkdownDocument, WorkspaceSnapshot } from "./types";
import {
  getMigratedStorageItem,
  legacyNoteDockStorageKeys,
  noteDockStorageKeys,
  removeLegacyStorageItem,
} from "./storageKeys";

const STORAGE_KEY = noteDockStorageKeys.workspace;

const now = () => new Date().toISOString();

const defaultMarkdown = `# 项目方案

这里是一个类似 Typora 的 Markdown 工作区。

## 当前能力

- 左侧管理文档。
- 中间编写 Markdown。
- 右侧即时预览。
- 点击工具栏的画板按钮插入 Excalidraw 流程图。
- 粘贴或选择图片后自动插入 Markdown 图片语法。

## 示例表格

| 模块 | 状态 |
| --- | --- |
| 编辑器 | 已启动 |
| Excalidraw | 已集成 |
| 本地存储 | 已启用 |

`;

export function createDocument(
  title = "未命名文档",
  content = defaultMarkdown,
  filePath?: string,
  documentType: DocumentType = "markdown",
  fileExtension?: string,
): MarkdownDocument {
  const timestamp = now();

  return {
    id: crypto.randomUUID(),
    title,
    content,
    documentType,
    drawings: {},
    fileExtension,
    filePath,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createInitialWorkspace(): WorkspaceSnapshot {
  const document = createDocument("项目方案");

  return {
    version: 1,
    activeDocumentId: "",
    documents: [document],
    updatedAt: now(),
  };
}

function getStoredDocumentType(filePath?: string): DocumentType {
  if (filePath && /\.html?$/i.test(filePath)) {
    return "html";
  }

  if (filePath && /\.pdf$/i.test(filePath)) {
    return "pdf";
  }

  if (filePath && /\.docx$/i.test(filePath)) {
    return "word";
  }

  if (filePath && /\.(?:xlsx|xlsm|xlsb|xls)$/i.test(filePath)) {
    return "excel";
  }

  if (filePath && /\.univer$/i.test(filePath)) {
    return "sheet";
  }

  if (filePath && /\.excalidraw$/i.test(filePath)) {
    return "drawing";
  }

  return "markdown";
}

function getStoredFileExtension(filePath?: string) {
  return filePath?.match(/\.([^.\\/]+)$/)?.[0]?.toLowerCase();
}

function normalizeStoredDocument(document: MarkdownDocument): MarkdownDocument {
  const documentType = document.documentType ?? getStoredDocumentType(document.filePath);

  return {
    ...document,
    content: documentType === "pdf" || documentType === "word" || documentType === "excel" ? "" : document.content,
    documentType,
    drawings: document.drawings ?? {},
    fileExtension:
      document.fileExtension ??
      getStoredFileExtension(document.filePath) ??
      (documentType === "html"
        ? ".html"
        : documentType === "pdf"
          ? ".pdf"
          : documentType === "word"
            ? ".docx"
            : documentType === "excel"
              ? ".xlsx"
              : documentType === "sheet"
                ? ".univer"
                : documentType === "drawing"
                  ? ".excalidraw"
                  : ".md"),
  };
}

function serializeDocument(document: MarkdownDocument): MarkdownDocument {
  return document.documentType === "pdf" ||
    document.documentType === "word" ||
    document.documentType === "excel"
    ? { ...document, content: "" }
    : document;
}

export function loadWorkspace(): WorkspaceSnapshot {
  const raw = getMigratedStorageItem(
    localStorage,
    STORAGE_KEY,
    legacyNoteDockStorageKeys.workspace,
  );

  if (!raw) {
    return createInitialWorkspace();
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceSnapshot;

    if (!parsed.documents?.length || parsed.version !== 1) {
      return createInitialWorkspace();
    }

    return {
      ...parsed,
      activeDocumentId: "",
      documents: parsed.documents.map(normalizeStoredDocument),
    };
  } catch {
    return createInitialWorkspace();
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      documents: snapshot.documents.map(serializeDocument),
      updatedAt: now(),
    }),
  );
  removeLegacyStorageItem(localStorage, legacyNoteDockStorageKeys.workspace);
}

export function renameFromMarkdown(markdown: string, fallback: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}
