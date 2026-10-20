import type { ReactNode } from 'react';
import { sectionHeaderDefaults, type SectionHeaderProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';
import { Button } from '../Button/Button';

export type SectionHeaderProps = DesignProps & {
  /** Dipanggil saat tombol aksi utama diklik (tombol tampil bila `action` ≠ none dan `actionLabel` terisi). */
  onAction?: () => void;
  /** Aksi tambahan di samping tombol utama. */
  children?: ReactNode;
  className?: string;
};

/** Kepala bagian di konten: judul + keterangan di kiri, aksi utama di kanan dalam satu baris. */
export function SectionHeader(props: SectionHeaderProps) {
  const { title, description, action, actionLabel, onAction, children, testId, className } = { ...sectionHeaderDefaults, ...props };
  const showAction = action !== 'none' && !!actionLabel;
  return (
    <div data-testid={testId} className={cx('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold leading-7 text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {(showAction || children) && (
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {showAction && <Button variant={action} onClick={onAction}>{actionLabel}</Button>}
        </div>
      )}
    </div>
  );
}
