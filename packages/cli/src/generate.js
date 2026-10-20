// `midas generate`: fetch the Code Builder project + design document from Midas, run the generator
// (@midas/builder-core), dan tulis hasilnya ke repo aplikasi. File yang pernah dibangkitkan tapi tidak lagi
// dihasilkan (mis. screen dihapus) ikut dibersihkan lewat manifest `.midas/generated.json`.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildTrees, generateProject, makeContext } from '@midas/builder-core';

const MANIFEST = '.midas/generated.json';
const enc = encodeURIComponent;

export async function listProjects(request) {
    const { projects } = await request('GET', '/api/builder-projects');
    if (!projects.length) console.log('No Code Builder projects in this workspace yet.');
    for (const p of projects) console.log(`${p.name.padEnd(28)} ${p.id}  ${p.modules} modules, ${p.screens} screens  · ${p.library ? `${p.library.packageName}@${p.library.version}` : 'no library'}`);
    return 0;
}

/** Pilih project dari argumen (nama atau id); satu-satunya project dipakai bila argumen kosong. */
async function pickProject(request, ref) {
    const { projects } = await request('GET', '/api/builder-projects');
    if (!projects.length) throw new Error('No Code Builder projects yet — create one in Midas Studio (Plugins → Code Builder)');
    if (!ref) {
        if (projects.length > 1) throw new Error(`There are ${projects.length} projects; name one:\n${projects.map(p => `  ${p.name} (${p.id})`).join('\n')}`);
        return projects[0];
    }
    const hit = projects.filter(p => p.id === ref || p.name.toLowerCase() === ref.toLowerCase());
    if (hit.length !== 1) throw new Error(hit.length ? `Name "${ref}" is ambiguous — use the project id` : `Project "${ref}" not found (midas generate --list)`);
    return hit[0];
}

/** Konteks dokumen desain dari ekspor file (`/api/files/:id/export`) + mapping library project. */
export function contextFromExport(doc, project, mappings) {
    const nodes = doc.pages.flatMap(p => (p.nodes || []).map(n => ({ ...n, pageId: p.id })));
    return makeContext({ nodes, variables: doc.variables, mappings, libraryId: project.library?.id ?? null, fileId: project.fileId });
}

export async function generateFromServer(request, { out, project: ref, dryRun }) {
    const picked = await pickProject(request, ref);
    const { project } = await request('GET', `/api/builder-projects/${enc(picked.id)}`);
    if (!project.library || project.library.missing) throw new Error('The project has no valid library/version selected — set it in Code Builder');
    const [doc, { mappings }] = await Promise.all([
        request('GET', `/api/files/${enc(project.fileId)}/export`),
        request('GET', `/api/libraries/${enc(project.library.id)}/versions/${enc(project.library.version)}/mappings`),
    ]);
    const ctx = contextFromExport(doc, project, mappings);
    const trees = buildTrees(project.config, ctx);
    const errors = [...trees.values()].flatMap(t => t.issues.filter(i => i.severity === 'error'));
    const { files, warnings } = generateProject(project, trees);

    for (const w of warnings) console.warn(`! ${w}`);
    for (const e of errors) console.warn(`! ${e.nodeName}: ${e.message}`);
    const previous = existsSync(join(out, MANIFEST)) ? JSON.parse(readFileSync(join(out, MANIFEST), 'utf8')).files || [] : [];
    const stale = previous.filter(f => !(f in files));
    // File yang sudah ada sebelum generate pertama (bawaan base project) ikut ditimpa tapi tidak masuk manifest,
    // jadi tidak pernah dihapus saat regenerate.
    const owned = Object.keys(files).filter(f => previous.includes(f) || !existsSync(join(out, f)));
    if (dryRun) {
        for (const f of Object.keys(files)) console.log(`  ${f}`);
        console.log(`\n${Object.keys(files).length} files would be written, ${stale.length} removed (dry-run).`);
        return 0;
    }
    let changed = 0;
    for (const [path, content] of Object.entries(files)) {
        const target = join(out, path);
        if (existsSync(target) && readFileSync(target, 'utf8') === content) continue;
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
        changed++;
    }
    for (const f of stale) rmSync(join(out, f), { force: true });
    mkdirSync(join(out, '.midas'), { recursive: true });
    writeFileSync(join(out, MANIFEST), JSON.stringify({ project: project.id, name: project.name, library: `${project.library.packageName}@${project.library.version}`, files: owned.sort() }, null, 2) + '\n');
    pinLibrary(out, project.library);
    console.log(`Project "${project.name}": ${Object.keys(files).length} files (${changed} changed, ${stale.length} removed) → ${out}`);
    console.log(`Library: ${project.library.packageName}@${project.library.version}`);
    return errors.length ? 2 : 0;
}

/**
 * Keep package.json on the library of the project (spec §6): same version when the dependency exists, and when the project
 * uses another @midas/ui-* package than the app (the library was switched) the dependency is replaced — the app code
 * only names the library in src/shared/ui, which this run has just regenerated.
 */
function pinLibrary(out, lib) {
    const file = join(out, 'package.json');
    if (!existsSync(file) || !lib.packageName) return;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const deps = pkg.dependencies || (pkg.dependencies = {});
    const others = Object.keys(deps).filter(n => /^@midas\/ui-/.test(n) && n !== lib.packageName);
    if (deps[lib.packageName] === lib.version && !others.length) return;
    for (const n of others) delete deps[n];
    deps[lib.packageName] = lib.version;
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`package.json: ${others.length ? `${others.join(', ')} → ` : ''}${lib.packageName}@${lib.version} (run npm install)`);
}
