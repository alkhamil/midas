// Kontrak props PageHeader dari komponen desain "PageHeader".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Title (text) */
  title?: string;
  /** Actions (slot) */
  children?: ReactNode;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const pageHeaderDefaults = {
  "title": "Judul halaman"
} as const satisfies Partial<PageHeaderProps>;
