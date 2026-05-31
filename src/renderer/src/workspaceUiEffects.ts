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
  resetWikiLinkDraft,
}: {
  activeDocumentId?: string;
  resetActiveEditorLine: () => void;
  resetWikiLinkDraft: () => void;
}) {
  useEffect(() => {
    resetActiveEditorLine();
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

export function useInspirationNoteBridge(
  subscribe: ((callback: () => void) => () => void) | undefined,
  onInspirationNote: () => void,
) {
  const onInspirationNoteRef = useRef(onInspirationNote);

  useEffect(() => {
    onInspirationNoteRef.current = onInspirationNote;
  }, [onInspirationNote]);

  useEffect(() => {
    return subscribe?.(() => {
      onInspirationNoteRef.current();
    });
  }, [subscribe]);
}
