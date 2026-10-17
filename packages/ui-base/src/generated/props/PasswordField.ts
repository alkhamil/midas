// Kontrak props PasswordField dari komponen desain "PasswordField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface PasswordFieldProps {
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
export const passwordFieldDefaults = {
  "size": "sm",
  "placeholder": "Ketik di sini…",
  "error": ""
} as const satisfies Partial<PasswordFieldProps>;
