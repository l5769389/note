export type EditorMode = "typora" | "source" | "split" | "preview";
export type DocumentType =
  | "markdown"
  | "html"
  | "pdf"
  | "word"
  | "sheet"
  | "drawing";

export type DrawingAsset = {
  id: string;
  name: string;
  dataUrl: string;
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
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSnapshot = {
  version: 1;
  activeDocumentId: string;
  documents: MarkdownDocument[];
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
  tree: DirectoryTreeItem;
};
