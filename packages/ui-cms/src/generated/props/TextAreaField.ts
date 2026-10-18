// Kontrak props TextAreaField dari komponen desain "TextAreaField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TextAreaFieldProps {
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
export const textAreaFieldDefaults = {
  "label": "Catatan",
  "placeholder": "Ketik di sini…",
  "disabled": false
} as const satisfies Partial<TextAreaFieldProps>;
