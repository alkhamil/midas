import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PickerView = 'date' | 'month' | 'year';

export const YEAR_ITEM_COUNT = 12;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function yearPageStart(year: number): number {
  return Math.floor(year / YEAR_ITEM_COUNT) * YEAR_ITEM_COUNT;
}

interface DatePickerHeaderProps {
  view: PickerView;
  cursor: Date;
  onNavigate: (delta: number) => void;
  onViewChange: (view: PickerView) => void;
  testId?: string;
}

function DatePickerHeader({
  view,
  cursor,
  onNavigate,
  onViewChange,
  testId,
}: DatePickerHeaderProps) {
  const navButtonClasses =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary';
  let label: ReactNode;
  let labelTestId: string | undefined;

  if (view === 'date') {
    label = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    labelTestId = testId ? `${testId}-month-year-label` : undefined;
  } else if (view === 'month') {
    label = String(cursor.getFullYear());
    labelTestId = testId ? `${testId}-year-label` : undefined;
  } else {
    const start = yearPageStart(cursor.getFullYear());
    label = `${start} - ${start + YEAR_ITEM_COUNT - 1}`;
  }

  return (
    <div
      data-testid={testId ? `${testId}-header` : undefined}
      className="flex items-center justify-between px-3 py-2"
    >
      <button
        type="button"
        data-testid={testId ? `${testId}-prev` : undefined}
        className={navButtonClasses}
        onClick={() => onNavigate(-1)}
        aria-label="Previous"
      >
        <ChevronLeft />
      </button>
      {view === 'year' ? (
        <span className="text-sm font-semibold text-foreground">{label}</span>
      ) : (
        <button
          type="button"
          data-testid={labelTestId}
          className="cursor-pointer text-sm font-semibold text-foreground"
          onClick={() => onViewChange(view === 'date' ? 'month' : 'year')}
        >
          {label}
        </button>
      )}
      <button
        type="button"
        data-testid={testId ? `${testId}-next` : undefined}
        className={navButtonClasses}
        onClick={() => onNavigate(1)}
        aria-label="Next"
      >
        <ChevronRight />
      </button>
    </div>
  );
}

export default DatePickerHeader;
