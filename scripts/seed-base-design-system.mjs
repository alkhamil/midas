#!/usr/bin/env node
// Bangun design system "Midas Base" di Midas lalu publish sebagai library @midas/ui-base.
// Isi desain ada di scripts/design-system/ (tokens, komponen, ikon, halaman). File yang sudah ada diperbarui
// dengan id yang sama (komponen, variant, property, Variable), sehingga update tidak menjadi breaking change
// dan file yang memakai library tetap tersambung.
//
// Pakai:
//   node scripts/seed-base-design-system.mjs [--server URL] [--icons DIR] [--version X.Y.Z] [--notes TEKS] [--no-publish] [--file NAMA] [--create] [--package @midas/ui-x]
// File dicari berdasarkan nama di workspace akun yang login; --create membuat file baru bila belum ada
// (tanpa itu script berhenti, supaya tidak membuat duplikat di workspace yang salah).
// Token: MIDAS_TOKEN atau hasil `midas login` (~/.midas/config.json).
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { dataUrlToSvg, iconNameParts, iconStyleOf } from '../apps/studio/src/iconSet.js';
import { COMPONENTS } from './design-system/components.mjs';
import { buildDocument, existingIds } from './design-system/document.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_FILE = 'Midas Base Design System';
const PACKAGE = '@midas/ui-base';
/** Nama prop kode yang berbeda dari nama property desain. */
const PROP_NAMES = { Button: { label: 'children' }, Badge: { label: 'children' } };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
}, []));
const userCfg = (() => {
    try {
        return JSON.parse(readFileSync(join(process.env.MIDAS_HOME || join(homedir(), '.midas'), 'config.json'), 'utf8'));
    } catch {
        return {};
    }
})();
const FILE_NAME = typeof args.file === 'string' ? args.file : DEFAULT_FILE;
const SERVER = (args.server || process.env.MIDAS_SERVER || userCfg.server || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const TOKEN = process.env.MIDAS_TOKEN || userCfg.token;
if (!TOKEN) throw new Error('Belum login: jalankan `node packages/cli/bin/midas.js login` atau set MIDAS_TOKEN');

async function api(method, path, body) {
    const isBlob = body instanceof Blob;
    const res = await fetch(SERVER + path, {
        method,
        headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { 'content-type': isBlob ? body.type : 'application/json' } : {}) },
        body: isBlob ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors || data?.message || data)}${data?.breaking?.length ? `\nBreaking: ${data.breaking.join("; ")}` : ""}`);
    return data;
}
const enc = encodeURIComponent;

// ---------------------------------------------------------------- file yang sudah ada (untuk id)
const { files } = await api('GET', '/api/files');
const file = files.find(f => f.name === FILE_NAME && !f.trashed);
let existing = new Map(), current = null, currentPages = [];
if (file) {
    current = (await api('GET', `/api/files/${file.id}`)).file;
    currentPages = (await api('GET', `/api/files/${file.id}/pages`)).pages;
    existing = existingIds({ pages: currentPages.map(p => p.data), variables: current.meta.variables });
}

// Ikon WDS: salinan di repo (scripts/design-system/icons/wds), atau folder referensi lama contoh_base_code.
const wdsDir = args.icons || [join(ROOT, 'scripts/design-system/icons/wds'), join(ROOT, 'contoh_base_code/public/icons/wds')].find(d => existsSync(d)) || join(ROOT, 'scripts/design-system/icons/wds');
if (!existsSync(wdsDir)) console.warn(`Peringatan: folder ikon WDS ${wdsDir} tidak ada — hanya ikon UI bawaan yang dipakai. Pakai --icons DIR untuk set lengkap.`);
const { doc, iconCount, iconStyles } = buildDocument({ existing, wdsDir });
console.log(`Design system: ${doc.pages.map(p => `${p.name} (${p.nodes.length})`).join(', ')} · ${iconCount} ikon (${iconStyles.join(', ')}) · ${doc.variables.items.length} variables`);

// ---------------------------------------------------------------- simpan ke Midas
let fileId = file?.id;
if (!fileId && !args.create) {
    const me = await api('GET', '/api/auth/me').catch(() => null);
    throw new Error(`File "${FILE_NAME}" tidak ada di workspace ${me?.user?.email ?? 'akun ini'}. Login dengan akun pemilik file, atau tambahkan --create untuk membuat file baru.`);
}
if (!fileId) {
    // File default memakai id library di packages/ui-base/midas.config.json supaya `midas sync` paket langsung tersambung.
    const kitId = FILE_NAME === DEFAULT_FILE ? (() => {
        try {
            return JSON.parse(readFileSync(join(ROOT, 'packages/ui-base/midas.config.json'), 'utf8')).libraryId;
        } catch {
            return null;
        }
    })() : null;
    fileId = kitId || `midas-base-ds-${Math.random().toString(36).slice(2, 10)}`;
    await api('POST', '/api/files/import', { id: fileId, data: { ...doc, name: FILE_NAME } }).catch(async err => {
        if (!kitId) throw err;
        fileId = `midas-base-ds-${Math.random().toString(36).slice(2, 10)}`; // id sudah dipakai workspace lain di server ini
        await api('POST', '/api/files/import', { id: fileId, data: { ...doc, name: FILE_NAME } });
    });
    console.log(`File dibuat: ${fileId}`);
}
else {
    const uploaded = new Set((await api('GET', `/api/files/${fileId}/assets`)).assets);
    const queue = Object.entries(doc.assets).filter(([id]) => !uploaded.has(id)), newAssets = queue.length;
    await Promise.all(Array.from({ length: 8 }, async () => {
        for (let job = queue.shift(); job; job = queue.shift())
            await api('PUT', `/api/files/${fileId}/assets/${enc(job[0])}`, new Blob([dataUrlToSvg(job[1])], { type: 'image/svg+xml' }));
    }));
    const keep = new Set(doc.pages.map(p => p.id));
    for (const p of currentPages) if (!keep.has(p.pageId)) await api('DELETE', `/api/files/${fileId}/pages/${enc(p.pageId)}`);
    const versions = new Map(currentPages.map(p => [p.pageId, p.version]));
    for (const p of doc.pages) await api('PUT', `/api/files/${fileId}/pages/${enc(p.id)}`, { data: p, baseVersion: versions.get(p.id) ?? null });
    const { pages: _p, assets: _a, ...meta } = doc;
    await api('PUT', `/api/files/${fileId}`, { name: FILE_NAME, meta: { ...meta, pageMeta: doc.pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId ?? null })) }, baseVersion: current.version });
    console.log(`File diperbarui: ${fileId} (${newAssets} aset baru)`);
}
if (args['no-publish']) process.exit(0);

// ---------------------------------------------------------------- publish (sama seperti publishLibrary() di Studio)
const components = [], icons = [];
for (const page of doc.pages) {
    const byId = new Map(page.nodes.map(n => [n.id, n]));
    const kids = new Map();
    for (const n of page.nodes) if (n.parentId) (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const subtree = id => {
        const out = [], q = [id];
        for (let i = 0; i < q.length; i++) {
            out.push(byId.get(q[i]));
            for (const k of kids.get(q[i]) || []) q.push(k.id);
        }
        return out;
    };
    for (const r of page.nodes.filter(n => n.componentSet || (n.component && !byId.get(n.parentId)?.componentSet))) {
        components.push({ id: r.id, name: r.name, set: !!r.componentSet, nodes: subtree(r.id).map(n => (n.id === r.id ? { ...n, parentId: null } : n)) });
        if (page.name !== 'Icons') continue;
        const styles = {};
        for (const v of r.componentSet ? (kids.get(r.id) || []).filter(x => x.component) : [r]) {
            const img = (kids.get(v.id) || []).find(x => x.type === 'image');
            const svg = img && dataUrlToSvg(doc.assets[img.assetId]);
            if (svg) styles[r.componentSet ? iconStyleOf(v.variant) : 'default'] = svg;
        }
        icons.push({ componentKey: r.id, ...iconNameParts(r.name), styles });
    }
}
const used = new Set(components.flatMap(c => c.nodes).map(n => n.assetId).filter(Boolean));
const snapshot = { components, variables: doc.variables, assets: Object.fromEntries([...used].map(id => [id, doc.assets[id]])), icons };
const iconKeys = icons.map(i => i.componentKey);
const draft = await api('POST', `/api/libraries/${fileId}/draft`, { name: FILE_NAME, snapshot, iconKeys });
const keys = new Set(iconKeys);
// Seperti Studio: komponen berawalan _ atau . = bagian internal, ikut snapshot tapi tidak dipetakan ke kode.
const mappings = draft.mappings.filter(m => !keys.has(m.componentKey) && !/^[_.]/.test(m.componentName)).map(m => {
    for (const p of m.propsMap.props) if (PROP_NAMES[m.componentName]?.[p.name]) p.name = PROP_NAMES[m.componentName][p.name];
    return m;
});
if (draft.breaking.length) console.log(`Breaking change: ${draft.breaking.join('; ')}`);
// Publish pertama di server baru mengikuti versi paket kode (packages/ui-base) supaya `midas report` cocok.
const codeVersion = (() => {
    try {
        return JSON.parse(readFileSync(join(ROOT, 'packages/ui-base/package.json'), 'utf8')).version;
    } catch {
        return null;
    }
})();
const version = args.version || (draft.latest ? draft.suggestedVersion : codeVersion || draft.suggestedVersion);
const res = await api('POST', `/api/libraries/${fileId}/versions`, {
    name: FILE_NAME, packageName: draft.library?.packageName || (typeof args.package === 'string' ? args.package : PACKAGE), version,
    releaseNotes: args.notes || `Design system Midas Base: ${COMPONENTS.length} komponen, ${iconCount} ikon (${iconStyles.join(' & ')}), foundations & templates`,
    snapshot, mappings,
});
console.log(`Published ${res.library.packageName}@${res.library.semver}: ${res.library.components} komponen, ${res.library.icons} ikon, ${res.library.variables} variables`);
