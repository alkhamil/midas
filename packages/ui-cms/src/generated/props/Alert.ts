// Kontrak props Alert dari komponen desain "Alert".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface AlertProps {
  /** Variant (variant) */
  variant?: "info" | "danger" | "success" | "warning";
  /** Message (text) */
  message?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const alertDefaults = {
  "variant": "success",
  "message": "Pesan untuk pengguna"
} as const satisfies Partial<AlertProps>;
