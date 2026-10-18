// Kontrak props SwitchField dari komponen desain "SwitchField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface SwitchFieldProps {
  /** Label (text) */
  label?: string;
  /** Disabled (boolean) */
  disabled?: boolean;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const switchFieldDefaults = {
  "label": "Aktif",
  "disabled": false
} as const satisfies Partial<SwitchFieldProps>;
