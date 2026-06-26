import {
  BookOpenText,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  PenLine,
  Table2,
} from "lucide-react";
import type { ComponentProps } from "react";
import { getDocumentTypeFromPath } from "../documentModel";
import type { DocumentType } from "../types";

type IconProps = ComponentProps<typeof FileText>;

const documentTypeIconMap: Record<DocumentType, typeof FileText> = {
  drawing: PenLine,
  excel: FileSpreadsheet,
  html: FileCode2,
  markdown: FileText,
  pdf: FileType2,
  sheet: Table2,
  word: BookOpenText,
};

const documentTypeLabelMap: Record<DocumentType, string> = {
  drawing: "Excalidraw",
  excel: "Excel",
  html: "HTML",
  markdown: "Markdown",
  pdf: "PDF",
  sheet: "在线表格",
  word: "Word",
};

export function DocumentFileIcon({
  filePath,
  ...props
}: IconProps & { filePath?: string }) {
  const documentType = getDocumentTypeFromPath(filePath);
  const Icon = documentTypeIconMap[documentType] ?? FileText;

  return (
    <Icon
      aria-label={documentTypeLabelMap[documentType]}
      className={`document-file-icon document-file-icon-${documentType}`}
      {...props}
    />
  );
}
