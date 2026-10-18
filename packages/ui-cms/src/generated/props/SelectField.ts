// Kontrak props SelectField dari komponen desain "SelectField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface SelectFieldProps {
  /** Label (text) */
  label?: string;
  /** Placeholder (text) */
  placeholder?: string;
  /** Disabled (boolean) */
  disabled?: boolean;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const selectFieldDefaults = {
  "label": "Role",
  "placeholder": "Pilih…",
  "disabled": false
} as const satisfies Partial<SelectFieldProps>;
