// Kontrak props Dialog dari komponen desain "Dialog".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { ReactNode } from 'react';

export interface DialogProps {
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
export const dialogDefaults = {
  "size": "sm",
  "title": "Judul dialog"
} as const satisfies Partial<DialogProps>;
