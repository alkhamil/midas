import type { ButtonHTMLAttributes } from 'react';
import { buttonDefaults, type ButtonProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type ButtonProps = DesignProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof DesignProps>;

const variants = {
  primary: 'border-primary bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border-border bg-background text-foreground hover:bg-muted',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-muted',
  danger: 'border-danger bg-danger text-white hover:opacity-90',
} as const;
const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm' } as const;

/** Aksi. Primary untuk aksi utama (satu per area), Secondary pendamping, Ghost ringan, Danger merusak. */
export function Button(props: ButtonProps) {
  const { variant, size, children, icon, testId, className, type = 'button', disabled, ...rest } = { ...buttonDefaults, ...props };
  return (
    <button
      type={type}
      data-testid={testId}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon && <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}
