import type { DataSource, FieldType } from '../types';

export interface DataSourceDef {
  label: string;
  description: string;
  /** Tipe field yang mendukung source ini. */
  appliesTo: FieldType[];
}

export const dataSourceRegistry: Record<DataSource, DataSourceDef> = {
  none: {
    label: 'None',
    description: 'No external data source.',
    appliesTo: [
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
    ],
  },
  mockStatic: {
    label: 'Mock Static',
    description: 'Static options [{label, value}] in mock.',
    appliesTo: ['selectField', 'selectMultipleField', 'radioGroupField', 'checkboxGroupField'],
  },
  mockPagingInfinityScroll: {
    label: 'Mock Paging (Infinite Scroll + Search)',
    description: 'Paginated, searchable mock options via loadOptions.',
    appliesTo: ['selectField', 'selectMultipleField'],
  },
  relation: {
    label: 'Relation',
    description: 'Options from another module records (target + label field).',
    appliesTo: ['selectField', 'selectMultipleField'],
  },
  api: {
    label: 'API',
    description: 'Options from a real endpoint (mock uses sample options).',
    appliesTo: ['selectField', 'selectMultipleField', 'radioGroupField', 'checkboxGroupField'],
  },
};

export const dataSourceOptions = (Object.keys(dataSourceRegistry) as DataSource[]).map(
  (value) => ({ label: dataSourceRegistry[value].label, value }),
);
