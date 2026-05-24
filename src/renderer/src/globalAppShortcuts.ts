import { useEffect, useRef, type RefObject } from "react";
import {
  getAppShortcutAction,
  getSelectAllContentScope,
  getSelectAllShortcutScope,
  isSelectAllShortcut,
  type AppShortcutAction,
} from "./editorShortcuts";

export function isAlwaysAvailableAppShortcutAction(action: AppShortcutAction) {
  return (
    action.type === "view" &&
    (action.command === "toggleFullScreen" ||
      action.command === "exitFullScreen" ||
      action.command === "resetZoom" ||
      action.command === "zoomIn" ||
      action.command === "zoomOut")
  );
}

export function shouldBlockAppShortcutAction({
  action,
  isCreateFileOpen,
  isSettingsOpen,
  shouldIgnoreTarget,
}: {
  action: AppShortcutAction;
  isCreateFileOpen: boolean;
  isSettingsOpen: boolean;
  shouldIgnoreTarget: boolean;
}) {
  return (
    !isAlwaysAvailableAppShortcutAction(action) &&
    (isCreateFileOpen || isSettingsOpen || shouldIgnoreTarget)
  );
}

export function shouldIgnoreAppShortcutTarget(
  target: EventTarget | null,
  editorElement: HTMLTextAreaElement | null,
) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return target !== editorElement;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    return true;
  }

  return Boolean(
    target.closest("[contenteditable='true']") && !target.closest(".ProseMirror"),
  );
}

export function isEditorShortcutTarget(
  target: EventTarget | null,
  editorElement: HTMLTextAreaElement | null,
) {
  return (
    target instanceof Element &&
    (target === editorElement || Boolean(target.closest(".ProseMirror")))
  );
}

export function selectContentScopeContents(scope: Element) {
  const ownerDocument = scope.ownerDocument;
  const selection = ownerDocument.getSelection();

  if (!selection) {
    return;
  }

  const range = ownerDocument.createRange();
  range.selectNodeContents(scope);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function handleScopedSelectAllShortcut({
  event,
  isCreateFileOpen,
  isSettingsOpen,
}: {
  event: KeyboardEvent;
  isCreateFileOpen: boolean;
  isSettingsOpen: boolean;
}) {
  if (!isSelectAllShortcut(event)) {
    return false;
  }

  const scope = getSelectAllShortcutScope(event.target);

  if (scope === "input") {
    return false;
  }

  event.preventDefault();

  if (scope !== "content" || isCreateFileOpen || isSettingsOpen) {
    return true;
  }

  const contentScope = getSelectAllContentScope(event.target);

  if (contentScope) {
    selectContentScopeContents(contentScope);
  }

  return true;
}

export function useGlobalAppShortcuts({
  editorRef,
  isCreateFileOpen,
  isFullScreen,
  isSettingsOpen,
  onAction,
}: {
  editorRef: RefObject<HTMLTextAreaElement>;
  isCreateFileOpen: boolean;
  isFullScreen: boolean;
  isSettingsOpen: boolean;
  onAction: (action: AppShortcutAction) => void;
}) {
  const stateRef = useRef({
    isCreateFileOpen,
    isFullScreen,
    isSettingsOpen,
    onAction,
  });

  useEffect(() => {
    stateRef.current = {
      isCreateFileOpen,
      isFullScreen,
      isSettingsOpen,
      onAction,
    };
  }, [isCreateFileOpen, isFullScreen, isSettingsOpen, onAction]);

  useEffect(() => {
    function handleGlobalAppShortcut(event: KeyboardEvent) {
      const {
        isCreateFileOpen: currentCreateFileOpen,
        isFullScreen: currentFullScreen,
        isSettingsOpen: currentSettingsOpen,
        onAction: currentOnAction,
      } = stateRef.current;

      if (
        handleScopedSelectAllShortcut({
          event,
          isCreateFileOpen: currentCreateFileOpen,
          isSettingsOpen: currentSettingsOpen,
        })
      ) {
        return;
      }

      const editorElement = editorRef.current;
      const action = getAppShortcutAction(event, {
        isEditorTarget: isEditorShortcutTarget(event.target, editorElement),
        isFullScreen: currentFullScreen,
      });

      if (!action) {
        return;
      }

      if (
        shouldBlockAppShortcutAction({
          action,
          isCreateFileOpen: currentCreateFileOpen,
          isSettingsOpen: currentSettingsOpen,
          shouldIgnoreTarget: shouldIgnoreAppShortcutTarget(
            event.target,
            editorElement,
          ),
        })
      ) {
        return;
      }

      event.preventDefault();
      currentOnAction(action);
    }

    window.addEventListener("keydown", handleGlobalAppShortcut, true);

    return () => {
      window.removeEventListener("keydown", handleGlobalAppShortcut, true);
    };
  }, [editorRef]);
}
