import { Pencil, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createUniverSheetPreviewRows,
  parseUniverSheetAssetReference,
  parseUniverSheetData,
  type UniverSheetData,
} from "../univerSheetDocument";

type UniverSheetPreviewProps = {
  code: string;
  filePath?: string;
  onEdit?: (code: string) => void;
};

type PreviewState =
  | { status: "error"; message: string }
  | { status: "loading" }
  | { status: "ready"; data: UniverSheetData };

const assetPreviewCache = new Map<string, PreviewState>();
const maxAssetPreviewCacheSize = 24;

function createAssetPreviewCacheKey(
  filePath: string,
  assetPath: string,
  code: string,
) {
  return `${filePath}\0${assetPath}\0${code}`;
}

function parseInlinePreviewData(code: string): PreviewState {
  try {
    return { status: "ready", data: parseUniverSheetData(code) };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Univer sheet render failed",
    };
  }
}

function rememberAssetPreviewState(cacheKey: string, state: PreviewState) {
  assetPreviewCache.delete(cacheKey);
  assetPreviewCache.set(cacheKey, state);

  while (assetPreviewCache.size > maxAssetPreviewCacheSize) {
    const oldestKey = assetPreviewCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    assetPreviewCache.delete(oldestKey);
  }
}

export function UniverSheetPreview({
  code,
  filePath,
  onEdit,
}: UniverSheetPreviewProps) {
  const assetReference = useMemo(
    () => parseUniverSheetAssetReference(code),
    [code],
  );
  const assetCacheKey = useMemo(
    () =>
      assetReference && filePath
        ? createAssetPreviewCacheKey(filePath, assetReference.assetPath, code)
        : null,
    [assetReference, code, filePath],
  );
  const [state, setState] = useState<PreviewState>(() =>
    assetCacheKey
      ? assetPreviewCache.get(assetCacheKey) ?? { status: "loading" }
      : assetReference
        ? { status: "loading" }
        : parseInlinePreviewData(code),
  );

  useEffect(() => {
    let cancelled = false;

    if (!assetReference) {
      setState(parseInlinePreviewData(code));
      return () => {
        cancelled = true;
      };
    }

    if (assetCacheKey) {
      const cachedState = assetPreviewCache.get(assetCacheKey);

      if (cachedState) {
        setState(cachedState);
        return () => {
          cancelled = true;
        };
      }
    }

    if (!filePath || !window.desktop?.readTextAsset) {
      setState({
        status: "error",
        message: "无法读取在线表格附件。",
      });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: "loading" });
    void window.desktop
      .readTextAsset({
        documentFilePath: filePath,
        reference: assetReference.assetPath,
      })
      .then((source) => {
        if (!cancelled) {
          const nextState = parseInlinePreviewData(source);

          if (assetCacheKey) {
            rememberAssetPreviewState(assetCacheKey, nextState);
          }

          setState(nextState);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Univer sheet asset failed to load.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetCacheKey, assetReference, code, filePath]);

  if (state.status === "loading") {
    return (
      <figure className="univer-sheet-preview">
        <figcaption className="univer-sheet-preview-header">
          <span>
            <Table2 size={16} />
            {assetReference?.title || "在线表格"}
          </span>
        </figcaption>
        <div className="univer-sheet-preview-loading">正在加载表格附件...</div>
      </figure>
    );
  }

  if (state.status === "error") {
    return (
      <figure className="univer-sheet-preview univer-sheet-preview-error">
        <figcaption>在线表格无法渲染</figcaption>
        <pre>{state.message}</pre>
      </figure>
    );
  }

  const data = state.data;
  const rows = createUniverSheetPreviewRows(data);

  return (
    <figure className="univer-sheet-preview">
      <figcaption className="univer-sheet-preview-header">
        <span>
          <Table2 size={16} />
          {data.title || "在线表格"}
        </span>
        {onEdit && (
          <button type="button" onClick={() => onEdit(code)}>
            <Pencil size={14} />
            编辑
          </button>
        )}
      </figcaption>
      <div className="univer-sheet-preview-table-wrap">
        <table>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`}>{cell.text}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
