import type { HTMLAttributes } from 'react';
import { statCardDefaults, type StatCardProps as DesignProps } from '../../generated/props';
import { ArrowDownIcon, ArrowUpIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export type StatCardProps = DesignProps & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;

const tones = { up: 'text-success', down: 'text-danger', neutral: 'text-muted-foreground' } as const;

/** Angka ringkasan di dashboard dengan tren naik, turun, atau netral. */
export function StatCard(props: StatCardProps) {
  const { trend, label, value, caption, testId, className, ...rest } = { ...statCardDefaults, ...props };
  return (
    <div data-testid={testId} className={cx('flex flex-col gap-2 rounded-lg border border-border bg-background p-5', className)} {...rest}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold leading-9 text-foreground">{value}</p>
      {caption && (
        <p className={cx('flex items-center gap-1 text-xs font-medium', tones[trend])}>
          {trend === 'up' && <ArrowUpIcon className="h-3.5 w-3.5" />}
          {trend === 'down' && <ArrowDownIcon className="h-3.5 w-3.5" />}
          {caption}
        </p>
      )}
    </div>
  );
}
