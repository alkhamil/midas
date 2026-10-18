// Token tema dari Variables design system.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  /** Aksi utama, link, fokus, elemen aktif */
  primary: string;
  /** Teks/ikon di atas primary */
  primaryForeground: string;
  /** Aksi & status netral */
  secondary: string;
  /** Teks/ikon di atas secondary */
  secondaryForeground: string;
  /** Berhasil, aktif */
  success: string;
  /** Perlu perhatian */
  warning: string;
  /** Hapus, gagal, error */
  danger: string;
  /** Informasi */
  info: string;
  /** Latar kartu, dialog, input */
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
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  pagePadding: string;
  pagePaddingLg: string;
  cardPaddingX: string;
  cardPaddingY: string;
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
    primary: "#0058CA",
    primaryForeground: "#FFFFFF",
    secondary: "#475569",
    secondaryForeground: "#FFFFFF",
    success: "#15803D",
    warning: "#B45309",
    danger: "#C62828",
    info: "#0369A1",
    background: "#FFFFFF",
    surface: "#F5F7FA",
    muted: "#E9EDF3",
    border: "#D5DCE5",
    foreground: "#0F172A",
    mutedForeground: "#5B6677",
    radiusSm: "4px",
    radiusMd: "6px",
    radiusLg: "8px",
    radiusXl: "12px",
    pagePadding: "16px",
    pagePaddingLg: "24px",
    cardPaddingX: "20px",
    cardPaddingY: "16px",
    sectionGap: "24px",
    stackGap: "16px",
    fieldGap: "12px",
    fontFamily: "Inter",
  },
  "dark": {
    primary: "#5B9BF5",
    primaryForeground: "#0B1220",
    secondary: "#94A3B8",
    secondaryForeground: "#0B1220",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    info: "#38BDF8",
    background: "#0B1220",
    surface: "#111A2B",
    muted: "#1E293B",
    border: "#2B384C",
    foreground: "#E6EBF2",
    mutedForeground: "#9AA6B8",
    radiusSm: "4px",
    radiusMd: "6px",
    radiusLg: "8px",
    radiusXl: "12px",
    pagePadding: "16px",
    pagePaddingLg: "24px",
    cardPaddingX: "20px",
    cardPaddingY: "16px",
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
