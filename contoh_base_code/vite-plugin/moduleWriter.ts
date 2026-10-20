import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { ModuleRegistration } from '../src/modules/generator/types.ts';
import {
  registerModuleNav,
  registerModuleRoutes,
  unregisterModuleNav,
  unregisterModuleRoutes,
} from './moduleRegistration.ts';

export interface FileToWrite {
  path: string;
  content: string;
}

export interface WriteOutcome {
  written: string[];
  /** Terisi (dan tidak ada yang ditulis) bila ada file existing tanpa overwrite. */
  existing: string[];
}

/** Batas body request 10 MB. */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Resolve & validasi target tulis: path harus berupa file di dalam
 * `<projectRoot>/src/modules/`, tanpa `..`/absolute escape.
 */
export function resolveWriteTargets(projectRoot: string, files: FileToWrite[]): string[] {
  const modulesRoot = path.resolve(projectRoot, 'src', 'modules');
  return files.map((file) => {
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Setiap file wajib punya path & content string.');
    }
    const abs = path.resolve(projectRoot, file.path);
    if (abs === modulesRoot || !abs.startsWith(modulesRoot + path.sep)) {
      throw new Error(`Path di luar src/modules: ${file.path}`);
    }
    return abs;
  });
}

/** Tulis file hasil generate ke repo. Murni fs — bisa di-unit-test via Node. */
export function writeGeneratedFiles(
  projectRoot: string,
  files: FileToWrite[],
  overwrite: boolean,
): WriteOutcome {
  const targets = resolveWriteTargets(projectRoot, files);
  const existing = files
    .filter((_, index) => fs.existsSync(targets[index] as string))
    .map((file) => file.path);
  if (existing.length > 0 && !overwrite) return { written: [], existing };
  targets.forEach((abs, index) => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, (files[index] as FileToWrite).content, 'utf8');
  });
  return { written: files.map((file) => file.path), existing: [] };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body terlalu besar.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
      } catch {
        reject(new Error('Body bukan JSON valid.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Validasi target hapus: direktori di dalam `<projectRoot>/src/modules/`. */
export function resolveDeleteTarget(projectRoot: string, moduleDir: string): string {
  if (typeof moduleDir !== 'string' || moduleDir.trim() === '') {
    throw new Error('moduleDir wajib string non-kosong.');
  }
  const modulesRoot = path.resolve(projectRoot, 'src', 'modules');
  const abs = path.resolve(projectRoot, moduleDir);
  if (abs === modulesRoot || !abs.startsWith(modulesRoot + path.sep)) {
    throw new Error(`Path di luar src/modules: ${moduleDir}`);
  }
  return abs;
}

/**
 * Dev-only: endpoint `POST /__api/write-module` agar hasil generate langsung
 * ditulis ke `src/modules/`. Tidak ada di production build / preview.
 */
export function moduleWriterPlugin(): Plugin {
  return {
    name: 'module-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__api/write-module', (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed.' });
          return;
        }
        readJsonBody(req)
          .then((body) => {
            const { files, overwrite, registration } = body as {
              files?: FileToWrite[];
              overwrite?: boolean;
              registration?: ModuleRegistration;
            };
            if (!Array.isArray(files) || files.length === 0) {
              sendJson(res, 400, { error: 'files wajib array non-kosong.' });
              return;
            }
            // Registrasi dihitung dulu (murni string): gagal → 400 tanpa menulis apa pun.
            let registered: { routes: number; navigation: boolean } | null = null;
            let nextRouter: string | null = null;
            let nextNav: string | null = null;
            if (registration) {
              const routerFile = path.resolve(server.config.root, 'src', 'app', 'router.tsx');
              const navFile = path.resolve(server.config.root, 'src', 'app', 'navigation.tsx');
              const routeOutcome = registerModuleRoutes(
                fs.readFileSync(routerFile, 'utf8'),
                registration,
              );
              const navOutcome = registerModuleNav(
                fs.readFileSync(navFile, 'utf8'),
                registration,
              );
              nextRouter = routeOutcome.source;
              nextNav = navOutcome.source;
              registered = {
                routes: routeOutcome.addedRoutes,
                navigation: navOutcome.added,
              };
            }
            const outcome = writeGeneratedFiles(
              server.config.root,
              files,
              overwrite === true,
            );
            if (outcome.existing.length > 0) {
              sendJson(res, 409, { existing: outcome.existing });
              return;
            }
            if (registration && nextRouter !== null && nextNav !== null) {
              fs.writeFileSync(
                path.resolve(server.config.root, 'src', 'app', 'router.tsx'),
                nextRouter,
                'utf8',
              );
              fs.writeFileSync(
                path.resolve(server.config.root, 'src', 'app', 'navigation.tsx'),
                nextNav,
                'utf8',
              );
            }
            sendJson(res, 200, { written: outcome.written, registered });
          })
          .catch((err: unknown) => {
            sendJson(res, 400, {
              error: err instanceof Error ? err.message : 'Request tidak valid.',
            });
          });
      });
      // Hapus modul hasil generate dari repo: direktori modul + routes + nav.
      server.middlewares.use('/__api/delete-module', (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed.' });
          return;
        }
        readJsonBody(req)
          .then((body) => {
            const { moduleDir, registration } = body as {
              moduleDir?: string;
              registration?: ModuleRegistration;
            };
            if (!registration || typeof registration !== 'object') {
              sendJson(res, 400, { error: 'registration wajib objek.' });
              return;
            }
            const routerFile = path.resolve(server.config.root, 'src', 'app', 'router.tsx');
            const navFile = path.resolve(server.config.root, 'src', 'app', 'navigation.tsx');
            const routeOutcome = unregisterModuleRoutes(
              fs.readFileSync(routerFile, 'utf8'),
              registration,
            );
            const navOutcome = unregisterModuleNav(
              fs.readFileSync(navFile, 'utf8'),
              registration,
            );
            fs.writeFileSync(routerFile, routeOutcome.source, 'utf8');
            fs.writeFileSync(navFile, navOutcome.source, 'utf8');
            let deleted: string[] = [];
            if (typeof moduleDir === 'string' && moduleDir.trim() !== '') {
              const abs = resolveDeleteTarget(server.config.root, moduleDir);
              if (fs.existsSync(abs)) {
                fs.rmSync(abs, { recursive: true, force: true });
                deleted = [moduleDir];
              }
            }
            sendJson(res, 200, {
              deleted,
              removedRoutes: routeOutcome.removed,
              removedNav: navOutcome.removed > 0,
            });
          })
          .catch((err: unknown) => {
            sendJson(res, 400, {
              error: err instanceof Error ? err.message : 'Request tidak valid.',
            });
          });
      });
    },
  };
}
