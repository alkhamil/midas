import { splitRule } from '../parser';
import type { FieldModel } from './context';

/**
 * Bangun isi aturan RHF untuk satu field dari rules string
 * (`required|min:3|max:100|withoutemoticon|email|regex:...`).
 * `unique` dilewat (dicek server-side saat submit).
 */
export function buildRulesObject(field: FieldModel, labelKey?: string): string {
  const label = field.label;
  // Bila labelKey diisi → pesan memakai key general + label terjemahan.
  // Tanpa labelKey → pesan Inggris literal (dipakai probe/konteks non-i18n).
  const req = (suffix: string): string =>
    labelKey
      ? `t('validation.required', { label: t('${labelKey}') })${suffix}`
      : `'${label} is required.'${suffix}`;
  const tLabel = labelKey ? `t('${labelKey}')` : null;
  const isNumber = field.valueType === 'number';
  const isArray = field.valueType === 'stringArray' || field.valueType === 'rowArray';
  const lines: string[] = [];

  // Beberapa rule array memakai kunci `validate` yang sama — yang pertama menang.
  const hasValidate = (): boolean => lines.some((line) => line.startsWith('validate:'));

  for (const rule of field.config.rules) {
    const { name, arg } = splitRule(rule);
    switch (name) {
      case 'required':
        lines.push(
          isArray
            ? `validate: (value: unknown[]) => (value && value.length > 0) || ${req(',')}`
            : `required: ${req(',')}`
        );
        break;
      case 'min':
        if (arg !== undefined) {
          if (isArray) {
            if (!hasValidate()) {
              lines.push(
                `validate: (value: unknown[]) => (value && value.length >= ${arg}) || ${tLabel ? `t('validation.minItems', { label: ${tLabel}, count: ${arg} })` : `'${label} must have at least ${arg} item(s).'`},`,
              );
            }
          } else {
            lines.push(
              isNumber
                ? `min: { value: ${arg}, message: ${tLabel ? `t('validation.minValue', { label: ${tLabel}, count: ${arg} })` : `'${label} must be at least ${arg}.'`} },`
                : `minLength: { value: ${arg}, message: ${tLabel ? `t('validation.minLength', { label: ${tLabel}, count: ${arg} })` : `'${label} must be at least ${arg} characters.'`} },`,
            );
          }
        }
        break;
      case 'max':
        if (arg !== undefined) {
          if (isArray) {
            if (!hasValidate()) {
              lines.push(
                `validate: (value: unknown[]) => (value && value.length <= ${arg}) || ${tLabel ? `t('validation.maxItems', { label: ${tLabel}, count: ${arg} })` : `'${label} must have at most ${arg} item(s).'`},`,
              );
            }
          } else {
            lines.push(
              isNumber
                ? `max: { value: ${arg}, message: ${tLabel ? `t('validation.maxValue', { label: ${tLabel}, count: ${arg} })` : `'${label} must be at most ${arg}.'`} },`
                : `maxLength: { value: ${arg}, message: ${tLabel ? `t('validation.maxLength', { label: ${tLabel}, count: ${arg} })` : `'${label} cannot be greater than ${arg} characters.'`} },`,
            );
          }
        }
        break;
      case 'minLength':
        if (arg !== undefined && !isArray) {
          lines.push(
            `minLength: { value: ${arg}, message: ${tLabel ? `t('validation.minLength', { label: ${tLabel}, count: ${arg} })` : `'${label} must be at least ${arg} characters.'`} },`,
          );
        }
        break;
      case 'maxLength':
        if (arg !== undefined && !isArray) {
          lines.push(
            `maxLength: { value: ${arg}, message: ${tLabel ? `t('validation.maxLength', { label: ${tLabel}, count: ${arg} })` : `'${label} cannot be greater than ${arg} characters.'`} },`,
          );
        }
        break;
      case 'email':
        if (!isArray) {
          lines.push(
            `pattern: { value: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, message: ${tLabel ? `t('validation.pattern', { label: ${tLabel} })` : `'${label} format is invalid.'`} },`,
          );
        }
        break;
      case 'withoutemoticon':
        if (!isArray) {
          lines.push(
            `validate: (value: string) => !hasEmoticon(value || '') || ${tLabel ? `t('validation.noEmoticon')` : 'WITHOUT_EMOTICON_MESSAGE'},`,
          );
        }
        break;
      case 'regex':
        if (arg !== undefined && !isArray) {
          const escaped = arg.replace(/\//g, '\\/');
          lines.push(`pattern: { value: /${escaped}/, message: ${tLabel ? `t('validation.pattern', { label: ${tLabel} })` : `'${label} format is invalid.'`} },`);
        }
        break;
      case 'unique':
        // Dicek server-side (atau mock conflict); tidak ada validasi client.
        break;
      default:
        break;
    }
  }

  if (lines.length === 0) return '{}';
  return `{\n${lines.map((line) => `  ${line}`).join('\n')}\n}`;
}

/** Ambil nilai maxLength (number) dari rules bila ada — untuk prop `maxLength` input. */
export function getMaxLength(field: FieldModel): number | null {
  for (const rule of field.config.rules) {
    const { name, arg } = splitRule(rule);
    if ((name === 'maxLength' || (name === 'max' && field.valueType !== 'number')) && arg) {
      const parsed = Number(arg);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** True bila ada field yang memakai rule `withoutemoticon` (butuh import utils). */
export function needsEmoticonUtils(fields: FieldModel[]): boolean {
  return fields.some((field) => field.config.rules.includes('withoutemoticon'));
}
