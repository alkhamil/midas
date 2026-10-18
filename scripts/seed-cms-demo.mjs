#!/usr/bin/env node
// Bangun file desain "CMS Demo" (layar User, Role, Dashboard) yang memakai library @midas/ui-cms, lalu daftarkan
// project Code Builder-nya (3 module: user, role = CRUD; dashboard = custom). Dipakai untuk menguji fitur Code Builder.
//
// File ini dibuat seperti Studio membuatnya saat sebuah file memakai library: variabel library disalin (bertanda libId),
// komponen disalin ke page "Library · <nama>" (setiap layer punya libRef), dan layar disusun dari instance salinan itu.
// Tiap layar dibungkus layout aplikasi (Sidebar + Topbar) supaya terlihat utuh di canvas; yang didaftarkan ke Code Builder
// adalah frame konten di dalamnya — sidebar/topbar di aplikasi datang dari layout project + AppShell library.
//
// Pakai:
//   node scripts/seed-cms-demo.mjs [--server URL] [--package @midas/ui-cms] [--file "CMS Demo"] [--no-project]
// Prasyarat: library sudah dipublish (`node scripts/seed-design-system.mjs`) dan sudah login (`midas login`).
import { svgToDataUrl } from '../apps/studio/src/iconSet.js';
import { build, col, icon, Ids, instance, row, text } from './design-system/build.mjs';
import { UI_ICONS } from './design-system/icons.mjs';
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
console.log(`Library ${snap.packageName}@${snap.semver} (seq ${snap.version}): ${snap.components.length} components`);

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
        if (!v) throw new Error(`Variable ${name} is not in the library`);
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
const extraAssets = {};
const ctx = {
    ids, vars, components,
    /** Ikon berwarna token untuk sidebar di canvas (aset SVG ikut disimpan di dokumen). */
    icon(name, style, colorRef) {
        const svg = UI_ICONS[name];
        if (!svg) throw new Error(`Icon ${name} does not exist`);
        const c = colorRef.startsWith('#') ? colorRef : vars.byName.get(colorRef).first;
        const id = `dsicon-${name}-${style}-${c.slice(1).toLowerCase()}`;
        extraAssets[id] ||= svgToDataUrl(svg.replace(/#1C274C/gi, c));
        return id;
    },
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
        if (!id) throw new Error(`Variant ${name} ${JSON.stringify(v)} is not in the library`);
        return id;
    },
    root(name) {
        const id = rootIndex.get(name);
        if (!id) throw new Error(`Komponen ${name} is not in the library`);
        return id;
    },
};

// ---------------------------------------------------------------- layar
const V = (name, variant, props, extra) => instance(ctx.variant(name, variant), props, extra);
const R = (name, props = {}, extra) => instance(ctx.root(name), props, extra);
const btn = (variant, label, extra) => V('Button', { Variant: variant, Size: 'Md' }, { Label: label }, { name: label, ...extra });
// Frame konten (yang didaftarkan ke Code Builder) lalu dibungkus layout aplikasi.
const content = (name, children) => col({ w: 'fill', h: 836, pad: 24, gap: 24, fill: 'color/surface', name }, children);
// Topbar = komponen library (breadcrumb, judul halaman, pengguna + avatar); tidak ada page header di dalam konten.
const topbarFor = name => {
    const [module, kind] = name.split(' — ');
    const [title, crumb] = kind === 'Form' ? [`Add ${module}`, `Home / ${module} / Add`] : kind === 'Detail' ? [`Detail ${module}`, `Home / ${module} / Detail`]
        : module === 'Dashboard' ? ['Dashboard', 'Dashboard'] : [module, `Home / ${module}`];
    return V('Topbar', { Menu: 'Closed' }, { Title: title, Breadcrumb: crumb, UserName: 'Administrator', UserRole: 'admin' }, { w: 'fill', name: 'Topbar' });
};
// Sidebar untuk canvas: dirakit dari frame biasa (bagian internal library `_SidebarItem` tidak ikut dipublish).
const NAV = [['Dashboard', 'widget'], ['User', 'user'], ['Role', 'shield-check']];
const sidebarFrame = active => col({ w: 256, h: 'fill', pad: [0, 12, 12, 12], gap: 4, fill: 'color/sidebar', name: 'Sidebar' }, [
    row({ w: 'fill', h: 72, pad: [0, 4], justify: 'between', name: 'Brand' }, [
        row({ gap: 10 }, [
            row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', fill: 'color/primary', name: 'Logo' }, [text('C', { size: 16, line: 24, weight: 700, color: 'color/primary-foreground' })]),
            text('CMS Demo', { size: 16, line: 24, weight: 600, color: '#FFFFFF', name: 'App name' }),
        ]),
        row({ w: 28, h: 28, justify: 'center', radius: 'radius/md', stroke: 'color/sidebar-foreground', name: 'Toggle' }, [icon(ctx.icon('double-alt-arrow-left', 'outline', 'color/sidebar-foreground'), { size: 14, name: 'Icon' })]),
    ]),
    ...NAV.map(([label, ic]) => {
        const on = label === active, c = on ? 'color/primary-foreground' : 'color/sidebar-foreground';
        return row({ w: 'fill', h: 40, pad: [0, 12], gap: 12, radius: 'radius/lg', fill: on ? 'color/primary' : 'none', name: `Menu · ${label}` }, [
            icon(ctx.icon(ic, 'outline', c), { size: 20, name: 'Icon' }),
            text(label, { size: 14, line: 20, weight: 500, color: c, name: 'Label' }),
        ]);
    }),
]);
const screen = (name, children) => {
    const module = name.split(' — ')[0];
    return row({ w: 1440, align: 'start', fill: 'color/surface', name: `Page · ${name}`, inner: name }, [
        sidebarFrame(module),
        col({ w: 'fill', name: 'Area utama' }, [topbarFor(name), content(name, children)]),
    ]);
};
// Kepala bagian = komponen library SectionHeader (judul + keterangan + aksi dalam satu frame).
const header = (title, description, [variant, label]) => V('SectionHeader', { Action: variant }, { Title: title, Description: description, ActionLabel: label }, { w: 'fill', name: 'Header' });
const panel = (children, name) => col({ w: 'fill', gap: 16, pad: 20, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', name }, children);
const twoCols = (a, b) => row({ w: 'fill', gap: 24, align: 'start' }, [a, b]);
const actions = (...buttons) => row({ w: 'fill', gap: 8, justify: 'end', pad: [16, 0, 0, 0], stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Form actions' }, buttons);
const detailRow = (label, value) => row({ w: 'fill', gap: 16, align: 'start', name: label }, [text(label, { w: 160, color: MUTED }), typeof value === 'string' ? text(value, { w: 'fill', weight: 500 }) : value]);
const field = (name, label, placeholder) => R(name, { Label: label, Placeholder: placeholder }, { w: 'fill' });
const list = (title, description, addLabel) => screen(`${title} — List`, [
    header(title, description, ['Primary', addLabel]),
    panel([R('FilterToolbar', {}, { w: 'fill' }), R('Table', {}, { w: 'fill' })], 'List'),
]);

// Confirmation dialogs: library Dialog instances. Registered in the Code Builder as `dialog` screens — the generator
// reads the title, message and button labels from these frames, so the texts you design are the texts the app shows.
const confirmFrame = (name, tone, title, message, cancel, confirm) => col({ w: 560, pad: 48, align: 'center', fill: 'color/muted', radius: 'radius/lg', name }, [
    V('Dialog', { Size: 'Sm', Tone: tone }, { Title: title, Message: message, CancelLabel: cancel, ConfirmLabel: confirm }, { name: 'Dialog' }),
]);
// Filter drawer (library Drawer): the generated list page opens it from the Filter button; its fields come from the entity
// fields marked "filterable".
const filterFrame = col({ w: 560, pad: 48, align: 'center', fill: 'color/muted', radius: 'radius/lg', name: 'Drawer · Filters' }, [
    instance(ctx.root('Drawer'), { Title: 'Filters', SecondaryLabel: 'Reset', PrimaryLabel: 'Apply' }, { name: 'Drawer' }),
]);

const userScreens = [
    list('User', 'Manage the accounts that can sign in to the app', 'Add user'),
    screen('User — Form', [
        header('Add User', 'Fill in the new account details', ['Secondary', 'Back']),
        panel([
            twoCols(field('TextField', 'Full name', 'e.g. John Smith'), field('TextField', 'Email', 'name@company.com')),
            twoCols(field('SelectField', 'Role', 'Select a role'), field('PasswordField', 'Password', 'At least 8 characters')),
            R('SwitchField', { Label: 'Active account' }),
            actions(btn('Secondary', 'Cancel'), btn('Primary', 'Save')),
        ], 'Form'),
    ]),
    screen('User — Detail', [
        header('Detail User', 'Account information', ['Secondary', 'Edit']),
        panel([
            detailRow('Name', 'John Smith'), detailRow('Email', 'john@example.com'), detailRow('Role', 'Administrator'),
            detailRow('Status', V('Badge', { Variant: 'Success' }, { Label: 'Active' })), detailRow('Created', '10/12/2026 09:30'),
        ], 'Detail'),
    ]),
    confirmFrame('Confirm · Delete user', 'Danger', 'Delete user?', 'The user is moved to deleted users and can no longer sign in. You can restore them later.', 'Cancel', 'Delete'),
    confirmFrame('Confirm · Restore user', 'Primary', 'Restore user?', 'The user can sign in to the app again.', 'Cancel', 'Restore'),
    confirmFrame('Confirm · Discard changes (user)', 'Danger', 'Discard changes?', 'You have unsaved changes. They will be lost if you leave this page.', 'Stay', 'Discard'),
    filterFrame,
];
const roleScreens = [
    list('Role', 'Manage roles and user permissions', 'Add role'),
    screen('Role — Form', [
        header('Add Role', 'Fill in the new role details', ['Secondary', 'Back']),
        panel([
            field('TextField', 'Role name', 'e.g. Editor'),
            field('TextAreaField', 'Description', 'Describe this role\'s permissions'),
            R('SwitchField', { Label: 'Active role' }),
            actions(btn('Secondary', 'Cancel'), btn('Primary', 'Save')),
        ], 'Form'),
    ]),
    screen('Role — Detail', [
        header('Detail Role', 'Role information', ['Secondary', 'Edit']),
        panel([
            detailRow('Role name', 'Editor'), detailRow('Description', 'Manages content, without access to settings'),
            detailRow('Status', V('Badge', { Variant: 'Success' }, { Label: 'Active' })), detailRow('Users', '12'),
        ], 'Detail'),
    ]),
    confirmFrame('Confirm · Delete role', 'Danger', 'Delete role?', 'Users with this role lose its permissions. This cannot be undone.', 'Cancel', 'Delete'),
    confirmFrame('Confirm · Discard changes (role)', 'Danger', 'Discard changes?', 'You have unsaved changes. They will be lost if you leave this page.', 'Stay', 'Discard'),
];
// Reference frame: the user menu opened from the avatar (Topbar variant Menu = Open).
const userMenuFrame = col({ w: 1440, pad: [0, 0, 48, 0], fill: 'color/surface', name: 'Topbar · User menu' }, [
    V('Topbar', { Menu: 'Open' }, { Title: 'Dashboard', Breadcrumb: 'Dashboard', UserName: 'Administrator', UserRole: 'admin' }, { w: 'fill', name: 'Topbar' }),
]);
const dashboard = screen('Dashboard', [
    header('Dashboard', 'Overview of app activity', ['Secondary', 'Download report']),
    row({ w: 'fill', gap: 16, align: 'start', name: 'Statistik' }, [
        V('StatCard', { Trend: 'Up' }, { Label: 'Total users', Value: '1,248', Caption: '12% vs last month' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Up' }, { Label: 'Active users', Value: '1,032', Caption: '83% of total' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Neutral' }, { Label: 'Role', Value: '4', Caption: 'No change' }, { w: 'fill' }),
        V('StatCard', { Trend: 'Down' }, { Label: 'Pending verification', Value: '47', Caption: '5 more than yesterday' }, { w: 'fill' }),
    ]),
    V('Alert', { Variant: 'Warning' }, { Message: '47 users are waiting for email verification.' }, { w: 'fill' }),
    panel([text('Recent users', { size: 18, line: 28, weight: 600 }), R('Table', {}, { w: 'fill' })], 'Recent users'),
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
        frames.push({ page: name, name: spec.inner ?? spec.name, id: built.find(n => n.name === (spec.inner ?? spec.name)).id });
        x += built[0].w + 120;
    });
    pages.push({ id: ids.get(`page:${name}`), name, nodes, parentId: null });
};
addPage('User', userScreens);
addPage('Role', roleScreens);
addPage('Dashboard', [dashboard, userMenuFrame]);
pages.push({ id: ids.get('page:library'), name: `Library · ${snap.name}`, nodes: libNodes, parentId: null });
const pageOf = name => pages.find(p => p.name === name).id;
const frameOf = (page, name) => frames.find(f => f.page === page && f.name === name).id;
const doc = { format: 'midas', version: 1, name: FILE_NAME, pageId: pages[0].id, pages, tokens: {}, variables: vars.toJSON(), assets: { ...structuredClone(snap.assets ?? {}), ...extraAssets } };
console.log(`CMS Demo: ${pages.map(p => `${p.name} (${p.nodes.length})`).join(', ')}`);

const saved = await saveDocument(api, { name: FILE_NAME, doc, existing: existingFile, idPrefix: 'cms-demo' });
const fileId = saved.fileId;
console.log(saved.created ? `File created: ${fileId}` : `File updated: ${fileId} (${saved.newAssets} new assets)`);
await api('PUT', `/api/files/${enc(fileId)}/libraries`, { libraries: [{ id: lib.id, version: snap.version }] });

// ---------------------------------------------------------------- project Code Builder
if (args['no-project']) process.exit(0);
const str = (name, label, extra = {}) => ({ name, label, type: 'string', required: false, sortable: false, filterable: false, ...extra });
const screenOf = (id, page, name, role, purpose) => ({ id, frameId: frameOf(page, name), pageId: pageOf(page), name, role, ...(purpose ? { purpose } : {}) });
const config = {
    modules: [
        {
            id: 'mod-user', name: 'user', label: 'User', parentId: null, permissionKey: 'user', pageId: pageOf('User'),
            entity: { fields: [
                str('name', 'Full name', { required: true, sortable: true, filterable: true, rules: ['min:3', 'max:100', 'withoutemoticon'] }),
                str('email', 'Email', { required: true, sortable: true, filterable: true, rules: ['email'] }),
                { name: 'role', label: 'Role', type: 'relation', relation: { moduleId: 'mod-role', labelField: 'name' }, required: true, sortable: false, filterable: true },
                { name: 'password', label: 'Password', type: 'password', required: true, rules: ['min:8'], sortable: false, filterable: false },
                { name: 'active', label: 'Active account', type: 'boolean', required: false, sortable: false, filterable: true },
            ], softDelete: true },
            screens: [
                screenOf('scr-user-list', 'User', 'User — List', 'list'),
                screenOf('scr-user-create', 'User', 'User — Form', 'create'),
                screenOf('scr-user-edit', 'User', 'User — Form', 'edit'),
                screenOf('scr-user-view', 'User', 'User — Detail', 'view'),
                screenOf('scr-user-dlg-delete', 'User', 'Confirm · Delete user', 'dialog', 'delete'),
                screenOf('scr-user-dlg-restore', 'User', 'Confirm · Restore user', 'dialog', 'restore'),
                screenOf('scr-user-dlg-discard', 'User', 'Confirm · Discard changes (user)', 'dialog', 'discard'),
            ],
        },
        {
            id: 'mod-role', name: 'role', label: 'Role', parentId: null, permissionKey: 'role', pageId: pageOf('Role'),
            entity: { fields: [
                str('name', 'Role name', { required: true, sortable: true, filterable: true }),
                { name: 'description', label: 'Description', type: 'text', required: false, sortable: false, filterable: false },
                { name: 'active', label: 'Active role', type: 'boolean', required: false, sortable: false, filterable: true },
            ] },
            screens: [
                screenOf('scr-role-list', 'Role', 'Role — List', 'list'),
                screenOf('scr-role-create', 'Role', 'Role — Form', 'create'),
                screenOf('scr-role-edit', 'Role', 'Role — Form', 'edit'),
                screenOf('scr-role-view', 'Role', 'Role — Detail', 'view'),
                screenOf('scr-role-dlg-delete', 'Role', 'Confirm · Delete role', 'dialog', 'delete'),
                screenOf('scr-role-dlg-discard', 'Role', 'Confirm · Discard changes (role)', 'dialog', 'discard'),
            ],
        },
        {
            id: 'mod-dashboard', name: 'dashboard', label: 'Dashboard', parentId: null, permissionKey: 'dashboard', pageId: pageOf('Dashboard'),
            screens: [screenOf('scr-dashboard', 'Dashboard', 'Dashboard', 'custom')],
        },
    ],
    // Layout aplikasi: urutan & ikon menu sidebar, identitas topbar (diatur di Studio dengan klik sidebar/topbar).
    layout: {
        appName: 'CMS Demo', userName: 'Administrator', userRole: 'admin',
        items: [
            { moduleId: 'mod-dashboard', icon: 'widget' },
            { moduleId: 'mod-user', icon: 'user' },
            { moduleId: 'mod-role', icon: 'shield-check' },
        ],
    },
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
console.log(`Project Code Builder "${project.name}": ${project.config.modules.length} modules, ${count} screens · ${project.library.packageName}@${project.library.version}`);
