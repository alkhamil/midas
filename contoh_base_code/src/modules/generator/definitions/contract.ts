import type { FieldType, GeneratorFieldConfig } from '../types';
import type { ModuleDefinition } from './types';

/** Tipe kolom model kontrak (spec §4 + flag `multiple` aditif untuk array). */
export type ContractFieldType = 'string' | 'number' | 'boolean' | 'relation';

export interface ContractModelField {
  name: string;
  type: ContractFieldType;
  required: boolean;
  filterable: boolean;
  sortable: boolean;
  /** True bila nilai array (selectMultiple/checkboxGroup). */
  multiple?: boolean;
  /** Key definisi target bila `type === 'relation'`. */
  target?: string;
}

export interface ContractEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  permission: string;
  features?: {
    pagination: boolean;
    search: string[];
    filter: string[];
    sort: string[];
    export: boolean;
  };
}

export interface ApiContract {
  module: string;
  menu: { parent: string | null; label: string; permissionKey: string };
  model: { name: string; fields: ContractModelField[] };
  endpoints: ContractEndpoint[];
}

function baseContractType(type: FieldType): 'string' | 'number' | 'boolean' {
  switch (type) {
    case 'numberField':
    case 'currencyField':
      return 'number';
    case 'checkboxField':
    case 'switchField':
      return 'boolean';
    default:
      return 'string';
  }
}

function isArrayType(type: FieldType): boolean {
  return (
    type === 'selectMultipleField' ||
    type === 'checkboxGroupField' ||
    type === 'formArrayField'
  );
}

/** Search keyword runtime mencakup field string/string[] + id (bukan array baris). */
function isSearchable(type: FieldType): boolean {
  return type !== 'formArrayField' && baseContractType(type) === 'string';
}

function toModelField(field: GeneratorFieldConfig): ContractModelField {
  if (field.source === 'relation' && field.relation) {
    return {
      name: field.name,
      type: 'relation',
      required: field.rules.includes('required'),
      filterable: field.filterable !== false,
      sortable: field.sortable !== false,
      target: field.relation.definitionKey,
    };
  }
  const entry: ContractModelField = {
    name: field.name,
    type: baseContractType(field.type),
    required: field.rules.includes('required'),
    filterable: field.filterable !== false,
    sortable: field.sortable !== false,
  };
  if (isArrayType(field.type)) entry.multiple = true;
  return entry;
}

/**
 * Bangun `api.contract.json` dari definisi (spec §4 BUILDER_SPEC).
 * Murni & Node-safe. Kontrak = artefak unduhan untuk BE masa depan;
 * path memakai prefix `/api/` tanpa versi.
 */
export function buildApiContract(def: ModuleDefinition): ApiContract {
  const base = `/api/${def.apiPlural}`;
  const perm = (suffix: string): string => `${def.permissionKey}.${suffix}`;
  const endpoints: ContractEndpoint[] = [];
  if (def.features.list) {
    endpoints.push({
      method: 'GET',
      path: base,
      permission: perm('view'),
      features: {
        pagination: true,
        search: def.fields.filter((f) => isSearchable(f.type)).map((f) => f.name),
        filter: def.fields.filter((f) => f.filterable !== false).map((f) => f.name),
        sort: def.fields.filter((f) => f.sortable !== false).map((f) => f.name),
        export: def.features.export,
      },
    });
  }
  if (def.features.create) {
    endpoints.push({ method: 'POST', path: base, permission: perm('create') });
  }
  if (def.features.edit) {
    endpoints.push({ method: 'PUT', path: `${base}/:id`, permission: perm('update') });
  }
  if (def.features.delete) {
    endpoints.push({ method: 'DELETE', path: `${base}/:id`, permission: perm('delete') });
    if (def.deleteMode === 'soft') {
      endpoints.push({ method: 'PATCH', path: `${base}/:id/restore`, permission: perm('delete') });
    }
  }
  return {
    module: def.apiPlural,
    menu: { parent: def.parent, label: def.label, permissionKey: def.permissionKey },
    model: { name: def.singularLabel, fields: def.fields.map(toModelField) },
    endpoints,
  };
}
