import { isValidElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import ErrorStatePage from './ErrorStatePage';
import type { ErrorPageType } from '../../utils';

export interface DetailRow {
  label: string;
  value?: ReactNode;
  /** Nama field sumber (diisi builder/runtime; dipakai seleksi kanvas). */
  name?: string;
  fullWidth?: boolean;
  noDivider?: boolean;
  /** Renders the row as a section heading (label spans full width). */
  heading?: boolean;
  /** Action di kanan heading (mis. tombol) — hanya dipakai saat `heading` true. */
  headingAction?: ReactNode;
  /** Extra classes for the row wrapper (e.g. heading padding). */
  className?: string;
}

interface DetailCardState {
  status: 'loading' | 'error' | 'success';
  message?: string;
  rows?: DetailRow[];
  /** Halaman error yang ditampilkan saat `status === 'error'` (default '500'). */
  errorType?: ErrorPageType;
}

interface DetailCardProps {
  title?: string;
  state: DetailCardState;
  actions?: ReactNode;
  testId?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Render rows tanpa pembungkus Card (mis. isi tab panel). */
  bare?: boolean;
  /** Judul empty state saat rows kosong (default `table.emptyTitle`). */
  emptyTitle?: string;
  /** Deskripsi empty state saat rows kosong (opsional). */
  emptyDescription?: string;
}

function renderValue(value: ReactNode): ReactNode {
  if (
    isValidElement(value) ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value == null
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => <div key={i}>{renderValue(item)}</div>);
  }
  if (typeof value === 'object') {
    const record = value as unknown as Record<string, unknown>;
    if ('label' in record && typeof record.label === 'string') {
      return record.label;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function DetailCard({
  title,
  state,
  actions,
  testId,
  collapsible = false,
  defaultOpen = true,
  bare = false,
  emptyTitle,
  emptyDescription,
}: DetailCardProps) {
  const { t } = useTranslation();
  if (state.status === 'error') {
    return (
      <div data-testid={testId}>
        <ErrorStatePage type={state.errorType ?? '500'} className="min-h-[calc(100vh-12rem)]!" />
        {state.message && (
          <p className="mt-4 text-center text-sm text-muted-foreground">{state.message}</p>
        )}
      </div>
    );
  }

  const rows = state.status === 'success' ? (state.rows ?? []) : [];
  const body =
    state.status === 'loading' ? (
      <div>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`grid grid-cols-[300px_1fr] items-center gap-4 py-4 ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    ) : rows.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-8 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle ?? t('table.emptyTitle')}</p>
        {emptyDescription && (
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        )}
      </div>
    ) : (
      <div>
        {rows.map((row, i) => {
          const { label, value, fullWidth, noDivider, heading, headingAction, className } = row;
          const rowKey = row.name ?? `${label}-${i}`;
          const prevWasHeading = i > 0 && !!rows[i - 1].heading;
          const showBorder = i > 0 && !noDivider && !prevWasHeading;
          return heading ? (
            <div
              key={rowKey}
              className={`flex items-center justify-between gap-2 ${showBorder ? 'border-t border-border' : ''} ${className ?? ''}`}
            >
              <span className="text-base font-semibold text-foreground">{label}</span>
              {headingAction}
            </div>
          ) : fullWidth ? (
            <div key={rowKey} className={`py-4 ${showBorder ? 'border-t border-border' : ''}`}>
              <div className="mb-1 text-sm text-muted-foreground">{label}</div>
              <div className="text-sm break-all text-foreground">{renderValue(value)}</div>
            </div>
          ) : (
            <div
              key={rowKey}
              className={`grid grid-cols-[300px_1fr] gap-4 py-4 px-0 ${showBorder ? 'border-t border-border' : ''}`}
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="text-sm break-all text-foreground">{renderValue(value)}</div>
            </div>
          );
        })}
      </div>
    );

  if (bare) {
    return <div data-testid={testId}>{body}</div>;
  }

  return (
    <div data-testid={testId}>
      <Card title={title} actions={actions} collapsible={collapsible} defaultOpen={defaultOpen}>
        {body}
      </Card>
    </div>
  );
}

export default DetailCard;
