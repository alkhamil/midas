// Kontrak props Tooltip dari komponen desain "Tooltip".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { ReactNode } from 'react';

export interface TooltipProps {
  /** Placement (variant) */
  placement?: "top" | "bottom";
  /** Content (text) */
  content?: string;
  /** Trigger (slot) */
  children?: ReactNode;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const tooltipDefaults = {
  "placement": "top",
  "content": "Keterangan"
} as const satisfies Partial<TooltipProps>;
