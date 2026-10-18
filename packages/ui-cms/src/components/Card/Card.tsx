import type { HTMLAttributes, ReactNode } from 'react';
import { cardDefaults, type CardProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type CardProps = DesignProps & {
  /** Aksi di kanan judul, mis. tombol Tambah. */
  actions?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;

/** Wadah konten dengan judul. Dipakai untuk tabel, form, dan detail. */
export function Card(props: CardProps) {
  const { title, children, actions, testId, className, ...rest } = { ...cardDefaults, ...props };
  return (
    <section data-testid={testId} className={cx('overflow-hidden rounded-lg border border-border bg-background', className)} {...rest}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}
