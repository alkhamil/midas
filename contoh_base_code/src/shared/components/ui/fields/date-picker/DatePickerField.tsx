import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePickerField.css';
import { Calendar, CircleAlert } from 'lucide-react';
import { useSelectDropdown } from '../../../../hooks';
import Button from '../../Button';
import DatePickerHeader, { YEAR_ITEM_COUNT, type PickerView } from './DatePickerHeader';

interface DatePickerFieldProps {
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  range?: boolean;
  showTime?: boolean;
  minDate?: Date;
  maxDate?: Date;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Tampilkan tombol X untuk mengosongkan tanggal (default: true). */
  clearable?: boolean;
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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toIsoDateTime(date: Date): string {
  return `${toIso(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`;
}

function toDisplay(date: Date | null, showTime = false): string {
  if (!date) return '';
  const base = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  return showTime ? `${base} ${pad2(date.getHours())}:${pad2(date.getMinutes())}` : base;
}

function formatRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return '';
  if (start && !end) return toIso(start);
  if (start && end) return `${toIso(start)},${toIso(end)}`;
  return '';
}

function parseRange(value: string): [Date | null, Date | null] {
  if (!value) return [null, null];
  const parts = value.split(',');
  return [toDate(parts[0]), toDate(parts[1] ?? '')];
}

function formatDisplay(value: string, showTime = false): string {
  if (!value) return '';
  const [start, end] = parseRange(value);
  if (start && end) return `${toDisplay(start)} - ${toDisplay(end)}`;
  return toDisplay(start, showTime) || value;
}

const inputBaseClasses = [
  'w-full rounded-lg border bg-background text-left outline-none transition-colors placeholder:text-muted-foreground',
  'focus-visible:ring-2 focus-visible:ring-primary/30',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
].join(' ');

const timeSelectClasses = [
  'h-9 w-16 rounded-lg border border-border bg-background px-2 text-center text-sm text-foreground outline-none transition-colors',
  'focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
].join(' ');

function renderRightSide(
  hasValue: boolean,
  disabled: boolean,
  onClear: () => void,
  showError: boolean,
) {
  return (
    <div
      className={[
        'pointer-events-none absolute right-0 inset-y-0 z-10 flex items-center gap-0.5 text-muted-foreground',
        showError ? 'pr-3.5' : 'pr-3',
      ].join(' ')}
    >
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
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
      {showError && (
        <span className="pointer-events-none flex items-center">
          <CircleAlert className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function DatePickerField({
  size = 'md',
  disabled = false,
  error,
  placeholder,
  range: isRange = false,
  showTime = false,
  minDate,
  maxDate,
  value,
  onChange,
  className = '',
  clearable = true,
  panelWidthClassName = 'w-80',
  testId,
  'data-testid': dataTestId,
}: DatePickerFieldProps) {
  const resolvedTestId = dataTestId ?? testId;
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('fields.selectDate');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>('date');
  const [cursor, setCursor] = useState(() => new Date());
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');
  const { position: dropdownPosition, dropdownRef: panelRef } = useSelectDropdown(
    open,
    wrapperRef,
    320, // min-width: kalender w-80 = 320px
    380, // estimatedHeight: tinggi kalender + tombol ≈ 380px
  );

  // Click-outside: useSelectDropdown tidak tahu tentang wrapperRef kita,
  // jadi kita tambahkan handler manual agar klik di trigger menutup panel.
  // Klik di dalam panel sudah di-handle via onMouseDown stopPropagation di bawah.
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

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const [startDate, endDate] = isRange ? parseRange(value) : [null, null];

  function openPanel() {
    if (disabled) return;
    const parsed = toDate(value);
    setDraftDate(parsed);
    setDraftHour(parsed ? pad2(parsed.getHours()) : '00');
    setDraftMinute(parsed ? pad2(parsed.getMinutes()) : '00');
    setCursor(parsed ?? new Date());
    setView('date');
    setOpen(true);
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

  function handlePick(date: Date) {
    if (view === 'month') {
      setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
      setView('date');
      return;
    }
    if (view === 'year') {
      setCursor(new Date(date.getFullYear(), cursor.getMonth(), 1));
      setView('month');
      return;
    }
    setDraftDate(date);
  }

  function handleApply() {
    if (!draftDate) {
      setOpen(false);
      return;
    }
    const d = new Date(
      draftDate.getFullYear(),
      draftDate.getMonth(),
      draftDate.getDate(),
      Number(draftHour),
      Number(draftMinute),
      0,
      0,
    );
    onChange(showTime ? toIsoDateTime(d) : toIso(d));
    setOpen(false);
  }

  function renderSinglePicker() {
    const borderError = error
      ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
      : 'border-border focus-visible:border-primary';

    const openRing = open && !error ? 'border-primary ring-2 ring-primary/30' : '';

    const inputPad = clearable && value && !disabled ? 'pr-12' : 'pr-9';

    return (
      <div ref={wrapperRef} className={['relative w-full', className].filter(Boolean).join(' ')}>
        {renderRightSide(
          clearable && !!value,
          disabled,
          () => {
            onChange('');
            setOpen(false);
          },
          !!error,
        )}
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={formatDisplay(value, showTime)}
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
                  selected={draftDate ?? undefined}
                  openToDate={cursor}
                  disabled={disabled}
                  minDate={minDate}
                  maxDate={maxDate}
                  showMonthYearPicker={view === 'month'}
                  showYearPicker={view === 'year'}
                  onChange={(d: Date | null) => {
                    if (d) handlePick(d);
                  }}
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
              {showTime && (
                <div
                  data-testid={resolvedTestId ? `${resolvedTestId}-time` : undefined}
                  className="flex items-center justify-center gap-2 px-4 pb-3"
                >
                  <select
                    data-testid={resolvedTestId ? `${resolvedTestId}-hour` : undefined}
                    value={draftHour}
                    disabled={disabled}
                    onChange={(e) => setDraftHour(e.target.value)}
                    className={timeSelectClasses}
                    aria-label={t('fields.hour')}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-medium text-muted-foreground">:</span>
                  <select
                    data-testid={resolvedTestId ? `${resolvedTestId}-minute` : undefined}
                    value={draftMinute}
                    disabled={disabled}
                    onChange={(e) => setDraftMinute(e.target.value)}
                    className={timeSelectClasses}
                    aria-label={t('fields.minute')}
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  data-testid={resolvedTestId ? `${resolvedTestId}-cancel` : undefined}
                  onClick={() => setOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  size="md"
                  className="flex-1"
                  data-testid={resolvedTestId ? `${resolvedTestId}-apply` : undefined}
                  disabled={!draftDate || disabled}
                  onClick={handleApply}
                >
                  {t('common.apply')}
                </Button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  function renderLegacyRangePicker() {
    const borderError = error
      ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
      : 'border-border focus-visible:border-primary';

    const openRing = open && !error ? 'border-primary ring-2 ring-primary/30' : '';

    const inputPad = clearable && value && !disabled ? 'pr-12' : 'pr-9';

    const sharedProps = {
      disabled,
      minDate,
      maxDate,
      dateFormat: 'dd/MM/yyyy' as const,
      onCalendarOpen: () => setOpen(true),
      onCalendarClose: () => setOpen(false),
      showMonthDropdown: true,
      showYearDropdown: true,
      dropdownMode: 'select' as const,
      yearDropdownItemNumber: 30,
      popperClassName: 'datepicker-popper' as const,
      calendarClassName: 'datepicker-calendar' as const,
    };

    return (
      <div className={['relative w-full', className].filter(Boolean).join(' ')}>
        {renderRightSide(clearable && !!value, disabled, () => onChange(''), !!error)}
        <DatePicker
          selected={startDate}
          onChange={(dates: [Date | null, Date | null]) => {
            const [start, end] = dates;
            onChange(formatRange(start, end));
          }}
          startDate={startDate}
          endDate={endDate}
          selectsRange
          placeholderText="Select date range..."
          {...sharedProps}
          customInput={
            <input
              ref={inputRef}
              value={formatDisplay(value)}
              className={[
                inputBaseClasses,
                borderError,
                triggerSizeStyles[size],
                openRing,
                inputPad,
              ].join(' ')}
              disabled={disabled}
              data-testid={resolvedTestId}
            />
          }
        />
      </div>
    );
  }

  return (
    <div>
      {isRange ? renderLegacyRangePicker() : renderSinglePicker()}
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

export default DatePickerField;
