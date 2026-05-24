import { useEffect } from "react";

export type WindowStateSnapshot = {
  alwaysOnTop: boolean;
  fullScreen: boolean;
};

export function isValidWindowZoomFactor(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function useWindowChromeState({
  getWindowState,
  getZoomFactor,
  setIsAlwaysOnTop,
  setIsFullScreen,
  setWindowZoomFactor,
}: {
  getWindowState?: () => Promise<WindowStateSnapshot | undefined>;
  getZoomFactor?: () => Promise<number>;
  setIsAlwaysOnTop: (alwaysOnTop: boolean) => void;
  setIsFullScreen: (fullScreen: boolean) => void;
  setWindowZoomFactor: (factor: number) => void;
}) {
  useEffect(() => {
    let isStale = false;

    void getWindowState?.().then((state) => {
      if (isStale || !state) {
        return;
      }

      setIsFullScreen(state.fullScreen);
      setIsAlwaysOnTop(state.alwaysOnTop);
    });

    void getZoomFactor?.().then((factor) => {
      if (isStale || !isValidWindowZoomFactor(factor)) {
        return;
      }

      setWindowZoomFactor(factor);
    });

    return () => {
      isStale = true;
    };
  }, []);
}
