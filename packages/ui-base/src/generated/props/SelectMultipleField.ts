// Kontrak props SelectMultipleField dari komponen desain "SelectMultipleField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface SelectMultipleFieldProps {
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
export const selectMultipleFieldDefaults = {
  "size": "sm",
  "placeholder": "Pilih…",
  "disabled": false,
  "error": ""
} as const satisfies Partial<SelectMultipleFieldProps>;
