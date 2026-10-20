import type { FieldType } from '../types';

export type FieldValueType = 'string' | 'number' | 'boolean' | 'stringArray' | 'file' | 'rowArray';

export interface FieldTypeDef {
  label: string;
  /** Komponen shared yang dipakai di form hasil generate. */
  component: string;
  /** Kategori nilai di types/payload/mock hasil generate. */
  valueType: FieldValueType;
  /** Kategori nilai di form (bisa beda, mis. number/file). */
  formType: FieldValueType;
  description: string;
}

export const fieldTypeRegistry: Record<FieldType, FieldTypeDef> = {
  textField: {
    label: 'Text Field',
    component: 'TextField',
    valueType: 'string',
    formType: 'string',
    description: 'Single-line text input.',
  },
  textareaField: {
    label: 'Textarea Field',
    component: 'TextAreaField',
    valueType: 'string',
    formType: 'string',
    description: 'Multi-line text input.',
  },
  passwordField: {
    label: 'Password Field',
    component: 'PasswordField',
    valueType: 'string',
    formType: 'string',
    description: 'Password input with show/hide toggle; masked in tables.',
  },
  numberField: {
    label: 'Number Field',
    component: 'TextField',
    valueType: 'number',
    formType: 'string',
    description: 'Number input (currency); string in form, number in payload.',
  },
  currencyField: {
    label: 'Currency Field',
    component: 'TextField',
    valueType: 'number',
    formType: 'string',
    description: 'Currency input (always currency-formatted + symbol, default Rp).',
  },
  dateField: {
    label: 'Date Field',
    component: 'DatePickerField',
    valueType: 'string',
    formType: 'string',
    description: 'Date input (ISO string).',
  },
  dateRangeField: {
    label: 'Date Range Field',
    component: 'DateRangeField',
    valueType: 'string',
    formType: 'string',
    description: 'Date range input ("start,end" ISO).',
  },
  selectField: {
    label: 'Select Field',
    component: 'SelectField',
    valueType: 'string',
    formType: 'string',
    description: 'Dropdown; options from source (static/loadOptions/api).',
  },
  selectMultipleField: {
    label: 'Select Multiple Field',
    component: 'SelectMultipleField',
    valueType: 'stringArray',
    formType: 'stringArray',
    description: 'Multi-select dropdown; string[] value.',
  },
  radioGroupField: {
    label: 'Radio Group Field',
    component: 'RadioGroupField',
    valueType: 'string',
    formType: 'string',
    description: 'Radio options; static/api options.',
  },
  checkboxField: {
    label: 'Checkbox Field',
    component: 'CheckboxField',
    valueType: 'boolean',
    formType: 'boolean',
    description: 'Single yes/no check.',
  },
  checkboxGroupField: {
    label: 'Checkbox Group Field',
    component: 'CheckboxGroupField',
    valueType: 'stringArray',
    formType: 'stringArray',
    description: 'Checkbox group; string[] value.',
  },
  switchField: {
    label: 'Switch Field',
    component: 'SwitchField',
    valueType: 'boolean',
    formType: 'boolean',
    description: 'Switch toggle.',
  },
  fileUploadField: {
    label: 'File Upload Field',
    component: 'FileUploadField',
    valueType: 'file',
    formType: 'file',
    description: 'File upload; File|null in form (File[] when multiple), file name in payload.',
  },
  colorField: {
    label: 'Color Field',
    component: 'ColorField',
    valueType: 'string',
    formType: 'string',
    description: 'Color picker; hex `#rrggbb` value.',
  },
  editorField: {
    label: 'Editor Field',
    component: 'EditorField',
    valueType: 'string',
    formType: 'string',
    description: 'Rich text (TipTap); HTML value.',
  },
  formArrayField: {
    label: 'Form Array Field',
    component: 'FormArrayField',
    valueType: 'rowArray',
    formType: 'rowArray',
    description: 'Embedded row table; sub-fields become columns.',
  },
};

export const fieldTypeOptions = (Object.keys(fieldTypeRegistry) as FieldType[]).map((value) => ({
  label: fieldTypeRegistry[value].label,
  value,
}));
