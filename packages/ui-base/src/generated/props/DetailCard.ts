// Kontrak props DetailCard dari komponen desain "DetailCard".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface DetailCardProps {
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const detailCardDefaults = {} as const satisfies Partial<DetailCardProps>;
