import { useEffect, useRef, type MutableRefObject } from "react";
import { isMarkdownDocument } from "./documentModel";
import type { MarkdownDocument } from "./types";
import type { MarkdownSearchMatch } from "./workspaceSearch";

export type WorkspaceSearchReveal = {
  filePath: string;
  match: MarkdownSearchMatch;
  query: string;
};

export function getPendingWorkspaceSearchRevealDecision(
  pendingReveal: WorkspaceSearchReveal | null,
  activeDocument?: MarkdownDocument | null,
) {
  if (!pendingReveal || activeDocument?.filePath !== pendingReveal.filePath) {
    return {
      shouldClear: false,
      shouldReveal: false,
    };
  }

  return {
    shouldClear: true,
    shouldReveal: isMarkdownDocument(activeDocument),
  };
}

export function usePendingWorkspaceSearchReveal({
  activeDocument,
  onReveal,
  pendingRevealRef,
  revealKey,
}: {
  activeDocument?: MarkdownDocument | null;
  onReveal: (
    document: MarkdownDocument,
    match: MarkdownSearchMatch,
    query: string,
  ) => void;
  pendingRevealRef: MutableRefObject<WorkspaceSearchReveal | null>;
  revealKey?: unknown;
}) {
  const onRevealRef = useRef(onReveal);

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    const pendingReveal = pendingRevealRef.current;
    const decision = getPendingWorkspaceSearchRevealDecision(
      pendingReveal,
      activeDocument,
    );

    if (!decision.shouldClear) {
      return;
    }

    pendingRevealRef.current = null;

    if (!decision.shouldReveal || !activeDocument || !pendingReveal) {
      return;
    }

    requestAnimationFrame(() => {
      onRevealRef.current(activeDocument, pendingReveal.match, pendingReveal.query);
    });
  }, [
    activeDocument?.content,
    activeDocument?.filePath,
    activeDocument?.id,
    pendingRevealRef,
    revealKey,
  ]);
}
