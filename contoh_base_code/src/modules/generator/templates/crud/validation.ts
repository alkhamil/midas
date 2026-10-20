import type { TemplateContext, FieldModel } from '../../engine/context';
import { splitRule } from '../../parser';
import { buildRulesObject, needsEmoticonUtils } from '../../engine/validationGenerator';

export function validationTemplate(ctx: TemplateContext): string {
  const { names, fields, config } = ctx;
  const base = config.permissionKey;
  const needUtils = needsEmoticonUtils(fields);

  const rules = fields
    .map((f) => {
      const body = buildRulesObject(f, `${base}.fields.${f.name}.label`);
      // Field tanpa rules → body tak memakai t; prefix `_` agar lolos noUnusedParameters.
      const param = body.includes("t('") ? 't' : '_t';
      return `export function get${f.pascal}Rules(${param}: TFunction): RegisterOptions<FormValues, '${f.name}'> {\n  return ${body};\n}`;
    })
    .join('\n\n');

  return `import type { RegisterOptions } from 'react-hook-form';
import type { TFunction } from 'i18next';
import type { FormValues } from '../hooks';
${needUtils ? `import { hasEmoticon } from '${names.sharedPrefix}shared/utils';\n` : ''}
${rules}
`;
}

/** Sample bulk value per field (template example row). */
function bulkExampleValue(field: FieldModel): string | number {
  const options = field.config.options ?? [];
  switch (field.config.type) {
    case 'numberField':
    case 'currencyField':
      return 100;
    case 'dateField':
      return '2024-01-15';
    case 'checkboxField':
    case 'switchField':
      return 'Yes';
    case 'passwordField':
      return 'secret123';
    case 'selectField':
    case 'radioGroupField':
      return options[0]?.value ?? `${field.name.toUpperCase()}_1`;
    case 'selectMultipleField':
    case 'checkboxGroupField':
      return options.length >= 2
        ? `${options[0]?.value},${options[1]?.value}`
        : (options[0]?.value ?? `${field.name.toUpperCase()}_1,${field.name.toUpperCase()}_2`);
    default:
      return `Sample ${field.label}`;
  }
}

type BulkKind = 'string' | 'number' | 'date' | 'dateRange' | 'multi' | 'bool';

function bulkKind(field: FieldModel): BulkKind {
  switch (field.config.type) {
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

function bulkStaticValues(field: FieldModel): string[] | null {
  if (field.config.source !== 'mockStatic') return null;
  const options = field.config.options ?? [];
  return options.length > 0 ? options.map((o) => o.value) : null;
}

/** Parse block + rule checks for one field in the bulk row validator. */
function bulkFieldChecks(ctx: TemplateContext, field: FieldModel): string {
  const { label } = field;
  const kind = bulkKind(field);
  const header = JSON.stringify(label);
  const L = `t('${ctx.config.permissionKey}.fields.${field.name}.label')`;
  const failT = (expr: string): string => `errors.push({ field: ${header}, message: ${expr} });`;
  const lines: string[] = [];
  const v = `${field.name}Value`;
  const rules = field.config.rules.map((rule) => splitRule(rule));
  const has = (name: string): boolean => rules.some((r) => r.name === name);
  const argOf = (name: string): string | undefined => rules.find((r) => r.name === name)?.arg;

  if (kind === 'number') {
    const raw = `${field.name}Raw`;
    lines.push(`const ${raw} = String(row[${header}] ?? '').trim();`);
    lines.push(`const ${v} = ${raw} === '' ? NaN : Number(${raw});`);
    if (has('required')) {
      lines.push(`if (${raw} === '') ${failT(`t('validation.required', { label: ${L} })`)}`);
      lines.push(`else if (Number.isNaN(${v})) ${failT(`t('validation.number', { label: ${L} })`)}`);
    } else {
      lines.push(`if (${raw} === '' || Number.isNaN(${v})) ${failT(`t('validation.number', { label: ${L} })`)}`);
    }
  } else if (kind === 'date') {
    lines.push(`const ${v} = String(row[${header}] ?? '').trim();`);
    lines.push(
      `if (${v} !== '' && !/^\\d{4}-\\d{2}-\\d{2}$/.test(${v})) ${failT(`t('validation.dateFormat', { label: ${L} })`)}`,
    );
    if (has('required')) lines.push(`if (!${v}) ${failT(`t('validation.required', { label: ${L} })`)}`);
  } else if (kind === 'dateRange') {
    const startHeader = JSON.stringify(`${label} Start`);
    const endHeader = JSON.stringify(`${label} End`);
    const s = `${field.name}Start`;
    const e = `${field.name}End`;
    lines.push(`const ${s} = String(row[${startHeader}] ?? '').trim();`);
    lines.push(`const ${e} = String(row[${endHeader}] ?? '').trim();`);
    lines.push(
      `if (${s} !== '' && !/^\\d{4}-\\d{2}-\\d{2}$/.test(${s})) ${failT(`t('validation.dateStartFormat', { label: ${L} })`)}`,
    );
    lines.push(
      `if (${e} !== '' && !/^\\d{4}-\\d{2}-\\d{2}$/.test(${e})) ${failT(`t('validation.dateEndFormat', { label: ${L} })`)}`,
    );
    if (has('required')) {
      lines.push(`if (!${s} || !${e}) ${failT(`t('validation.rangeRequired', { label: ${L} })`)}`);
    }
    lines.push(`const ${v} = ${s} || ${e} ? ${s} + ',' + ${e} : '';`);
  } else if (kind === 'multi') {
    lines.push(
      `const ${v} = String(row[${header}] ?? '').split(',').map((item) => item.trim()).filter(Boolean);`,
    );
    if (has('required')) {
      lines.push(`if (${v}.length === 0) ${failT(`t('validation.required', { label: ${L} })`)}`);
    }
  } else if (kind === 'bool') {
    const raw = `${field.name}Raw`;
    lines.push(`const ${raw} = String(row[${header}] ?? '').trim().toLowerCase();`);
    lines.push(
      `const ${v} = ['ya', 'true', '1'].includes(${raw}) ? true : ['tidak', 'false', '0', ''].includes(${raw}) ? false : null;`,
    );
    lines.push(`if (${v} === null) ${failT(`t('validation.boolYesNo', { label: ${L} })`)}`);
    if (has('required')) lines.push(`if (${v} !== true) ${failT(`t('validation.required', { label: ${L} })`)}`);
  } else {
    lines.push(`const ${v} = String(row[${header}] ?? '').trim();`);
    if (has('required')) lines.push(`if (!${v}) ${failT(`t('validation.required', { label: ${L} })`)}`);
  }

  const min = argOf('min');
  const max = argOf('max');
  const minLength = argOf('minLength');
  const maxLength = argOf('maxLength');
  if (kind === 'number') {
    if (min !== undefined) {
      lines.push(
        `if (!Number.isNaN(${v}) && ${v} < ${min}) ${failT(`t('validation.minValue', { label: ${L}, count: ${min} })`)}`,
      );
    }
    if (max !== undefined) {
      lines.push(
        `if (!Number.isNaN(${v}) && ${v} > ${max}) ${failT(`t('validation.maxValue', { label: ${L}, count: ${max} })`)}`,
      );
    }
  } else if (kind === 'multi') {
    if (min !== undefined) {
      lines.push(`if (${v}.length < ${min}) ${failT(`t('validation.minItems', { label: ${L}, count: ${min} })`)}`);
    }
    if (max !== undefined) {
      lines.push(`if (${v}.length > ${max}) ${failT(`t('validation.maxItems', { label: ${L}, count: ${max} })`)}`);
    }
  } else if (kind !== 'bool' && kind !== 'dateRange') {
    const target = v;
    if (min !== undefined) {
      lines.push(
        `if (${target} !== '' && ${target}.length < ${min}) ${failT(`t('validation.minLength', { label: ${L}, count: ${min} })`)}`,
      );
    }
    if (max !== undefined) {
      lines.push(
        `if (${target} !== '' && ${target}.length > ${max}) ${failT(`t('validation.maxLength', { label: ${L}, count: ${max} })`)}`,
      );
    }
  }
  if ((kind === 'string' || kind === 'date' || kind === 'number') && minLength !== undefined) {
    const target = kind === 'number' ? `${field.name}Raw` : v;
    lines.push(
      `if (${target} !== '' && ${target}.length < ${minLength}) ${failT(`t('validation.minLength', { label: ${L}, count: ${minLength} })`)}`,
    );
  }
  if ((kind === 'string' || kind === 'date' || kind === 'number') && maxLength !== undefined) {
    const target = kind === 'number' ? `${field.name}Raw` : v;
    lines.push(
      `if (${target} !== '' && ${target}.length > ${maxLength}) ${failT(`t('validation.maxLength', { label: ${L}, count: ${maxLength} })`)}`,
    );
  }
  if (has('email') && (kind === 'string' || kind === 'date' || kind === 'number')) {
    const target = kind === 'number' ? `${field.name}Raw` : v;
    lines.push(
      `if (${target} !== '' && !EMAIL_RE.test(${target})) ${failT(`t('validation.email')`)}`,
    );
  }
  const regexArg = argOf('regex');
  if (regexArg !== undefined && (kind === 'string' || kind === 'date' || kind === 'number')) {
    const target = kind === 'number' ? `${field.name}Raw` : v;
    lines.push(
      `if (${target} !== '' && !new RegExp(${JSON.stringify(regexArg)}).test(${target})) ${failT(`t('validation.pattern', { label: ${L} })`)}`,
    );
  }
  if (has('withoutemoticon') && kind === 'string') {
    lines.push(`if (${v} !== '' && hasEmoticon(${v})) ${failT(`t('validation.noEmoticon')`)}`);
  }
  const staticValues = bulkStaticValues(field);
  if (staticValues && (kind === 'string' || kind === 'multi')) {
    if (kind === 'multi') {
      lines.push(
        `for (const item of ${v}) { if (!${field.name}Values.includes(item)) errors.push({ field: ${header}, message: t('validation.unknownOption', { label: ${L}, value: item }) }); }`,
      );
    } else {
      lines.push(
        `if (${v} !== '' && !${field.name}Values.includes(${v})) ${failT(`t('validation.optionIn', { label: ${L}, options: ${JSON.stringify(staticValues.join(', '))} })`)}`,
      );
    }
  }
  if (has('unique') && kind !== 'multi' && kind !== 'bool') {
    if (kind === 'number') {
      lines.push(
        `if (!Number.isNaN(${v}) && isTaken('${field.name}', String(${v}))) ${failT(`t('validation.unique', { label: ${L} })`)}`,
      );
    } else if (kind === 'dateRange') {
      lines.push(
        `if (${v} !== '' && isTaken('${field.name}', ${v})) ${failT(`t('validation.unique', { label: ${L} })`)}`,
      );
    } else {
      lines.push(
        `if (${v} !== '' && isTaken('${field.name}', ${v})) ${failT(`t('validation.unique', { label: ${L} })`)}`,
      );
    }
  }

  return lines.map((line) => `  ${line}`).join('\n');
}

export function bulkValidationTemplate(ctx: TemplateContext): string {
  const { names, fields } = ctx;
  const bulkFields = fields.filter(
    (f) => f.config.type !== 'fileUploadField' && f.config.type !== 'formArrayField',
  );
  const needUtils = needsEmoticonUtils(bulkFields);
  const needEmailRe = bulkFields.some((f) => f.config.rules.includes('email'));
  const constName = names.entity.toUpperCase();

  const headers: string[] = [];
  const examples: (string | number)[] = [];
  for (const field of bulkFields) {
    if (field.config.type === 'dateRangeField') {
      headers.push(`${field.label} Start`, `${field.label} End`);
      examples.push('2024-01-01', '2024-01-31');
    } else {
      headers.push(field.label);
      examples.push(bulkExampleValue(field));
    }
  }
  const valuesConsts = bulkFields
    .map((f) => {
      const values = bulkStaticValues(f);
      return values ? `const ${f.name}Values = ${JSON.stringify(values)};` : '';
    })
    .filter(Boolean)
    .join('\n');

  const checks = bulkFields.map((f) => bulkFieldChecks(ctx, f)).join('\n');
  // Mirror the isTaken usage condition in bulkFieldChecks so the param is not unused.
  const hasUniqueCheck = bulkFields.some(
    (f) =>
      f.config.rules.map((rule) => splitRule(rule)).some((r) => r.name === 'unique') &&
      bulkKind(f) !== 'multi' &&
      bulkKind(f) !== 'bool',
  );
  const payloadLines = fields
    .map((f) => {
      if (f.config.type === 'fileUploadField') return `    ${f.name}: '',`;
      if (f.config.type === 'formArrayField') return `    ${f.name}: [],`;
      if (f.valueType === 'boolean') return `    ${f.name}: ${f.name}Value ?? false,`;
      return `    ${f.name}: ${f.name}Value,`;
    })
    .join('\n');

  const needI18n = checks.includes("t('");
  const i18nImport = needI18n ? `import { t } from 'i18next';\nimport '${names.sharedPrefix}shared/i18n';\n` : '';
  return `${i18nImport}import type { ${names.payload} } from '../types';
${needUtils ? `import { hasEmoticon } from '${names.sharedPrefix}shared/utils';\n` : ''}
export interface BulkFieldError {
  field: string;
  message: string;
}

export interface BulkRowValidation {
  payload: ${names.payload} | null;
  errors: BulkFieldError[];
}

/** Bulk template column headers (also used for row mapping). */
export const BULK_${constName}_HEADERS = ${JSON.stringify(headers)};

/** Example row in the bulk upload template. */
export const BULK_${constName}_EXAMPLE = ${JSON.stringify(examples)};
${needEmailRe ? '\nconst EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n' : ''}${valuesConsts ? `\n${valuesConsts}\n` : ''}
/**
 * Validasi satu baris bulk (key = header). Aturan mirror validasi form +
 * membership option + unique via \`isTaken\`.
 */
export function validateBulk${names.entity}Row(
  row: Record<string, unknown>,
  ${hasUniqueCheck ? 'isTaken' : '_isTaken'}: (field: string, value: string) => boolean,
): BulkRowValidation {
  const errors: BulkFieldError[] = [];
${checks}
  if (errors.length > 0) return { payload: null, errors };
  return {
    payload: {
${payloadLines}
    },
    errors,
  };
}
`;
}
