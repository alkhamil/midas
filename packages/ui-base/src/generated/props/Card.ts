// Kontrak props Card dari komponen desain "Card".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { ReactNode } from 'react';

export interface CardProps {
  /** Size (variant) */
  size?: "md" | "sm";
  /** Title (text) */
  title?: string;
  /** Content (slot) */
  children?: ReactNode;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const cardDefaults = {
  "size": "sm",
  "title": "Judul card"
} as const satisfies Partial<CardProps>;
