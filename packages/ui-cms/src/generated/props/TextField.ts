// Kontrak props TextField dari komponen desain "TextField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TextFieldProps {
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
export const textFieldDefaults = {
  "label": "Nama lengkap",
  "placeholder": "Ketik di sini…",
  "disabled": false
} as const satisfies Partial<TextFieldProps>;
