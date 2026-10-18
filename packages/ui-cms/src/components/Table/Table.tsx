import type { ReactNode } from 'react';
import { tableDefaults, type TableProps as DesignProps } from '../../generated/props';
import { AltArrowDownIcon, AltArrowLeftIcon, AltArrowRightIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Isi sel; default menampilkan `item[key]`. */
  render?: (item: T, index: number) => ReactNode;
  /** Lebar kolom (px); kolom tanpa lebar berbagi sisa ruang. */
  width?: number;
}

export type TableProps<T> = DesignProps & {
  columns: Column<T>[];
  data: T[];
  rowKey: (item: T, index: number) => string | number;
  /** Isi kolom aksi di kanan (mis. <IconButton>). Kolom tidak tampil bila kosong. */
  renderAction?: (item: T) => ReactNode;
  actionHeader?: ReactNode;
  /** Total data di server; default = `data.length`. */
  totalRecords?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** Pilihan baris per halaman; select muncul di footer bila `onPageSizeChange` diisi. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  emptyText?: string;
  className?: string;
};

/** Daftar data dengan header, aksi baris, dan paginasi. */
export function Table<T>(props: TableProps<T>) {
  const { columns, data, rowKey, renderAction, actionHeader = 'Actions', totalRecords = data.length, page = 1, pageSize = 10, onPageChange, pageSizeOptions = [10, 20, 50, 100], onPageSizeChange, emptyText = 'No data yet.', testId, className } = { ...tableDefaults, ...props };
  const pages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const from = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalRecords, from + data.length - 1);
  return (
    <div data-testid={testId} className={cx('overflow-hidden rounded-lg border border-border bg-background', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map(c => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined} className="h-10 px-4 text-xs font-semibold text-muted-foreground">
                  {c.header}
                </th>
              ))}
              {renderAction && <th className="h-10 w-[144px] px-4 text-xs font-semibold text-muted-foreground">{actionHeader}</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + (renderAction ? 1 : 0)} className="h-24 px-4 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
            {data.map((item, i) => (
              <tr key={rowKey(item, i)} className="border-t border-border">
                {columns.map(c => (
                  <td key={c.key} className="h-[52px] px-4 text-foreground">
                    {c.render ? c.render(item, i) : String((item as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
                {renderAction && <td className="h-[52px] px-4">{renderAction(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span>{totalRecords === 0 ? 'No data' : `Showing ${from}–${to} of ${totalRecords}`}</span>
        <div className="flex items-center gap-4">
          {onPageSizeChange && (
            <label className="flex items-center gap-2">
              <span>Rows per page</span>
              <span className="relative inline-flex">
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={e => onPageSizeChange(Number(e.target.value))}
                  className="h-8 w-16 cursor-pointer appearance-none rounded-lg border border-border bg-background pl-2 pr-6 text-sm font-medium text-foreground outline-none focus:border-primary"
                >
                  {[...new Set([...pageSizeOptions, pageSize])].sort((a, b) => a - b).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <AltArrowDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              </span>
            </label>
          )}
          <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40">
            <AltArrowLeftIcon className="h-4 w-4" />
          </button>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-primary px-2 font-medium text-primary">{page}</span>
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange?.(page + 1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40">
            <AltArrowRightIcon className="h-4 w-4" />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
