// Token tema dari Variables design system.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  /** Aksi utama, link, fokus, item menu aktif */
  primary: string;
  /** Teks/ikon di atas primary */
  primaryForeground: string;
  /** Berhasil, aktif */
  success: string;
  /** Perlu perhatian */
  warning: string;
  /** Hapus, gagal, error */
  danger: string;
  /** Informasi */
  info: string;
  /** Latar card, dialog, input */
  background: string;
  /** Latar halaman */
  surface: string;
  /** Latar hover, header tabel, chip */
  muted: string;
  /** Garis & pembatas */
  border: string;
  /** Teks utama */
  foreground: string;
  /** Teks sekunder, placeholder */
  mutedForeground: string;
  /** Latar sidebar */
  sidebar: string;
  /** Teks & ikon menu di sidebar */
  sidebarForeground: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  pagePadding: string;
  cardPadding: string;
  sectionGap: string;
  stackGap: string;
  fieldGap: string;
  /** Font utama UI */
  fontFamily: string;
}

export const themeNames: ThemeName[] = ["light", "dark"];
export const defaultTheme: ThemeName = "light";

export const themes: Record<ThemeName, Partial<ThemeTokens>> = {
  "light": {
    primary: "#4338CA",
    primaryForeground: "#FFFFFF",
    success: "#15803D",
    warning: "#B45309",
    danger: "#B91C1C",
    info: "#0369A1",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    muted: "#F1F5F9",
    border: "#E2E8F0",
    foreground: "#0F172A",
    mutedForeground: "#64748B",
    sidebar: "#0F172A",
    sidebarForeground: "#CBD5E1",
    radiusSm: "4px",
    radiusMd: "6px",
    radiusLg: "8px",
    radiusXl: "12px",
    pagePadding: "24px",
    cardPadding: "20px",
    sectionGap: "24px",
    stackGap: "16px",
    fieldGap: "12px",
    fontFamily: "Inter",
  },
  "dark": {
    primary: "#818CF8",
    primaryForeground: "#0B1020",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    info: "#38BDF8",
    background: "#0F172A",
    surface: "#0B1220",
    muted: "#1E293B",
    border: "#334155",
    foreground: "#F1F5F9",
    mutedForeground: "#94A3B8",
    sidebar: "#020617",
    sidebarForeground: "#CBD5E1",
    radiusSm: "4px",
    radiusMd: "6px",
    radiusLg: "8px",
    radiusXl: "12px",
    pagePadding: "24px",
    cardPadding: "20px",
    sectionGap: "24px",
    stackGap: "16px",
    fieldGap: "12px",
    fontFamily: "Inter",
  },
};

/** `primaryForeground` → `--theme-primary-foreground` */
export function toVarName(key: string): string {
  return `--theme-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Terapkan tema ke dokumen: set `data-theme` + CSS variables. */
export function applyTheme(name: ThemeName, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = name;
  for (const [key, value] of Object.entries(themes[name] ?? {}) as [string, string | undefined][]) {
    if (value !== undefined) root.style.setProperty(toVarName(key), value);
  }
}
