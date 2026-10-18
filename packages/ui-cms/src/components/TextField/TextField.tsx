import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { textFieldDefaults, type TextFieldProps as DesignProps } from '../../generated/props';
import { controlClass, FieldShell } from '../../internal/FieldShell';
import { cx } from '../../internal/cx';

export type TextFieldProps = DesignProps & {
  /** Pesan error di bawah input; membuat input berwarna danger. */
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, keyof DesignProps>;

/** Input teks satu baris dengan label. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(props, ref) {
  const { label, placeholder, disabled, error, testId, className, id: idProp, ...rest } = { ...textFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <input
        ref={ref}
        id={id}
        data-testid={testId}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(controlClass(error, disabled), 'h-10')}
        {...rest}
      />
    </FieldShell>
  );
});
