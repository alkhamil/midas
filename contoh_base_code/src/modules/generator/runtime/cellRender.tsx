/** Render sel tabel per tipe field — dipakai list runtime + kolom FormArrayField. */
import { t } from 'i18next';
import '../../../shared/i18n';
import type { ReactNode } from 'react';
import Badge from '../../../shared/components/ui/Badge';
import type { Column } from '../../../shared/components/ui/Table';
import {
  capitalize,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatNumber,
  stripHtml,
} from '../../../shared/utils';
import type { DynamicListItem } from './types';
import { RelationLabel, type RelationOptionLoader } from '../../../shared/components/ui';

/** Opsi statis untuk dipetakan value → label di sel tabel. */
export interface StaticOption {
  label: string;
  value: string;
}

/**
 * Opsi statis field (source `none`/`mockStatic` + options terisi) —
 * undefined bila label harus fallback ke value (source async).
 */
export function staticOptionsOf(field: {
  source?: string;
  options?: StaticOption[] | undefined;
}): StaticOption[] | undefined {
  if (!field.options || field.options.length === 0) return undefined;
  if (field.source !== undefined && field.source !== 'none' && field.source !== 'mockStatic') {
    return undefined;
  }
  return field.options;
}

function singleLabel(options: StaticOption[] | undefined, value: unknown): string {
  const raw = String(value ?? '');
  return options?.find((o) => o.value === raw)?.label ?? capitalize(raw);
}

function multiLabel(options: StaticOption[] | undefined, value: unknown): string {
  const list = Array.isArray(value) ? value : [];
  return list.map((v) => singleLabel(options, v)).join(', ');
}

export function columnRenderForType(
  fieldType: string,
  name: string,
  options?: StaticOption[],
  loader?: RelationOptionLoader,
): ((row: Record<string, unknown>) => ReactNode) | undefined {
  switch (fieldType) {
    case 'numberField':
    case 'currencyField':
      return (row) => formatNumber(Number(row[name] ?? 0));
    case 'dateField':
      return (row) => formatDate(String(row[name] ?? ''));
    case 'dateRangeField':
      return (row) => formatDateRange(String(row[name] ?? ''));
    case 'checkboxField':
    case 'switchField':
      return (row) => (row[name] ? 'Yes' : 'No');
    case 'selectField':
    case 'radioGroupField':
      if (!options && loader) {
        return (row) => <RelationLabel loader={loader} value={String(row[name] ?? '')} />;
      }
      return (row) => singleLabel(options, row[name]);
    case 'selectMultipleField':
    case 'checkboxGroupField':
      if (!options && loader) {
        return (row) => (
          <>
            {(Array.isArray(row[name]) ? (row[name] as unknown[]) : []).map((v, i) => (
              <span key={String(v ?? i)}>
                {i > 0 ? ', ' : ''}
                <RelationLabel loader={loader} value={String(v ?? '')} />
              </span>
            ))}
          </>
        );
      }
      return (row) => multiLabel(options, row[name]);
    case 'passwordField':
      return () => '••••••';
    case 'colorField':
      return (row) =>
        row[name] ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-4 w-4 rounded border border-border"
              style={{ backgroundColor: String(row[name]) }}
            />
            <span>{String(row[name])}</span>
          </span>
        ) : (
          '-'
        );
    case 'editorField':
      return (row) => stripHtml(String(row[name] ?? '')) || '-';
    case 'formArrayField':
      return (row) => {
        const rows = row[name];
        const count = Array.isArray(rows) ? rows.length : 0;
        return count > 0 ? t('system.rowCount', { count }) : '-';
      };
    default:
      return undefined;
  }
}

/** Definisi kolom sistem tabel (header label + render sel + class). */
export function systemTableColumn(
  key: string,
): Pick<Column<DynamicListItem>, 'key' | 'header' | 'render' | 'sortable' | 'className'> | null {
  switch (key) {
    case 'created_by':
      return { key, header: t('table.createdBy') };
    case 'created_date':
      return {
        key,
        header: t('table.createdDate'),
        render: (row) => formatDateTime(String(row.created_date ?? '')),
      };
    case 'status':
      return {
        key,
        header: t('table.status'),
        sortable: false,
        className: 'w-32',
        render: (row) => (
          <Badge variant={row.status === 'active' ? 'success' : 'secondary'}>
            {capitalize(row.status)}
          </Badge>
        ),
      };
    default:
      return null;
  }
}
