/** Helper props komponen per tipe field: kunci relevan, prune, sanitasi nilai. */
import type {
  FieldComponentProps,
  FieldType,
  FormItemPropsConfig,
} from './types';

const TYPE_PROPS_KEY: Record<FieldType, keyof FieldComponentProps> = {
  textField: 'text',
  numberField: 'text',
  currencyField: 'text',
  textareaField: 'textarea',
  passwordField: 'password',
  selectField: 'select',
  selectMultipleField: 'selectMultiple',
  dateField: 'date',
  dateRangeField: 'dateRange',
  radioGroupField: 'radio',
  checkboxField: 'checkbox',
  checkboxGroupField: 'checkboxGroup',
  switchField: 'switch',
  fileUploadField: 'upload',
  colorField: 'color',
  editorField: 'editor',
  formArrayField: 'array',
};

/** Kunci `componentProps` yang relevan untuk tipe field ini. */
export function propsKeyForType(type: FieldType): keyof FieldComponentProps {
  return TYPE_PROPS_KEY[type];
}

/** Span grid maksimum yang masih dianggap sempit (label pindah ke atas input). */
export const NARROW_SPAN_MAX = 6;

/**
 * Layout FormItem efektif: pilihan eksplisit menang; tanpa pilihan,
 * span sempit (<=6 dari 12 kolom) default vertikal agar proporsional.
 */
export function resolveFormItemLayout(
  explicit: 'horizontal' | 'vertical' | undefined,
  span?: number,
): 'horizontal' | 'vertical' {
  if (explicit) return explicit;
  return span !== undefined && span <= NARROW_SPAN_MAX ? 'vertical' : 'horizontal';
}

function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every(
      (v) => v === undefined || v === null || v === '',
    )
  );
}

function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out as T;
}

function clampPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const floored = Math.floor(value);
  return floored > 0 ? floored : undefined;
}

/** String `YYYY-MM-DD` valid → tanggal; selain itu undefined. */
export function parseConfigDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isValidDateString(value: unknown): value is string {
  return parseConfigDate(value) !== undefined;
}

/**
 * Props bersih untuk satu field: hanya `formItem` + kunci relevan tipenya,
 * objek kosong dibuang, angka di-clamp, tanggal divalidasi.
 */
export function pruneComponentProps(
  type: FieldType,
  props: FieldComponentProps | undefined,
): FieldComponentProps | undefined {
  if (!props) return undefined;
  const out: FieldComponentProps = {};
  if (props.formItem && !isEmptyObject(props.formItem)) {
    const cleaned = cleanObject({ ...props.formItem });
    if (!isEmptyObject(cleaned)) out.formItem = cleaned as FormItemPropsConfig;
  }
  const key = propsKeyForType(type);
  const typed = props[key] as Record<string, unknown> | undefined;
  if (typed && !isEmptyObject(typed)) {
    const cleaned = cleanObject({ ...typed });
    if (key === 'select' || key === 'selectMultiple') {
      if ('pageSize' in cleaned) {
        const size = clampPositiveInt(cleaned.pageSize);
        if (size === undefined) delete cleaned.pageSize;
        else cleaned.pageSize = size;
      }
    }
    if (key === 'date') {
      if ('minDate' in cleaned && !isValidDateString(cleaned.minDate)) delete cleaned.minDate;
      if ('maxDate' in cleaned && !isValidDateString(cleaned.maxDate)) delete cleaned.maxDate;
    }
    if (key === 'dateRange') {
      if ('maxDate' in cleaned && !isValidDateString(cleaned.maxDate)) delete cleaned.maxDate;
      if ('maxRangeDays' in cleaned) {
        const days = clampPositiveInt(cleaned.maxRangeDays);
        if (days === undefined) delete cleaned.maxRangeDays;
        else cleaned.maxRangeDays = days;
      }
    }
    if (key === 'array') {
      if ('maxRows' in cleaned) {
        const rows = clampPositiveInt(cleaned.maxRows);
        if (rows === undefined) delete cleaned.maxRows;
        else cleaned.maxRows = rows;
      }
    }
    if (!isEmptyObject(cleaned)) {
      (out as Record<string, unknown>)[key] = cleaned;
    }
  }
  return Object.keys(out).length === 0 ? undefined : out;
}
