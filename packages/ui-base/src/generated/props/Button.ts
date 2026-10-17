// Kontrak props Button dari komponen desain "Button".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { ReactNode } from 'react';

export interface ButtonProps {
  /** Variant (variant) */
  variant?: "danger" | "primary" | "secondary";
  /** Size (variant) */
  size?: "lg" | "md" | "sm";
  /** Label (text) */
  children?: string;
  /** Disabled (boolean) */
  disabled?: boolean;
  /** Icon (instance) */
  icon?: ReactNode;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const buttonDefaults = {
  "variant": "primary",
  "size": "sm",
  "children": "Button",
  "disabled": false
} as const satisfies Partial<ButtonProps>;
