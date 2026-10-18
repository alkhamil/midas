// `midas generate`: ambil project Code Builder + dokumen desain dari Midas, jalankan generator
// (@midas/builder-core), dan tulis hasilnya ke repo aplikasi. File yang pernah dibangkitkan tapi tidak lagi
// dihasilkan (mis. screen dihapus) ikut dibersihkan lewat manifest `.midas/generated.json`.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildTrees, generateProject, makeContext } from '@midas/builder-core';

const MANIFEST = '.midas/generated.json';
const enc = encodeURIComponent;

export async function listProjects(request) {
    const { projects } = await request('GET', '/api/builder-projects');
    if (!projects.length) console.log('Belum ada project Code Builder di workspace ini.');
    for (const p of projects) console.log(`${p.name.padEnd(28)} ${p.id}  ${p.modules} module, ${p.screens} screen  · ${p.library ? `${p.library.packageName}@${p.library.version}` : 'tanpa library'}`);
    return 0;
}

/** Pilih project dari argumen (nama atau id); satu-satunya project dipakai bila argumen kosong. */
async function pickProject(request, ref) {
    const { projects } = await request('GET', '/api/builder-projects');
    if (!projects.length) throw new Error('Belum ada project Code Builder — buat di Midas Studio (menu Plugins → Code Builder)');
    if (!ref) {
        if (projects.length > 1) throw new Error(`Ada ${projects.length} project; sebutkan salah satu:\n${projects.map(p => `  ${p.name} (${p.id})`).join('\n')}`);
        return projects[0];
    }
    const hit = projects.filter(p => p.id === ref || p.name.toLowerCase() === ref.toLowerCase());
    if (hit.length !== 1) throw new Error(hit.length ? `Nama "${ref}" ambigu — pakai id project` : `Project "${ref}" tidak ditemukan (midas generate --list)`);
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
    if (!project.library || project.library.missing) throw new Error('Project belum memilih library/versi yang valid — atur di Code Builder');
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
        console.log(`\n${Object.keys(files).length} file akan ditulis, ${stale.length} dihapus (dry-run).`);
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
    console.log(`Project "${project.name}": ${Object.keys(files).length} file (${changed} berubah, ${stale.length} dihapus) → ${out}`);
    console.log(`Library: ${project.library.packageName}@${project.library.version}`);
    return errors.length ? 2 : 0;
}

/** Samakan versi library di package.json aplikasi dengan versi yang dipakai project (spec §6). */
function pinLibrary(out, lib) {
    const file = join(out, 'package.json');
    if (!existsSync(file) || !lib.packageName) return;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    if (pkg.dependencies?.[lib.packageName] && pkg.dependencies[lib.packageName] !== lib.version) {
        pkg.dependencies[lib.packageName] = lib.version;
        writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`package.json: ${lib.packageName} → ${lib.version} (jalankan npm install)`);
    }
}
