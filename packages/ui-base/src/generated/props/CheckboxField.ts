// Kontrak props CheckboxField dari komponen desain "CheckboxField".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface CheckboxFieldProps {
  /** Size (variant) */
  size?: "lg" | "md" | "sm";
  /** Checkbox Label (text) */
  checkboxLabel?: string;
  /** Disabled (boolean) */
  disabled?: boolean;
  /** Indeterminate (boolean) */
  indeterminate?: boolean;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const checkboxFieldDefaults = {
  "size": "sm",
  "checkboxLabel": "Setuju",
  "disabled": false,
  "indeterminate": false
} as const satisfies Partial<CheckboxFieldProps>;
