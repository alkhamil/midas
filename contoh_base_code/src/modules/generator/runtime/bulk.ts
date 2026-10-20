/**
 * Engine bulk upload generik (mock-only): header/template + validasi per baris.
 * Kepala + pesan + perilaku SAMA PERSIS agar mock dan BE sejalan.
 * Murni & Node-safe.
 */
import { t } from 'i18next';
import '../../../shared/i18n';
import type { GeneratorFieldConfig } from '../types';

export interface BulkFieldError {
  field?: string;
  message: string;
}

export interface BulkRowValidation {
  payload: Record<string, unknown> | null;
  errors: BulkFieldError[];
}

export interface BulkUploadResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: (BulkFieldError & { row: number })[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Uji pola regex secara aman (pola rusak dari definisi lama: lolos, tak crash). */
function safePatternTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMOTICON_RE = /\p{Extended_Pictographic}/u;

type BulkKind = 'string' | 'number' | 'date' | 'dateRange' | 'multi' | 'bool';

function bulkKind(type: string): BulkKind {
  switch (type) {
    case 'numberField':
    case 'currencyField':
      return 'number';
    case 'dateField':
      return 'date';
    case 'dateRangeField':
      return 'dateRange';
    case 'selectMultipleField':
    case 'checkboxGroupField':
      return 'multi';
    case 'checkboxField':
    case 'switchField':
      return 'bool';
    default:
      return 'string';
  }
}

function splitRule(rule: string): { name: string; arg?: string } {
  const index = rule.indexOf(':');
  if (index === -1) return { name: rule };
  return { name: rule.slice(0, index), arg: rule.slice(index + 1) };
}

export function bulkableFields(fields: GeneratorFieldConfig[]): GeneratorFieldConfig[] {
  return fields.filter(
    (field) => field.type !== 'fileUploadField' && field.type !== 'formArrayField',
  );
}

function staticValuesOf(field: GeneratorFieldConfig): string[] | null {
  if (field.source !== 'mockStatic' || !field.options || field.options.length === 0) return null;
  return field.options.map((option) => option.value);
}

export function bulkHeaders(fields: GeneratorFieldConfig[]): string[] {
  const headers: string[] = [];
  for (const field of bulkableFields(fields)) {
    if (field.type === 'dateRangeField') {
      headers.push(`${field.label} Start`, `${field.label} End`);
    } else {
      headers.push(field.label);
    }
  }
  return headers;
}

export function bulkExampleRow(fields: GeneratorFieldConfig[]): (string | number)[] {
  const row: (string | number)[] = [];
  for (const field of bulkableFields(fields)) {
    if (field.type === 'dateRangeField') {
      row.push('2024-01-01', '2024-01-31');
      continue;
    }
    switch (field.type) {
      case 'numberField':
      case 'currencyField':
        row.push(100);
        break;
      case 'dateField':
        row.push('2024-01-15');
        break;
      case 'checkboxField':
      case 'switchField':
        row.push('Ya');
        break;
      case 'passwordField':
        row.push('secret123');
        break;
      case 'selectField':
      case 'radioGroupField': {
        const values = staticValuesOf(field) ?? [];
        row.push(values[0] ?? `${field.name.toUpperCase()}_1`);
        break;
      }
      case 'selectMultipleField':
      case 'checkboxGroupField': {
        const values = staticValuesOf(field) ?? [];
        row.push(
          values.length >= 2
            ? `${values[0]},${values[1]}`
            : (values[0] ?? `${field.name.toUpperCase()}_1,${field.name.toUpperCase()}_2`),
        );
        break;
      }
      default:
        row.push(`${t('bulk.examplePrefix')} ${field.label}`);
        break;
    }
  }
  return row;
}

export function exportHeaders(fields: GeneratorFieldConfig[]): string[] {
  return [...fields.map((field) => field.label), 'Status', 'Created Date'];
}

export function exportCellValue(
  type: string,
  value: unknown,
): string | number | boolean | null {
  const kind = bulkKind(type);
  if (kind === 'bool') return value ? 'Yes' : 'No';
  if (kind === 'multi') return Array.isArray(value) ? value.join(', ') : '';
  if (type === 'formArrayField') {
    const count = Array.isArray(value) ? value.length : 0;
    return count > 0 ? `${count} baris` : '';
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function validateBulkRow(
  fields: GeneratorFieldConfig[],
  row: Record<string, unknown>,
  isTaken: (field: string, value: string) => boolean,
): BulkRowValidation {
  const errors: BulkFieldError[] = [];
  const payload: Record<string, unknown> = {};
  const fail = (field: string, message: string): void => {
    errors.push({ field, message });
  };

  for (const field of fields) {
    if (field.type === 'fileUploadField') {
      payload[field.name] = '';
      continue;
    }
    if (field.type === 'formArrayField') {
      payload[field.name] = [];
      continue;
    }
    const { label } = field;
    const kind = bulkKind(field.type);
    const rules = field.rules.map(splitRule);
    const has = (name: string): boolean => rules.some((rule) => rule.name === name);
    const argOf = (name: string): string | undefined =>
      rules.find((rule) => rule.name === name)?.arg;
    const statics = staticValuesOf(field);

    if (kind === 'number') {
      const raw = String(row[label] ?? '').trim();
      const value = raw === '' ? NaN : Number(raw);
      if (has('required')) {
        if (raw === '') fail(label, t('validation.required', { label }));
        else if (Number.isNaN(value)) fail(label, t('validation.number', { label }));
      } else if (raw === '' || Number.isNaN(value)) {
        fail(label, t('validation.number', { label }));
      }
      const min = argOf('min');
      const max = argOf('max');
      if (min !== undefined && !Number.isNaN(value) && value < Number(min)) {
        fail(label, t('validation.minValue', { label, count: min }));
      }
      if (max !== undefined && !Number.isNaN(value) && value > Number(max)) {
        fail(label, t('validation.maxValue', { label, count: max }));
      }
      const minLength = argOf('minLength');
      const maxLength = argOf('maxLength');
      if (minLength !== undefined && raw !== '' && raw.length < Number(minLength)) {
        fail(label, t('validation.minLength', { label, count: minLength }));
      }
      if (maxLength !== undefined && raw !== '' && raw.length > Number(maxLength)) {
        fail(label, t('validation.maxLength', { label, count: maxLength }));
      }
      if (has('email') && raw !== '' && !EMAIL_RE.test(raw)) {
        fail(label, t('validation.email'));
      }
      const regexArg = argOf('regex');
      if (regexArg !== undefined && raw !== '' && !safePatternTest(regexArg, raw)) {
        fail(label, t('validation.pattern', { label }));
      }
      if (has('unique') && !Number.isNaN(value) && isTaken(field.name, String(value))) {
        fail(label, t('validation.unique', { label }));
      }
      payload[field.name] = value;
      continue;
    }

    if (kind === 'date') {
      const value = String(row[label] ?? '').trim();
      if (value !== '' && !DATE_RE.test(value)) fail(label, t('validation.dateFormat', { label }));
      if (has('required') && !value) fail(label, t('validation.required', { label }));
      applyStringRules(field, value, fail, { email: true, regex: true, lengths: true, minMaxLength: true });
      if (has('unique') && value !== '' && isTaken(field.name, value)) {
        fail(label, t('validation.unique', { label }));
      }
      payload[field.name] = value;
      continue;
    }

    if (kind === 'dateRange') {
      const start = String(row[`${label} Start`] ?? '').trim();
      const end = String(row[`${label} End`] ?? '').trim();
      if (start !== '' && !DATE_RE.test(start)) {
        fail(label, t('validation.dateStartFormat', { label }));
      }
      if (end !== '' && !DATE_RE.test(end)) fail(label, t('validation.dateEndFormat', { label }));
      if (has('required') && (!start || !end)) {
        fail(label, t('validation.rangeRequired', { label }));
      }
      const value = start || end ? `${start},${end}` : '';
      if (has('unique') && value !== '' && isTaken(field.name, value)) {
        fail(label, t('validation.unique', { label }));
      }
      payload[field.name] = value;
      continue;
    }

    if (kind === 'multi') {
      const value = String(row[label] ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (has('required') && value.length === 0) fail(label, t('validation.required', { label }));
      const min = argOf('min');
      const max = argOf('max');
      if (min !== undefined && value.length < Number(min)) {
        fail(label, t('validation.minItems', { label, count: min }));
      }
      if (max !== undefined && value.length > Number(max)) {
        fail(label, t('validation.maxItems', { label, count: max }));
      }
      if (statics) {
        for (const item of value) {
          if (!statics.includes(item)) {
            fail(label, t('validation.unknownOption', { label, value: item }));
          }
        }
      }
      payload[field.name] = value;
      continue;
    }

    if (kind === 'bool') {
      const raw = String(row[label] ?? '').trim().toLowerCase();
      const value = ['ya', 'true', '1'].includes(raw)
        ? true
        : ['tidak', 'false', '0', ''].includes(raw)
          ? false
          : null;
      if (value === null) fail(label, t('validation.boolYesNo', { label }));
      if (has('required') && value !== true) fail(label, t('validation.required', { label }));
      payload[field.name] = value ?? false;
      continue;
    }

    const value = String(row[label] ?? '').trim();
    if (has('required') && !value) fail(label, t('validation.required', { label }));
    applyStringRules(field, value, fail, {
      email: true,
      regex: true,
      lengths: true,
      emoticon: true,
      minMaxLength: true,
    });
    if (statics && value !== '' && !statics.includes(value)) {
      fail(label, t('validation.optionIn', { label, options: statics.join(', ') }));
    }
    if (has('unique') && value !== '' && isTaken(field.name, value)) {
      fail(label, t('validation.unique', { label }));
    }
    payload[field.name] = value;
  }

  if (errors.length > 0) return { payload: null, errors };
  return { payload, errors };
}

function applyStringRules(
  field: GeneratorFieldConfig,
  value: string,
  fail: (field: string, message: string) => void,
  opts: { email?: boolean; regex?: boolean; lengths?: boolean; emoticon?: boolean; minMaxLength?: boolean },
): void {
  const rules = field.rules.map(splitRule);
  const has = (name: string): boolean => rules.some((rule) => rule.name === name);
  const argOf = (name: string): string | undefined =>
    rules.find((rule) => rule.name === name)?.arg;
  const { label } = field;
  if (opts.minMaxLength) {
    const min = argOf('min');
    const max = argOf('max');
    if (min !== undefined && value !== '' && value.length < Number(min)) {
      fail(label, t('validation.minLength', { label, count: min }));
    }
    if (max !== undefined && value !== '' && value.length > Number(max)) {
      fail(label, t('validation.maxLength', { label, count: max }));
    }
  }
  if (opts.lengths) {
    const minLength = argOf('minLength');
    const maxLength = argOf('maxLength');
    if (minLength !== undefined && value !== '' && value.length < Number(minLength)) {
      fail(label, t('validation.minLength', { label, count: minLength }));
    }
    if (maxLength !== undefined && value !== '' && value.length > Number(maxLength)) {
      fail(label, t('validation.maxLength', { label, count: maxLength }));
    }
  }
  if (opts.email && has('email') && value !== '' && !EMAIL_RE.test(value)) {
    fail(label, t('validation.email'));
  }
  const regexArg = argOf('regex');
  if (opts.regex && regexArg !== undefined && value !== '' && !safePatternTest(regexArg, value)) {
    fail(label, t('validation.pattern', { label }));
  }
  if (opts.emoticon && has('withoutemoticon') && value !== '' && EMOTICON_RE.test(value)) {
    fail(label, `${label} tidak boleh mengandung emoticon.`);
  }
}
