import { DangerCircleIcon as CircleAlert } from '../../../generated/icons';

interface SwitchFieldProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  className?: string;
  // check/uncheck dinamis: tampilkan checkedLabel/uncheckedLabel mengikuti nilai value.
  // Kalau showCheckedLabels=false (tidak pakai checkedLabel/uncheckedLabel), pakai switchLabel (statis).
  checkedLabel?: string;
  uncheckedLabel?: string;
  switchLabel?: string;
  showCheckedLabels?: boolean;
  testId?: string;
  'data-testid'?: string;
}

const trackSizes: Record<string, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
  lg: 'h-7 w-14',
};

const thumbSizes: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const translateX: Record<string, string> = {
  sm: 'peer-checked:translate-x-[16px]',
  md: 'peer-checked:translate-x-[20px]',
  lg: 'peer-checked:translate-x-[28px]',
};

function SwitchField({ value = false, onChange, size = 'md', disabled, error, className = '', checkedLabel, uncheckedLabel, switchLabel, showCheckedLabels = true, testId, 'data-testid': dataTestId }: SwitchFieldProps) {
  const resolvedTestId = dataTestId ?? testId;
  // Label selalu tampil: bila mode label dinamis aktif tapi checked/unchecked
  // kosong, fallback ke switchLabel agar label tidak hilang.
  const visibleLabel = showCheckedLabels
    ? (value ? (checkedLabel || switchLabel) : (uncheckedLabel || switchLabel))
    : switchLabel;
  return (
    <div>
      <div className={`flex items-center gap-3 ${className}`}>
        <label
          className={[
            'relative inline-flex items-center',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <input
            data-testid={resolvedTestId}
            type="checkbox"
            role="switch"
            checked={value}
            disabled={disabled}
            className="peer sr-only"
            onChange={(e) => onChange(e.target.checked)}
          />
          <span
            className={[
              'block rounded-full transition-colors',
              disabled ? 'bg-muted' : 'bg-border',
              !disabled ? 'peer-checked:bg-primary' : '',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
              trackSizes[size],
            ].join(' ')}
          />
          <span
            className={[
              'absolute top-0.5 left-0.5 block rounded-full bg-primary-foreground shadow-sm transition-transform',
              thumbSizes[size],
              translateX[size],
            ].join(' ')}
          />
        </label>
        {visibleLabel ? (
          <span className="text-sm font-medium text-foreground">{visibleLabel}</span>
        ) : null}
        {error && <CircleAlert className="h-3.5 w-3.5" />}
      </div>
      {error && (
        <p data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default SwitchField;
