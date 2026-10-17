// Kontrak props TextAreaField dari komponen desain "TextAreaField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TextAreaFieldProps {
  /** Size (variant) */
  size?: "lg" | "md" | "sm";
  /** Placeholder (text) */
  placeholder?: string;
  /** Error (text) */
  error?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const textAreaFieldDefaults = {
  "size": "sm",
  "placeholder": "Ketik di sini…",
  "error": ""
} as const satisfies Partial<TextAreaFieldProps>;
