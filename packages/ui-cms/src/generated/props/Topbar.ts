// Kontrak props Topbar dari komponen desain "Topbar".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface TopbarProps {
  /** Title (text) */
  title?: string;
  /** Breadcrumb (text) */
  breadcrumb?: string;
  /** UserName (text) */
  userName?: string;
  /** UserRole (text) */
  userRole?: string;
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const topbarDefaults = {
  "title": "Judul halaman",
  "breadcrumb": "Beranda / Halaman",
  "userName": "Administrator",
  "userRole": "admin"
} as const satisfies Partial<TopbarProps>;
