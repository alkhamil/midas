import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePickerField.css';
import { CalendarIcon as Calendar, DangerCircleIcon as CircleAlert } from '../../../../generated/icons';
import { useSelectDropdown } from '../../../../internal/hooks';
import Button from '../../Button';
import DatePickerHeader, { YEAR_ITEM_COUNT, type PickerView } from './DatePickerHeader';

interface DateRangeFieldProps {
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  maxDate?: Date;
  maxRangeDays?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Lebar panel kalender (default: 'w-80' agar sel tanggal tidak melar). */
  panelWidthClassName?: string;
  testId?: string;
  'data-testid'?: string;
}

const triggerSizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

const inputBaseClasses = [
  'w-full rounded-lg border bg-background text-left outline-none transition-colors placeholder:text-muted-foreground',
  'focus-visible:ring-2 focus-visible:ring-primary/30',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
].join(' ');

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toIso(date: Date | null): string {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toDisplay(date: Date | null): string {
  if (!date) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseRange(value: string): [Date | null, Date | null] {
  if (!value) return [null, null];
  const parts = value.split(',');
  return [toDate(parts[0]), toDate(parts[1] ?? '')];
}

function formatRange(start: Date | null, end: Date | null): string {
  if (!start) return '';
  if (!end) return toIso(start);
  return `${toIso(start)},${toIso(end)}`;
}

function formatDisplay(value: string): string {
  if (!value) return '';
  const [start, end] = parseRange(value);
  if (start && end) return `${toDisplay(start)} - ${toDisplay(end)}`;
  return toDisplay(start);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function DateRangeField({
  size = 'md',
  disabled = false,
  error,
  placeholder = 'Select date range',
  maxDate,
  maxRangeDays,
  value,
  onChange,
  className = '',
  panelWidthClassName = 'w-80',
  testId,
  'data-testid': dataTestId,
}: DateRangeFieldProps) {
  const resolvedTestId = dataTestId ?? testId;
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('fields.selectDateRange');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>('date');
  const [cursor, setCursor] = useState(() => new Date());
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);
  const { position: dropdownPosition, dropdownRef: panelRef } = useSelectDropdown(
    open,
    wrapperRef,
    320,
    380,
  );

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, panelRef]);

  const [startDate, endDate] = parseRange(value);

  const activeStart = open ? draftStart : startDate;
  const activeEnd = open ? draftEnd : endDate;

  const isSelectingEnd = !!maxRangeDays && !!activeStart && !activeEnd;
  const rangeMinDate = isSelectingEnd ? addDays(activeStart, -maxRangeDays) : undefined;
  const rangeMaxDate = isSelectingEnd ? addDays(activeStart, maxRangeDays) : undefined;
  const effectiveMinDate = rangeMinDate;
  const effectiveMaxDate =
    rangeMaxDate && maxDate
      ? rangeMaxDate < maxDate
        ? rangeMaxDate
        : maxDate
      : (rangeMaxDate ?? maxDate);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function openPanel() {
    if (disabled) return;
    const [committedStart, committedEnd] = parseRange(value);
    setDraftStart(committedStart);
    setDraftEnd(committedEnd);
    setCursor(committedStart ?? new Date());
    setView('date');
    setOpen(true);
  }

  function handleCancel() {
    setOpen(false);
  }

  function handleApply() {
    if (!draftStart) return;
    onChange(formatRange(draftStart, draftEnd));
    setOpen(false);
  }

  function handleClear() {
    onChange('');
    setDraftStart(null);
    setDraftEnd(null);
    setOpen(false);
  }

  function navigate(delta: number) {
    setCursor((prev) => {
      if (view === 'date') {
        return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      }
      if (view === 'month') {
        return new Date(prev.getFullYear() + delta, prev.getMonth(), 1);
      }
      return new Date(prev.getFullYear() + delta * YEAR_ITEM_COUNT, prev.getMonth(), 1);
    });
  }

  function handleChange(dates: [Date | null, Date | null]) {
    const [start, end] = dates;
    if (view !== 'date') {
      const picked = start ?? end;
      if (picked) {
        setCursor(
          view === 'month'
            ? new Date(picked.getFullYear(), picked.getMonth(), 1)
            : new Date(picked.getFullYear(), cursor.getMonth(), 1),
        );
        setView(view === 'month' ? 'date' : 'month');
      }
      return;
    }
    setDraftStart(start);
    setDraftEnd(end);
  }

  const borderError = error
    ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
    : 'border-border focus-visible:border-primary';

  const openRing = open && !error ? 'border-primary ring-2 ring-primary/30' : '';
  const inputPad = value && !disabled ? 'pr-12' : 'pr-9';

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')} ref={wrapperRef}>
      <div className="relative">
        <div
          className={[
            'pointer-events-none absolute right-0 inset-y-0 z-10 flex items-center gap-0.5 text-muted-foreground',
            error ? 'pr-3.5' : 'pr-3',
          ].join(' ')}
        >
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto flex cursor-pointer items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-none"
              tabIndex={-1}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
          <span className="pointer-events-none flex items-center mr-1">
            <Calendar className='w-4 h-4' />
          </span>
          {error && (
            <span className="pointer-events-none flex items-center">
              <CircleAlert className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <input
          type="text"
          readOnly
          value={formatDisplay(value)}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openPanel())}
          data-testid={resolvedTestId}
          className={[
            inputBaseClasses,
            borderError,
            triggerSizeStyles[size],
            openRing,
            inputPad,
            disabled ? '' : 'cursor-pointer',
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {open &&
          dropdownPosition &&
          createPortal(
            <div
              ref={panelRef}
              data-testid={resolvedTestId ? `${resolvedTestId}-panel` : undefined}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: panelWidthClassName === 'w-full' ? dropdownPosition.width : undefined,
                zIndex: 9999,
              }}
              className={[
                'rounded-lg border border-border bg-background shadow-lg',
                panelWidthClassName === 'w-full' ? '' : panelWidthClassName,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="datepicker-inline-reset pt-1">
                <DatePicker
                  key={`${view}-${cursor.getTime()}`}
                  inline
                  selectsRange
                  swapRange
                  startDate={activeStart ?? undefined}
                  endDate={activeEnd ?? undefined}
                  openToDate={cursor}
                  disabled={disabled}
                  minDate={effectiveMinDate}
                  maxDate={effectiveMaxDate}
                  showMonthYearPicker={view === 'month'}
                  showYearPicker={view === 'year'}
                  onChange={(dates: [Date | null, Date | null]) => handleChange(dates)}
                  renderCustomHeader={() => (
                    <DatePickerHeader
                      view={view}
                      cursor={cursor}
                      onNavigate={navigate}
                      onViewChange={setView}
                      testId={resolvedTestId}
                    />
                  )}
                />
              </div>
              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  data-testid={resolvedTestId ? `${resolvedTestId}-cancel` : undefined}
                  onClick={handleCancel}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  size="md"
                  className="flex-1"
                  data-testid={resolvedTestId ? `${resolvedTestId}-apply` : undefined}
                  disabled={!draftStart || disabled}
                  onClick={handleApply}
                >
                  {t('common.apply')}
                </Button>
              </div>
            </div>,
            document.body,
          )}
      </div>

      {error && (
        <p
          data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default DateRangeField;
