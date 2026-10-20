import type { ModuleDefinition } from '../definitions';
import type { ModuleRegistration } from '../types';
import { definitionToConfig } from '../engine/fromDefinition';
import { buildRegistration } from '../engine/registration';
import { repoWriteEnabled, WriteEndpointUnavailableError } from './writeToRepo';

/** Dev-server endpoint (vite plugin `moduleWriter`) yang menghapus modul dari repo. */
const DELETE_ENDPOINT = '/__api/delete-module';

export interface DeleteFromRepoResult {
  deleted: string[];
  removedRoutes: number;
  removedNav: boolean;
}

/**
 * Hapus modul dari repo: direktori `src/modules/...` + routes + nav.
 * Endpoint tulis hanya ada di dev-server; di luar itu lempar
 * `WriteEndpointUnavailableError` (pemanggil sebaiknya mengabaikannya —
 * hapus definisi mock tetap jalan).
 */
/**
 * Direktori repo dari registrasi: moduleImportPath = `../modules/<dir>`
 * (relatif dari src/app) → `src/modules/<dir>`.
 */
export function moduleDirForRegistration(registration: ModuleRegistration): string {
  return `src/${registration.moduleImportPath.replace(/^\.\.\//, '')}`;
}

export async function deleteModuleFromRepo(
  def: ModuleDefinition,
): Promise<DeleteFromRepoResult> {
  if (!repoWriteEnabled()) throw new WriteEndpointUnavailableError();
  const config = definitionToConfig(def);
  const registration = buildRegistration(config);
  const moduleDir = moduleDirForRegistration(registration);
  let res: Response;
  try {
    res = await fetch(DELETE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleDir, registration }),
    });
  } catch {
    throw new WriteEndpointUnavailableError();
  }
  if (res.status === 404) throw new WriteEndpointUnavailableError();
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Failed to delete from repo (HTTP ${res.status}).`);
  }
  return (await res.json()) as DeleteFromRepoResult;
}
