/**
 * Aturan form runtime — port `buildRulesObject`/`getMaxLength`/
 * `formDefaultValue`/`formEditValue`/`payloadMapping` (pesan + perilaku sama).
 * Murni & Node-safe.
 */
import type { RegisterOptions } from 'react-hook-form';
import { t } from 'i18next';
import '../../../shared/i18n';
import { hasEmoticon, parseCurrency } from '../../../shared/utils';
import type { GeneratorFieldConfig } from '../types';
import { fieldTypeRegistry } from '../registry';

export type DynamicFormValues = Record<string, unknown>;

function splitRule(rule: string): { name: string; arg?: string } {
  const index = rule.indexOf(':');
  if (index === -1) return { name: rule };
  return { name: rule.slice(0, index), arg: rule.slice(index + 1) };
}

function isArrayField(field: GeneratorFieldConfig): boolean {
  const formType = fieldTypeRegistry[field.type].formType;
  return formType === 'stringArray' || formType === 'rowArray';
}

/** RHF RegisterOptions dari rules generator (`label` = label tampil, bisa override terjemahan). */
export function fieldRulesToRHF(field: GeneratorFieldConfig, label: string = field.label): RegisterOptions {
  if (field.rules.length === 0) return {};
  const rules: RegisterOptions = {};
  const isArray = isArrayField(field);
  const isNumber = field.type === 'numberField' || field.type === 'currencyField';
  for (const raw of field.rules) {
    const { name, arg } = splitRule(raw);
    switch (name) {
      case 'unique':
        break;
      case 'required':
        if (isArray) {
          rules.validate = {
            ...(typeof rules.validate === 'object' ? rules.validate : {}),
            required: (value: unknown) =>
              (Array.isArray(value) && value.length > 0) || t('validation.required', { label }),
          };
        } else if (field.type === 'fileUploadField') {
          rules.validate = {
            ...(typeof rules.validate === 'object' ? rules.validate : {}),
            required: (value: unknown) =>
              value instanceof File ||
              (Array.isArray(value) && value.length > 0 && value[0] instanceof File) ||
              t('validation.required', { label }),
          };
        } else {
          rules.required = t('validation.required', { label });
        }
        break;
      case 'min':
      case 'max': {
        // Batasan rusak (kosong/non-angka) dilewati, bukan diterapkan sebagai 0/NaN.
        if ((arg ?? '').trim() === '' || !Number.isFinite(Number(arg))) break;
        const limit = Number(arg);
        if (isArray) {
          const message =
            name === 'min'
              ? t('validation.minItems', { label, count: arg })
              : t('validation.maxItems', { label, count: arg });
          rules.validate = {
            ...(typeof rules.validate === 'object' ? rules.validate : {}),
            [name]: (value: unknown) =>
              !Array.isArray(value) ||
              (name === 'min' ? value.length >= limit : value.length <= limit) ||
              message,
          };
        } else if (isNumber) {
          rules[name] = {
            value: limit,
            message:
              name === 'min'
                ? t('validation.minValue', { label, count: arg })
                : t('validation.maxValue', { label, count: arg }),
          };
        } else {
          const key = name === 'min' ? 'minLength' : 'maxLength';
          rules[key] = {
            value: limit,
            message:
              name === 'min'
                ? t('validation.minLength', { label, count: arg })
                : t('validation.maxLength', { label, count: arg }),
          };
        }
        break;
      }
      case 'minLength':
      case 'maxLength':
        if (!isArray && (arg ?? '').trim() !== '' && Number.isFinite(Number(arg))) {
          rules[name] = {
            value: Number(arg),
            message:
              name === 'minLength'
                ? t('validation.minLength', { label, count: arg })
                : t('validation.maxLength', { label, count: arg }),
          };
        }
        break;
      case 'email':
        rules.pattern = {
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: t('validation.email'),
        };
        break;
      case 'regex': {
        // Pola rusak (mis. backslash gantung saat mengetik) dilewati agar
        // render form tak crash; ditolak saat publish (validateConfig).
        let pattern: RegExp | null = null;
        try {
          pattern = new RegExp(arg ?? '');
        } catch {
          pattern = null;
        }
        if (pattern) {
          rules.pattern = {
            value: pattern,
            message: t('validation.pattern', { label }),
          };
        }
        break;
      }
      case 'withoutemoticon':
        if (!isArray) {
          rules.validate = {
            ...(typeof rules.validate === 'object' ? rules.validate : {}),
            withoutemoticon: (value: unknown) =>
              !hasEmoticon(String(value ?? '')) || t('validation.noEmoticon'),
          };
        }
        break;
      default:
        break;
    }
  }
  return rules;
}

/** Batas maxLength prop TextField (string non-number saja). */
export function maxLengthOf(field: GeneratorFieldConfig): number | null {
  if (fieldTypeRegistry[field.type].formType !== 'string') return null;
  for (const raw of field.rules) {
    const { name, arg } = splitRule(raw);
    if ((name === 'max' || name === 'maxLength') && arg !== undefined) return Number(arg);
  }
  return null;
}

/** Nilai default form per tipe (create). */
export function formDefaultValue(field: GeneratorFieldConfig): unknown {
  const formType = fieldTypeRegistry[field.type].formType;
  if (formType === 'boolean') return false;
  if (formType === 'stringArray' || formType === 'rowArray') return [];
  if (formType === 'file') return null;
  return '';
}

/** Nilai form editor baris dari baris data (number→string, file→null, default aman). */
export function rowFormValues(
  subs: GeneratorFieldConfig[],
  row: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sub of subs) {
    const valueType = fieldTypeRegistry[sub.type].valueType;
    const raw = row?.[sub.name];
    if (valueType === 'number') out[sub.name] = String(raw ?? '');
    else if (valueType === 'file') out[sub.name] = null;
    else if (valueType === 'stringArray') out[sub.name] = Array.isArray(raw) ? [...raw] : [];
    else if (valueType === 'boolean') out[sub.name] = (raw ?? false) as boolean;
    else out[sub.name] = (raw ?? '') as string;
  }
  return out;
}

/** Baris data dari nilai form editor (number→parseCurrency, file→nama file). */
export function rowPayloadValues(
  subs: GeneratorFieldConfig[],
  formRow: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sub of subs) out[sub.name] = payloadValue(sub, formRow[sub.name]);
  return out;
}

/** Nilai edit dari record detail. */
export function formEditValue(field: GeneratorFieldConfig, item: Record<string, unknown>): unknown {
  const valueType = fieldTypeRegistry[field.type].valueType;
  if (valueType === 'number') return String(item[field.name] ?? '');
  if (valueType === 'file') return null;
  return item[field.name];
}

/** Mapping nilai form → payload (parseCurrency number, nama file untuk file). */
export function payloadValue(field: GeneratorFieldConfig, value: unknown): unknown {
  const valueType = fieldTypeRegistry[field.type].valueType;
  if (valueType === 'number') return parseCurrency(String(value ?? ''));
  if (valueType === 'file') {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
      return (value as File[]).map((file) => file.name).join(', ');
    }
    return value instanceof File ? value.name : '';
  }
  return value;
}

