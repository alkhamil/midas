import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useDebounce, useClickOutside, useSelectDropdown } from '../../../hooks';
import { stripNonAscii } from '../../../utils';
import type { SelectOption, LoadOptionsFn } from './SelectField';
import { CircleAlert } from 'lucide-react';

function dedupeByValue(list: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  const out: SelectOption[] = [];
  for (const opt of list) {
    if (seen.has(opt.value)) continue;
    seen.add(opt.value);
    out.push(opt);
  }
  return out;
}

interface SelectMultipleFieldProps {
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  options?: SelectOption[];
  loadOptions?: LoadOptionsFn;
  value: string[];
  onChange: (values: string[]) => void;
  className?: string;
  clearable?: boolean;
  searchable?: boolean;
  /**
   * Opsi awal yang sudah diketahui (misal dari detail) untuk value yang
   * sedang dipilih — dipakai men-seed daftar sebelum `loadOptions` selesai
   * dan dipertahankan kalau hasil fetch tidak memuatnya.
   */
  defaultOptions?: SelectOption[];
  /**
   * Saat true, dropdown memuat halaman berikutnya otomatis saat scroll
   * mendekati bawah. `loadOptions(search, page)` dipanggil dengan page
   * 1-based; halaman 1 mengganti daftar, halaman > 1 menambahkan.
   * `hasMore` disimpulkan dari panjang hasil >= `pageSize`.
   */
  paginateOnScroll?: boolean;
  /** Ukuran halaman loader (default 20). */
  pageSize?: number;
  /**
   * Saat search aktif & hasil pencarian kosong: false = jangan tampilkan
   * opsi yang sedang dipilih (yang dipertahankan label-nya), cukup teks
   * `emptyOptionsText`. Default true (perilaku lama).
   */
  showSelectedOptions?: boolean;
  emptyOptionsText?: string;
  /**
   * When true, selected items are summarized as a single "[n] items
   * selected" chip instead of individual chips (avoids wrapping when many
   * options are selected, e.g. inside table cells).
   */
  chipsSummary?: boolean;
  /** Format teks ringkasan saat chipsSummary aktif (default "[n] items selected"). */
  summaryFormat?: (count: number) => string;
  /** Menutup dropdown setelah satu pilihan (pick satu per satu). */
  closeOnSelect?: boolean;
  /** Sembunyikan checkbox pada opsi dropdown. */
  hideCheckBox?: boolean;
  /** Format teks chip terpilih (default = o.label). */
  chipLabel?: (option: SelectOption) => string;
  testId?: string;
  'data-testid'?: string;
  /** Opsi yang return true dirender disabled (tidak bisa dipilih). */
  isOptionDisabled?: (option: SelectOption) => boolean;
}

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[34px]',
  md: 'pl-4 pr-3 py-2.5 text-sm min-h-[44px]',
  lg: 'pl-5 pr-3 py-3 text-base min-h-[52px]',
};

const iconSizeStyles: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-5 w-5',
};

const tagSizeStyles: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2 py-1 text-sm',
};

function SelectMultipleField({
  size = 'md',
  disabled = false,
  error,
  placeholder = 'Select...',
  options: staticOptions,
  loadOptions,
  // Nilai bisa `undefined` saat form induk belum memberi default (mis.
  // pratinjau kanvas) — normalisasi ke array agar `.length`/`.includes`
  // tidak melempar TypeError.
  value = [],
  onChange,
  className = '',
  clearable = true,
  searchable = false,
  defaultOptions,
  paginateOnScroll = false,
  pageSize = 20,
  showSelectedOptions = true,
  emptyOptionsText,
  chipsSummary = false,
  summaryFormat = (count) => `${count} items selected`,
  closeOnSelect = false,
  hideCheckBox = false,
  chipLabel,
  testId,
  'data-testid': dataTestId,
  isOptionDisabled,
}: SelectMultipleFieldProps) {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyOptionsText ?? t('fields.noOptions');
  const [isOpen, setIsOpen] = useState(false);
  const [loadedOptions, setLoadedOptions] = useState<SelectOption[]>(
    dedupeByValue(defaultOptions ?? []),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const options = loadOptions ? loadedOptions : (staticOptions ?? []);
  const displayOptions =
    searchable && searchTerm && !loadOptions
      ? options.filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
      : options;
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useClickOutside<HTMLDivElement>(useCallback(() => setIsOpen(false), []));
  const { position: dropdownPosition, dropdownRef } = useSelectDropdown(isOpen, wrapperRef);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const listRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const appliedSearchRef = useRef<string | undefined>(undefined);
  // id yang benar-benar berasal dari hasil fetch (bukan entry preserve),
  // + flag search yang sedang aktif — dipakai saat showSelectedOptions=false.
  const [fetchIds, setFetchIds] = useState<Set<string> | null>(null);
  const [hasAppliedSearch, setHasAppliedSearch] = useState(false);

  // Saat search aktif dan showSelectedOptions=false, daftar dropdown hanya
  // menampilkan hasil fetch — entry terpilih yang dipertahankan untuk label
  // chip tidak ikut tampil (kalau kosong → emptyOptionsText).
  const listOptions =
    hasAppliedSearch && !showSelectedOptions
      ? options.filter((o) => fetchIds?.has(o.value))
      : displayOptions;

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // chipsSummary: only collapse to "[n] items selected" when the selected
  // chips would overflow the trigger's available width; otherwise show them.
  const [summaryOverflow, setSummaryOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const applyMeasurement = useCallback(() => {
    const content = contentRef.current;
    const measure = measureRef.current;
    if (!content || !measure) return;
    const available = content.clientWidth - (searchable ? 64 : 0);
    setSummaryOverflow(measure.offsetWidth > available);
  }, [searchable]);

  useLayoutEffect(() => {
    if (!chipsSummary || value.length === 0) {
      // Measuring chips width is external-DOM sync; a render after
      // measurement is required. The resize observer handles container
      // resizes (window/table scroll changes).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummaryOverflow(false);
      return;
    }
    applyMeasurement();
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(applyMeasurement);
    ro.observe(content);
    return () => ro.disconnect();
  }, [value, chipsSummary, applyMeasurement]);

  const showChipsSummary = chipsSummary && value.length > 0 && summaryOverflow;
  const chipClasses = [
    'inline-flex items-center gap-0.5 rounded-full font-medium',
    'bg-muted text-foreground',
    tagSizeStyles[size],
  ].join(' ');

  const selectedOptions = options.filter((o) => value.includes(o.value));

  const renderChips = selectedOptions.map((opt) => (
    <span key={opt.value} className={chipClasses}>
      {chipLabel ? chipLabel(opt) : opt.label}
      <button
        type="button"
        onClick={(e) => {
          if (disabled) return;
          removeValue(opt.value, e);
        }}
        className={[
          'flex items-center rounded-sm transition-colors focus-visible:outline-none',
          disabled
            ? 'text-muted-foreground opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:text-primary',
        ].join(' ')}
        tabIndex={-1}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </span>
  ));

  const load = useCallback(
    async (search?: string, page?: number) => {
      if (!loadOptions) return;
      const nextPage = page ?? 1;
      appliedSearchRef.current = search;
      hasMoreRef.current = false;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await loadOptions(search, nextPage);
        pageRef.current = nextPage;
        hasMoreRef.current = data.length >= pageSize;
        if (nextPage === 1) setHighlightedIndex(null);
        setFetchIds((prev) =>
          nextPage > 1 && prev
            ? new Set([...prev, ...data.map((o) => o.value)])
            : new Set(data.map((o) => o.value)),
        );
        setHasAppliedSearch(!!search);
        setLoadedOptions((prev) => {
          if (nextPage > 1) {
            const seen = new Set(data.map((o) => o.value));
            return [...prev.filter((o) => !seen.has(o.value)), ...data];
          }
          const currentValues = valueRef.current;
          if (!currentValues.length) return dedupeByValue(data);
          // Pertahankan entry terpilih yang tidak ada di hasil fetch/search
          // supaya tag-nya tidak hilang saat dropdown dalam mode search.
          const selected = prev.filter(
            (o) => currentValues.includes(o.value) && !data.some((d) => d.value === o.value),
          );
          return dedupeByValue([...selected, ...data]);
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t('fields.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [loadOptions, pageSize, setLoading, setLoadError],
  );

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (loadOptions && !initialLoadDone.current) {
      initialLoadDone.current = true;
      load();
    }
  }, [loadOptions, load]);

  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(stripNonAscii(e.target.value));
  }

  const debounceLoaded = useRef(false);

  useEffect(() => {
    if (!loadOptions) return;
    if (!debounceLoaded.current) {
      debounceLoaded.current = true;
      return;
    }
    load(debouncedSearchTerm || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const handleListScroll = useCallback(() => {
    if (!paginateOnScroll || !loadOptions || loading || !hasMoreRef.current) return;
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      load(appliedSearchRef.current, pageRef.current + 1);
    }
  }, [paginateOnScroll, loadOptions, loading, load]);

  function toggle() {
    if (disabled) return;
    if (!isOpen && wrapperRef.current) {
      if (searchable) {
        setSearchTerm('');
        if (loadOptions) load();
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    setIsOpen((prev) => !prev);
  }

  function toggleOption(opt: SelectOption) {
    if (value.includes(opt.value)) {
      onChange(value.filter((v) => v !== opt.value));
    } else {
      onChange([...value, opt.value]);
    }
    setSearchTerm('');
    if (closeOnSelect) setIsOpen(false);
  }

  function removeValue(val: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== val));
  }

  // Opsi pertama yang bisa dipilih (lewati yang disabled).
  function firstEnabledOption(): SelectOption | null {
    return listOptions.find((o) => !(isOptionDisabled?.(o) ?? false)) ?? null;
  }

  function nearestEnabledIndex(from: number, dir: 1 | -1): number | null {
    const len = listOptions.length;
    let i = from;
    while (i >= 0 && i < len) {
      if (!(isOptionDisabled?.(listOptions[i]) ?? false)) return i;
      i += dir;
    }
    return null;
  }

  // Navigasi arrow: pindah highlight opsi. Saat arrow down menyentuh 2 item
  // terbawah dan masih ada halaman berikutnya (paginateOnScroll), muat halaman
  // berikutnya.
  function moveHighlight(dir: 1 | -1) {
    if (listOptions.length === 0) return;
    const start =
      highlightedIndex == null ? (dir === 1 ? -1 : listOptions.length) : highlightedIndex;
    const target = nearestEnabledIndex(start + dir, dir);
    if (target == null) return;
    setHighlightedIndex(target);
    listRef.current
      ?.querySelector(`[data-focused-index="${target}"]`)
      ?.scrollIntoView({ block: 'nearest' });
    if (
      dir === 1 &&
      paginateOnScroll &&
      !loading &&
      hasMoreRef.current &&
      target >= listOptions.length - 2
    ) {
      load(appliedSearchRef.current, pageRef.current + 1);
    }
  }

  // Enter saat konteks search: jangan submit form — pilih opsi yang sedang
  // di-highlight (fallback opsi teratas) dan biarkan dropdown tetap terbuka
  // (abaikan closeOnSelect) supaya user bisa mengetik ulang untuk pencarian
  // berikutnya. Saat tidak ada hasil, dropdown juga tetap terbuka.
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(null);
      searchInputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const target =
      highlightedIndex != null && listOptions[highlightedIndex]
        ? listOptions[highlightedIndex]
        : firstEnabledOption();
    if (!target) return;
    if (value.includes(target.value)) {
      onChange(value.filter((v) => v !== target.value));
    } else {
      onChange([...value, target.value]);
    }
    setSearchTerm('');
    setHighlightedIndex(null);
    setHasAppliedSearch(false);
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const triggerBaseClass = [
    'flex w-full items-center rounded-lg border outline-none transition-colors',
    error
      ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20 focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20 focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
      : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
    disabled ? 'cursor-not-allowed' : 'bg-background cursor-pointer',
  ].join(' ');

  const triggerContent = (
    <>
      <div ref={contentRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {showChipsSummary ? (
          <span className={chipClasses}>{summaryFormat(value.length)}</span>
        ) : (
          value.length > 0 && renderChips
        )}
        {searchable ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchInput}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (!isOpen) toggle();
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder={value.length > 0 ? '' : placeholder}
            disabled={disabled}
            className="min-w-15 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
          />
        ) : value.length === 0 ? (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        ) : null}
        {value.length > 0 && !searchable && <span className="flex-1" />}
      </div>
      <span className="flex shrink-0 items-center text-muted-foreground">
        {loading ? (
          <svg
            className={[iconSizeStyles[size], 'animate-spin'].join(' ')}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : !disabled && clearable && value.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="flex cursor-pointer items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-none"
            tabIndex={-1}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={iconSizeStyles[size]}
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        ) : null}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={iconSizeStyles[size]}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
        {error && <CircleAlert className="h-3.5 w-3.5" />}
      </span>
    </>
  );

  return (
    <div data-testid={dataTestId ?? testId} className={className}>
      <div ref={wrapperRef} className="relative">
        {searchable ? (
          <div
            className={[triggerBaseClass, disabled ? 'bg-muted' : '', sizeStyles[size]].join(
              ' ',
            )}
            onClick={toggle}
          >
            {triggerContent}
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            className={[
              triggerBaseClass,
              disabled ? 'bg-muted text-muted-foreground' : 'cursor-pointer',
              sizeStyles[size],
            ].join(' ')}
          >
            {triggerContent}
          </button>
        )}
        {chipsSummary && value.length > 0 && (
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-0 left-[-9999px] flex w-max flex-nowrap items-center gap-1"
          >
            {renderChips}
          </div>
        )}
        {isOpen &&
          dropdownPosition &&
          createPortal(
            <div
              ref={dropdownRef}
              data-select-dropdown
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 50,
              }}
              className="rounded-lg border border-border bg-background shadow-lg mt-2"
            >
              <div ref={listRef} onScroll={handleListScroll} className="max-h-60 overflow-y-auto">
                {loading && loadedOptions.length === 0 ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-6 text-sm">
                    <span className="text-danger">{loadError}</span>
                    <button
                      type="button"
                      onClick={() => load(searchTerm || undefined)}
                      className="text-sm font-medium text-primary hover:text-primary/80"
                    >
                      Retry
                    </button>
                  </div>
                ) : !loading && listOptions.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {resolvedEmptyText}
                  </p>
                ) : (
                  <>
                    {listOptions.map((opt, index) => {
                      const isSelected = value.includes(opt.value);
                      const disabled = isOptionDisabled?.(opt) ?? false;
                      const focused = highlightedIndex === index;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          data-focused-index={index}
                          disabled={disabled}
                          onClick={() => toggleOption(opt)}
                          onMouseMove={() => {
                            if (!disabled) setHighlightedIndex(index);
                          }}
                          className={[
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                            disabled
                              ? 'cursor-not-allowed text-muted-foreground'
                              : focused && !isSelected
                                ? 'cursor-pointer bg-muted text-foreground'
                                : isSelected
                                  ? 'cursor-pointer bg-primary/10 text-primary font-medium'
                                  : 'cursor-pointer text-foreground hover:bg-muted',
                          ].join(' ')}
                        >
                          {!hideCheckBox && (
                            <span
                              className={[
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                disabled
                                  ? 'border-border bg-muted'
                                  : isSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border',
                              ].join(' ')}
                            >
                              {isSelected && !disabled && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="h-3 w-3"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </span>
                          )}
                          {opt.label}
                          {disabled && <span className="text-xs"></span>}
                        </button>
                      );
                    })}
                    {loading && (
                      <div className="flex items-center justify-center py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {error && (
        <p
          data-testid={testId ? `${testId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default SelectMultipleField;
