import { useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { DangerCircleIcon as CircleAlert } from '../../../generated/icons';
import { stripNonAscii } from '../../../internal/utils';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  isInvalid?: boolean;
  defaultVisible?: boolean;
  sanitize?: (value: string) => string;
  'data-testid'?: string;
}

const iconSizeStyles: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-5 w-5',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

function EyeOpen({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeClosed({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function PasswordField({
  size = 'md',
  error,
  isInvalid,
  disabled,
  defaultVisible = false,
  sanitize,
  className = '',
  onChange,
  'data-testid': testId,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(defaultVisible);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const cleaned = stripNonAscii(e.target.value);
    if (cleaned !== e.target.value) {
      e.target.value = cleaned;
    }
    if (sanitize) {
      const raw = sanitize(e.target.value);
      if (raw !== e.target.value) {
        e.target.value = raw;
      }
    }
    onChange?.(e);
  }

  return (
    <div>
      <div
        className={[
          'flex items-center overflow-hidden rounded-lg border bg-background transition-colors',
          error || isInvalid
            ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
            : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          disabled ? 'cursor-not-allowed bg-muted' : '',
          className,
        ].join(' ')}
      >
        <input
          data-testid={testId}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          onChange={handleChange}
          className={[
            'w-full flex-1 border-none bg-transparent outline-none placeholder:text-muted-foreground',
            '[&:-webkit-autofill]:[-webkit-text-fill-color:currentColor]',
            sizeStyles[size],
            disabled ? 'cursor-not-allowed text-muted-foreground disabled:bg-muted' : '',
          ].join(' ')}
          {...rest}
        />
        <button
          data-testid={testId ? `${testId}-toggle` : undefined}
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          className={[
            'flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none',
            disabled ? 'cursor-not-allowed opacity-50' : '',
            error || isInvalid ? 'pr-1' : 'pr-3',
          ].join(' ')}
          tabIndex={-1}
        >
          {visible ? (
            <EyeOpen className={iconSizeStyles[size]} />
          ) : (
            <EyeClosed className={iconSizeStyles[size]} />
          )}
        </button>
        {(error || isInvalid) && (
          <span className="flex items-center pr-3">
            <CircleAlert className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      {error && (
        <p
          data-testid={testId ? `${testId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default PasswordField;
