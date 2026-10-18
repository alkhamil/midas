// Kontrak props Badge dari komponen desain "Badge".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface BadgeProps {
  /** Variant (variant) */
  variant?: "info" | "danger" | "neutral" | "success" | "warning";
  /** Label (text) */
  children?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const badgeDefaults = {
  "variant": "success",
  "children": "Badge"
} as const satisfies Partial<BadgeProps>;
