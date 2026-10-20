import { useRef, useEffect } from 'react';

interface CheckboxFieldProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  className?: string;
  checkboxLabel?: string;
  indeterminate?: boolean;
  testId?: string;
}

const boxSizes: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const iconSizes: Record<string, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
};

function CheckboxField({ value, onChange, size = 'md', disabled, className = '', error, checkboxLabel, indeterminate, testId }: CheckboxFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  const isActive = value || !!indeterminate;

  const control = (
    <span
      className={[
        'relative inline-flex items-center justify-center',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        data-testid={testId}
        ref={inputRef}
        type="checkbox"
        checked={value}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={[
          'block rounded border-2 transition-colors',
          boxSizes[size],
          disabled && isActive ? 'border-primary/50 bg-primary/50 cursor-not-allowed' : '',
          disabled && !isActive ? 'border-border bg-muted cursor-not-allowed' : '',
          !disabled && isActive ? 'border-primary bg-primary' : '',
          !disabled && !isActive ? 'border-border bg-background hover:border-muted-foreground' : '',
        ].filter(Boolean).join(' ')}
      />
      {indeterminate ? (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground pointer-events-none',
            'block',
            iconSizes[size],
          ].join(' ')}
        >
          <path
            fillRule="evenodd"
            d="M5 10a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 10z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground pointer-events-none',
            disabled ? (value ? 'block' : 'hidden') : value ? 'block' : 'hidden',
            iconSizes[size],
          ].join(' ')}
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </span>
  );

  return (
    <div data-testid={testId ? `${testId}-field` : undefined} className={!checkboxLabel ? className : ''}>
      <label className={[
        'inline-flex items-center gap-2 cursor-pointer',
        checkboxLabel ? className : '',
      ].filter(Boolean).join(' ')}>
        {control}
        {checkboxLabel && <span className="text-sm text-foreground">{checkboxLabel}</span>}
      </label>
      {error && (
        <p data-testid={testId ? `${testId}-error` : undefined} className="text-xs text-danger" role="alert">{error}</p>
      )}
    </div>
  );
}

export default CheckboxField;
