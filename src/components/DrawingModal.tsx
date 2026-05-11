import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { Excalidraw, exportToBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import { fileToDataUrl } from "../services/imageUpload";
import type { DrawingAsset } from "../types";

type ExcalidrawApi = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
};

type DrawingModalProps = {
  assetIndex: number;
  onClose: () => void;
  onInsert: (asset: DrawingAsset) => void;
};

const now = () => new Date().toISOString();

export function DrawingModal({
  assetIndex,
  onClose,
  onInsert,
}: DrawingModalProps) {
  const [isExportingDrawing, setIsExportingDrawing] = useState(false);
  const excalidrawApiRef = useRef<ExcalidrawApi | null>(null);

  async function saveDrawing() {
    const api = excalidrawApiRef.current;

    if (!api) {
      return;
    }

    const elements = api.getSceneElements();

    if (!elements.length) {
      onClose();
      return;
    }

    try {
      setIsExportingDrawing(true);
      const appState = api.getAppState();
      const files = api.getFiles();
      const blob = await exportToBlob({
        elements: elements as never,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
        } as never,
        files: files as never,
        mimeType: "image/png",
        exportPadding: 24,
      });
      const dataUrl = await fileToDataUrl(
        new File([blob], "excalidraw-flow.png", { type: "image/png" }),
      );
      const asset: DrawingAsset = {
        id: crypto.randomUUID(),
        name: `流程图 ${assetIndex}`,
        dataUrl,
        sceneJSON: serializeAsJSON(
          elements as never,
          appState as never,
          files as never,
          "local",
        ),
        createdAt: now(),
      };

      onInsert(asset);
      onClose();
    } finally {
      setIsExportingDrawing(false);
    }
  }

  return (
    <section className="drawing-modal">
      <header className="drawing-toolbar">
        <strong>Excalidraw 流程图</strong>
        <div>
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} />
            关闭
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void saveDrawing()}
            disabled={isExportingDrawing}
          >
            <Check size={16} />
            {isExportingDrawing ? "插入中" : "插入文档"}
          </button>
        </div>
      </header>
      <div className="drawing-surface">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api as ExcalidrawApi;
          }}
          initialData={{
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: 1,
            },
          }}
        />
      </div>
    </section>
  );
}
