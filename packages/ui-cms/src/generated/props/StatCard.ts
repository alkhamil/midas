// Kontrak props StatCard dari komponen desain "StatCard".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface StatCardProps {
  /** Trend (variant) */
  trend?: "up" | "down" | "neutral";
  /** Label (text) */
  label?: string;
  /** Value (text) */
  value?: string;
  /** Caption (text) */
  caption?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const statCardDefaults = {
  "trend": "up",
  "label": "Total user",
  "value": "1.248",
  "caption": "12% dari bulan lalu"
} as const satisfies Partial<StatCardProps>;
