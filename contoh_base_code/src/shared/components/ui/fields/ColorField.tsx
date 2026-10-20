import { forwardRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

const swatchSizes: Record<string, string> = {
  // Tinggi swatch = line-height teks tiap size agar tinggi keseluruhan
  // ColorField sama dengan TextField (padding + text size sudah identik).
  sm: 'h-4 w-6',
  md: 'h-5 w-7',
  lg: 'h-6 w-8',
};

function cleanHex(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
}

function ColorField(
  {
    value = '',
    onChange,
    size = 'md',
    disabled,
    error,
    className = '',
    testId,
    'data-testid': dataTestId,
  }: ColorFieldProps,
  ref: React.ForwardedRef<HTMLInputElement>,
) {
  const { t } = useTranslation();
  const resolvedTestId = dataTestId ?? testId;
  const cleaned = cleanHex(value.startsWith('#') ? value.slice(1) : value);
  const swatchValue = cleaned.length === 6 ? `#${cleaned}` : '#000000';

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    const next = cleanHex(e.target.value);
    onChange(next === '' ? '' : `#${next}`);
  }

  function handleSwatchChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div>
      <div
        className={[
          'flex items-center gap-2 rounded-lg border bg-background transition-colors',
          error
            ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
            : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          sizeStyles[size],
          disabled ? 'cursor-not-allowed bg-muted' : '',
          className,
        ].join(' ')}
      >
        <input
          data-testid={resolvedTestId ? `${resolvedTestId}-swatch` : undefined}
          type="color"
          value={swatchValue}
          disabled={disabled}
          onChange={handleSwatchChange}
          aria-label={t('fields.pickColor')}
          className={[
            'shrink-0 cursor-pointer appearance-none rounded-md border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none',
            swatchSizes[size],
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        />
        <input
          data-testid={resolvedTestId}
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={handleTextChange}
          placeholder="#000000"
          maxLength={7}
          spellCheck={false}
          className={[
            'w-full flex-1 border-none bg-transparent font-mono uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground',
            disabled ? 'cursor-not-allowed text-muted-foreground' : '',
          ].join(' ')}
        />
      </div>
      {error && (
        <p
          data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default forwardRef<HTMLInputElement, ColorFieldProps>(ColorField);
