import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useDebounce, useClickOutside, useSelectDropdown } from '../../../hooks';
import { stripNonAscii } from '../../../utils';
import { CircleAlert } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  /** Id sumber opsi (mis. master) bila pemanggil butuh nilainya. */
  id?: number;
}

export type LoadOptionsFn = (search?: string, page?: number) => Promise<SelectOption[]>;

interface SelectFieldProps {
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  options?: SelectOption[];
  loadOptions?: LoadOptionsFn;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  clearable?: boolean;
  searchable?: boolean;
  /**
   * Saat true, dropdown memuat halaman berikutnya otomatis saat scroll
   * mendekati bawah. `loadOptions(search, page)` dipanggil dengan page
   * 1-based; halaman 1 mengganti daftar, halaman > 1 menambahkan.
   * `hasMore` disimpulkan dari panjang hasil >= `pageSize`.
   */
  paginateOnScroll?: boolean;
  /** Ukuran halaman loader (default 20). */
  pageSize?: number;
  /** Teks saat dropdown tidak punya opsi (default "No options"). */
  emptyOptionsText?: string;
  /**
   * Saat search aktif & hasil pencarian kosong: false = jangan tampilkan
   * opsi yang sedang dipilih (yang dipertahankan label-nya), cukup teks
   * `emptyOptionsText`. Default true (perilaku lama).
   */
  showSelectedOptions?: boolean;
  testId?: string;
  'data-testid'?: string;
  /** Opsi yang return true akan dirender disabled (tidak bisa dipilih). */
  isOptionDisabled?: (option: SelectOption) => boolean;
  /**
   * Label yang sudah diketahui untuk `value` saat ini. Dipakai untuk
   * men-seed daftar opsi SEBELUM `loadOptions` selesai fetch, dan juga
   * dipertahankan kalau hasil fetch (initial load / hasil search) tidak
   * memuat item yang sedang dipilih — ini yang bikin mode edit sempat/terus
   * menampilkan value mentah alih-alih label.
   * Diabaikan kalau `loadOptions` tidak dipakai.
   */
  defaultOption?: SelectOption;
  /**
   * Saat true, trigger menampilkan `value` mentah (mis. code) alih-alih label
   * opsi. Daftar opsi di dropdown tetap menampilkan `label`.
   */
  showValueOnly?: boolean;
  /** Paksa state loading (mis. opsi di-fetch di luar komponen). */
  isLoading?: boolean;
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

function SelectField({
  size = 'md',
  disabled = false,
  error,
  placeholder = 'Select...',
  options: staticOptions,
  loadOptions,
  value,
  onChange,
  className = '',
  clearable = true,
  searchable = false,
  paginateOnScroll = false,
  pageSize = 20,
  emptyOptionsText,
  showSelectedOptions = true,
  testId,
  'data-testid': dataTestId,
  defaultOption,
  showValueOnly = false,
  isLoading = false,
  isOptionDisabled,
}: SelectFieldProps) {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyOptionsText ?? t('fields.noOptions');
  const [isOpen, setIsOpen] = useState(false);
  const [loadedOptions, setLoadedOptions] = useState<SelectOption[]>(
    defaultOption ? [defaultOption] : [],
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
  // Loading internal (loadOptions) atau dari pemanggil (mis. query eksternal).
  const showLoading = loading || isLoading;
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
  // chip/trigger tidak ikut tampil (kalau kosong → emptyOptionsText).
  const listOptions =
    hasAppliedSearch && !showSelectedOptions
      ? displayOptions.filter((o) => fetchIds?.has(o.value))
      : displayOptions;

  const selectedLabel = showValueOnly
    ? value
    : (options.find((o) => o.value === value)?.label ?? value);

  // Sinkron ke ref supaya `load` tidak perlu depend ke `value` langsung
  // (kalau iya, effect debounced-search di bawah akan retrigger tiap kali
  // value berubah, bukan cuma saat search term berubah).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
          const currentValue = valueRef.current;
          if (!currentValue) return data;
          // Kalau item yang sedang dipilih tidak ada di halaman hasil ini
          // (umum terjadi: API cuma balikin N item teratas / hasil search),
          // pertahankan entry lama untuk value itu supaya label-nya tidak
          // hilang / jatuh balik ke raw id.
          if (data.some((o) => o.value === currentValue)) return data;
          const existing = prev.find((o) => o.value === currentValue);
          return existing ? [existing, ...data] : data;
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

  function select(opt: SelectOption) {
    onChange(opt.value);
    setIsOpen(false);
    setSearchTerm('');
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
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
  // supaya user bisa mengetik ulang untuk pencarian berikutnya. Saat tidak ada
  // hasil, dropdown juga tetap terbuka.
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(null);
      setSearchTerm('');
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
    onChange(target.value);
    setSearchTerm('');
    setHighlightedIndex(null);
    setHasAppliedSearch(false);
  }

  const inputValue = searchable && isOpen ? searchTerm : value ? selectedLabel : '';

  const triggerBaseClass = [
    'flex w-full items-center rounded-lg border outline-none transition-colors',
    error
      ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20 focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20 focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
      : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
    disabled ? 'cursor-not-allowed' : 'bg-background',
  ].join(' ');

  return (
    <div data-testid={dataTestId ?? testId} className={className}>
      <div ref={wrapperRef} className="relative">
        {searchable ? (
          <div
            className={[
              triggerBaseClass,
              'overflow-hidden',
              disabled ? 'bg-muted' : '',
              sizeStyles[size],
            ].join(' ')}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={inputValue}
              onChange={handleSearchInput}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                if (!isOpen) toggle();
              }}
              placeholder={placeholder}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
            />
            <span className="flex shrink-0 items-center text-muted-foreground">
              {showLoading ? (
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
              ) : value && !disabled && clearable ? (
                <button
                  type="button"
                  onClick={clear}
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
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            className={[
              triggerBaseClass,
              'justify-between',
              disabled ? 'bg-muted text-muted-foreground' : 'cursor-pointer',
              sizeStyles[size],
            ].join(' ')}
          >
            <span
              className={
                value
                  ? disabled
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {value ? selectedLabel : placeholder}
            </span>
            <span className="flex shrink-0 items-center text-muted-foreground">
              {showLoading ? (
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
              ) : value && !disabled && clearable ? (
                <button
                  type="button"
                  onClick={clear}
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
              ) : (
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
              )}
              {error && <CircleAlert className="h-3.5 w-3.5" />}
            </span>
          </button>
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
                {showLoading && loadedOptions.length === 0 ? (
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
                ) : !showLoading && listOptions.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {resolvedEmptyText}
                    </p>
                ) : (
                  <>
                    {listOptions.map((opt, index) => {
                      const disabled = isOptionDisabled?.(opt) ?? false;
                      const focused = highlightedIndex === index;
                      const isSelected = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          data-focused-index={index}
                          disabled={disabled}
                          onClick={() => select(opt)}
                          onMouseMove={() => {
                            if (!disabled) setHighlightedIndex(index);
                          }}
                          className={[
                            'flex w-full px-3 py-2 text-left text-sm transition-colors',
                            disabled
                              ? 'cursor-not-allowed text-muted-foreground'
                              : focused && !isSelected
                                ? 'cursor-pointer bg-muted text-foreground'
                                : isSelected
                                  ? 'cursor-pointer bg-primary/10 text-primary font-medium'
                                  : 'cursor-pointer text-foreground hover:bg-muted',
                          ].join(' ')}
                        >
                          {opt.label}
                          {disabled && <span className="ml-2 text-xs"></span>}
                        </button>
                      );
                    })}
                    {showLoading && (
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
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default SelectField;
