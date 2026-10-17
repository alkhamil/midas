// Kontrak props Sidebar dari komponen desain "Sidebar".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface SidebarProps {
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const sidebarDefaults = {} as const satisfies Partial<SidebarProps>;
