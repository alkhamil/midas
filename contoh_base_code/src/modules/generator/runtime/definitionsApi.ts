/** Mock definisi modul: seed JSON + persist localStorage (mock-only, tanpa BE). */
import { t } from 'i18next';
import '../../../shared/i18n';
import type { ModuleDefinition } from '../definitions';

export interface SaveDefinitionResult {
  definition: ModuleDefinition;
  /** True bila key belum ada (baru), false bila menimpa key lama. */
  created: boolean;
}

const STORAGE_KEY = 'mock_definitions_v1';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Seed JSON lokal — state awal bila localStorage kosong.
const seedModules = import.meta.glob<ModuleDefinition>('../seeds/definitions/*.json', {
  eager: true,
  import: 'default',
});

let cachedDefinitions: ModuleDefinition[] | null = null;

function readStored(): ModuleDefinition[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ModuleDefinition[]) : null;
  } catch {
    return null;
  }
}

function persist(defs: ModuleDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defs));
  } catch {
    // Abaikan: mode privat / kuota penuh — cache in-memory tetap jalan.
  }
}

function seedDefinitions(): ModuleDefinition[] {
  if (!cachedDefinitions) {
    cachedDefinitions =
      readStored() ?? Object.values(seedModules).map((def) => ({ ...def }));
  }
  return cachedDefinitions;
}

/** Kosongkan mock definisi kembali ke seed JSON (hapus simpanan lokal). */
export function resetMockDefinitions(): void {
  cachedDefinitions = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Abaikan.
  }
}

export async function listDefinitions(status?: string): Promise<ModuleDefinition[]> {
  await delay(150);
  const all = seedDefinitions();
  return status ? all.filter((def) => def.status === status) : [...all];
}

export async function getDefinition(key: string): Promise<ModuleDefinition> {
  await delay(150);
  const found = seedDefinitions().find((def) => def.key === key);
  if (!found) throw new Error(t('api.definitionNotFound', { key }));
  return { ...found };
}

/** Hapus definisi dari mock store + persist. Return false bila key tidak ada. */
export async function deleteDefinition(key: string): Promise<boolean> {
  await delay(150);
  const cached = seedDefinitions();
  const index = cached.findIndex((entry) => entry.key === key);
  if (index < 0) return false;
  cached.splice(index, 1);
  persist(cached);
  return true;
}

/** Upsert definisi ke mock store + persist. */
export async function saveDefinition(def: ModuleDefinition): Promise<SaveDefinitionResult> {
  await delay(150);
  const cached = seedDefinitions();
  const stored = { ...def };
  const index = cached.findIndex((entry) => entry.key === def.key);
  if (index >= 0) {
    cached[index] = stored;
    persist(cached);
    return { definition: { ...stored }, created: false };
  }
  cached.push(stored);
  persist(cached);
  return { definition: { ...stored }, created: true };
}
