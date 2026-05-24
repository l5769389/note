import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export const quickDocumentLinkShortcut = "Ctrl+Alt+L";

export function isQuickDocumentLinkShortcut(
  event: Pick<
    KeyboardEvent | ReactKeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
  > & {
    isComposing?: boolean;
    nativeEvent?: { isComposing?: boolean };
  },
) {
  return (
    !event.isComposing &&
    !event.nativeEvent?.isComposing &&
    (event.ctrlKey || event.metaKey) &&
    event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "l"
  );
}
