// Kontrak props RowActionButton dari komponen desain "RowActionButton".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface RowActionButtonProps {
  /** Action (variant) */
  action?: "edit" | "view" | "delete" | "restore";
  /** Color (variant) */
  color?: "info" | "muted" | "danger" | "default" | "success" | "warning";
  /** Disabled (boolean) */
  disabled?: boolean;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const rowActionButtonDefaults = {
  "action": "view",
  "color": "default",
  "disabled": false
} as const satisfies Partial<RowActionButtonProps>;
