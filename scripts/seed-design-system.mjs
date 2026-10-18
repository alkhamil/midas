#!/usr/bin/env node
// Bangun design system "CMS" di Midas lalu publish sebagai library @midas/ui-cms.
// The design lives in scripts/design-system/ (tokens, components, icons, pages). An existing file is updated
// with the same ids (components, variants, properties, Variables), so an update is not a breaking change
// dan file yang memakai library tetap tersambung.
//
// Pakai:
//   node scripts/seed-design-system.mjs [--server URL] [--version X.Y.Z] [--notes TEKS] [--no-publish] [--file NAMA] [--create] [--package @midas/ui-x] [--code-dir FOLDER]
// --code-dir: folder paket kode library (default packages/ui-cms) — untuk menguji di workspace lain tanpa bentrok id.
// File dicari berdasarkan nama di workspace akun yang login; --create membuat file baru bila belum ada
// (tanpa itu script berhenti, supaya tidak membuat duplikat di workspace yang salah).
// Token: MIDAS_TOKEN atau hasil `midas login` (~/.midas/config.json).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dataUrlToSvg, iconNameParts, iconStyleOf } from '../apps/studio/src/iconSet.js';
import { COMPONENTS } from './design-system/components.mjs';
import { PACKAGE_NAME } from './design-system/tokens.mjs';
import { buildDocument, existingIds } from './design-system/document.mjs';
import { connect, findFile, parseArgs, saveDocument, whoami } from './lib/midas-api.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_FILE = 'CMS Design System';
const PACKAGE = PACKAGE_NAME;
/** Paket kode library (dibuat dengan `midas init`); bila ada, id library & versi awal mengikutinya. */
/** Nama prop kode yang berbeda dari nama property desain. */
const PROP_NAMES = { Button: { label: 'children' }, Badge: { label: 'children' } };

const args = parseArgs();
const CODE_PACKAGE_DIR = typeof args['code-dir'] === 'string' ? resolve(args['code-dir']) : join(ROOT, 'packages/ui-cms');
const FILE_NAME = typeof args.file === 'string' ? args.file : DEFAULT_FILE;
const { api } = connect(args);

// ---------------------------------------------------------------- file yang sudah ada (untuk id)
const existingFile = await findFile(api, FILE_NAME);
const existing = existingFile ? existingIds({ pages: existingFile.currentPages.map(p => p.data), variables: existingFile.current.meta.variables }) : new Map();

const { doc, iconCount, iconStyles } = buildDocument({ existing });
console.log(`Design system: ${doc.pages.map(p => `${p.name} (${p.nodes.length})`).join(', ')} · ${iconCount} icons (${iconStyles.join(', ')}) · ${doc.variables.items.length} variables`);

// ---------------------------------------------------------------- simpan ke Midas
if (!existingFile && !args.create) {
    const me = await whoami(api);
    throw new Error(`File "${FILE_NAME}" not found in the workspace of ${me?.email ?? 'this account'}. Sign in with the file owner's account, or add --create to create a new file.`);
}
// File default memakai id library di packages/ui-cms/midas.config.json (bila paket kodenya sudah ada) supaya `midas sync` langsung tersambung.
const kitId = !existingFile && FILE_NAME === DEFAULT_FILE ? (() => {
    try {
        return JSON.parse(readFileSync(join(CODE_PACKAGE_DIR, 'midas.config.json'), 'utf8')).libraryId;
    } catch {
        return null;
    }
})() : null;
const saved = await saveDocument(api, { name: FILE_NAME, doc, existing: existingFile, id: kitId, idPrefix: 'midas-ds' });
const fileId = saved.fileId;
console.log(saved.created ? `File created: ${fileId}` : `File updated: ${fileId} (${saved.newAssets} new assets)`);
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
// Like Studio: components prefixed with _ or . are internal parts: part of the snapshot but not mapped to code.
const mappings = draft.mappings.filter(m => !keys.has(m.componentKey) && !/^[_.]/.test(m.componentName)).map(m => {
    for (const p of m.propsMap.props) if (PROP_NAMES[m.componentName]?.[p.name]) p.name = PROP_NAMES[m.componentName][p.name];
    return m;
});
if (draft.breaking.length) console.log(`Breaking change: ${draft.breaking.join('; ')}`);
// Publish pertama di server baru mengikuti versi paket kode (packages/ui-cms) bila ada, supaya `midas report` cocok.
const codeVersion = (() => {
    try {
        return JSON.parse(readFileSync(join(CODE_PACKAGE_DIR, 'package.json'), 'utf8')).version;
    } catch {
        return null;
    }
})();
const version = args.version || (draft.latest ? draft.suggestedVersion : codeVersion || draft.suggestedVersion);
const res = await api('POST', `/api/libraries/${fileId}/versions`, {
    name: FILE_NAME, packageName: draft.library?.packageName || (typeof args.package === 'string' ? args.package : PACKAGE), version,
    releaseNotes: args.notes || `Design system CMS: ${COMPONENTS.filter(c => !c.name.startsWith('_')).length} components, ${iconCount} icons (${iconStyles.join(' & ')}), foundations`,
    snapshot, mappings,
});
console.log(`Published ${res.library.packageName}@${res.library.semver}: ${res.library.components} components, ${res.library.icons} icons, ${res.library.variables} variables`);
