import RadioButtonField from './RadioButtonField';

interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface RadioGroupFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  testId?: string;
  'data-testid'?: string;
}

function RadioGroupField({
  value,
  onChange,
  options,
  size = 'md',
  disabled,
  error,
  testId,
  'data-testid': dataTestId,
}: RadioGroupFieldProps) {
  const resolvedTestId = dataTestId ?? testId;
  return (
    <div data-testid={resolvedTestId}>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-2 cursor-pointer"
          >
            <RadioButtonField
              size={size}
              value={option.value}
              checked={value === option.value}
              disabled={disabled || option.disabled}
              error={error}
              onChange={onChange}
              testId={resolvedTestId ? `${resolvedTestId}-${option.value}` : undefined}
            />
            <span className="text-sm text-foreground">{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined} className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default RadioGroupField;
