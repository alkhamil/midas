import type { ModuleDefinition } from './types';

/**
 * Kumpulkan definisi yang bergantung ke `key` lewat field relasi
 * (`source === 'relation'`, termasuk sub-field form array), transitif:
 * dependen dari dependen ikut (hapus cascade). Murni & Node-safe.
 * Return urutan stabil (urutan input), tanpa duplikat, tanpa target sendiri.
 */
export function relationDependentsOf(
  key: string,
  definitions: ModuleDefinition[],
): ModuleDefinition[] {
  const visited = new Set<string>([key]);
  const queue = [key];
  const result: ModuleDefinition[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const def of definitions) {
      if (visited.has(def.key)) continue;
      const depends = def.fields.some(
        (field) =>
          (field.source === 'relation' && field.relation?.definitionKey === current) ||
          (field.subFields ?? []).some(
            (sub) => sub.source === 'relation' && sub.relation?.definitionKey === current,
          ),
      );
      if (!depends) continue;
      visited.add(def.key);
      result.push(def);
      queue.push(def.key);
    }
  }
  return result;
}
