import type { FieldType, FilterCriteria } from '../types';

export interface FilterCriteriaDef {
  label: string;
  description: string;
  /** Tipe field yang boleh memakai kriteria ini. */
  appliesTo: FieldType[];
}

export const filterCriteriaRegistry: Record<FilterCriteria, FilterCriteriaDef> = {
  contains: {
    label: 'Contains',
    description: 'Text contains keyword (case-insensitive).',
    appliesTo: ['textField', 'textareaField', 'passwordField', 'fileUploadField', 'colorField'],
  },
  exact: {
    label: 'Equals',
    description: 'Exact text match.',
    appliesTo: ['textField', 'textareaField', 'passwordField', 'fileUploadField', 'colorField'],
  },
  numberExact: {
    label: 'Equals',
    description: 'Exact number match.',
    appliesTo: ['numberField', 'currencyField'],
  },
  numberMin: {
    label: 'Minimum',
    description: 'Number greater than or equal.',
    appliesTo: ['numberField', 'currencyField'],
  },
  numberMax: {
    label: 'Maximum',
    description: 'Number less than or equal.',
    appliesTo: ['numberField', 'currencyField'],
  },
  numberRange: {
    label: 'Range (min–max)',
    description: 'Lower and upper bound inputs.',
    appliesTo: ['numberField', 'currencyField'],
  },
  dateExact: {
    label: 'Exact date',
    description: 'Exact date match.',
    appliesTo: ['dateField'],
  },
  dateRange: {
    label: 'Date range',
    description: 'Date between start and end.',
    appliesTo: ['dateField'],
  },
  dateOverlap: {
    label: 'Range overlap',
    description: 'Record range overlaps the filter range.',
    appliesTo: ['dateRangeField'],
  },
  optionExact: {
    label: 'Any value',
    description: 'Value equals the selected option.',
    appliesTo: ['selectField', 'radioGroupField'],
  },
  optionAny: {
    label: 'One/more values',
    description: 'Record matches when containing any selected value.',
    appliesTo: ['selectMultipleField', 'checkboxGroupField'],
  },
  booleanExact: {
    label: 'Yes / No',
    description: 'Boolean value equals the selection.',
    appliesTo: ['checkboxField', 'switchField'],
  },
};

export const filterCriteriaNames = Object.keys(filterCriteriaRegistry) as FilterCriteria[];

/** Opsi kriteria valid untuk satu tipe field. */
export function criteriaForFieldType(type: FieldType): FilterCriteria[] {
  return filterCriteriaNames.filter((name) => filterCriteriaRegistry[name].appliesTo.includes(type));
}

/** Default sortable per tipe (array baris dimatikan — sortir objek tak bermakna). */
export function defaultSortable(type: FieldType): boolean {
  return type !== 'formArrayField';
}

/** Default filterable per tipe (password, file, editor, array dimatikan agar tidak berisik). */
export function defaultFilterable(type: FieldType): boolean {
  return (
    type !== 'passwordField' &&
    type !== 'fileUploadField' &&
    type !== 'editorField' &&
    type !== 'formArrayField'
  );
}

/** Default kriteria per tipe. */
export function defaultCriteria(type: FieldType): FilterCriteria {
  switch (type) {
    case 'numberField':
    case 'currencyField':
      return 'numberExact';
    case 'dateField':
      return 'dateExact';
    case 'dateRangeField':
      return 'dateOverlap';
    case 'selectField':
    case 'radioGroupField':
      return 'optionExact';
    case 'selectMultipleField':
    case 'checkboxGroupField':
      return 'optionAny';
    case 'checkboxField':
    case 'switchField':
      return 'booleanExact';
    default:
      return 'contains';
  }
}
