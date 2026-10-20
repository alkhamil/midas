import type { FeatureKey, FilterCriteria, GeneratorConfig, GeneratorFieldConfig } from '../types';
import { resolveNames, toPascalCase, type ResolvedNames } from '../naming';
import { fieldTypeRegistry, type FieldValueType } from '../registry';

/** Tipe field yang memakai options (static/query/loadOptions). */
const OPTION_TYPES = ['selectField', 'selectMultipleField', 'radioGroupField', 'checkboxGroupField'];
/** Tipe option bernilai tunggal (filter exact match). */
const SINGLE_OPTION_TYPES = ['selectField', 'radioGroupField'];
/** Tipe option yang mendukung loadOptions (paging/search). */
const LOADABLE_TYPES = ['selectField', 'selectMultipleField'];

/** Model field yang sudah diperkaya untuk kebutuhan template. */
export interface FieldModel {
  config: GeneratorFieldConfig;
  name: string;
  label: string;
  pascal: string;
  valueType: FieldValueType;
  formType: FieldValueType;
  isSelect: boolean;
  isOptionField: boolean;
  isMultiOption: boolean;
  isOptionsQuery: boolean;
  isLoadOptions: boolean;
  /** Select dari modul lain (`source === 'relation'`): loader target-backed. */
  isRelationOptions: boolean;
  rulesVar: string;
  optionType: string;
  mockOptionsVar: string;
  optionsQueryHook: string;
  loadOptionsFn: string;
  sortable: boolean;
  filterable: boolean;
  filterCriteria: FilterCriteria | null;
}

/** Permission keys turunan otomatis dari base `config.permissionKey`. */
export interface ModulePermissions {
  base: string;
  view: string;
  create: string;
  update: string;
  delete: string;
  bulkUpload: string;
  export: string;
}

export interface TemplateContext {
  config: GeneratorConfig;
  names: ResolvedNames;
  fields: FieldModel[];
  features: Record<FeatureKey, boolean>;
  permissions: ModulePermissions;
  hasOptionsSelects: boolean;
  hasLoadOptionsSelects: boolean;
  hasNumberFields: boolean;
  hasDateFields: boolean;
  hasBooleanFields: boolean;
  selectFields: FieldModel[];
  multiOptionFields: FieldModel[];
  uniqueField: FieldModel | null;
}

function toFieldModel(config: GeneratorFieldConfig): FieldModel {
  const def = fieldTypeRegistry[config.type];
  const pascal = toPascalCase(config.name);
  const isOptionField = OPTION_TYPES.includes(config.type);
  return {
    config,
    name: config.name,
    label: config.label,
    pascal,
    valueType: def.valueType,
    formType: def.formType,
    isSelect: SINGLE_OPTION_TYPES.includes(config.type),
    isOptionField,
    isMultiOption: config.type === 'selectMultipleField' || config.type === 'checkboxGroupField',
    isOptionsQuery: isOptionField && (config.source === 'mockStatic' || config.source === 'api'),
    isLoadOptions:
      LOADABLE_TYPES.includes(config.type) && config.source === 'mockPagingInfinityScroll',
    isRelationOptions: isOptionField && config.source === 'relation',
    rulesVar: `${config.name}Rules`,
    optionType: `${pascal}Option`,
    mockOptionsVar: `mock${pascal}Options`,
    optionsQueryHook: `use${pascal}OptionsQuery`,
    loadOptionsFn: `load${pascal}Options`,
    sortable: config.sortable ?? true,
    filterable: config.filterable ?? true,
    filterCriteria: config.filterCriteria ?? null,
  };
}

export function buildContext(config: GeneratorConfig): TemplateContext {
  const fields = config.fields.map(toFieldModel);
  const base = config.permissionKey;
  return {
    config,
    names: resolveNames(config.parentName, config.moduleName),
    fields,
    features: config.features,
    permissions: {
      base,
      view: `${base}.view`,
      create: `${base}.create`,
      update: `${base}.update`,
      delete: `${base}.delete`,
      bulkUpload: `${base}.bulk_upload`,
      export: `${base}.export`,
    },
    hasOptionsSelects: fields.some((f) => f.isOptionsQuery),
    hasLoadOptionsSelects: fields.some((f) => f.isLoadOptions),
    hasNumberFields: fields.some((f) => f.valueType === 'number'),
    hasDateFields: fields.some(
      (f) => f.config.type === 'dateField' || f.config.type === 'dateRangeField',
    ),
    hasBooleanFields: fields.some((f) => f.valueType === 'boolean'),
    selectFields: fields.filter((f) => SINGLE_OPTION_TYPES.includes(f.config.type)),
    multiOptionFields: fields.filter(
      (f) => f.config.type === 'selectMultipleField' || f.config.type === 'checkboxGroupField',
    ),
    uniqueField: fields.find((f) => f.config.rules.includes('unique')) ?? null,
  };
}
