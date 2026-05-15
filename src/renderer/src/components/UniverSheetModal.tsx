import "@univerjs/preset-sheets-core/lib/index.css";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createUniver,
  defaultTheme,
  LocaleType,
  type IWorkbookData,
} from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import zhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import type { UniverSheetData } from "../univerSheetDocument";

type UniverSheetModalProps = {
  initialData: UniverSheetData;
  onClose: () => void;
  onSave: (data: UniverSheetData) => void;
};

type WorkbookFacade = {
  save: () => IWorkbookData;
};

export function UniverSheetModal({
  initialData,
  onClose,
  onSave,
}: UniverSheetModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workbookRef = useRef<WorkbookFacade | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(initialData.title || initialData.workbook.name);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    setError("");

    const editorHost = document.createElement("div");

    try {
      editorHost.className = "univer-sheet-editor-inner-host";
      container.append(editorHost);

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: zhCN,
        },
        presets: [
          UniverSheetsCorePreset({
            container: editorHost,
            footer: {},
            formulaBar: true,
            header: false,
            toolbar: true,
          }),
        ],
        theme: defaultTheme,
      });

      workbookRef.current = univerAPI.createWorkbook(initialData.workbook);

      return () => {
        workbookRef.current = null;
        window.setTimeout(() => {
          univer.dispose();
          editorHost.remove();
        }, 0);
      };
    } catch (nextError) {
      editorHost.remove();
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Univer sheet editor failed to start.",
      );
      return undefined;
    }
  }, [initialData.workbook]);

  function saveSheet() {
    const workbook = workbookRef.current;

    if (!workbook) {
      setError("表格尚未初始化完成。");
      return;
    }

    try {
      const nextTitle = title.trim() || "在线表格";
      const nextWorkbook = {
        ...workbook.save(),
        name: nextTitle,
      };

      onSave({
        title: nextTitle,
        version: 1,
        workbook: nextWorkbook,
      });
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "保存在线表格时出现问题。",
      );
    }
  }

  return (
    <section className="univer-sheet-modal">
      <header className="drawing-toolbar univer-sheet-modal-toolbar">
        <label className="univer-sheet-title-field">
          <span>在线表格</span>
          <input
            value={title}
            aria-label="表格标题"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div>
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} />
            关闭
          </button>
          <button className="primary-button" type="button" onClick={saveSheet}>
            <Check size={16} />
            保存
          </button>
        </div>
      </header>
      {error && <div className="univer-sheet-modal-error">{error}</div>}
      <div className="univer-sheet-editor-host" ref={containerRef} />
    </section>
  );
}
