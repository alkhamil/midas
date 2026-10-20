import type { ModuleDefinition } from './types';

/** Nilai sentinel select saat user memilih "Parent baru". */
export const NEW_PARENT_VALUE = '__new__';

/**
 * Daftar parent dari definisi yang sudah terdaftar (draft maupun published).
 * Menggantikan deteksi direktori `src/modules/` — parent adalah data, bukan folder.
 */
export function parentOptionsFromDefinitions(definitions: ModuleDefinition[]): string[] {
  const parents = new Set<string>();
  for (const def of definitions) {
    if (def.parent) parents.add(def.parent);
  }
  return [...parents].sort((a, b) => a.localeCompare(b));
}
