// Klien Midas API untuk script di scripts/: koneksi + token, argumen, dan penyimpanan dokumen desain ke server.
// Token: MIDAS_TOKEN atau hasil `midas login` (~/.midas/config.json, atau $MIDAS_HOME/config.json).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dataUrlToSvg } from '../../apps/studio/src/iconSet.js';

export const enc = encodeURIComponent;

/** `--kunci nilai` dan `--bendera` → objek. */
export function parseArgs(argv = process.argv.slice(2)) {
    return Object.fromEntries(argv.reduce((acc, a, i, all) => {
        if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
        return acc;
    }, []));
}

export function connect(args = {}) {
    const userCfg = (() => {
        try {
            return JSON.parse(readFileSync(join(process.env.MIDAS_HOME || join(homedir(), '.midas'), 'config.json'), 'utf8'));
        } catch {
            return {};
        }
    })();
    const server = (args.server || process.env.MIDAS_SERVER || userCfg.server || 'http://127.0.0.1:4000').replace(/\/+$/, '');
    const token = process.env.MIDAS_TOKEN || userCfg.token;
    if (!token) throw new Error('Not signed in: run `node packages/cli/bin/midas.js login` or set MIDAS_TOKEN');
    async function api(method, path, body) {
        const isBlob = body instanceof Blob;
        const res = await fetch(server + path, {
            method,
            headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': isBlob ? body.type : 'application/json' } : {}) },
            body: isBlob ? body : body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors || data?.message || data)}${data?.breaking?.length ? `\nBreaking: ${data.breaking.join('; ')}` : ''}`);
        return data;
    }
    return { server, api };
}

/** File di workspace akun yang login berdasarkan nama (bukan yang di Trash), beserta meta & page-nya. */
export async function findFile(api, name) {
    const { files } = await api('GET', '/api/files');
    const file = files.find(f => f.name === name && !f.trashed);
    if (!file) return null;
    const current = (await api('GET', `/api/files/${file.id}`)).file;
    const currentPages = (await api('GET', `/api/files/${file.id}/pages`)).pages;
    return { file, current, currentPages };
}

export async function whoami(api) {
    return (await api('GET', '/api/auth/me').catch(() => null))?.user ?? null;
}

/**
 * Simpan dokumen ke server. File baru dibuat lewat /api/files/import dengan `id` (atau id acak `<prefix>-xxxx` bila id
 * dipakai workspace lain). File yang sudah ada diperbarui per page (id page/komponen dipertahankan dari `doc`).
 * Mengembalikan { fileId, created, newAssets }.
 */
export async function saveDocument(api, { name, doc, existing = null, id = null, idPrefix = 'midas' }) {
    const random = () => `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`;
    if (!existing) {
        let fileId = id || random();
        try {
            await api('POST', '/api/files/import', { id: fileId, data: { ...doc, name } });
        }
        catch (err) {
            if (!id) throw err;
            fileId = random(); // id sudah dipakai workspace lain di server ini
            await api('POST', '/api/files/import', { id: fileId, data: { ...doc, name } });
        }
        return { fileId, created: true, newAssets: Object.keys(doc.assets).length };
    }
    const { file, current, currentPages } = existing, fileId = file.id;
    const uploaded = new Set((await api('GET', `/api/files/${fileId}/assets`)).assets);
    const queue = Object.entries(doc.assets).filter(([assetId]) => !uploaded.has(assetId)), newAssets = queue.length;
    await Promise.all(Array.from({ length: 8 }, async () => {
        for (let job = queue.shift(); job; job = queue.shift())
            await api('PUT', `/api/files/${fileId}/assets/${enc(job[0])}`, new Blob([dataUrlToSvg(job[1])], { type: 'image/svg+xml' }));
    }));
    const keep = new Set(doc.pages.map(p => p.id));
    for (const p of currentPages) if (!keep.has(p.pageId)) await api('DELETE', `/api/files/${fileId}/pages/${enc(p.pageId)}`);
    const versions = new Map(currentPages.map(p => [p.pageId, p.version]));
    for (const p of doc.pages) await api('PUT', `/api/files/${fileId}/pages/${enc(p.id)}`, { data: p, baseVersion: versions.get(p.id) ?? null });
    const { pages: _p, assets: _a, ...meta } = doc;
    await api('PUT', `/api/files/${fileId}`, { name, meta: { ...meta, pageMeta: doc.pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId ?? null })) }, baseVersion: current.version });
    return { fileId, created: false, newAssets };
}
