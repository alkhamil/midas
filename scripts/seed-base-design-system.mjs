#!/usr/bin/env node
// Seed design system "Midas Base" di Midas lalu publish sebagai library @midas/ui-base.
//
// Isi file desain mengikuti komponen di packages/ui-base (asal: contoh_base_code):
//   - Variables  : warna Light/Dark, radius, spacing (nama token = --theme-* yang dipakai komponen)
//   - Components : component set per komponen; variant & component property = props desain
//   - Icons      : set WDS (bila folder tersedia) + ikon "ui" yang dipakai komponen
// Script bisa dijalankan ulang: file yang sama diperbarui, lalu dipublish sebagai versi baru.
//
// Pakai:
//   node scripts/seed-base-design-system.mjs [--server URL] [--icons DIR] [--version X.Y.Z] [--no-publish]
// Token: MIDAS_TOKEN atau hasil `midas login` (~/.midas/config.json).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { buildIconPage, dataUrlToSvg, iconNameParts, iconStyleOf } from '../apps/studio/src/iconSet.js';

const ROOT = resolve(import.meta.dirname, '..');
const FILE_NAME = 'Midas Base Design System';
const PACKAGE = '@midas/ui-base';

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
const SERVER = (args.server || process.env.MIDAS_SERVER || userCfg.server || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const TOKEN = process.env.MIDAS_TOKEN || userCfg.token;
if (!TOKEN) throw new Error('Belum login: jalankan `node packages/cli/bin/midas.js login` atau set MIDAS_TOKEN');
const ICON_DIR = args.icons || join(ROOT, 'contoh_base_code/public/icons/wds');

async function api(method, path, body) {
    const isBlob = body instanceof Blob;
    const res = await fetch(SERVER + path, {
        method,
        headers: { authorization: `Bearer ${TOKEN}`, ...(body && !isBlob ? { 'content-type': 'application/json' } : {}), ...(isBlob ? { 'content-type': body.type } : {}) },
        body: isBlob ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors || data?.message || data)}`);
    return data;
}

let n = 0;
const uid = () => `base-${(++n).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------- Variables
// Nilai dari contoh_base_code/src/shared/theme/theme.ts.
const COLORS = {
    primary: ['#2563eb', '#3b82f6'], 'primary-foreground': ['#ffffff', '#0f172a'],
    secondary: ['#0f766e', '#2dd4bf'], 'secondary-foreground': ['#ffffff', '#0f172a'],
    success: ['#15803d', '#4ade80'], warning: ['#b45309', '#fbbf24'], danger: ['#dc2626', '#f87171'], info: ['#0284c7', '#38bdf8'],
    background: ['#ffffff', '#0f172a'], surface: ['#f1f5f9', '#1e293b'], muted: ['#e2e8f0', '#334155'], border: ['#cbd5e1', '#475569'],
    foreground: ['#0f172a', '#f1f5f9'], 'muted-foreground': ['#64748b', '#94a3b8'],
};
const RADIUS = { sm: 2, md: 4, lg: 8 };
// Tanpa grup supaya token = --theme-page-padding, dst. (dipakai .page-padding, .stack-gap, …).
const SPACING = { 'page-padding': 16, 'page-padding-lg': 24, 'card-padding-x': 20, 'card-padding-y': 16, 'section-gap': 24, 'stack-gap': 16, 'field-gap': 12 };

function variables() {
    const color = { id: uid(), name: 'Color', modes: [{ id: uid(), name: 'Light' }, { id: uid(), name: 'Dark' }] };
    const radius = { id: uid(), name: 'Radius', modes: [{ id: uid(), name: 'Base' }] };
    const spacing = { id: uid(), name: 'Spacing', modes: [{ id: uid(), name: 'Base' }] };
    const items = [];
    for (const [name, [light, dark]] of Object.entries(COLORS))
        items.push({ id: uid(), collectionId: color.id, name: `color/${name}`, type: 'color', values: { [color.modes[0].id]: light, [color.modes[1].id]: dark }, description: '' });
    for (const [name, v] of Object.entries(RADIUS))
        items.push({ id: uid(), collectionId: radius.id, name: `radius/${name}`, type: 'number', values: { [radius.modes[0].id]: v }, description: '' });
    for (const [name, v] of Object.entries(SPACING))
        items.push({ id: uid(), collectionId: spacing.id, name, type: 'number', values: { [spacing.modes[0].id]: v }, description: '' });
    return { collections: [color, radius, spacing], items };
}

// ---------------------------------------------------------------- Components
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v[0]]));
const base = { rotation: 0, opacity: 1, visible: true, locked: false, shadow: false, version: 0, fillType: 'solid', fillOpacity: 1, stroke: '#000000', strokeWidth: 0, radius: 0, clip: false };
const frame = (props) => ({ ...base, id: uid(), type: 'frame', fill: 'none', ...props });
const text = (props) => ({ ...base, id: uid(), type: 'text', fontFamily: 'Inter', fontSize: 14, fontWeight: 500, fontStyle: 'normal', lineHeight: 1.35, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fill: C.foreground, h: 20, ...props });

/**
 * Komponen desain: `variants` = property variant → nilai; `cprops` = component property.
 * `props` = penyesuaian nama prop kode (default dari nama property, mis. "Max Width" → maxWidth).
 * `draw(variant, cprops)` → layer isi satu variant.
 */
const COMPONENTS = [
    {
        name: 'Button', w: 120, h: 40,
        variants: { Variant: ['Primary', 'Secondary', 'Danger'], Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Button' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Icon', type: 'instance' }],
        props: { label: 'children' },
        draw: (v) => {
            const bg = { Primary: C.primary, Secondary: C.background, Danger: C.danger }[v.Variant];
            const fg = { Primary: C['primary-foreground'], Secondary: C.primary, Danger: '#ffffff' }[v.Variant];
            const h = { Sm: 32, Md: 40, Lg: 48 }[v.Size];
            return { fill: bg, stroke: v.Variant === 'Secondary' ? C.primary : '#000000', strokeWidth: v.Variant === 'Secondary' ? 1 : 0, radius: 8, h, label: { fill: fg, fontSize: { Sm: 12, Md: 14, Lg: 16 }[v.Size] } };
        },
    },
    {
        name: 'Badge', w: 72, h: 22,
        variants: { Variant: ['Success', 'Error', 'Warning', 'Info', 'Primary', 'Secondary'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Badge' }],
        props: { label: 'children' },
        draw: (v) => {
            const c = { Success: C.success, Error: C.danger, Warning: C.warning, Info: C.info, Primary: C.primary, Secondary: C.secondary }[v.Variant];
            return { fill: c, fillOpacity: 0.12, radius: 11, label: { fill: c, fontSize: 12 } };
        },
    },
    {
        name: 'Alert', w: 320, h: 48,
        variants: { Variant: ['Success', 'Error', 'Warning', 'Info'] },
        cprops: [{ name: 'Message', type: 'text', default: 'Pesan untuk pengguna' }],
        draw: (v) => {
            const c = { Success: C.success, Error: C.danger, Warning: C.warning, Info: C.info }[v.Variant];
            return { fill: c, fillOpacity: 0.1, stroke: c, strokeWidth: 1, radius: 8, label: { fill: c } };
        },
    },
    {
        name: 'Card', w: 320, h: 160,
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul card' }, { name: 'Content', type: 'slot' }],
        draw: () => ({ fill: C.background, stroke: C.border, strokeWidth: 1, radius: 8, label: { fontWeight: 600 } }),
    },
    ...['TextField', 'TextAreaField', 'PasswordField', 'SelectField'].map(name => ({
        name, w: 240, h: name === 'TextAreaField' ? 80 : 40,
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [
            { name: 'Placeholder', type: 'text', default: name === 'SelectField' ? 'Pilih…' : 'Ketik di sini…' },
            ...(name === 'TextAreaField' || name === 'PasswordField' ? [] : [{ name: 'Disabled', type: 'boolean', default: false }]),
            { name: 'Error', type: 'text', default: '' },
        ],
        draw: (v) => ({ fill: C.background, stroke: C.border, strokeWidth: 1, radius: 8, h: name === 'TextAreaField' ? 80 : { Sm: 32, Md: 40, Lg: 48 }[v.Size], label: { fill: C['muted-foreground'] } }),
    })),
    {
        name: 'CheckboxField', w: 160, h: 24,
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Checkbox Label', type: 'text', default: 'Setuju' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Indeterminate', type: 'boolean', default: false }],
        draw: () => ({ fill: 'none', label: {} }),
    },
    {
        name: 'SwitchField', w: 160, h: 24,
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Switch Label', type: 'text', default: 'Aktif' }, { name: 'Disabled', type: 'boolean', default: false }],
        draw: () => ({ fill: 'none', label: {} }),
    },
    {
        name: 'Dialog', w: 420, h: 220,
        variants: { 'Max Width': ['Sm', 'Md', 'Lg', 'Xl', '2xl'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul dialog' }, { name: 'Content', type: 'slot' }],
        draw: () => ({ fill: C.background, stroke: C.border, strokeWidth: 1, radius: 12, label: { fontWeight: 600, fontSize: 16 } }),
    },
    {
        name: 'Tooltip', w: 160, h: 32,
        variants: { Placement: ['Top', 'Bottom'] },
        cprops: [{ name: 'Content', type: 'text', default: 'Keterangan' }, { name: 'Trigger', type: 'slot' }],
        props: { trigger: 'children' },
        draw: () => ({ fill: C.foreground, radius: 6, label: { fill: C.background, fontSize: 12 } }),
    },
    {
        name: 'RowActionButton', w: 32, h: 32,
        variants: { Action: ['View', 'Edit', 'Delete', 'Restore'], Color: ['Default', 'Info', 'Warning', 'Danger', 'Success', 'Muted'] },
        cprops: [{ name: 'Disabled', type: 'boolean', default: false }],
        draw: (v) => ({ fill: { Default: C.muted, Info: C.info, Warning: C.warning, Danger: C.danger, Success: C.success, Muted: C.muted }[v.Color], fillOpacity: 0.15, radius: 6 }),
    },
    {
        name: 'PageHeader', w: 640, h: 56,
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Judul halaman' }, { name: 'Actions', type: 'slot' }],
        props: { actions: 'actions' },
        draw: () => ({ fill: C.background, stroke: C.border, strokeWidth: 1, label: { fontWeight: 600, fontSize: 18 } }),
    },
    // Komponen data/layout: tampil di canvas, props-nya fungsional (diatur di Code Builder, bukan di desain).
    ...[['Table', 640, 240], ['FilterToolbar', 640, 48], ['DetailCard', 400, 200], ['Sidebar', 240, 480], ['AppShell', 960, 560]].map(([name, w, h]) => ({
        name, w, h, variants: {}, cprops: [],
        draw: () => ({ fill: C.background, stroke: C.border, strokeWidth: 1, radius: name === 'Sidebar' || name === 'AppShell' ? 0 : 8, label: { fill: C['muted-foreground'] } }),
    })),
];

function combos(variants) {
    let out = [{}];
    for (const [k, vals] of Object.entries(variants))
        out = out.flatMap(o => vals.map(v => ({ ...o, [k]: v })));
    return out;
}

function componentsPage() {
    const nodes = [];
    let y = 0;
    for (const spec of COMPONENTS) {
        const cprops = spec.cprops.map(p => ({ id: uid(), ...p }));
        const label = cprops.find(p => p.type === 'text');
        const vs = combos(spec.variants);
        const isSet = Object.keys(spec.variants).length > 0;
        const cols = Math.min(vs.length, 6), gap = 16;
        const rootId = uid();
        const setW = isSet ? cols * spec.w + (cols + 1) * gap : spec.w;
        const rows = Math.ceil(vs.length / cols);
        const maxH = Math.max(...vs.map(v => spec.draw(v).h || spec.h));
        if (isSet)
            nodes.push(frame({ id: rootId, name: spec.name, x: 0, y, w: setW, h: rows * maxH + (rows + 1) * gap, componentSet: true, cprops, stroke: '#9747ff', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4, strokeAlign: 'center', radius: 6 }));
        vs.forEach((v, i) => {
            const d = spec.draw(v), h = d.h || spec.h, { label: labelStyle, ...look } = d;
            const id = isSet ? uid() : rootId;
            const x = isSet ? gap + (i % cols) * (spec.w + gap) : 0, vy = isSet ? gap + Math.floor(i / cols) * (maxH + gap) : y;
            nodes.push(frame({
                id, name: isSet ? Object.entries(v).map(([k, x2]) => `${k}=${x2}`).join(', ') : spec.name,
                parentId: isSet ? rootId : null, x, y: vy, w: spec.w, h, component: true,
                ...(isSet ? { variant: v } : { cprops }), ...look,
            }));
            if (labelStyle || label)
                nodes.push(text({ parentId: id, name: label?.name || spec.name, x: 12, y: Math.max(4, (h - 20) / 2), w: spec.w - 24, text: label?.default || spec.name, ...(label ? { propBind: { text: label.id } } : {}), ...(labelStyle || {}) }));
        });
        y += (isSet ? rows * maxH + (rows + 1) * gap : spec.h) + 64;
    }
    return { id: uid(), name: 'Components', nodes };
}

// ---------------------------------------------------------------- Icons
// Ikon "ui" yang dipakai komponen tetapi tidak ada di set WDS lokal. Digambar sederhana (24×24, garis 1.5),
// desainer bisa menggantinya di page Icons kapan saja.
const S = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C274C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const UI_ICONS = {
    calendar: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    'danger-circle': S('<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5v.01"/>'),
    'check-circle': S('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5 11 15l4.5-5"/>'),
    'close-circle': S('<circle cx="12" cy="12" r="9"/><path d="m9.5 9.5 5 5m0-5-5 5"/>'),
    eye: S('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
    'file-text': S('<path d="M6.5 3h7.5l4.5 4.5V21h-12z"/><path d="M14 3v4.5h4.5M9.5 12.5h5M9.5 16h5"/>'),
    filter: S('<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>'),
    'info-circle': S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>'),
    logout: S('<path d="M13.5 4H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M10 12h10.5M17.5 9l3 3-3 3"/>'),
    'hamburger-menu': S('<path d="M4 6.5h16M4 12h16M4 17.5h16"/>'),
    add: S('<path d="M12 5v14M5 12h14"/>'),
    magnifer: S('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
    settings: S('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
    'trash-bin': S('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>'),
    'danger-triangle': S('<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17v.01"/>'),
    close: S('<path d="m6 6 12 12M18 6 6 18"/>'),
};

function svgFiles(dir) {
    if (!existsSync(dir)) return [];
    const out = [];
    const walk = d => {
        for (const f of readdirSync(d)) {
            const p = join(d, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.svg')) out.push({ path: `wds/${relative(dir, p)}`, svg: readFileSync(p, 'utf8') });
        }
    };
    walk(dir);
    return out;
}

// ---------------------------------------------------------------- Snapshot (sama seperti publishLibrary() di Studio)
function subtree(nodes, rootId) {
    const out = [], queue = [rootId];
    for (let i = 0; i < queue.length; i++) {
        out.push(nodes.find(x => x.id === queue[i]));
        for (const x of nodes) if (x.parentId === queue[i]) queue.push(x.id);
    }
    return out.filter(Boolean);
}

function snapshotOf(doc) {
    const components = [], icons = [], used = new Set();
    for (const page of doc.pages) {
        const byParent = new Map();
        for (const x of page.nodes) if (x.parentId) (byParent.get(x.parentId) || byParent.set(x.parentId, []).get(x.parentId)).push(x);
        const isSetChild = x => x.parentId && page.nodes.find(p => p.id === x.parentId)?.componentSet;
        for (const r of page.nodes.filter(x => x.componentSet || (x.component && !isSetChild(x)))) {
            const nodes = subtree(page.nodes, r.id).map(x => (x.id === r.id ? { ...x, parentId: null } : x));
            components.push({ id: r.id, name: r.name, set: !!r.componentSet, nodes });
            for (const x of nodes) if (x.assetId) used.add(x.assetId);
            if (page.name === 'Icons') {
                const styles = {};
                for (const v of r.componentSet ? byParent.get(r.id).filter(x => x.component) : [r]) {
                    const img = (byParent.get(v.id) || []).find(x => x.type === 'image');
                    const svg = img && dataUrlToSvg(doc.assets[img.assetId]);
                    if (svg) styles[r.componentSet ? iconStyleOf(v.variant) : 'default'] = svg;
                }
                icons.push({ componentKey: r.id, ...iconNameParts(r.name), styles });
            }
        }
    }
    const assets = Object.fromEntries([...used].map(id => [id, doc.assets[id]]));
    return { snapshot: { components, variables: doc.variables, assets, icons }, iconKeys: icons.map(i => i.componentKey) };
}

// ---------------------------------------------------------------- Main
const wds = svgFiles(ICON_DIR);
const ui = Object.entries(UI_ICONS).map(([name, svg]) => ({ path: `ui/outline/ui/${name}.svg`, svg }));
const iconPage = buildIconPage([...wds, ...ui], { uid });
const components = componentsPage();
const doc = {
    format: 'midas', version: 1, name: FILE_NAME, pageId: components.id,
    pages: [components, iconPage.page],
    tokens: {}, variables: variables(), assets: iconPage.assets,
};
console.log(`Design system: ${COMPONENTS.length} komponen, ${iconPage.count} ikon (${iconPage.styles.join(', ')}), ${doc.variables.items.length} variables${wds.length ? '' : ' — folder ikon WDS tidak ditemukan, hanya ikon ui'}`);

const { files } = await api('GET', '/api/files');
let file = files.find(f => f.name === FILE_NAME && !f.trashed);
if (!file) {
    const id = `midas-base-ds-${Math.random().toString(36).slice(2, 10)}`;
    await api('POST', '/api/files/import', { id, data: doc });
    file = { id };
    console.log(`File dibuat: ${id}`);
}
else {
    // Perbarui isi file yang sama (id tetap, sehingga library & pemakainya tetap tersambung).
    const current = (await api('GET', `/api/files/${file.id}`)).file;
    const { pages } = await api('GET', `/api/files/${file.id}/pages`);
    for (const p of pages) await api('DELETE', `/api/files/${file.id}/pages/${encodeURIComponent(p.pageId)}`);
    const queue = Object.entries(doc.assets);
    await Promise.all(Array.from({ length: 8 }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
            const svg = dataUrlToSvg(job[1]);
            await api('PUT', `/api/files/${file.id}/assets/${encodeURIComponent(job[0])}`, new Blob([svg], { type: 'image/svg+xml' }));
        }
    }));
    for (const p of doc.pages) await api('PUT', `/api/files/${file.id}/pages/${encodeURIComponent(p.id)}`, { data: p, baseVersion: null });
    const { pages: _p, assets: _a, ...meta } = doc;
    await api('PUT', `/api/files/${file.id}`, { name: FILE_NAME, meta: { ...meta, pageMeta: doc.pages.map(p => ({ id: p.id, name: p.name, parentId: null })) }, baseVersion: current.version });
    console.log(`File diperbarui: ${file.id}`);
}

if (args['no-publish']) process.exit(0);

const { snapshot, iconKeys } = snapshotOf(doc);
const draft = await api('POST', `/api/libraries/${file.id}/draft`, { name: FILE_NAME, snapshot, iconKeys });
const keys = new Set(iconKeys);
const mappings = draft.mappings.filter(m => !keys.has(m.componentKey)).map(m => {
    const spec = COMPONENTS.find(c => c.name === m.componentName);
    for (const p of m.propsMap.props) if (spec?.props?.[p.name]) p.name = spec.props[p.name];
    return m;
});
const version = args.version || draft.suggestedVersion;
const res = await api('POST', `/api/libraries/${file.id}/versions`, {
    name: FILE_NAME, packageName: draft.library?.packageName || PACKAGE, version,
    releaseNotes: args.notes || `Seed design system Midas Base (${COMPONENTS.length} komponen, ${iconPage.count} ikon)`,
    snapshot, mappings,
});
console.log(`Published ${res.library.packageName}@${res.library.semver}: ${res.library.components} komponen, ${res.library.icons} ikon, ${res.library.variables} variables`);
