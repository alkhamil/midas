import type { ModuleType } from '../types';

export interface ModuleTypeDef {
  label: string;
  templateDir: string;
  description: string;
}

export const moduleTypeRegistry: Record<ModuleType, ModuleTypeDef> = {
  crud: {
    label: 'CRUD',
    templateDir: 'templates/crud',
    description: 'Full list, detail, create, edit, delete following user modules.',
  },
};

export const moduleTypeOptions = (Object.keys(moduleTypeRegistry) as ModuleType[]).map(
  (value) => ({ label: moduleTypeRegistry[value].label, value }),
);
