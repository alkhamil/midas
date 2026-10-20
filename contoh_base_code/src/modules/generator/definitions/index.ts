export { MODULE_DEFINITION_VERSION, SYSTEM_TABLE_COLUMNS } from './types';
export type {
  ModuleDefinitionVersion,
  ModuleDefinitionStatus,
  DeleteMode,
  FormLayoutItem,
  FormLayoutItemKind,
  TableLayout,
  DetailLayout,
  ModuleLayout,
  ModuleDefinition,
} from './types';
export {
  defaultLayoutForFields,
  normalizeLayout,
  normalizeModuleI18n,
  configToDefinition,
  normalizeDefinition,
} from './normalize';
export type { ConfigToDefinitionOptions } from './normalize';
export type { MenuIcon } from '../types';
export { validateDefinition } from './validate';
export { buildApiContract } from './contract';
export type {
  ApiContract,
  ContractEndpoint,
  ContractFieldType,
  ContractModelField,
} from './contract';
export { NEW_PARENT_VALUE, parentOptionsFromDefinitions } from './parents';
export { relationDependentsOf } from './dependents';
