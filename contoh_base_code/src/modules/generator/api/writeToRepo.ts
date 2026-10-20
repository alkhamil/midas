import type { GeneratedFile, ModuleRegistration } from '../types';

/** Dev-server endpoint (vite plugin `moduleWriter`) that writes files to the repo. */
const WRITE_ENDPOINT = '/__api/write-module';

export interface WriteToRepoResult {
  written: string[];
  /** Auto-registration result for routes + navigation (null when not sent). */
  registered: { routes: number; navigation: boolean } | null;
}

/** Thrown when files already exist and `overwrite === false`. */
export class WriteConflictError extends Error {
  existing: string[];

  constructor(existing: string[]) {
    super(`File already exists: ${existing.join(', ')}`);
    this.name = 'WriteConflictError';
    this.existing = existing;
  }
}

/** Thrown when the dev-server endpoint is unavailable (e.g. production build). */
export class WriteEndpointUnavailableError extends Error {
  constructor() {
    super('Repo-write endpoint is unavailable. Run via `npm run dev`.');
    this.name = 'WriteEndpointUnavailableError';
  }
}

/**
 * Repo-write hanya boleh di dev-server: pada production build (Netlify,
 * `vite build`/`preview`) endpoint tulis tidak pernah ada, jadi jangan
 * sampai mencoba fetch sama sekali.
 */
export function repoWriteEnabled(): boolean {
  return import.meta.env.DEV;
}

/** Write generate output directly to `src/modules/` via dev-server + register routes/nav. */
export async function writeModuleToRepo(
  files: GeneratedFile[],
  overwrite: boolean,
  registration?: ModuleRegistration,
): Promise<WriteToRepoResult> {
  if (!repoWriteEnabled()) throw new WriteEndpointUnavailableError();
  let res: Response;
  try {
    res = await fetch(WRITE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, overwrite, registration }),
    });
  } catch {
    throw new WriteEndpointUnavailableError();
  }
  if (res.status === 404) throw new WriteEndpointUnavailableError();
  if (res.status === 409) {
    const data = (await res.json()) as { existing?: string[] };
    throw new WriteConflictError(data.existing ?? []);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Failed to write to repo (HTTP ${res.status}).`);
  }
  return (await res.json()) as WriteToRepoResult;
}
