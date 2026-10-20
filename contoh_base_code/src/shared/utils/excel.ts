/** Helper Excel (.xlsx) berbasis SheetJS — dipakai bulk upload & export. */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ExcelCell = string | number | boolean | null;

export interface WorkbookRows {
  headers: string[];
  rows: Record<string, unknown>[];
}

type XlsxModule = typeof import('xlsx');

async function loadXlsx(): Promise<XlsxModule> {
  return import('xlsx');
}

/** Baca sheet pertama workbook menjadi headers + rows (key = header). */
export async function readWorkbookRows(data: ArrayBuffer): Promise<WorkbookRows> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<ExcelCell[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim());
  const rows = matrix.slice(1).map((cells) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

/** Susun workbook satu sheet dari headers + matriks rows. */
export async function buildWorkbook(headers: string[], rows: ExcelCell[][]): Promise<ArrayBuffer> {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header, index) => ({
    wch: Math.max(
      header.length,
      ...rows.map((row) => String(row[index] ?? '').length),
      10,
    ),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return output as ArrayBuffer;
}

/** Unduh Blob sebagai file (browser only). */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') {
    throw new Error('downloadBlob is only available in the browser.');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Unduh ArrayBuffer sebagai file (browser only). */
export function downloadArrayBuffer(data: ArrayBuffer, filename: string, mime: string): void {
  downloadBlob(new Blob([data], { type: mime }), filename);
}

/** Susun workbook lalu unduh langsung (browser only). */
export async function downloadWorkbook(
  headers: string[],
  rows: ExcelCell[][],
  filename: string,
): Promise<void> {
  const data = await buildWorkbook(headers, rows);
  downloadArrayBuffer(data, filename, XLSX_MIME);
}
