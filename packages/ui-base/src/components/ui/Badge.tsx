import { type ReactNode } from 'react';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'custom';
  children: ReactNode;
  className?: string;
  testId?: string;
}

const variantStyles: Record<string, string> = {
  success: 'bg-success/15 text-success',
  error: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-muted text-muted-foreground',
  custom: '',
};

function Badge({ variant = 'info', children, className = '', testId }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant] ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

export default Badge;
