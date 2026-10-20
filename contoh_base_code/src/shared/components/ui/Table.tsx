import { isValidElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { formatNumber } from '../../utils';
import SelectField from './fields/SelectField';
import Button from './Button';
import Tooltip from './Tooltip';

export interface Column<T> {
  key: string;
  header: ReactNode;
  sortable?: boolean;
  render?: (item: T, index?: number) => ReactNode;
  className?: string;
  /** Freeze kolom di sisi kiri saat scroll horizontal. */
  stickyLeft?: boolean;
  /** Offset CSS `left` kolom sticky (mis. '0', '3rem') — wajib diisi untuk kolom sticky ke-2 dst. */
  stickyLeftOffset?: string;
  /** Lebar kolom piksel (efektif bila tabel fixed layout). */
  width?: number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  totalRecords: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  renderAction?: (item: T) => ReactNode;
  actionWidth?: string;
  /** Posisi kolom aksi: kanan (default) atau kiri. */
  actionPosition?: 'left' | 'right';
  /** Tampilkan kolom nomor urut baris pertama ("No", sadar halaman). */
  showRowNumber?: boolean;
  /** Label header kolom aksi (default "Action"). */
  actionHeader?: ReactNode;
  /** Sembunyikan seluruh kolom aksi (header + sel). */
  hideActionColumn?: boolean;
  fixedLayout?: boolean;
  stickyAction?: boolean;
  hidePagination?: boolean;
  hideTotalRecords?: boolean;
  /** Node di kanan baris "Total Records" (mis. badge ringkasan). */
  headerExtra?: ReactNode;
  /** Highlight `n` baris pertama (mis. baris terbaru). */
  highlightRowCount?: number;
  /** Predikat highlight per baris (menang atas `highlightRowCount`). */
  isRowHighlighted?: (item: T) => boolean;
  /** Selalu tampilkan scrollbar horizontal (default: hanya saat overflow). */
  alwaysShowScrollbar?: boolean;
  /** Saat true, baris header tetap terlihat (sticky) saat body di-scroll vertikal. */
  stickyHeader?: boolean;
  /** Kelas height untuk area scroll (mis. "h-96") — hanya body tabel yang scroll. */
  scrollBodyClassName?: string;
  /** Selalu tampilkan scrollbar vertikal custom (butuh `scrollBodyClassName`). */
  alwaysShowVerticalScrollbar?: boolean;
  rowKey: (item: T, index?: number) => string | number;
  isEmptyState?: boolean;
  isFilteredEmptyState?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  filteredEmptyStateTitle?: string;
  filteredEmptyStateDescription?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  retryLabel?: string;
  /** Padding vertikal sel body lebih rapat (`py-1` alih-alih `py-3`). */
  dense?: boolean;
  testId?: string;
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' | null }) {
  const trianglePath =
    'M4.15222 0.117132L0.117901 4.15145C-0.134085 4.40343 0.0443821 4.83429 0.400744 4.83429H8.46937C8.82574 4.83429 9.0042 4.40343 8.75222 4.15145L4.7179 0.117132C4.56169 -0.0390775 4.30843 -0.0390776 4.15222 0.117132Z';

  return (
    <div className="inline-flex flex-col items-center ml-1.5 gap-px">
      <svg
        className={`h-1.25 w-2.25 ${active && direction === 'asc' ? 'text-primary' : 'text-border'}`}
        fill="currentColor"
        viewBox="0 0 9 5"
      >
        <path d={trianglePath} />
      </svg>
      <svg
        className={`h-1.25 w-2.25 ${active && direction === 'desc' ? 'text-primary' : 'text-border'}`}
        fill="currentColor"
        viewBox="0 0 9 5"
      >
        <path d={trianglePath} style={{ transform: 'rotate(180deg)', transformOrigin: 'center' }} />
      </svg>
    </div>
  );
}

function buildPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  // Lampiran A (7-slot window): awal 1-4, akhir T-3..T, selain itu tengah.
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const { t } = useTranslation();
  const pages = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SelectField
          clearable={false}
          value={String(pageSize)}
          onChange={(val) => onPageSizeChange(Number(val))}
          options={[10, 20, 50, 100].map((n) => ({ label: String(n), value: String(n) }))}
          className="w-16"
        />
        <span>{t('table.rowsPerPage')}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          data-testid="pagination-prev"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span
              key={`e-${i}`}
              data-testid="pagination-ellipsis"
              className="flex h-8 min-w-8 items-center justify-center px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              data-testid={`pagination-page-${p}`}
              onClick={() => {
                if (p !== page) onPageChange(p);
              }}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1 text-sm font-medium transition-colors border ${
                p === page
                  ? 'border-primary text-primary bg-background'
                  : 'border-transparent text-muted-foreground hover:bg-primary/10 hover:border-primary'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          data-testid="pagination-next"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function bc(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Background SOLID untuk sel sticky (freeze). Versi translucent (mis.
 * `bg-primary/5`) membuat konten kolom yang ter-scroll di bawahnya terlihat
 * menembus sel freeze — terutama saat row di-hover lalu di-scroll.
 * `color-mix` menghasilkan warna solid yang setara dengan tint di atas
 * background, sehingga sel sticky tetap menutup konten di bawahnya.
 */
const STICKY_ROW_BG = 'bg-background';
const STICKY_ROW_HOVER_BG =
  'group-hover:bg-[color-mix(in_srgb,var(--theme-primary)_5%,var(--theme-background))]';
const STICKY_ROW_HIGHLIGHT_BG =
  'bg-[color-mix(in_srgb,var(--theme-primary)_15%,var(--theme-background))]';

/** Nilai sel kosong (null/undefined/string kosong) ditampilkan sebagai `-`. */
function renderCellValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof File) return value.name;
  if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
    return (value as File[]).map((file) => file.name).join(', ');
  }
  // Array objek (mis. baris embedded tanpa render kolom) tidak valid sebagai React child.
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    !isValidElement(value[0])
  ) {
    return '-';
  }
  // Objek polos (mis. sisa File di draft lama) tidak valid sebagai React child.
  if (typeof value === 'object' && !Array.isArray(value) && !isValidElement(value)) return '-';
  return value as ReactNode;
}

/** Bungkus isi sel; tampilkan Tooltip berisi teks penuh hanya saat ter-truncate. */
function TruncatedCell({ children }: { children: ReactNode }) {
  const [truncated, setTruncated] = useState(false);
  // Elemen (SelectField, Badge, tombol, custom render): render apa adanya
  // seperti sebelum tooltip ada — wrapper inline-flex + truncate mencekik
  // layout kontrol (mis. Select w-full menyusut selebar intrinsik).
  if (typeof children !== 'string' && typeof children !== 'number') {
    return children;
  }
  return (
    // max-w-full: trigger inline-flex Tooltip shrink-to-fit mengikuti konten —
    // tanpa cap ia melebar melampaui td (ellipsis hilang + anchor tooltip ngaco).
    <Tooltip content={truncated ? children : undefined} className="max-w-full" minWidth={0}>
      <span
        className="block truncate"
        onMouseEnter={(e) => {
          // Bandingkan scrollWidth vs clientWidth span itu sendiri: clientWidth
          // td termasuk padding sehingga overflow kecil (< padding) lolos dari
          // deteksi padahal ellipsis sudah muncul.
          const el = e.currentTarget;
          setTruncated(el.scrollWidth > el.clientWidth);
        }}
      >
        {children}
      </span>
    </Tooltip>
  );
}

function Table<T>({
  columns,
  data,
  totalRecords,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
  renderAction,
  actionWidth = 'w-16',
  actionHeader,
  actionPosition = 'right',
  showRowNumber = false,
  hideActionColumn = false,
  fixedLayout = false,
  stickyAction = false,
  rowKey,
  isEmptyState,
  isFilteredEmptyState,
  emptyStateTitle,
  emptyStateDescription = '',
  filteredEmptyStateTitle,
  filteredEmptyStateDescription,
  loading,
  error,
  onRetry,
  errorTitle = 'Oops! Something Went Wrong',
  errorDescription = "We're sorry, but something went wrong on our end. Please try again later.",
  retryLabel,
  dense = false,
  hidePagination = false,
  hideTotalRecords = false,
  headerExtra,
  highlightRowCount,
  isRowHighlighted,
  alwaysShowScrollbar = false,
  stickyHeader = false,
  scrollBodyClassName,
  alwaysShowVerticalScrollbar = false,
  testId,
}: TableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const cellPy = dense ? 'py-1' : 'py-3';
  const actionRight = actionPosition === 'right';
  const { t } = useTranslation();
  const resolvedActionHeader = actionHeader ?? t('table.action');
  const resolvedRowNumberHeader = t('table.rowNumber', { defaultValue: 'No' });
  const rowNumberOf = (rowIdx: number): number => (page - 1) * pageSize + rowIdx + 1;
  const resolvedEmptyTitle = emptyStateTitle ?? t('table.emptyTitle');
  const resolvedFilteredTitle = filteredEmptyStateTitle ?? t('table.filteredTitle');
  const resolvedFilteredDesc = filteredEmptyStateDescription ?? t('table.filteredDesc');
  const resolvedRetryLabel = retryLabel ?? t('table.retry');

  const skeletonRows = Array.from({ length: pageSize }, (_, i) => i);
  const showAction = !!renderAction && !hideActionColumn;
  const totalColumns = columns.length + (showAction ? 1 : 0) + (showRowNumber ? 1 : 0);
  const emptyState = !loading && !error && data.length === 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [vTrackHeight, setVTrackHeight] = useState(0);
  const [vScrollHeight, setVScrollHeight] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    const tableEl = el?.querySelector('table');
    if (!el || !tableEl) return;
    const update = () => {
      setBarWidth(el.scrollWidth);
      setClientWidth(el.clientWidth);
      setHasOverflow(el.scrollWidth > el.clientWidth);
      setScrollTop(el.scrollTop);
      setVTrackHeight(el.clientHeight);
      setVScrollHeight(el.scrollHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(tableEl);
    return () => ro.disconnect();
  }, []);

  function syncBarFromTable() {
    if (!scrollRef.current) return;
    setScrollLeft(scrollRef.current.scrollLeft);
    setScrollTop(scrollRef.current.scrollTop);
  }

  function scrubStrip(clientX: number, strip: HTMLDivElement) {
    const el = scrollRef.current;
    if (!el) return;
    const rect = strip.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  }

  function scrubVBar(clientY: number, strip: HTMLDivElement) {
    const el = scrollRef.current;
    if (!el) return;
    const rect = strip.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  }

  function handleStripPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubStrip(e.clientX, e.currentTarget);
  }

  function handleStripPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    scrubStrip(e.clientX, e.currentTarget);
  }

  function handleVBarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubVBar(e.clientY, e.currentTarget);
  }

  function handleVBarPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    scrubVBar(e.clientY, e.currentTarget);
  }

  const scrollable = barWidth - clientWidth;
  // Shadow tepi kolom aksi sticky: muncul hanya saat ada konten yang
  // ter-scroll di baliknya (kiri: scrollLeft > 0; kanan: belum mentok).
  const showLeftActionShadow =
    stickyAction && !actionRight && hasOverflow && scrollLeft > 0;
  const showRightActionShadow =
    stickyAction && actionRight && hasOverflow && scrollLeft < scrollable - 1;
  const leftActionShadow = 'shadow-[6px_0_6px_-4px_rgb(0_0_0/0.2)]';
  const rightActionShadow = 'shadow-[-6px_0_6px_-4px_rgb(0_0_0/0.2)]';
  const thumbPct = clientWidth > 0 && scrollable > 0 ? (clientWidth / barWidth) * 100 : 100;
  const thumbOffsetPct = scrollable > 0 ? (scrollLeft / scrollable) * (100 - thumbPct) : 0;

  const vScrollable = vScrollHeight - vTrackHeight;
  const vThumbPct =
    vTrackHeight > 0 && vScrollable > 0 ? (vTrackHeight / vScrollHeight) * 100 : 100;
  const vThumbOffsetPct =
    vScrollable > 0 && vTrackHeight > 0 ? (scrollTop / vScrollable) * (100 - vThumbPct) : 0;

  // AC-087: saat pindah halaman, kembalikan gulir ke atas tabel agar baris
  // pertama halaman baru langsung terlihat.
  function handlePageChange(next: number) {
    onPageChange(next);
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollIntoView({ block: 'start' });
  }

  return (
    <div data-testid={testId} className="w-full">
      {!loading && !error && !hideTotalRecords && (
        <div className="flex items-center gap-6 py-3">
          <span className="text-sm text-muted-foreground">
            {t('table.totalRecords')}:{' '}
            <span className="font-medium text-foreground">{formatNumber(totalRecords)}</span>
          </span>
          {headerExtra}
        </div>
      )}

      <div
        className={bc(
          'border-y border-border bg-background overflow-hidden',
          alwaysShowVerticalScrollbar && scrollBodyClassName ? 'flex' : '',
        )}
      >
        <div
          ref={scrollRef}
          onScroll={syncBarFromTable}
          className={bc(
            'overflow-x-auto table-scroll no-scrollbar',
            scrollBodyClassName,
            alwaysShowVerticalScrollbar && 'flex-1 min-w-0',
          )}
        >
          <table
            className={bc(
              'border-separate border-spacing-0',
              fixedLayout ? 'table-fixed w-full' : 'min-w-full',
            )}
          >
            <thead>
              <tr className="bg-surface">
                {showRowNumber && (
                  <th
                    className={bc(
                      'px-4 py-3 text-center text-sm font-medium tracking-wider text-muted-foreground whitespace-nowrap border-b border-border w-12',
                      stickyHeader ? 'sticky top-0 z-20 bg-surface' : 'bg-surface',
                    )}
                  >
                    {resolvedRowNumberHeader}
                  </th>
                )}
                {showAction && !actionRight && (
                  <th
                    className={bc(
                      `px-4 py-3 text-center text-sm font-medium tracking-wider text-muted-foreground whitespace-nowrap border-b border-border`,
                      stickyHeader ? 'sticky top-0 z-20 bg-surface' : 'bg-surface',
                      stickyAction && 'sticky left-0 z-30',
                      showLeftActionShadow && leftActionShadow,
                      actionWidth,
                    )}
                  >
                    {resolvedActionHeader}
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      ...(col.stickyLeft ? { left: col.stickyLeftOffset ?? '0' } : {}),
                      ...(col.width ? { width: col.width } : {}),
                    }}
                    className={bc(
                      'px-5 py-3 text-left text-sm font-medium tracking-wider text-muted-foreground whitespace-nowrap border-b border-border',
                      stickyHeader ? 'sticky top-0 z-20 bg-surface' : '',
                      col.stickyLeft ? 'sticky z-20 bg-surface' : '',
                      
                      col.sortable ? 'cursor-pointer select-none hover:text-foreground' : '',
                      col.className,
                    )}
                    onClick={() => col.sortable && onSort?.(col.key)}
                  >
                    <span className="inline-flex items-center">
                      {col.header}
                      {col.sortable && (
                        <SortIcon
                          active={sortKey === col.key}
                          direction={sortKey === col.key ? (sortDir ?? null) : null}
                        />
                      )}
                    </span>
                  </th>
                ))}
                {showAction && actionRight && (
                  <th
                    className={bc(
                      `px-4 py-3 text-center text-sm font-medium tracking-wider text-muted-foreground whitespace-nowrap border-b border-border`,
                      stickyHeader ? 'sticky top-0 z-20 bg-surface' : 'bg-surface',
                      stickyAction && 'sticky right-0 z-30',
                      showRightActionShadow && rightActionShadow,
                      actionWidth,
                    )}
                  >
                    {resolvedActionHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows.map((rowIdx) => (
                  <tr key={`skeleton-${rowIdx}`}>
                    {showRowNumber && (
                      <td className={`w-12 border-b border-border px-4 ${cellPy}`}>
                        <div className="mx-auto h-4 animate-pulse rounded bg-muted" />
                      </td>
                    )}
                    {showAction && !actionRight && (
                      <td
                        className={`${actionWidth} border-b border-border px-4 ${cellPy}`}
                      >
                        <div className="mx-auto h-4 animate-pulse rounded bg-muted" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`border-b border-border px-5 ${cellPy}`}
                      >
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                    {showAction && actionRight && (
                      <td
                        className={`${actionWidth} border-b border-border px-4 ${cellPy}`}
                      >
                        <div className="mx-auto h-4 animate-pulse rounded bg-muted" />
                      </td>
                    )}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={totalColumns} className="px-5 py-12">
                    <div className="sticky left-1/2 w-max -translate-x-1/2 flex flex-col gap-2 items-center justify-center text-center">
                      <TriangleAlert className="h-12 w-12 shrink-0 text-danger" />
                      <p className="text-lg font-semibold text-foreground">{errorTitle}</p>
                      {errorDescription && (
                        <p className="text-sm text-muted-foreground">{errorDescription}</p>
                      )}
                      {onRetry && (
                        <Button type="button" onClick={onRetry} variant="secondary">
                          {resolvedRetryLabel}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : emptyState ? (
                <tr>
                  <td colSpan={totalColumns} className="px-5 py-12">
                    <div className="sticky left-1/2 w-max -translate-x-1/2">
                      {isEmptyState ? (
                        <div className="flex flex-col gap-1.5 items-center justify-center text-center">
                          <p className="text-2xl font-semibold text-foreground">
                            {resolvedEmptyTitle}
                          </p>
                          {emptyStateDescription && (
                            <p className="text-base text-muted-foreground">
                              {emptyStateDescription}
                            </p>
                          )}
                        </div>
                      ) : isFilteredEmptyState ? (
                        <div className="flex flex-col gap-1.5 items-center justify-center text-center">
                          <p className="text-2xl font-semibold text-foreground">
                            {resolvedFilteredTitle}
                          </p>
                          {filteredEmptyStateDescription && (
                            <p className="text-base text-muted-foreground">
                              {resolvedFilteredDesc}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-base text-foreground">No data available.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, rowIdx) => {
                  const isLast = rowIdx === data.length - 1;
                  const highlighted = isRowHighlighted
                    ? isRowHighlighted(item)
                    : highlightRowCount !== undefined && rowIdx < highlightRowCount;
                  return (
                    <tr
                      key={rowKey(item, rowIdx)}
                      className={highlighted ? 'group bg-primary/15' : 'group hover:bg-primary/5'}
                    >
                      {showRowNumber && (
                        <td
                          className={bc(
                            `w-12 px-4 ${cellPy} text-center text-sm text-muted-foreground whitespace-nowrap`,
                            isLast ? '' : 'border-b border-border',
                          )}
                        >
                          {rowNumberOf(rowIdx)}
                        </td>
                      )}
                      {showAction && !actionRight && (
                        <td
                          className={bc(
                            highlighted
                              ? STICKY_ROW_HIGHLIGHT_BG
                              : `${STICKY_ROW_BG} ${STICKY_ROW_HOVER_BG}`,
                            `${actionWidth} px-4 ${cellPy} whitespace-nowrap border-border`,
                            stickyAction && 'sticky left-0 z-10',
                            showLeftActionShadow && leftActionShadow,
                            isLast ? '' : 'border-b border-border',
                          )}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {renderAction(item)}
                          </div>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={col.stickyLeft ? { left: col.stickyLeftOffset ?? '0' } : undefined}
                          className={bc(
                            `px-5 ${cellPy} text-sm font-normal text-foreground`,
                            fixedLayout ? 'truncate' : 'whitespace-nowrap',
                            
                            isLast ? '' : 'border-b border-border',
                            col.stickyLeft
                              ? highlighted
                                ? `sticky z-10 ${STICKY_ROW_HIGHLIGHT_BG}`
                                : `sticky z-10 ${STICKY_ROW_BG} ${STICKY_ROW_HOVER_BG}`
                              : '',
                            col.className,
                          )}
                        >
                          <TruncatedCell>
                            {col.render
                              ? col.render(item, rowIdx)
                              : renderCellValue((item as Record<string, unknown>)[col.key])}
                          </TruncatedCell>
                        </td>
                      ))}
                      {showAction && actionRight && (
                        <td
                          className={bc(
                            highlighted
                              ? STICKY_ROW_HIGHLIGHT_BG
                              : `${STICKY_ROW_BG} ${STICKY_ROW_HOVER_BG}`,
                            `${actionWidth} px-4 ${cellPy} whitespace-nowrap border-border`,
                            stickyAction && 'sticky right-0 z-10',
                            showRightActionShadow && rightActionShadow,
                            isLast ? '' : 'border-b border-border',
                          )}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {renderAction(item)}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {alwaysShowVerticalScrollbar && scrollBodyClassName && vTrackHeight > 0 && (
          <div
            aria-hidden="true"
            className="relative w-2 shrink-0 cursor-pointer bg-muted touch-none"
            onPointerDown={handleVBarPointerDown}
            onPointerMove={handleVBarPointerMove}
          >
            <div
              className="absolute left-0 w-full rounded-full bg-border"
              style={{ height: `${vThumbPct}%`, top: `${vThumbOffsetPct}%` }}
            />
          </div>
        )}
      </div>

      {(alwaysShowScrollbar || hasOverflow) && (
        <div
          aria-hidden="true"
          className="mt-1 h-2 cursor-pointer rounded-full bg-muted touch-none"
          onPointerDown={handleStripPointerDown}
          onPointerMove={handleStripPointerMove}
        >
          <div
            className="h-full rounded-full bg-border"
            style={{
              width: `${thumbPct}%`,
              marginLeft: `${thumbOffsetPct}%`,
            }}
          />
        </div>
      )}

      {!hidePagination && !loading && !error && data.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

export default Table;
