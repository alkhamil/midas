// Kontrak props IconButton dari komponen desain "IconButton".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface IconButtonProps {
  /** Action (variant) */
  action?: "edit" | "view" | "delete";
  /** Disabled (boolean) */
  disabled?: boolean;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const iconButtonDefaults = {
  "action": "view",
  "disabled": false
} as const satisfies Partial<IconButtonProps>;
