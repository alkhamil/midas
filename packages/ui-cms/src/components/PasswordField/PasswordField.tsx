import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { passwordFieldDefaults, type PasswordFieldProps as DesignProps } from '../../generated/props';
import { EyeClosedIcon, EyeIcon } from '../../generated/icons';
import { controlClass, FieldShell } from '../../internal/FieldShell';
import { cx } from '../../internal/cx';

export type PasswordFieldProps = DesignProps & {
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, keyof DesignProps | 'type'>;

/** Input kata sandi dengan tombol tampilkan/sembunyikan. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(props, ref) {
  const { label, placeholder, disabled, error, testId, className, id: idProp, ...rest } = { ...passwordFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          data-testid={testId}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(controlClass(error, disabled), 'h-10 pr-10')}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeClosedIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </FieldShell>
  );
});
