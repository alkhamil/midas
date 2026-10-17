import { type ChangeEvent, type TextareaHTMLAttributes, forwardRef } from 'react';
import { DangerCircleIcon as CircleAlert } from '../../../generated/icons';
import { stripNonAscii } from '../../../internal/utils';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  sanitize?: (value: string) => string;
  'data-testid'?: string;
}

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  (
    {
      size = 'md',
      error,
      className = '',
      disabled,
      rows = 4,
      sanitize,
      onChange,
      'data-testid': testId,
      ...rest
    },
    ref,
  ) => {
    function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
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
        <div className="relative">
          <textarea
            data-testid={testId}
            ref={ref}
            disabled={disabled}
            rows={rows}
            onChange={handleChange}
            className={[
              'w-full rounded-lg border bg-background outline-none transition-colors placeholder:text-muted-foreground resize-y min-h-[88px]',
              'focus-visible:ring-2 focus-visible:ring-primary/30',
              error
                ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
                : 'border-border focus-visible:border-primary',
              disabled
                ? 'cursor-not-allowed bg-muted text-muted-foreground disabled:bg-muted'
                : '',
              sizeStyles[size],
              className,
            ].join(' ')}
            {...rest}
          />
          {error && (
            <span className="absolute top-2 right-3">
              <CircleAlert className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {error && (
          <p
            data-testid={testId ? `${testId}-error` : undefined}
            className="-mt-0.5 text-xs text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextAreaField.displayName = 'TextAreaField';

export default TextAreaField;
