// Kontrak props Table dari komponen desain "Table".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TableProps {
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const tableDefaults = {} as const satisfies Partial<TableProps>;
