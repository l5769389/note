import { useEffect } from "react";
import { getWritableDirtyDocuments } from "./filePersistence";
import type { MarkdownDocument, SaveState, WorkspaceSnapshot } from "./types";

export const workspaceAutosaveDelayMs = 650;

export type WriteMarkdownFile = (payload: {
  content: string;
  filePath: string;
}) => Promise<unknown>;

export async function writeWorkspaceDirtyDocuments({
  acknowledgeSavedFileContent,
  documents,
  rememberInternalFileWrite,
  writeMarkdownFile,
}: {
  acknowledgeSavedFileContent: (filePath: string, content: string) => void;
  documents: MarkdownDocument[];
  rememberInternalFileWrite: (filePath: string, content: string) => void;
  writeMarkdownFile?: WriteMarkdownFile;
}) {
  if (!documents.length || !writeMarkdownFile) {
    return false;
  }

  await Promise.all(
    documents.map((document) => {
      rememberInternalFileWrite(document.filePath!, document.content);
      return writeMarkdownFile({
        content: document.content,
        filePath: document.filePath!,
      });
    }),
  );

  documents.forEach((document) => {
    acknowledgeSavedFileContent(document.filePath!, document.content);
  });

  return true;
}

export function useWorkspaceAutosave({
  acknowledgeSavedFileContent,
  delayMs = workspaceAutosaveDelayMs,
  externalConflictPaths,
  loadDirectoryTree,
  rememberInternalFileWrite,
  savedFileContentByPath,
  setSaveState,
  workspace,
  writeMarkdownFile,
}: {
  acknowledgeSavedFileContent: (filePath: string, content: string) => void;
  delayMs?: number;
  externalConflictPaths: Set<string>;
  loadDirectoryTree: () => Promise<unknown>;
  rememberInternalFileWrite: (filePath: string, content: string) => void;
  savedFileContentByPath: Map<string, string>;
  setSaveState: (state: SaveState) => void;
  workspace: WorkspaceSnapshot;
  writeMarkdownFile?: WriteMarkdownFile;
}) {
  useEffect(() => {
    if (!writeMarkdownFile) {
      return undefined;
    }

    let hasDirtyDocuments = false;

    try {
      hasDirtyDocuments =
        getWritableDirtyDocuments({
          documents: workspace.documents,
          externalConflictPaths,
          savedFileContentByPath,
        }).length > 0;
    } catch {
      setSaveState("failed");
      return undefined;
    }

    if (!hasDirtyDocuments) {
      return undefined;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        const writableDocuments = getWritableDirtyDocuments({
          documents: workspace.documents,
          externalConflictPaths,
          savedFileContentByPath,
        });

        if (!writableDocuments.length) {
          setSaveState("saved");
          return;
        }

        void writeWorkspaceDirtyDocuments({
          acknowledgeSavedFileContent,
          documents: writableDocuments,
          rememberInternalFileWrite,
          writeMarkdownFile,
        })
          .then((didWrite) => {
            setSaveState("saved");
            if (didWrite) {
              void loadDirectoryTree();
            }
          })
          .catch(() => setSaveState("failed"));
      } catch {
        setSaveState("failed");
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [workspace]);
}
