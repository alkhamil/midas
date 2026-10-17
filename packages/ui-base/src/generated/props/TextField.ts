// Kontrak props TextField dari komponen desain "TextField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TextFieldProps {
  /** Size (variant) */
  size?: "lg" | "md" | "sm";
  /** Placeholder (text) */
  placeholder?: string;
  /** Disabled (boolean) */
  disabled?: boolean;
  /** Error (text) */
  error?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const textFieldDefaults = {
  "size": "sm",
  "placeholder": "Ketik di sini…",
  "disabled": false,
  "error": ""
} as const satisfies Partial<TextFieldProps>;
