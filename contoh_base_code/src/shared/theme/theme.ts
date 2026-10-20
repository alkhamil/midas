export type ThemeName = 'light' | 'dark';

/** Satu-satunya sumber kebenaran token thema. Nilai di sini yang dipakai seluruh shared components. */
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
  /** Standar spacing — dipakai via class semantik (`.page-padding`, `.section-gap`, ...). */
  pagePadding: string;
  pagePaddingLg: string;
  cardPaddingX: string;
  cardPaddingY: string;
  sectionGap: string;
  stackGap: string;
  fieldGap: string;
}

const spacing = {
  pagePadding: '1rem',
  pagePaddingLg: '1.5rem',
  cardPaddingX: '1.25rem',
  cardPaddingY: '1rem',
  sectionGap: '1.5rem',
  stackGap: '1rem',
  fieldGap: '0.75rem',
} satisfies Pick<
  ThemeTokens,
  | 'pagePadding'
  | 'pagePaddingLg'
  | 'cardPaddingX'
  | 'cardPaddingY'
  | 'sectionGap'
  | 'stackGap'
  | 'fieldGap'
>;

export const themes: Record<ThemeName, ThemeTokens> = {
  light: {
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    secondary: '#0f766e',
    secondaryForeground: '#ffffff',
    success: '#15803d',
    warning: '#b45309',
    danger: '#dc2626',
    info: '#0284c7',
    background: '#ffffff',
    surface: '#f1f5f9',
    muted: '#e2e8f0',
    border: '#cbd5e1',
    foreground: '#0f172a',
    mutedForeground: '#64748b',
    radiusSm: '0.125rem',
    radiusMd: '0.25rem',
    radiusLg: '0.5rem',
    ...spacing,
  },
  dark: {
    primary: '#3b82f6',
    primaryForeground: '#0f172a',
    secondary: '#2dd4bf',
    secondaryForeground: '#0f172a',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#38bdf8',
    background: '#0f172a',
    surface: '#1e293b',
    muted: '#334155',
    border: '#475569',
    foreground: '#f1f5f9',
    mutedForeground: '#94a3b8',
    radiusSm: '0.125rem',
    radiusMd: '0.25rem',
    radiusLg: '0.5rem',
    ...spacing,
  },
};

/** Override pengguna via panel thema — diterapkan di atas token thema aktif. */
export interface ThemeOverrides {
  primary?: string;
  secondary?: string;
  radiusSm?: string;
  radiusMd?: string;
  radiusLg?: string;
}

const STORAGE_KEY = 'app-theme';
const OVERRIDES_KEY = 'app-theme-overrides';

function toVarName(key: keyof ThemeTokens): string {
  return `--theme-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Pilih warna teks (gelap/terang) yang kontras di atas `hex`. */
export function getContrastForeground(hex: string): string {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  const channel = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.45 ? '#0f172a' : '#ffffff';
}

/** Terapkan thema: set `data-theme` + CSS variables dari token, lalu simpan pilihan. */
export function applyTheme(name: ThemeName, overrides: ThemeOverrides = {}): void {
  const root = document.documentElement;
  root.dataset.theme = name;
  const tokens: ThemeTokens = { ...themes[name], ...overrides };
  if (overrides.primary) {
    tokens.primaryForeground = getContrastForeground(overrides.primary);
  }
  if (overrides.secondary) {
    tokens.secondaryForeground = getContrastForeground(overrides.secondary);
  }
  (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach((key) => {
    root.style.setProperty(toVarName(key), tokens[key]);
  });
  localStorage.setItem(STORAGE_KEY, name);
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function getInitialTheme(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

export function getStoredOverrides(): ThemeOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ThemeOverrides;
    return { ...parsed };
  } catch {
    return {};
  }
}

export function clearStoredOverrides(): void {
  localStorage.removeItem(OVERRIDES_KEY);
}
