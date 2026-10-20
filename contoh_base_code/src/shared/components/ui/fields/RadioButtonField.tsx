interface RadioButtonFieldProps {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  className?: string;
  testId?: string;
}

const circleSizes: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const dotSizes: Record<string, string> = {
  sm: 'h-2 w-2',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

function RadioButtonField({ value, checked, onChange, size = 'md', disabled, error, className = '', testId }: RadioButtonFieldProps) {
  return (
    <span
      className={[
        'relative inline-flex items-center justify-center',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      <input
        data-testid={testId}
        type="radio"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        onChange={() => onChange(value)}
      />
      <span
        className={[
          'block rounded-full border transition-colors',
          circleSizes[size],
          error ? 'border-danger' : 'border-border',
          disabled ?  (checked ? 'bg-primary opacity-20' : 'bg-muted') : 'bg-background',
          !disabled ? 'peer-checked:border-primary peer-checked:bg-primary' : '',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
          disabled ? 'cursor-not-allowed' : 'hover:border-muted-foreground',
        ].join(' ')}
      />
      <span
        className={[
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground pointer-events-none',
          disabled ? (checked ? 'block' : 'hidden') : 'hidden peer-checked:block',
          dotSizes[size],
        ].join(' ')}
      />
    </span>
  );
}

export default RadioButtonField;
