import type { HTMLAttributes, ReactNode } from 'react';
import { badgeDefaults, type BadgeProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type BadgeProps = DesignProps & Omit<HTMLAttributes<HTMLSpanElement>, keyof DesignProps>;

const variants = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  neutral: 'bg-muted text-muted-foreground',
} as const;

/** Status singkat di tabel & detail. Warna mengikuti makna, bukan dekorasi. */
export function Badge(props: BadgeProps) {
  // `label` is the design's own text property; libraries may also map it to `children` — both are accepted.
  const { variant, children: kids, testId, className, ...rest } = { ...badgeDefaults, ...props };
  const children = kids ?? (props as { label?: ReactNode }).label;
  delete (rest as { label?: unknown }).label;
  return (
    <span data-testid={testId} className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)} {...rest}>
      {children}
    </span>
  );
}
