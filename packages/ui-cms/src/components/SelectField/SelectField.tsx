import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { selectFieldDefaults, type SelectFieldProps as DesignProps } from '../../generated/props';
import { AltArrowDownIcon } from '../../generated/icons';
import { controlClass, FieldShell } from '../../internal/FieldShell';
import { cx } from '../../internal/cx';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export type SelectFieldProps = DesignProps & {
  options?: SelectOption[];
  error?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof DesignProps | 'children'>;

/** Pilihan dari daftar dengan label. Memakai <select> bawaan browser supaya aksesibel di semua perangkat. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(props, ref) {
  const { label, placeholder, disabled, options = [], error, testId, className, id: idProp, ...rest } = { ...selectFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          data-testid={testId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(controlClass(error, disabled), 'h-10 appearance-none pr-10')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <AltArrowDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </FieldShell>
  );
});
