/**
 * Logika list runtime: FilterToolbar fields + filter/sort/paginate mock.
 * Meniru 1:1 template generate (`filterFieldSnippet`, `mockFilterLine`,
 * `filter<EntityPlural>Records`, `sort<EntityPlural>`, `paginate`).
 * Murni & Node-safe (tipe UI diimpor type-only).
 */
import { t } from 'i18next';
import '../../../shared/i18n';
import type { FilterField } from '../../../shared/components/ui';
import type { ModuleDefinition } from '../definitions';
import { moduleFieldLabel } from './moduleI18n';
import type { LoadOptionsFn } from '../../../shared/components/ui/fields/SelectField';
import type { GeneratorFieldConfig } from '../types';
import { fieldTypeRegistry } from '../registry';
import type { DynamicListItem } from './types';

/** Bangun FilterToolbar fields dari definisi (status sistem + field filterable). */
export function buildFilterFields(
  fields: GeneratorFieldConfig[],
  loadOptionsFor: (field: GeneratorFieldConfig) => LoadOptionsFn | undefined,
  def?: Pick<ModuleDefinition, 'i18n'>,
): FilterField[] {
  const statusField: FilterField = {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  };
  const items: FilterField[] = [statusField];
  for (const field of fields) {
    if (field.filterable === false) continue;
    const criteria = field.filterCriteria;
    if (!criteria) continue;
    const isMulti = field.type === 'selectMultipleField' || field.type === 'checkboxGroupField';
    switch (criteria) {
      case 'contains':
        items.push({ name: field.name, label: moduleFieldLabel(def, field), type: 'text', placeholder: t('filter.containsPh') });
        break;
      case 'exact':
      case 'numberExact':
        items.push({ name: field.name, label: moduleFieldLabel(def, field), type: 'text' });
        break;
      case 'numberMin':
        items.push({ name: field.name, label: `${moduleFieldLabel(def, field)} (Min)`, type: 'text', placeholder: t('filter.minPh') });
        break;
      case 'numberMax':
        items.push({ name: field.name, label: `${moduleFieldLabel(def, field)} (Max)`, type: 'text', placeholder: t('filter.maxPh') });
        break;
      case 'numberRange':
        items.push(
          { name: `${field.name}Min`, label: `${moduleFieldLabel(def, field)} (Min)`, type: 'text', placeholder: t('filter.minPh') },
          { name: `${field.name}Max`, label: `${moduleFieldLabel(def, field)} (Max)`, type: 'text', placeholder: t('filter.maxPh') },
        );
        break;
      case 'dateExact':
        items.push({ name: field.name, label: moduleFieldLabel(def, field), type: 'date' });
        break;
      case 'dateRange':
      case 'dateOverlap':
        items.push({
          name: field.name,
          label: moduleFieldLabel(def, field),
          type: 'date',
          range: true,
          rangeErrorMessage: t('validation.rangeRequired', { label: moduleFieldLabel(def, field) }),
        });
        break;
      case 'booleanExact':
        items.push({
          name: field.name,
          label: moduleFieldLabel(def, field),
          type: 'select',
          options: [
            { label: t('filter.yes'), value: 'true' },
            { label: t('filter.no'), value: 'false' },
          ],
        });
        break;
      case 'optionAny':
      case 'optionExact':
      default: {
        const filterType = isMulti ? 'multi-select' : 'select';
        const loader = loadOptionsFor(field);
        if (field.source === 'mockStatic' || field.source === 'api') {
          items.push({
            name: field.name,
            label: moduleFieldLabel(def, field),
            type: filterType,
            options: (field.options ?? []).map((option) => ({ ...option })),
          });
        } else if (loader) {
          items.push({ name: field.name, label: moduleFieldLabel(def, field), type: filterType, loadOptions: loader });
        } else {
          items.push({ name: field.name, label: moduleFieldLabel(def, field), type: filterType, options: [] });
        }
        break;
      }
    }
  }
  return items;
}

/** Terapkan search + filter kolom + sort (tanpa paging). */
export function filterDynamicRecords(
  fields: GeneratorFieldConfig[],
  rows: DynamicListItem[],
  params: Record<string, string | number | undefined>,
): DynamicListItem[] {
  let items = [...rows];
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : '';
  if (search) {
    const stringFields = fields.filter((f) => fieldTypeRegistry[f.type].valueType === 'string');
    const arrayFields = fields.filter((f) => fieldTypeRegistry[f.type].valueType === 'stringArray');
    items = items.filter(
      (row) =>
        stringFields.some((f) => String(row[f.name] ?? '').toLowerCase().includes(search)) ||
        arrayFields.some((f) =>
          ((row[f.name] as string[] | null) ?? []).join(' ').toLowerCase().includes(search),
        ) ||
        String(row.id).includes(search),
    );
  }
  if (typeof params.status === 'string' && params.status !== '') {
    items = items.filter((row) => row.status === params.status);
  }
  for (const field of fields) {
    if (field.filterable === false) continue;
    const criteria = field.filterCriteria;
    if (!criteria) continue;
    const raw = params[field.name];
    const value = typeof raw === 'string' ? raw : raw === undefined ? undefined : String(raw);
    const present = (input: unknown): input is string =>
      typeof input === 'string' ? input !== '' : input !== undefined && input !== '';
    switch (criteria) {
      case 'contains':
        if (present(value)) {
          const q = value.toLowerCase();
          items = items.filter((row) => String(row[field.name] ?? '').toLowerCase().includes(q));
        }
        break;
      case 'exact':
        if (present(value)) items = items.filter((row) => String(row[field.name] ?? '') === value);
        break;
      case 'optionExact':
        if (present(value)) items = items.filter((row) => row[field.name] === value);
        break;
      case 'booleanExact':
        if (present(value)) items = items.filter((row) => String(row[field.name]) === value);
        break;
      case 'numberExact':
      case 'numberMin':
      case 'numberMax': {
        if (!present(value) || value === '') break;
        const num = Number(value);
        if (Number.isNaN(num)) break;
        if (criteria === 'numberExact') items = items.filter((row) => Number(row[field.name]) === num);
        if (criteria === 'numberMin') items = items.filter((row) => Number(row[field.name]) >= num);
        if (criteria === 'numberMax') items = items.filter((row) => Number(row[field.name]) <= num);
        break;
      }
      case 'numberRange': {
        const min = params[`${field.name}Min`];
        const max = params[`${field.name}Max`];
        if (present(min) && min !== '' && !Number.isNaN(Number(min))) {
          items = items.filter((row) => Number(row[field.name]) >= Number(min));
        }
        if (present(max) && max !== '' && !Number.isNaN(Number(max))) {
          items = items.filter((row) => Number(row[field.name]) <= Number(max));
        }
        break;
      }
      case 'dateExact':
        if (present(value)) items = items.filter((row) => row[field.name] === value);
        break;
      case 'dateRange': {
        if (!present(value)) break;
        const [start, end] = value.split(',');
        if (start && end) {
          items = items.filter((row) => {
            const cell = row[field.name];
            return typeof cell === 'string' && cell >= start && cell <= end;
          });
        }
        break;
      }
      case 'dateOverlap': {
        if (!present(value)) break;
        const [from, to] = value.split(',');
        if (from && to) {
          items = items.filter((row) => {
            const [recordStart, recordEnd] = String(row[field.name] ?? '').split(',');
            return (recordStart ?? '') <= to && from <= (recordEnd ?? '');
          });
        }
        break;
      }
      case 'optionAny': {
        if (!present(value)) break;
        const selected = new Set(value.split(','));
        items = items.filter((row) =>
          ((row[field.name] as string[] | null) ?? []).some((item) => selected.has(item)),
        );
        break;
      }
      default:
        break;
    }
  }
  const orderParam = params.order;
  const orderKey =
    typeof orderParam === 'string' && orderParam !== '' ? orderParam : (fields[0]?.name ?? 'id');
  const direction = params.sort === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = a[orderKey];
    const bv = b[orderKey];
    if (av == null || bv == null) return 0;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    return String(av).localeCompare(String(bv)) * direction;
  });
}

/** Paginate 1-based (kontrak BE; mock FE lama 0-based dan tidak dipakai runtime). */
export function paginateRecords<T>(items: T[], page: number, size: number): {
  pagination: { page: number; size: number; total_pages: number; total_elements: number };
  content: T[];
} {
  const safeSize = Math.min(Math.max(Math.floor(size) || 10, 1), 100);
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / safeSize));
  const safePage = Math.min(Math.max(Math.floor(page) || 1, 1), totalPages);
  return {
    pagination: {
      page: safePage,
      size: safeSize,
      total_pages: totalPages,
      total_elements: totalElements,
    },
    content: items.slice((safePage - 1) * safeSize, safePage * safeSize),
  };
}
