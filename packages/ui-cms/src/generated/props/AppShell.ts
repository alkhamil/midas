// Kontrak props AppShell dari komponen desain "AppShell".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export interface AppShellProps {
  /** `data-testid` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const appShellDefaults = {} as const satisfies Partial<AppShellProps>;
