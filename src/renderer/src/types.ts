export type EditorMode = "typora" | "source" | "split" | "preview";
export type DocumentType =
  | "markdown"
  | "html"
  | "pdf"
  | "word"
  | "excel"
  | "sheet"
  | "drawing";

export type DocumentProperty = {
  key: string;
  value: string;
};

export type DocumentLinkReference = {
  createdAt: string;
  documentType: DocumentType;
  filePath: string;
  title: string;
};

export type DocumentMetadata = {
  documentLinks: DocumentLinkReference[];
  properties: DocumentProperty[];
  tags: string[];
};

export type DrawingAsset = {
  id: string;
  name: string;
  dataUrl: string;
  sceneReference?: string;
  sceneJSON: string;
  createdAt: string;
};

export type MarkdownDocument = {
  id: string;
  title: string;
  content: string;
  documentType: DocumentType;
  drawings: Record<string, DrawingAsset>;
  fileExtension?: string;
  filePath?: string;
  lastOpenedAt?: string;
  metadata?: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
};

export type DocumentHistoryVersionReason = "auto" | "manual" | "restore";

export type DocumentHistoryVersion = {
  byteSize: number;
  contentHash: string;
  createdAt: string;
  filePath: string;
  id: string;
  lineCount: number;
  preview: string;
  reason: DocumentHistoryVersionReason;
  title: string;
  wordCount: number;
};

export type DocumentHistoryVersionWithContent = DocumentHistoryVersion & {
  content: string;
};

export type WorkspaceSource =
  | {
      directoryPath: string;
      kind: "local";
    }
  | {
      cachePath: string;
      kind: "cloud";
      workspaceId: string;
      workspaceName: string;
    };

export type WorkspaceSnapshot = {
  version: 1;
  activeDocumentId: string;
  documents: MarkdownDocument[];
  source?: WorkspaceSource;
  workspacePath?: string;
  updatedAt: string;
};

export type SaveState = "idle" | "saving" | "saved" | "failed";

export type DirectoryTreeItem = {
  children?: DirectoryTreeItem[];
  name: string;
  path: string;
  type: "directory" | "file";
};

export type LocalMarkdownFile = {
  content: string;
  createdAt: string;
  documentType: DocumentType;
  fileExtension: string;
  filePath: string;
  title: string;
  updatedAt: string;
};

export type LocalWorkspaceDirectory = {
  directoryPath: string;
  files: LocalMarkdownFile[];
  source?: WorkspaceSource;
  tree: DirectoryTreeItem;
};
