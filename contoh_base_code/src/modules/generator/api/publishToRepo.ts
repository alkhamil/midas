import type { ModuleDefinition } from '../definitions';
import { definitionToConfig } from '../engine/fromDefinition';
import { GeneratorConfigError, generateModule } from '../engine/moduleGenerator';
import { buildRegistration } from '../engine/registration';
import { repoWriteEnabled, WriteEndpointUnavailableError, writeModuleToRepo } from './writeToRepo';

export type PublishToRepoOutcome =
  | { state: 'written'; count: number }
  | { state: 'skipped'; message: string; reason?: 'build' };

/**
 * Tulis modul yang di-publish langsung ke repo (`src/modules/`) + registrasi
 * routes/nav. File turunan selalu dioverwrite karena sumber kebenarannya
 * adalah definisi yang baru di-publish. Endpoint tulis hanya ada di dev-server;
 * di luar itu (atau saat generate gagal) kembalikan `skipped` tanpa
 * menggagalkan publish — definisi tetap live lewat dynamic routes.
 */
export async function publishModuleToRepo(
  def: ModuleDefinition,
): Promise<PublishToRepoOutcome> {
  // Production build (Netlify/preview): repo-write memang tidak tersedia —
  // skipped by-design, tanpa mencoba fetch.
  if (!repoWriteEnabled()) {
    return {
      state: 'skipped',
      reason: 'build',
      message: 'Repo write skipped: production build (dev-only endpoint).',
    };
  }
  try {
    const config = definitionToConfig(def);
    const files = generateModule(config);
    const registration = buildRegistration(config);
    const result = await writeModuleToRepo(files, true, registration);
    return { state: 'written', count: result.written.length };
  } catch (err) {
    if (err instanceof WriteEndpointUnavailableError) {
      return { state: 'skipped', message: err.message };
    }
    const message =
      err instanceof GeneratorConfigError
        ? err.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
        : err instanceof Error
          ? err.message
          : 'Gagal menulis ke repo.';
    return { state: 'skipped', message };
  }
}
