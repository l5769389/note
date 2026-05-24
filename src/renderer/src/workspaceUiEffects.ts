import { useEffect, useRef, type RefObject } from "react";

export function shouldFocusWorkspaceSearch(
  sidebarTab: string,
  isSidebarHidden: boolean,
) {
  return sidebarTab === "search" && !isSidebarHidden;
}

export function focusAndSelectInput(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

export function useActiveDocumentUiReset({
  activeDocumentId,
  resetActiveEditorLine,
  resetKnowledgeEditor,
  resetWikiLinkDraft,
}: {
  activeDocumentId?: string;
  resetActiveEditorLine: () => void;
  resetKnowledgeEditor: () => void;
  resetWikiLinkDraft: () => void;
}) {
  useEffect(() => {
    resetActiveEditorLine();
    resetKnowledgeEditor();
    resetWikiLinkDraft();
  }, [activeDocumentId]);
}

export function useWorkspaceSearchAutoFocus({
  inputRef,
  isSidebarHidden,
  sidebarTab,
}: {
  inputRef: RefObject<HTMLInputElement>;
  isSidebarHidden: boolean;
  sidebarTab: string;
}) {
  useEffect(() => {
    if (!shouldFocusWorkspaceSearch(sidebarTab, isSidebarHidden)) {
      return;
    }

    requestAnimationFrame(() => {
      focusAndSelectInput(inputRef.current);
    });
  }, [inputRef, isSidebarHidden, sidebarTab]);
}

export function useQuickCaptureBridge(
  subscribe: ((callback: () => void) => () => void) | undefined,
  onQuickCapture: () => void,
) {
  const onQuickCaptureRef = useRef(onQuickCapture);

  useEffect(() => {
    onQuickCaptureRef.current = onQuickCapture;
  }, [onQuickCapture]);

  useEffect(() => {
    return subscribe?.(() => {
      onQuickCaptureRef.current();
    });
  }, [subscribe]);
}
