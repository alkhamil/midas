import { useTheme } from '../../../shared/theme';
import type { ThemeTokens } from '../../../shared/theme';
import DocSection from '../components/DocSection';

const SWATCHES: { token: keyof ThemeTokens; label: string; swatchClass: string }[] = [
  { token: 'primary', label: 'Primary', swatchClass: 'bg-primary' },
  { token: 'secondary', label: 'Secondary', swatchClass: 'bg-secondary' },
  { token: 'success', label: 'Success', swatchClass: 'bg-success' },
  { token: 'warning', label: 'Warning', swatchClass: 'bg-warning' },
  { token: 'danger', label: 'Danger', swatchClass: 'bg-danger' },
  { token: 'info', label: 'Info', swatchClass: 'bg-info' },
  { token: 'background', label: 'Background', swatchClass: 'bg-background' },
  { token: 'surface', label: 'Surface', swatchClass: 'bg-surface' },
  { token: 'muted', label: 'Muted', swatchClass: 'bg-muted' },
  { token: 'border', label: 'Border', swatchClass: 'bg-border' },
  { token: 'foreground', label: 'Foreground', swatchClass: 'bg-foreground' },
  { token: 'mutedForeground', label: 'Muted foreground', swatchClass: 'bg-muted-foreground' },
];

function toCssVar(token: string): string {
  return `--theme-${token.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

function ColorsPage() {
  const { theme, tokens } = useTheme();

  return (
    <div className="flex flex-col section-gap">
      <DocSection
        title={`Theme palette (${theme})`}
        description="Source of truth: src/shared/theme/theme.ts. Values below follow the active mode — switch via the floating button to see the other mode. Components must use these tokens."
      >
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SWATCHES.map((item) => (
            <li
              key={item.token}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <span
                className={`h-10 w-10 shrink-0 rounded-md border border-border ${item.swatchClass}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {String(tokens[item.token])}
                </span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {toCssVar(item.token)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </DocSection>
    </div>
  );
}

export default ColorsPage;
