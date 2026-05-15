import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { Excalidraw, exportToBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import type { LibraryItems, LibraryItemsSource } from "@excalidraw/excalidraw/types";
import { getBundledExcalidrawLibraryItems } from "../excalidrawLibraries";
import { fileToDataUrl } from "../services/imageUpload";
import type { DrawingAsset } from "../types";

type ExcalidrawApi = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  updateLibrary: (options: {
    defaultStatus?: "published" | "unpublished";
    libraryItems: LibraryItemsSource;
    merge?: boolean;
    openLibraryMenu?: boolean;
    prompt?: boolean;
  }) => Promise<LibraryItems>;
};

type DrawingModalProps = {
  assetIndex: number;
  initialAsset?: DrawingAsset;
  onClose: () => void;
  onInsert: (asset: DrawingAsset) => void;
};

const now = () => new Date().toISOString();

function getInitialDrawingData(asset?: DrawingAsset) {
  const fallback = {
    appState: {
      viewBackgroundColor: "#ffffff",
      currentItemFontFamily: 1,
    },
    libraryItems: getBundledExcalidrawLibraryItems(),
  };

  if (!asset?.sceneJSON) {
    return fallback;
  }

  try {
    const scene = JSON.parse(asset.sceneJSON) as {
      appState?: Record<string, unknown>;
      elements?: readonly unknown[];
      files?: Record<string, unknown>;
    };

    return {
      ...scene,
      appState: {
        ...scene.appState,
        viewBackgroundColor: "#ffffff",
        currentItemFontFamily: 1,
      },
      libraryItems: getBundledExcalidrawLibraryItems(),
    };
  } catch {
    return fallback;
  }
}

export function DrawingModal({
  assetIndex,
  initialAsset,
  onClose,
  onInsert,
}: DrawingModalProps) {
  const [isExportingDrawing, setIsExportingDrawing] = useState(false);
  const excalidrawApiRef = useRef<ExcalidrawApi | null>(null);
  const libraryLoadedRef = useRef(false);

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
        id: initialAsset?.id ?? crypto.randomUUID(),
        name: initialAsset?.name ?? `Excalidraw ${assetIndex}`,
        dataUrl,
        sceneJSON: serializeAsJSON(
          elements as never,
          appState as never,
          files as never,
          "local",
        ),
        createdAt: initialAsset?.createdAt ?? now(),
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
            {isExportingDrawing ? "保存中" : initialAsset ? "保存" : "插入"}
          </button>
        </div>
      </header>
      <div className="drawing-surface">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api as ExcalidrawApi;
            if (!libraryLoadedRef.current) {
              libraryLoadedRef.current = true;
              void (api as ExcalidrawApi).updateLibrary({
                libraryItems: getBundledExcalidrawLibraryItems(),
                merge: true,
                prompt: false,
                openLibraryMenu: false,
                defaultStatus: "published",
              });
            }
          }}
          initialData={getInitialDrawingData(initialAsset)}
        />
      </div>
    </section>
  );
}
