import { ExternalLink, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getDocumentDisplayName } from "../documentModel";
import type { MarkdownDocument } from "../types";

type ExcelRenderState =
  | { status: "loading" }
  | { message: string; status: "error" }
  | {
      activeSheet: string;
      rows: string[][];
      sheetNames: string[];
      status: "ready";
    };

function base64ToArrayBuffer(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function normalizeRows(rows: unknown[][]) {
  return rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) {
        return "";
      }

      return String(cell);
    }),
  );
}

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return [];
  }

  return normalizeRows(
    XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      blankrows: false,
      defval: "",
      header: 1,
      raw: false,
    }),
  );
}

function getColumnName(index: number) {
  let value = index + 1;
  let name = "";

  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }

  return name;
}

export function ExcelDocumentViewer({ document }: { document: MarkdownDocument }) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<ExcelRenderState>({ status: "loading" });
  const title = getDocumentDisplayName(document);

  async function openExternally() {
    if (document.filePath) {
      await window.desktop?.openPath?.(document.filePath);
    }
  }

  useEffect(() => {
    let isDisposed = false;

    async function renderExcelDocument() {
      if (!document.filePath) {
        setState({
          message: "这个 Excel 文件没有可访问的本地路径。",
          status: "error",
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const base64 = await window.desktop?.readExcelDocument?.(document.filePath);

        if (!base64) {
          throw new Error("当前运行环境无法读取 Excel 文件。");
        }

        const workbook = XLSX.read(base64ToArrayBuffer(base64), {
          cellDates: true,
          type: "array",
        });
        const sheetNames = workbook.SheetNames;
        const activeSheet = sheetNames[0] ?? "Sheet1";
        const rows = readSheetRows(workbook, activeSheet);

        if (!isDisposed) {
          setState({
            activeSheet,
            rows,
            sheetNames,
            status: "ready",
          });
        }
      } catch (error) {
        if (!isDisposed) {
          setState({
            message: error instanceof Error ? error.message : "Excel 文件预览失败。",
            status: "error",
          });
        }
      }
    }

    void renderExcelDocument();

    return () => {
      isDisposed = true;
    };
  }, [document.filePath, document.updatedAt, reloadNonce]);

  const columnCount = useMemo(() => {
    if (state.status !== "ready") {
      return 0;
    }

    return Math.max(1, ...state.rows.map((row) => row.length));
  }, [state]);

  function selectSheet(sheetName: string) {
    if (state.status !== "ready" || sheetName === state.activeSheet || !document.filePath) {
      return;
    }

    const filePath = document.filePath;
    setState({ status: "loading" });

    void (async () => {
      try {
        const base64 = await window.desktop?.readExcelDocument?.(filePath);

        if (!base64) {
          throw new Error("当前运行环境无法读取 Excel 文件。");
        }

        const workbook = XLSX.read(base64ToArrayBuffer(base64), {
          cellDates: true,
          type: "array",
        });

        setState({
          activeSheet: sheetName,
          rows: readSheetRows(workbook, sheetName),
          sheetNames: workbook.SheetNames,
          status: "ready",
        });
      } catch (error) {
        setState({
          message: error instanceof Error ? error.message : "Excel 文件预览失败。",
          status: "error",
        });
      }
    })();
  }

  return (
    <section className="excel-document-viewer">
      <header className="readonly-document-header">
        <div>
          <FileSpreadsheet size={17} />
          <strong>{title}</strong>
        </div>
        <div className="readonly-document-actions">
          <button type="button" onClick={() => setReloadNonce((value) => value + 1)}>
            <RefreshCw size={15} />
            重新载入
          </button>
          <button type="button" disabled={!document.filePath} onClick={openExternally}>
            <ExternalLink size={15} />
            在系统应用中打开
          </button>
        </div>
      </header>

      {state.status === "loading" ? (
        <div className="readonly-document-state">
          <RefreshCw className="readonly-document-loading" size={26} />
          <strong>正在读取 Excel 文件</strong>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="readonly-document-state readonly-document-error">
          <FileSpreadsheet size={30} />
          <strong>无法显示 Excel 文件</strong>
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="excel-document-stage">
          <div className="excel-sheet-tabs">
            {state.sheetNames.map((sheetName) => (
              <button
                className={sheetName === state.activeSheet ? "excel-sheet-tab-active" : ""}
                key={sheetName}
                type="button"
                onClick={() => selectSheet(sheetName)}
              >
                {sheetName}
              </button>
            ))}
          </div>

          <div className="excel-table-scroll">
            {state.rows.length ? (
              <table className="excel-preview-table">
                <thead>
                  <tr>
                    <th className="excel-row-index" />
                    {Array.from({ length: columnCount }, (_, index) => (
                      <th key={index}>{getColumnName(index)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <th className="excel-row-index">{rowIndex + 1}</th>
                      {Array.from({ length: columnCount }, (_, cellIndex) => (
                        <td key={cellIndex}>{row[cellIndex] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="readonly-document-state">
                <FileSpreadsheet size={30} />
                <strong>当前工作表为空</strong>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
