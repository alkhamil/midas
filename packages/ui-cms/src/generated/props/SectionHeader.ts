// Kontrak props SectionHeader dari komponen desain "SectionHeader".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface SectionHeaderProps {
  /** Action (variant) */
  action?: "none" | "primary" | "secondary";
  /** Title (text) */
  title?: string;
  /** Description (text) */
  description?: string;
  /** ActionLabel (text) */
  actionLabel?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const sectionHeaderDefaults = {
  "action": "primary",
  "title": "Judul bagian",
  "description": "Keterangan singkat bagian ini",
  "actionLabel": "Tambah"
} as const satisfies Partial<SectionHeaderProps>;
