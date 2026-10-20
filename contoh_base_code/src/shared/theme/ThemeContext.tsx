import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  applyTheme,
  clearStoredOverrides,
  getContrastForeground,
  getInitialTheme,
  getStoredOverrides,
  themes,
} from './theme';
import type { ThemeName, ThemeOverrides, ThemeTokens } from './theme';

interface ThemeContextValue {
  theme: ThemeName;
  tokens: ThemeTokens;
  overrides: ThemeOverrides;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  /** Gabungkan override kustom (warna primary/secondary, radius) dan terapkan langsung. */
  updateOverrides: (partial: ThemeOverrides) => void;
  /** Hapus semua override kembali ke token bawaan thema. */
  resetOverrides: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);
  const [overrides, setOverridesState] = useState<ThemeOverrides>(getStoredOverrides);

  useEffect(() => {
    applyTheme(theme, overrides);
  }, [theme, overrides]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const updateOverrides = useCallback((partial: ThemeOverrides) => {
    setOverridesState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetOverrides = useCallback(() => {
    clearStoredOverrides();
    setOverridesState({});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const merged: ThemeTokens = { ...themes[theme], ...overrides };
    if (overrides.primary) {
      merged.primaryForeground = getContrastForeground(overrides.primary);
    }
    if (overrides.secondary) {
      merged.secondaryForeground = getContrastForeground(overrides.secondary);
    }
    return {
      theme,
      tokens: merged,
      overrides,
      setTheme,
      toggleTheme,
      updateOverrides,
      resetOverrides,
    };
  }, [theme, overrides, setTheme, toggleTheme, updateOverrides, resetOverrides]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}
