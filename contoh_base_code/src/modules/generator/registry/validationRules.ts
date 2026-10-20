import type { FieldType } from '../types';

export type ValidationRuleName =
  | 'required'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'withoutemoticon'
  | 'email'
  | 'regex'
  | 'unique';

export interface ValidationRuleDef {
  label: string;
  /** Apakah rule butuh argumen (`min:3`). */
  needsArg: boolean;
  description: string;
  placeholder?: string;
  /** Tipe field yang boleh memakai rule ini (editor menyembunyikan sisanya). */
  appliesTo: FieldType[];
}

/** Field teks satu/multi-baris + editor rich text. */
const stringFields: FieldType[] = ['textField', 'textareaField', 'passwordField', 'editorField'];
/** Field angka (nilai, bukan panjang). */
const numberFields: FieldType[] = ['numberField', 'currencyField'];
/** Semua tipe field (untuk `required` yang universal). */
const allFields: FieldType[] = [
  'textField',
  'textareaField',
  'passwordField',
  'numberField',
  'currencyField',
  'dateField',
  'dateRangeField',
  'selectField',
  'selectMultipleField',
  'radioGroupField',
  'checkboxField',
  'checkboxGroupField',
  'switchField',
  'fileUploadField',
  'colorField',
  'editorField',
  'formArrayField',
];

export const validationRegistry: Record<ValidationRuleName, ValidationRuleDef> = {
  required: { label: 'Required', needsArg: false, description: 'Required field.', appliesTo: allFields },
  min: {
    label: 'Min',
    needsArg: true,
    description: 'Minimum value (number).',
    placeholder: 'min:3',
    appliesTo: numberFields,
  },
  max: {
    label: 'Max',
    needsArg: true,
    description: 'Maximum value (number).',
    placeholder: 'max:100',
    appliesTo: numberFields,
  },
  minLength: {
    label: 'Min Length',
    needsArg: true,
    description: 'Minimum string length.',
    placeholder: 'minLength:3',
    appliesTo: stringFields,
  },
  maxLength: {
    label: 'Max Length',
    needsArg: true,
    description: 'Maximum string length.',
    placeholder: 'maxLength:100',
    appliesTo: stringFields,
  },
  withoutemoticon: {
    label: 'Without Emoticon',
    needsArg: false,
    description: 'Must not contain emoticons/emoji.',
    appliesTo: ['textField', 'textareaField', 'editorField'],
  },
  email: {
    label: 'Email',
    needsArg: false,
    description: 'Valid email format.',
    appliesTo: ['textField'],
  },
  regex: {
    label: 'Regex',
    needsArg: true,
    description: 'Custom pattern, e.g. regex:^\\d+$',
    placeholder: 'regex:^\\d+$',
    appliesTo: ['textField', 'textareaField', 'passwordField'],
  },
  unique: {
    label: 'Unique',
    needsArg: false,
    description: 'Checked server-side on submit (no client validation).',
    appliesTo: [
      'textField',
      'textareaField',
      'passwordField',
      'numberField',
      'currencyField',
      'dateField',
      'selectField',
      'radioGroupField',
      'colorField',
      'fileUploadField',
    ],
  },
};

export const validationRuleNames = Object.keys(validationRegistry) as ValidationRuleName[];

/** Daftar rule yang berlaku untuk satu tipe field (urutan registry). */
export function rulesForFieldType(type: FieldType): ValidationRuleName[] {
  return validationRuleNames.filter((name) => validationRegistry[name].appliesTo.includes(type));
}

/** Buang rule yang tak berlaku untuk tipe field; nama tak dikenal dipertahankan. */
export function pruneRulesForType(rules: string[], type: FieldType): string[] {
  const allowed = new Set(rulesForFieldType(type));
  return rules.filter((rule) => {
    const sep = rule.indexOf(':');
    const name = (sep === -1 ? rule : rule.slice(0, sep)) as ValidationRuleName;
    return name in validationRegistry ? allowed.has(name) : true;
  });
}

/** Argumen bawaan saat rule berargumen dicentang (diambil dari placeholder registry). */
export function defaultRuleArg(name: ValidationRuleName): string {
  const placeholder = validationRegistry[name].placeholder ?? '';
  const sep = placeholder.indexOf(':');
  const arg = sep === -1 ? placeholder : placeholder.slice(sep + 1);
  return arg.trim() || '1';
}
