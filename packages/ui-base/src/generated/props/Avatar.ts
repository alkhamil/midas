// Kontrak props Avatar dari komponen desain "Avatar".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface AvatarProps {
  /** Size (variant) */
  size?: "lg" | "md" | "sm";
  /** Initial (text) */
  initial?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const avatarDefaults = {
  "size": "sm",
  "initial": "A"
} as const satisfies Partial<AvatarProps>;
