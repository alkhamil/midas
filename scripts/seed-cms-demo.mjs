#!/usr/bin/env node
// Bangun file desain "CMS Demo" (layar User, Role, Dashboard) yang memakai library @midas/ui-cms, lalu daftarkan
// project Code Builder-nya (3 module: user, role = CRUD; dashboard = custom). Dipakai untuk menguji fitur Code Builder.
//
// File ini dibuat seperti Studio membuatnya saat sebuah file memakai library: variabel library disalin (bertanda libId),
// komponen disalin ke page "Library · <nama>" (setiap layer punya libRef), dan layar disusun dari instance salinan itu.
// Layar adalah frame konten (tanpa sidebar/topbar): shell aplikasi datang dari base project.
//
// Pakai:
//   node scripts/seed-cms-demo.mjs [--server URL] [--package @midas/ui-cms] [--file "CMS Demo"] [--no-project]
// Prasyarat: library sudah dipublish (`node scripts/seed-design-system.mjs`) dan sudah login (`midas login`).
import { build, col, Ids, instance, row, text } from './design-system/build.mjs';
import { existingIds } from './design-system/document.mjs';
import { PACKAGE_NAME } from './design-system/tokens.mjs';
import { connect, enc, findFile, parseArgs, saveDocument } from './lib/midas-api.mjs';

const args = parseArgs();
const FILE_NAME = typeof args.file === 'string' ? args.file : 'CMS Demo';
const PACKAGE = typeof args.package === 'string' ? args.package : PACKAGE_NAME;
const MUTED = 'color/muted-foreground';
const { api } = connect(args);

// ---------------------------------------------------------------- library (versi terbaru yang dipublish)
const lib = await api('GET', `/api/libraries/resolve?package=${enc(PACKAGE)}`);
const snap = await api('GET', `/api/libraries/${enc(lib.id)}/snapshot`);
console.log(`Library ${snap.packageName}@${snap.semver} (seq ${snap.version}): ${snap.components.length} komponen`);

// ---------------------------------------------------------------- id stabil dari file yang sudah ada
const existingFile = await findFile(api, FILE_NAME);
const ids = new Ids(existingFile ? existingIds({ pages: existingFile.currentPages.map(p => p.data), variables: existingFile.current.meta.variables }) : new Map());

// ---------------------------------------------------------------- variabel library (id sama, bertanda libId)
const collections = snap.variables.collections.map(c => ({ ...structuredClone(c), libId: snap.id }));
const items = snap.variables.items.map(i => ({ ...structuredClone(i), libId: snap.id }));
const firstMode = new Map(snap.variables.collections.map(c => [c.id, c.modes[0].id]));
const vars = {
    byName: new Map(items.map(i => [i.name, { item: i, first: i.values[firstMode.get(i.collectionId)] }])),
    ref(name) {
        const v = this.byName.get(name);
        if (!v) throw new Error(`Variable ${name} tidak ada di library`);
        return v;
    },
    toJSON: () => ({ collections, items }),
};

// ---------------------------------------------------------------- salinan komponen library (tanpa ikon; ikon dipakai lewat komponen)
const iconKeys = new Set((snap.icons ?? []).map(i => i.componentKey));
const libComponents = snap.components.filter(c => !iconKeys.has(c.id));
const idFor = new Map();
for (const c of libComponents) for (const n of c.nodes) idFor.set(n.id, ids.get(`node:lib:${n.id}`));
const libNodes = [];
let libY = 0;
for (const c of libComponents) {
    for (const src of c.nodes) {
        const n = structuredClone(src);
        n.id = idFor.get(src.id);
        n.parentId = src.parentId ? idFor.get(src.parentId) : null;
        for (const k of ['sourceId', 'swapOf', 'prototypeTarget']) if (n[k] != null) n[k] = idFor.get(n[k]) ?? n[k];
        if (Array.isArray(n.exposedNested)) n.exposedNested = n.exposedNested.map(v => idFor.get(v) ?? v);
        Object.assign(n, { libRef: `${snap.id}:${src.id}`, libVersion: snap.version, dsKey: `lib:${src.id}`, version: 0 });
        if (!n.parentId) {
            n.x = 0;
            n.y = libY;
            libY += n.h + 80;
        }
        libNodes.push(n);
    }
}
const byId = new Map(libNodes.map(n => [n.id, n]));
const kids = new Map();
for (const n of libNodes) if (n.parentId) (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
const components = new Map(), variantIndex = new Map(), rootIndex = new Map();
for (const n of libNodes) {
    if (!n.component) continue;
    components.set(n.id, n);
    const parent = byId.get(n.parentId);
    if (parent?.componentSet) variantIndex.set(`${parent.name}|${n.name}`, n.id);
    else if (!n.parentId) rootIndex.set(n.name, n.id);
}
const ctx = {
    ids, vars, components,
    subtree(id) {
        const out = [], queue = [id];
        for (let i = 0; i < queue.length; i++) {
            const n = byId.get(queue[i]);
            if (n) out.push(n);
            for (const k of kids.get(queue[i]) || []) queue.push(k.id);
        }
        return out;
    },
    propHolder: src => (src.variant ? byId.get(src.parentId) : src),
    componentName: src => (src.variant ? byId.get(src.parentId)?.name : src.name),
    variant(name, v) {
        const id = variantIndex.get(`${name}|${Object.entries(v).map(([k, x]) => `${k}=${x}`).join(', ')}`);
        if (!id) throw new Error(`Variant ${name} ${JSON.stringify(v)} tidak ada di library`);
        return id;
    },
    root(name) {
        const id = rootIndex.get(name);
        if (!id) throw new Error(`Komponen ${name} tidak ada di library`);
        return id;
    },
};

// ---------------------------------------------------------------- layar
const V = (name, variant, props, extra) => instance(ctx.variant(name, variant), props, extra);
const R = (name, props = {}, extra) => instance(ctx.root(name), props, extra);
const btn = (variant, label, extra) => V('Button', { Variant: variant, Size: 'Md' }, { Label: label }, { name: label, ...extra });
const screen = (name, children) => col({ w: 1184, pad: 24, gap: 24, fill: 'color/surface', name }, children);
const header = (title, description, action) => row({ w: 'fill', justify: 'between', align: 'center', name: 'Header' }, [R('PageHeader', { Title: title, Description: description }, { w: 'fill' }), action]);
const panel = (children, name) => col({ w: 'fill', gap: 16, pad: 20, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', name }, children);
const twoCols = (a, b) => row({ w: 'fill', gap: 24, align: 'start' }, [a, b]);
const actions = (...buttons) => row({ w: 'fill', gap: 8, justify: 'end', pad: [16, 0, 0, 0], stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Aksi form' }, buttons);
const detailRow = (label, value) => row({ w: 'fill', gap: 16, align: 'start', name: label }, [text(label, { w: 160, color: MUTED }), typeof value === 'string' ? text(value, { w: 'fill', weight: 500 }) : value]);
const field = (name, label, placeholder) => R(name, { Label: label, Placeholder: placeholder }, { w: 'fill' });
const list = (title, description, addLabel) => screen(`${title} — Daftar`, [
    header(title, description, btn('Primary', addLabel)),
    panel([R('FilterToolbar', {}, { w: 'fill' }), R('Table', {}, { w: 'fill' })], 'Daftar'),
]);

const userScreens = [
    list('User', 'Kelola akun yang dapat masuk ke aplikasi', 'Tambah user'),
    screen('User — Form', [
        header('Tambah User', 'Isi data akun baru', btn('Secondary', 'Kembali')),
        panel([
            twoCols(field('TextField', 'Nama lengkap', 'Mis. Budi Santoso'), field('TextField', 'Email', 'nama@perusahaan.id')),
            twoCols(field('SelectField', 'Role', 'Pilih role'), field('PasswordField', 'Kata sandi', 'Minimal 8 karakter')),
            R('SwitchField', { Label: 'Akun aktif' }),
            actions(btn('Secondary', 'Batal'), btn('Primary', 'Simpan')),
        ], 'Form'),
    ]),
    screen('User — Detail', [
        header('Detail User', 'Informasi akun', btn('Secondary', 'Ubah')),
        panel([
            detailRow('Nama', 'Budi Santoso'), detailRow('Email', 'budi@contoh.id'), detailRow('Role', 'Administrator'),
            detailRow('Status', V('Badge', { Variant: 'Success' }, { Label: 'Aktif' })), detailRow('Dibuat', '12/10/2026 09:30'),
        ], 'Detail'),
    ]),
];
const roleScreens = [
    list('Role', 'Atur role dan hak akses pengguna', 'Tambah role'),
    screen('Role — Form', [
        header('Tambah Role', 'Isi data role baru', btn('Secondary', 'Kembali')),
        panel([
            field('TextField', 'Nama role', 'Mis. Editor'),
            field('TextAreaField', 'Deskripsi', 'Jelaskan hak akses role ini'),
            R('SwitchField', { Label: 'Role aktif' }),
            actions(btn('Secondary', 'Batal'), btn('Primary', 'Simpan')),
        ], 'Form'),
    ]),
    screen('Role — Detail', [
        header('Detail Role', 'Informasi role', btn('Secondary', 'Ubah')),
        panel([
            detailRow('Nama role', 'Editor'), detailRow('Deskripsi', 'Mengelola konten, tanpa akses pengaturan'),
            detailRow('Status', V('Badge', { Variant: 'Success' }, { Label: 'Aktif' })), detailRow('Jumlah user', '12'),
        ], 'Detail'),
    ]),
];
const dashboard = screen('Dashboard', [
    header('Dashboard', 'Ringkasan aktivitas aplikasi', btn('Secondary', 'Unduh laporan')),
    row({ w: 'fill', gap: 16, align: 'start', name: 'Statistik' }, [
        V('StatCard', { Trend: 'Up' }, { Label: 'Total user', Value: '1.248', Caption: '12% dari bulan lalu' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Up' }, { Label: 'User aktif', Value: '1.032', Caption: '83% dari total' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Neutral' }, { Label: 'Role', Value: '4', Caption: 'Tidak berubah' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Down' }, { Label: 'Menunggu verifikasi', Value: '47', Caption: '5 lebih banyak dari kemarin' }, { w: 'fill' }),
    ]),
    V('Alert', { Variant: 'Warning' }, { Message: '47 user menunggu verifikasi email.' }, { w: 'fill' }),
    panel([text('User terbaru', { size: 18, line: 28, weight: 600 }), R('Table', {}, { w: 'fill' })], 'User terbaru'),
]);

// ---------------------------------------------------------------- dokumen
const frames = []; // { page, name, id }
const pages = [];
const addPage = (name, specs) => {
    const nodes = [];
    let x = 0;
    specs.forEach((spec, i) => {
        const built = build(spec, ctx, { x, y: 0, key: `screen:${name}/${i}` });
        nodes.push(...built);
        frames.push({ page: name, name: spec.name, id: built[0].id });
        x += built[0].w + 120;
    });
    pages.push({ id: ids.get(`page:${name}`), name, nodes, parentId: null });
};
addPage('User', userScreens);
addPage('Role', roleScreens);
addPage('Dashboard', [dashboard]);
pages.push({ id: ids.get('page:library'), name: `Library · ${snap.name}`, nodes: libNodes, parentId: null });
const pageOf = name => pages.find(p => p.name === name).id;
const frameOf = (page, name) => frames.find(f => f.page === page && f.name === name).id;
const doc = { format: 'midas', version: 1, name: FILE_NAME, pageId: pages[0].id, pages, tokens: {}, variables: vars.toJSON(), assets: structuredClone(snap.assets ?? {}) };
console.log(`CMS Demo: ${pages.map(p => `${p.name} (${p.nodes.length})`).join(', ')}`);

const saved = await saveDocument(api, { name: FILE_NAME, doc, existing: existingFile, idPrefix: 'cms-demo' });
const fileId = saved.fileId;
console.log(saved.created ? `File dibuat: ${fileId}` : `File diperbarui: ${fileId} (${saved.newAssets} aset baru)`);
await api('PUT', `/api/files/${enc(fileId)}/libraries`, { libraries: [{ id: lib.id, version: snap.version }] });

// ---------------------------------------------------------------- project Code Builder
if (args['no-project']) process.exit(0);
const str = (name, label, extra = {}) => ({ name, label, type: 'string', required: false, sortable: false, filterable: false, ...extra });
const screenOf = (id, page, name, role) => ({ id, frameId: frameOf(page, name), pageId: pageOf(page), name, role });
const config = {
    modules: [
        {
            id: 'mod-user', name: 'user', label: 'User', parentId: null, permissionKey: 'user', pageId: pageOf('User'),
            entity: { fields: [
                str('name', 'Nama lengkap', { required: true, sortable: true, filterable: true }),
                str('email', 'Email', { required: true, sortable: true, filterable: true }),
                { name: 'role', label: 'Role', type: 'relation', relation: 'role', required: true, sortable: false, filterable: true },
                { name: 'status', label: 'Status', type: 'enum', options: ['active', 'inactive'], required: true, sortable: false, filterable: true },
            ] },
            screens: [
                screenOf('scr-user-list', 'User', 'User — Daftar', 'list'),
                screenOf('scr-user-create', 'User', 'User — Form', 'create'),
                screenOf('scr-user-edit', 'User', 'User — Form', 'edit'),
                screenOf('scr-user-view', 'User', 'User — Detail', 'view'),
            ],
        },
        {
            id: 'mod-role', name: 'role', label: 'Role', parentId: null, permissionKey: 'role', pageId: pageOf('Role'),
            entity: { fields: [
                str('name', 'Nama role', { required: true, sortable: true, filterable: true }),
                { name: 'description', label: 'Deskripsi', type: 'text', required: false, sortable: false, filterable: false },
                { name: 'status', label: 'Status', type: 'enum', options: ['active', 'inactive'], required: true, sortable: false, filterable: true },
            ] },
            screens: [
                screenOf('scr-role-list', 'Role', 'Role — Daftar', 'list'),
                screenOf('scr-role-create', 'Role', 'Role — Form', 'create'),
                screenOf('scr-role-edit', 'Role', 'Role — Form', 'edit'),
                screenOf('scr-role-view', 'Role', 'Role — Detail', 'view'),
            ],
        },
        {
            id: 'mod-dashboard', name: 'dashboard', label: 'Dashboard', parentId: null, permissionKey: 'dashboard', pageId: pageOf('Dashboard'),
            screens: [screenOf('scr-dashboard', 'Dashboard', 'Dashboard', 'custom')],
        },
    ],
};
const { projects } = await api('GET', `/api/builder-projects?fileId=${enc(fileId)}`);
const old = projects.find(p => p.name === FILE_NAME);
let project;
if (old) {
    const cur = (await api('GET', `/api/builder-projects/${old.id}`)).project;
    project = (await api('PUT', `/api/builder-projects/${old.id}`, { version: cur.version, libraryId: lib.id, libraryVersion: snap.semver, config })).project;
}
else {
    const created = (await api('POST', '/api/builder-projects', { name: FILE_NAME, fileId, libraryId: lib.id, libraryVersion: snap.semver })).project;
    project = (await api('PUT', `/api/builder-projects/${created.id}`, { version: created.version, config })).project;
}
const count = project.config.modules.reduce((t, m) => t + m.screens.length, 0);
console.log(`Project Code Builder "${project.name}": ${project.config.modules.length} module, ${count} screen · ${project.library.packageName}@${project.library.version}`);
