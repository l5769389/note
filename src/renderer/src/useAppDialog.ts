import { useCallback, useEffect, useRef, useState } from "react";

export type AppDialogTone = "info" | "warning" | "danger";

export type AppDialogState = {
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: AppDialogTone;
  type: "alert" | "confirm";
};

export function useAppDialog() {
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const closeAppDialog = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setAppDialog(null);
  }, []);

  const openAppDialog = useCallback((dialog: AppDialogState) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setAppDialog(dialog);
    });
  }, []);

  const showAppAlert = useCallback(
    (dialog: Omit<AppDialogState, "type" | "cancelLabel">) =>
      openAppDialog({
        ...dialog,
        type: "alert",
      }),
    [openAppDialog],
  );

  const showAppConfirm = useCallback(
    (dialog: Omit<AppDialogState, "type">) =>
      openAppDialog({
        ...dialog,
        type: "confirm",
      }),
    [openAppDialog],
  );

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  return {
    appDialog,
    closeAppDialog,
    openAppDialog,
    showAppAlert,
    showAppConfirm,
  };
}
