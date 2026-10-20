import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface AppSettings {
  appName: string;
  brandIcon: string;
}

const STORAGE_KEY = 'app_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Generator',
  brandIcon: 'Box',
};

function readStored(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      appName: parsed.appName?.trim() || DEFAULT_SETTINGS.appName,
      brandIcon: parsed.brandIcon || DEFAULT_SETTINGS.brandIcon,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface AppSettingsContextValue extends AppSettings {
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

/** Provider pengaturan aplikasi (nama app + brand icon), persist localStorage. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readStored);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Abaikan: mode privat / kuota penuh.
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Abaikan.
    }
  }, []);

  const value = useMemo(
    () => ({ ...settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings harus dipakai di dalam SettingsProvider.');
  return ctx;
}
