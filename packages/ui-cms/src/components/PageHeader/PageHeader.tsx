import type { HTMLAttributes } from 'react';
import { pageHeaderDefaults, type PageHeaderProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type PageHeaderProps = Omit<DesignProps, 'title'> & {
  title?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;

/** Kepala halaman di dalam konten: judul, keterangan, dan aksi utama di kanan (`children`). */
export function PageHeader(props: PageHeaderProps) {
  const { title, description, children, testId, className, ...rest } = { ...pageHeaderDefaults, ...props };
  return (
    <div data-testid={testId} className={cx('flex items-center justify-between gap-4', className)} {...rest}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold leading-8 text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
