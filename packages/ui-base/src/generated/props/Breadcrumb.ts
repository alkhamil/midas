// Kontrak props Breadcrumb dari komponen desain "Breadcrumb".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface BreadcrumbProps {
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const breadcrumbDefaults = {} as const satisfies Partial<BreadcrumbProps>;
