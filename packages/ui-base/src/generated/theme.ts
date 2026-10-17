// Token tema dari Variables design system.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.

export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  muted: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  pagePadding: string;
  pagePaddingLg: string;
  cardPaddingX: string;
  cardPaddingY: string;
  sectionGap: string;
  stackGap: string;
  fieldGap: string;
}

export const themeNames: ThemeName[] = ["light", "dark"];
export const defaultTheme: ThemeName = "light";

export const themes: Record<ThemeName, Partial<ThemeTokens>> = {
  "light": {
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    secondary: "#0f766e",
    secondaryForeground: "#ffffff",
    success: "#15803d",
    warning: "#b45309",
    danger: "#dc2626",
    info: "#0284c7",
    background: "#ffffff",
    surface: "#f1f5f9",
    muted: "#e2e8f0",
    border: "#cbd5e1",
    foreground: "#0f172a",
    mutedForeground: "#64748b",
    radiusSm: "2px",
    radiusMd: "4px",
    radiusLg: "8px",
    pagePadding: "16px",
    pagePaddingLg: "24px",
    cardPaddingX: "20px",
    cardPaddingY: "16px",
    sectionGap: "24px",
    stackGap: "16px",
    fieldGap: "12px",
  },
  "dark": {
    primary: "#3b82f6",
    primaryForeground: "#0f172a",
    secondary: "#2dd4bf",
    secondaryForeground: "#0f172a",
    success: "#4ade80",
    warning: "#fbbf24",
    danger: "#f87171",
    info: "#38bdf8",
    background: "#0f172a",
    surface: "#1e293b",
    muted: "#334155",
    border: "#475569",
    foreground: "#f1f5f9",
    mutedForeground: "#94a3b8",
    radiusSm: "2px",
    radiusMd: "4px",
    radiusLg: "8px",
    pagePadding: "16px",
    pagePaddingLg: "24px",
    cardPaddingX: "20px",
    cardPaddingY: "16px",
    sectionGap: "24px",
    stackGap: "16px",
    fieldGap: "12px",
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
