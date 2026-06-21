import type {
  DocumentMetadata,
  DocumentType,
  MarkdownDocument,
  WorkspaceSource,
  WorkspaceSnapshot,
} from "./types";
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
    metadata: {
      documentLinks: [],
      properties: [],
      tags: [],
    },
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

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function normalizeMetadataString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoredMetadata(value: unknown): DocumentMetadata {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<DocumentMetadata>)
      : {};
  const seenTags = new Set<string>();
  const tags = Array.isArray(record.tags)
    ? record.tags
        .map(normalizeMetadataString)
        .filter((tag) => {
          const key = tag.toLocaleLowerCase();

          if (!tag || seenTags.has(key)) {
            return false;
          }

          seenTags.add(key);
          return true;
        })
    : [];
  const seenProperties = new Set<string>();
  const properties = Array.isArray(record.properties)
    ? record.properties
        .map((property) => ({
          key: normalizeMetadataString(property?.key),
          value: normalizeMetadataString(property?.value),
        }))
        .filter((property) => {
          const key = property.key.toLocaleLowerCase();

          if (!property.key || seenProperties.has(key)) {
            return false;
          }

          seenProperties.add(key);
          return true;
        })
    : [];
  const seenDocumentLinks = new Set<string>();
  const documentLinks = Array.isArray(record.documentLinks)
    ? record.documentLinks
        .map((value) => {
          const link =
            value && typeof value === "object"
              ? (value as Record<string, unknown>)
              : {};
          const filePath =
            normalizeMetadataString(link.filePath) ||
            normalizeMetadataString(link.path);

          return {
            createdAt:
              normalizeMetadataString(link.createdAt) ||
              normalizeMetadataString(link.updatedAt) ||
              now(),
            documentType: getStoredDocumentType(filePath),
            filePath,
            title:
              normalizeMetadataString(link.title) ||
              normalizeMetadataString(link.name) ||
              filePath,
          };
        })
        .filter((link) => {
          const key = link.filePath.replace(/\\/g, "/").toLocaleLowerCase();

          if (!link.filePath || seenDocumentLinks.has(key)) {
            return false;
          }

          seenDocumentLinks.add(key);
          return true;
        })
    : [];

  return {
    documentLinks,
    properties,
    tags,
  };
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
    lastOpenedAt:
      typeof document.lastOpenedAt === "string"
        ? document.lastOpenedAt
        : undefined,
    metadata: normalizeStoredMetadata(document.metadata),
  };
}

function normalizeWorkspaceSource(
  value: unknown,
  workspacePath?: string,
): WorkspaceSource | undefined {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<WorkspaceSource>)
      : null;

  if (record?.kind === "cloud") {
    const workspaceId =
      typeof record.workspaceId === "string" ? record.workspaceId.trim() : "";
    const workspaceName =
      typeof record.workspaceName === "string" && record.workspaceName.trim()
        ? record.workspaceName.trim()
        : "云端笔记";
    const cachePath =
      typeof record.cachePath === "string" && record.cachePath.trim()
        ? record.cachePath.trim()
        : workspacePath;

    if (workspaceId && cachePath) {
      return {
        cachePath,
        kind: "cloud",
        workspaceId,
        workspaceName,
      };
    }
  }

  if (record?.kind === "local") {
    const directoryPath =
      typeof record.directoryPath === "string" && record.directoryPath.trim()
        ? record.directoryPath.trim()
        : workspacePath;

    return directoryPath
      ? {
          directoryPath,
          kind: "local",
        }
      : undefined;
  }

  return workspacePath
    ? {
        directoryPath: workspacePath,
        kind: "local",
      }
    : undefined;
}

function serializeDocument(document: MarkdownDocument): MarkdownDocument {
  return document.documentType === "pdf" ||
    document.documentType === "word" ||
    document.documentType === "excel"
    ? { ...document, content: "" }
    : document;
}

export function normalizeWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  const parsed =
    value && typeof value === "object" ? (value as Partial<WorkspaceSnapshot>) : null;

  if (!parsed?.documents?.length || parsed.version !== 1) {
    return createInitialWorkspace();
  }

  return {
    ...parsed,
    activeDocumentId: "",
    documents: parsed.documents.map(normalizeStoredDocument),
    source: normalizeWorkspaceSource(parsed.source, parsed.workspacePath),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now(),
    version: 1,
  };
}

export function serializeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    documents: snapshot.documents.map(serializeDocument),
    updatedAt: now(),
  };
}

export function loadWorkspaceFromStorage(
  storage: Storage | undefined = getBrowserStorage(),
): WorkspaceSnapshot {
  const raw = getMigratedStorageItem(
    storage,
    STORAGE_KEY,
    legacyNoteDockStorageKeys.workspace,
  );

  if (!raw) {
    return createInitialWorkspace();
  }

  try {
    return normalizeWorkspaceSnapshot(JSON.parse(raw));
  } catch {
    return createInitialWorkspace();
  }
}

export function loadWorkspace(): WorkspaceSnapshot {
  return loadWorkspaceFromStorage();
}

export function saveWorkspaceToStorage(
  snapshot: WorkspaceSnapshot,
  storage: Storage | undefined = getBrowserStorage(),
) {
  storage?.setItem(
    STORAGE_KEY,
    JSON.stringify(serializeWorkspaceSnapshot(snapshot)),
  );
  removeLegacyStorageItem(storage, legacyNoteDockStorageKeys.workspace);
}

export function saveWorkspace(snapshot: WorkspaceSnapshot) {
  saveWorkspaceToStorage(snapshot);
}

export function renameFromMarkdown(markdown: string, fallback: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}
