import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

const PRIMARY_PRESETS = ['#2563eb', '#0f766e', '#15803d', '#b45309', '#dc2626'];

const RADIUS_PRESETS: {
  label: string;
  value: { radiusSm: string; radiusMd: string; radiusLg: string };
}[] = [
  { label: 'Sharp', value: { radiusSm: '0', radiusMd: '0.125rem', radiusLg: '0.25rem' } },
  { label: 'Default', value: { radiusSm: '0.125rem', radiusMd: '0.25rem', radiusLg: '0.5rem' } },
  { label: 'Round', value: { radiusSm: '0.5rem', radiusMd: '0.75rem', radiusLg: '1rem' } },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-muted-foreground">{children}</p>;
}

interface ThemeSettingsPanelProps {
  testId?: string;
}

/**
 * Panel pengaturan thema (mode, warna primary, radius) — dipakai di modul
 * Pengaturan. Perubahan langsung diterapkan dan tersimpan di localStorage.
 */
export function ThemeSettingsPanel({ testId }: ThemeSettingsPanelProps) {
  const { t } = useTranslation();
  const { theme, tokens, setTheme, updateOverrides, resetOverrides } = useTheme();

  const activeRadius =
    RADIUS_PRESETS.find(
      (p) =>
        tokens.radiusSm === p.value.radiusSm &&
        tokens.radiusMd === p.value.radiusMd &&
        tokens.radiusLg === p.value.radiusLg,
    )?.label ?? 'Custom';

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      <div>
        <SectionLabel>Mode</SectionLabel>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={[
                'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                theme === mode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Primary color</SectionLabel>
        <div className="flex items-center gap-2">
          {PRIMARY_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`primary-${color}`}
              onClick={() => updateOverrides({ primary: color })}
              style={{ backgroundColor: color }}
              className={[
                'h-8 w-8 rounded-full border border-border transition-transform',
                tokens.primary.toLowerCase() === color.toLowerCase()
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                  : '',
              ].join(' ')}
            />
          ))}
          <input
            type="color"
            aria-label="custom-primary"
            value={tokens.primary}
            onChange={(e) => updateOverrides({ primary: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background p-0.5"
          />
        </div>
        <p className="mt-1.5 font-mono text-xs text-muted-foreground">{tokens.primary}</p>
      </div>

      <div>
        <SectionLabel>Radius: {activeRadius}</SectionLabel>
        <div className="flex gap-2">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => updateOverrides(preset.value)}
              className={[
                'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                activeRadius === preset.label
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={resetOverrides}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {t('theme.resetToDefault')}
      </button>
    </div>
  );
}
