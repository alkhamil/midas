// Kontrak props PasswordField dari komponen desain "PasswordField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface PasswordFieldProps {
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
export const passwordFieldDefaults = {
  "label": "Kata sandi",
  "placeholder": "Ketik di sini…",
  "disabled": false
} as const satisfies Partial<PasswordFieldProps>;
