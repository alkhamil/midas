import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, defaultTheme, themeNames, themes, type ThemeName } from '../generated/theme';

interface ThemeContextValue {
  theme: ThemeName;
  themes: ThemeName[];
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Terapkan token tema (dari Variables design system) ke dokumen. */
export function ThemeProvider({ initialTheme = defaultTheme, children }: { initialTheme?: ThemeName; children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme in themes ? initialTheme : defaultTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const value = useMemo(() => ({ theme, themes: themeNames, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
