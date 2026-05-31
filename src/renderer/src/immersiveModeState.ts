import { useEffect } from "react";

export function shouldResetImmersiveReveal<T>(
  isImmersiveMode: boolean,
  immersiveRevealEdge: T | null,
) {
  return !isImmersiveMode && immersiveRevealEdge !== null;
}

export function shouldCloseImmersiveSidebar(
  isImmersiveMode: boolean,
  isImmersiveSidebarOpen: boolean,
) {
  return !isImmersiveMode && isImmersiveSidebarOpen;
}

export function getImmersiveModeFromWindowFullScreen(fullScreen: boolean) {
  return fullScreen;
}

export function useImmersiveModeState<T>({
  immersiveRevealEdge,
  isImmersiveMode,
  isImmersiveSidebarOpen,
  setImmersiveRevealEdge,
  setIsImmersiveSidebarOpen,
}: {
  immersiveRevealEdge: T | null;
  isImmersiveMode: boolean;
  isImmersiveSidebarOpen: boolean;
  setImmersiveRevealEdge: (edge: T | null) => void;
  setIsImmersiveSidebarOpen: (open: boolean) => void;
}) {
  useEffect(() => {
    if (shouldResetImmersiveReveal(isImmersiveMode, immersiveRevealEdge)) {
      setImmersiveRevealEdge(null);
    }
  }, [immersiveRevealEdge, isImmersiveMode, setImmersiveRevealEdge]);

  useEffect(() => {
    if (shouldCloseImmersiveSidebar(isImmersiveMode, isImmersiveSidebarOpen)) {
      setIsImmersiveSidebarOpen(false);
    }
  }, [isImmersiveMode, isImmersiveSidebarOpen, setIsImmersiveSidebarOpen]);
}
