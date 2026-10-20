import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { textAreaFieldDefaults, type TextAreaFieldProps as DesignProps } from '../../generated/props';
import { controlClass, FieldShell } from '../../internal/FieldShell';
import { cx } from '../../internal/cx';

export type TextAreaFieldProps = DesignProps & {
  error?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof DesignProps>;

/** Input teks multi-baris dengan label. */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(props, ref) {
  const { label, placeholder, disabled, error, testId, className, id: idProp, rows = 4, ...rest } = { ...textAreaFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        data-testid={testId}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(controlClass(error, disabled), 'py-2.5')}
        {...rest}
      />
    </FieldShell>
  );
});
