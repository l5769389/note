import { useEffect } from "react";
import {
  createPersistedAppState,
  savePersistedAppState,
} from "./appPersistence";
import type { AppSettings, AppTheme } from "./appSettings";
import type { WorkspaceSnapshot } from "./types";

export const persistedAppStateWriteDelayMs = 500;

export function usePersistedAppStateWriter({
  isReady,
  recentDirectories,
  settings,
  sidebarWidth,
  theme,
  workspace,
  writeDelayMs = persistedAppStateWriteDelayMs,
}: {
  isReady: boolean;
  recentDirectories: string[];
  settings: AppSettings;
  sidebarWidth: number;
  theme: AppTheme;
  workspace: WorkspaceSnapshot;
  writeDelayMs?: number;
}) {
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      void savePersistedAppState(
        createPersistedAppState({
          recentDirectories,
          settings,
          sidebarWidth,
          theme,
          workspace,
        }),
      );
    }, writeDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    isReady,
    recentDirectories,
    settings,
    sidebarWidth,
    theme,
    workspace,
    writeDelayMs,
  ]);
}
