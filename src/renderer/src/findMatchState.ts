import { useEffect } from "react";

export function clampFindMatchIndex(currentIndex: number, matchCount: number) {
  if (matchCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, currentIndex), matchCount - 1);
}

export function shouldClearFindHighlight({
  findQuery,
  isFindReplaceOpen,
  matchCount,
}: {
  findQuery: string;
  isFindReplaceOpen: boolean;
  matchCount: number;
}) {
  return !isFindReplaceOpen || !findQuery || matchCount <= 0;
}

export function useFindMatchStateMaintenance({
  activeDocumentId,
  clearFindHighlight,
  findQuery,
  isFindReplaceOpen,
  matchCount,
  setFindMatchIndex,
}: {
  activeDocumentId?: string;
  clearFindHighlight: () => void;
  findQuery: string;
  isFindReplaceOpen: boolean;
  matchCount: number;
  setFindMatchIndex: (updater: number | ((current: number) => number)) => void;
}) {
  useEffect(() => {
    setFindMatchIndex((current) => clampFindMatchIndex(current, matchCount));
  }, [matchCount]);

  useEffect(() => {
    setFindMatchIndex(0);
  }, [activeDocumentId, findQuery]);

  useEffect(() => {
    if (
      shouldClearFindHighlight({
        findQuery,
        isFindReplaceOpen,
        matchCount,
      })
    ) {
      clearFindHighlight();
    }
  }, [findQuery, isFindReplaceOpen, matchCount]);
}
