export const tableClipboardMimeType = "application/x-notedock-table+json";

export type TableClipboardPayload = {
  cells: string[][];
  version: 1;
};

function normalizeTableClipboardCells(cells: unknown): string[][] | null {
  if (!Array.isArray(cells) || cells.length === 0) {
    return null;
  }

  const rows = cells.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => (typeof cell === "string" ? cell : String(cell ?? "")))
      : [],
  );
  const width = Math.max(...rows.map((row) => row.length));

  if (width === 0) {
    return null;
  }

  return rows.map((row) => [
    ...row,
    ...Array.from({ length: width - row.length }, () => ""),
  ]);
}

export function createTableClipboardPayload(
  cells: string[][],
): TableClipboardPayload | null {
  const normalizedCells = normalizeTableClipboardCells(cells);

  return normalizedCells
    ? { cells: normalizedCells, version: 1 }
    : null;
}

export function parseTableClipboardPayload(
  value: string | null | undefined,
): TableClipboardPayload | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const payload = JSON.parse(value) as Partial<TableClipboardPayload>;

    if (payload.version !== 1) {
      return null;
    }

    return createTableClipboardPayload(payload.cells ?? []);
  } catch {
    return null;
  }
}

function normalizeTableClipboardTextCell(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[\t\n]+/g, " ");
}

export function tableClipboardPayloadToText(payload: TableClipboardPayload) {
  return payload.cells
    .map((row) => row.map(normalizeTableClipboardTextCell).join("\t"))
    .join("\n");
}

export function serializeTableClipboardPayload(payload: TableClipboardPayload) {
  return JSON.stringify(payload);
}
