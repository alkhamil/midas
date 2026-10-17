import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'custom';

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
  testId?: string;
}

type ButtonProps =
  | (ButtonBaseProps & { variant?: Exclude<ButtonVariant, 'custom'>; className?: string })
  | (ButtonBaseProps & { variant: 'custom'; className: string });

const variantStyles: Record<string, string> = {
  primary:
    'border border-transparent bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75',
  secondary:
    'border border-primary text-primary bg-background hover:bg-primary/10 active:bg-primary/15',
  danger: 'border border-transparent bg-danger text-white hover:bg-danger/85 active:bg-danger/75',
  custom: '',
};

const sizeStyles: Record<string, string> = {
  sm: 'gap-1.5 rounded-lg px-3 py-1.5 text-xs',
  md: 'gap-2 rounded-lg px-4 py-2.5 text-sm',
  lg: 'gap-2.5 rounded-xl px-5 py-3 text-base',
};

const iconSizeStyles: Record<string, string> = {
  sm: '[&>svg]:h-4 [&>svg]:w-4',
  md: '[&>svg]:h-4 [&>svg]:w-4',
  lg: '[&>svg]:h-5 [&>svg]:w-5',
};

function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  testId,
  ...rest
}: ButtonProps) {
  return (
    <button
      data-testid={testId}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        variantStyles[variant],
        sizeStyles[size],
        iconSizeStyles[size],
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      ].join(' ')}
      disabled={disabled}
      {...rest}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  );
}

export default Button;
