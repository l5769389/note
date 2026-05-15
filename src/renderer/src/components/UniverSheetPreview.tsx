import { Pencil, Table2 } from "lucide-react";
import {
  createUniverSheetPreviewRows,
  parseUniverSheetData,
} from "../univerSheetDocument";

type UniverSheetPreviewProps = {
  code: string;
  onEdit?: (code: string) => void;
};

export function UniverSheetPreview({ code, onEdit }: UniverSheetPreviewProps) {
  try {
    const data = parseUniverSheetData(code);
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Univer sheet render failed";

    return (
      <figure className="univer-sheet-preview univer-sheet-preview-error">
        <figcaption>在线表格无法渲染</figcaption>
        <pre>{message}</pre>
      </figure>
    );
  }
}
