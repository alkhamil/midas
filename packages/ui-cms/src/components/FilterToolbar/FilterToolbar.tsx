import type { ReactNode } from 'react';
import { filterToolbarDefaults, type FilterToolbarProps as DesignProps } from '../../generated/props';
import { FilterIcon, MagniferIcon } from '../../generated/icons';
import { Button } from '../Button/Button';
import { cx } from '../../internal/cx';

export type FilterToolbarProps = DesignProps & {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Tampilkan tombol Filter; panel filternya dibuat oleh pemakai lewat `onFilterClick`. */
  onFilterClick?: () => void;
  filterLabel?: string;
  /** Aksi tambahan di sisi kanan, sebelum tombol Filter. */
  actions?: ReactNode;
  className?: string;
};

/** Pencarian di kiri, tombol Filter di kanan, di atas tabel. */
export function FilterToolbar(props: FilterToolbarProps) {
  const { searchValue = '', onSearchChange, searchPlaceholder = 'Cari…', onFilterClick, filterLabel = 'Filter', actions, testId, className } = { ...filterToolbarDefaults, ...props };
  return (
    <div data-testid={testId} className={cx('flex items-center justify-between gap-3', className)}>
      <div className="relative w-80 max-w-full">
        <MagniferIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={searchValue}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={e => onSearchChange?.(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onFilterClick && (
          <Button variant="secondary" size="md" icon={<FilterIcon className="h-4 w-4" />} onClick={onFilterClick}>
            {filterLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
