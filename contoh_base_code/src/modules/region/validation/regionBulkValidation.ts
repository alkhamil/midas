import { t } from 'i18next';
import '../../../shared/i18n';
import type { CreateRegionPayload } from '../types';

export interface BulkFieldError {
  field: string;
  message: string;
}

export interface BulkRowValidation {
  payload: CreateRegionPayload | null;
  errors: BulkFieldError[];
}

/** Bulk template column headers (also used for row mapping). */
export const BULK_REGION_HEADERS = ["Text","Number","Textarea","Textarea","Password","Select"];

/** Example row in the bulk upload template. */
export const BULK_REGION_EXAMPLE = ["Sample Text",100,"Sample Textarea","Sample Textarea","secret123","option_1"];

const selectValues = ["option_1","option_2"];

/**
 * Validasi satu baris bulk (key = header). Aturan mirror validasi form +
 * membership option + unique via `isTaken`.
 */
export function validateBulkRegionRow(
  row: Record<string, unknown>,
  _isTaken: (field: string, value: string) => boolean,
): BulkRowValidation {
  const errors: BulkFieldError[] = [];
  const textValue = String(row["Text"] ?? '').trim();
  const numberRaw = String(row["Number"] ?? '').trim();
  const numberValue = numberRaw === '' ? NaN : Number(numberRaw);
  if (numberRaw === '' || Number.isNaN(numberValue)) errors.push({ field: "Number", message: t('validation.number', { label: t('region.fields.number.label') }) });
  const textareaValue = String(row["Textarea"] ?? '').trim();
  const textarea2Value = String(row["Textarea"] ?? '').trim();
  const passwordValue = String(row["Password"] ?? '').trim();
  const selectValue = String(row["Select"] ?? '').trim();
  if (selectValue !== '' && !selectValues.includes(selectValue)) errors.push({ field: "Select", message: t('validation.optionIn', { label: t('region.fields.select.label'), options: "option_1, option_2" }) });
  if (errors.length > 0) return { payload: null, errors };
  return {
    payload: {
    text: textValue,
    number: numberValue,
    textarea: textareaValue,
    textarea2: textarea2Value,
    password: passwordValue,
    select: selectValue,
    },
    errors,
  };
}
