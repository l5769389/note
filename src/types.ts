export type EditorMode = "typora" | "source" | "split" | "preview";

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
  drawings: Record<string, DrawingAsset>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSnapshot = {
  version: 1;
  activeDocumentId: string;
  documents: MarkdownDocument[];
  updatedAt: string;
};

export type SaveState = "idle" | "saving" | "saved" | "failed";

export type UploadResult = {
  url: string;
  storage: "remote" | "embedded";
};
