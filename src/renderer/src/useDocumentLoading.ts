import { useCallback, useState } from "react";

export type DocumentLoadingState = {
  detail?: string;
  title: string;
} | null;

export function useDocumentLoading() {
  const [documentLoadingState, setDocumentLoadingState] =
    useState<DocumentLoadingState>(null);

  const showDocumentLoading = useCallback((title: string, detail?: string) => {
    setDocumentLoadingState({ detail, title });
  }, []);

  const clearDocumentLoading = useCallback(() => {
    setDocumentLoadingState(null);
  }, []);

  return {
    clearDocumentLoading,
    documentLoadingState,
    showDocumentLoading,
  };
}
