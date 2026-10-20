import CheckboxField from './CheckboxField';

interface CheckboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface CheckboxGroupFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: CheckboxOption[];
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  testId?: string;
}

function CheckboxGroupField({
  value = [],
  onChange,
  options,
  size = 'md',
  disabled,
  error,
  testId,
}: CheckboxGroupFieldProps) {
  function handleToggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <CheckboxField
            key={option.value}
            size={size}
            value={value.includes(option.value)}
            onChange={() => handleToggle(option.value)}
            disabled={disabled || option.disabled}
            checkboxLabel={option.label}
            testId={testId ? `${testId}-${option.value}` : undefined}
          />
        ))}
      </div>
      {error && (
        <p data-testid={testId ? `${testId}-error` : undefined} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default CheckboxGroupField;
