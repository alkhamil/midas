// Merakit dokumen Midas "Midas Base Design System": Cover, Foundations, Components, Icons, Templates.
import { createHash } from 'node:crypto';
import { buildIconPage, svgToDataUrl } from '../../apps/studio/src/iconSet.js';
import { build, col, frame, icon, Ids, instance, row, text, Vars } from './build.mjs';
import { COMPONENTS, card, sidebar } from './components.mjs';
import { ICON_STYLES, UI_ICONS, uiIconFiles, wdsIconFiles } from './icons.mjs';
import { COLOR_NOTES, COLORS, ELEVATION, FONT_FAMILY, RADIUS, SPACING, TYPE_SCALE } from './tokens.mjs';

const MUTED_FG = 'color/muted-foreground';
const combos = variants => Object.entries(variants).reduce((acc, [k, vals]) => acc.flatMap(o => vals.map(v => ({ ...o, [k]: v }))), [{}]);
const variantName = v => Object.entries(v).map(([k, x]) => `${k}=${x}`).join(', ');

/** Id dari file yang sudah ada: kunci dsKey (generator) + nama komponen/variant/property/Variable (seed lama). */
export function existingIds(doc) {
    const map = new Map();
    const nodes = (doc?.pages || []).flatMap(p => p.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const n of nodes) {
        if (n.dsKey) map.set(`node:${n.dsKey}`, n.id);
        const parent = byId.get(n.parentId);
        if (n.componentSet || (n.component && !parent?.componentSet)) {
            map.set(`component:${n.name}`, n.id);
            for (const cp of n.cprops || []) map.set(`cprop:${n.name}/${cp.name}`, cp.id);
        }
        if (n.component && parent?.componentSet) map.set(`variant:${parent.name}/${n.name}`, n.id);
    }
    const vars = doc?.variables || { collections: [], items: [] };
    for (const c of vars.collections || []) {
        map.set(`coll:${c.name}`, c.id);
        for (const m of c.modes || []) map.set(`mode:${c.name}/${m.name}`, m.id);
    }
    for (const i of vars.items || []) map.set(`var:${i.name}`, i.id);
    return map;
}

/**
 * Id stabil untuk page Icons: komponen dari nama ("Icon/arrows/arrow-left" → icon-arrows-arrow-left),
 * variant & layer turunan darinya, aset dari hash isi SVG. Generator bisa dijalankan ulang tanpa memutus
 * instance ikon di file lain dan tanpa mengunggah ulang aset yang sama.
 */
function stabilizeIconIds(iconPage, assets) {
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const remap = new Map(), assetMap = new Map();
    const byParent = new Map();
    for (const n of iconPage.page.nodes) if (n.parentId) (byParent.get(n.parentId) || byParent.set(n.parentId, []).get(n.parentId)).push(n);
    for (const set of iconPage.page.nodes.filter(n => !n.parentId)) {
        const setId = `icon-${slug(set.name.replace(/^Icon\//, ''))}`;
        remap.set(set.id, setId);
        for (const v of byParent.get(set.id) || []) {
            const vId = `${setId}--${slug(v.name.replace(/^Style=/, ''))}`;
            remap.set(v.id, vId);
            for (const img of byParent.get(v.id) || []) remap.set(img.id, `${vId}--img`);
        }
    }
    for (const [id, url] of Object.entries(iconPage.assets)) assetMap.set(id, `svg-${createHash('sha1').update(url).digest('hex').slice(0, 20)}`);
    for (const n of iconPage.page.nodes) {
        n.id = remap.get(n.id) ?? n.id;
        if (n.parentId) n.parentId = remap.get(n.parentId) ?? n.parentId;
        if (n.assetId) n.assetId = assetMap.get(n.assetId) ?? n.assetId;
    }
    for (const [id, url] of Object.entries(iconPage.assets)) assets[assetMap.get(id)] = url;
}

export function buildDocument({ existing = new Map(), wdsDir }) {
    const ids = new Ids(existing);
    const vars = new Vars(ids);
    const assets = {};
    const wds = wdsIconFiles(wdsDir);
    const wdsByName = new Map(wds.map(f => [`${f.path.split('/')[1]}:${f.path.split('/').pop().replace('.svg', '')}`, f.svg]));

    // ---- Variables
    const color = vars.collection('Color', ['Light', 'Dark']);
    for (const [name, values] of Object.entries(COLORS)) vars.add(color, `color/${name}`, 'color', values, COLOR_NOTES[name]);
    const radius = vars.collection('Radius', ['Base']);
    for (const [name, v] of Object.entries(RADIUS)) vars.add(radius, `radius/${name}`, 'number', [v]);
    const spacing = vars.collection('Spacing', ['Base']);
    for (const [name, v] of Object.entries(SPACING)) vars.add(spacing, name, 'number', [v]);
    const typo = vars.collection('Typography', ['Base']);
    vars.add(typo, 'font/family', 'string', [FONT_FAMILY], 'Font utama UI');

    // ---- konteks generator
    const allNodes = [];
    const components = new Map(), variantIndex = new Map(), rootIndex = new Map();
    const hex = ref => (ref.startsWith('#') ? ref : vars.ref(ref).first);
    const ctx = {
        ids, vars, components,
        subtree(id) {
            const out = [], queue = [id];
            for (let i = 0; i < queue.length; i++) {
                const n = allNodes.find(x => x.id === queue[i]);
                if (n) out.push(n);
                for (const x of allNodes) if (x.parentId === queue[i]) queue.push(x.id);
            }
            return out;
        },
        propHolder: src => (src.variant ? allNodes.find(n => n.id === src.parentId) : src),
        componentName: src => (src.variant ? allNodes.find(n => n.id === src.parentId)?.name : src.name),
        variant: (name, v) => {
            const id = variantIndex.get(`${name}|${variantName(v)}`);
            if (!id) throw new Error(`Variant ${name} ${variantName(v)} belum ada`);
            return id;
        },
        root: name => rootIndex.get(name),
        /** Ikon berwarna untuk dipakai di dalam desain (gambar SVG dengan warna token). */
        icon(name, style, colorRef) {
            const svg = UI_ICONS[name]?.[style] ?? wdsByName.get(`${style}:${name}`) ?? UI_ICONS[name]?.outline;
            if (!svg) throw new Error(`Ikon ${name} (${style}) tidak ada`);
            const c = hex(colorRef);
            const id = `dsicon-${name}-${style}-${c.slice(1).toLowerCase()}`;
            assets[id] ||= svgToDataUrl(svg.replace(/#1C274C/gi, c));
            return id;
        },
        svgAsset(key, svg) {
            const id = `dsasset-${key}`;
            assets[id] ||= svgToDataUrl(svg);
            return id;
        },
    };
    const add = nodes => {
        allNodes.push(...nodes);
        return nodes;
    };

    const pages = [];
    const page = (name, nodes) => {
        pages.push({ id: ids.get(`page:${name}`), name, nodes });
        return pages.at(-1);
    };

    // ---- Components (dibangun dulu: page lain memakai instance-nya)
    const compNodes = [];
    let y = 0;
    for (const spec of COMPONENTS) {
        const header = add(build(col({ gap: 6, w: 720, name: `Header — ${spec.name}` }, [
            text(spec.name, { size: 24, line: 32, weight: 600 }),
            text(spec.description, { w: 720, color: MUTED_FG }),
        ]), ctx, { x: 0, y, key: `doc:${spec.name}/header` }));
        compNodes.push(...header);
        y += header[0].h + 40;
        // `def` = nilai default component property di engine Midas.
        const cprops = spec.cprops.map(c => ({ id: ids.get(`cprop:${spec.name}/${c.name}`), name: c.name, type: c.type, def: c.default ?? null }));
        const cp = Object.fromEntries(cprops.map(c => [c.name, c.id]));
        let blockW, blockH;
        if (Object.keys(spec.variants).length) {
            const setId = ids.get(`component:${spec.name}`), gap = 24;
            const built = combos(spec.variants).map(v => {
                const name = variantName(v), key = `variant:${spec.name}/${name}`;
                const nodes = build(spec.render(v, ctx, cp), ctx, { parentId: setId, id: ids.get(key), key });
                Object.assign(nodes[0], { component: true, variant: v, name });
                variantIndex.set(`${spec.name}|${name}`, nodes[0].id);
                components.set(nodes[0].id, nodes[0]);
                return nodes;
            });
            // Kolom = nilai property pertama; baris = kombinasi property lainnya.
            const propNames = Object.keys(spec.variants), firstProp = propNames[0], multi = propNames.length > 1;
            const roots = built.map(b => b[0]);
            const colW = Math.max(...roots.map(r => r.w)), rowH = Math.max(...roots.map(r => r.h));
            const restKey = r => propNames.slice(1).map(p => r.variant[p]).join('|');
            const restKeys = [...new Set(roots.map(restKey))];
            const perRow = multi ? spec.variants[firstProp].length : Math.min(roots.length, 6);
            roots.forEach((r, i) => {
                const c = multi ? spec.variants[firstProp].indexOf(r.variant[firstProp]) : i % perRow;
                const rr = multi ? restKeys.indexOf(restKey(r)) : Math.floor(i / perRow);
                r.x = gap + c * (colW + gap);
                r.y = gap + rr * (rowH + gap);
            });
            const cols = multi ? perRow : Math.min(roots.length, perRow), rows = multi ? restKeys.length : Math.ceil(roots.length / perRow);
            const set = {
                rotation: 0, opacity: 1, visible: true, locked: false, shadow: false, version: 0, fillType: 'solid', fillOpacity: 1, clip: false,
                id: setId, type: 'frame', name: spec.name, parentId: null, x: 0, y, w: gap + cols * (colW + gap), h: gap + rows * (rowH + gap),
                fill: 'none', stroke: '#9747FF', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4, strokeAlign: 'center', radius: 8, componentSet: true, cprops, dsKey: `component:${spec.name}`,
            };
            add([set, ...built.flat()]);
            compNodes.push(set, ...built.flat());
            blockW = set.w;
            blockH = set.h;
        }
        else {
            const nodes = add(build(spec.render({}, ctx, cp), ctx, { x: 0, y, id: ids.get(`component:${spec.name}`), key: `component:${spec.name}` }));
            Object.assign(nodes[0], { component: true, cprops, name: spec.name });
            components.set(nodes[0].id, nodes[0]);
            rootIndex.set(spec.name, nodes[0].id);
            compNodes.push(...nodes);
            blockW = nodes[0].w;
            blockH = nodes[0].h;
        }
        if (spec.states) {
            const states = add(build(col({ gap: 12, pad: 24, radius: 12, fill: 'color/surface', name: `States — ${spec.name}` }, [
                text('State', { size: 12, line: 16, weight: 600, color: MUTED_FG, letterSpacing: 0.5 }),
                row({ gap: 24, align: 'start' }, spec.states(ctx).map(s => col({ gap: 8 }, [s.spec, text(s.label, { size: 12, line: 16, color: MUTED_FG })]))),
            ]), ctx, { x: blockW + 64, y, key: `doc:${spec.name}/states` }));
            compNodes.push(...states);
            blockH = Math.max(blockH, states[0].h);
        }
        y += blockH + 96;
    }

    // ---- Cover
    const coverW = 1440;
    page('Cover', add(build(col({ w: coverW, h: 900, pad: 96, gap: 48, fill: 'color/surface', name: 'Cover' }, [
        col({ gap: 12 }, [
            row({ gap: 12 }, [
                row({ w: 48, h: 48, justify: 'center', radius: 12, fill: 'color/primary' }, [text('M', { size: 24, weight: 700, color: 'color/primary-foreground' })]),
                text('Midas Base', { size: 18, weight: 600, color: MUTED_FG }),
            ]),
            text('Design System', { size: 56, line: 64, weight: 700 }),
            text('Komponen, token, dan pola layar untuk aplikasi back-office yang dibangun dengan Midas Code Builder.', { w: 720, size: 18, line: 28, color: MUTED_FG }),
        ]),
        row({ w: 'fill', gap: 24, align: 'start' }, [
            ['Jelas lebih dulu', 'Hierarki tegas, satu aksi utama per area, teks yang langsung bisa dipahami.'],
            ['Tenang & konsisten', 'Warna netral dengan satu aksen biru; warna status hanya untuk makna.'],
            ['Satu sumber kebenaran', 'Warna, radius, dan ikon berasal dari Variables & komponen — sama dengan kode @midas/ui-base.'],
        ].map(([t, d]) => col({ w: 'fill', gap: 8, pad: 24, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border' }, [text(t, { size: 16, line: 24, weight: 600 }), text(d, { w: 352, color: MUTED_FG })]))),
        col({ gap: 8 }, [
            text('Isi file', { size: 14, weight: 600 }),
            ...['Foundations — warna, tipografi, spacing, radius, elevasi, ikonografi', `Components — ${COMPONENTS.length} komponen dengan variant & state`, 'Icons — set ikon outline & bold-duotone', 'Templates — contoh layar List, Form, Detail, Dashboard'].map(s => text(`•  ${s}`, { color: MUTED_FG })),
        ]),
    ]), ctx, { key: 'page:cover' })));

    // ---- Foundations
    const section = (title, desc, body) => col({ w: 'fill', gap: 16 }, [col({ gap: 4 }, [text(title, { size: 24, line: 32, weight: 600 }), text(desc, { w: 720, color: MUTED_FG })]), body]);
    const swatches = mode => col({ w: 'fill', gap: 16, pad: 24, radius: 12, fill: 'color/background', stroke: 'color/border', name: `Palette — ${mode}`, props: mode === 'Dark' ? { varModes: { [color.id]: color.modes[1].id } } : {} }, [
        text(mode === 'Dark' ? 'Dark' : 'Light', { size: 16, line: 24, weight: 600 }),
        ...[Object.keys(COLORS).slice(0, 8), Object.keys(COLORS).slice(8)].map(group => row({ w: 'fill', gap: 16, align: 'start' }, group.map(name => col({ w: 132, gap: 6 }, [
            frame({ w: 132, h: 64, radius: 'radius/lg', fill: `color/${name}`, stroke: 'color/border', name }),
            text(name, { size: 12, line: 16, weight: 600 }),
            text(COLORS[name][mode === 'Dark' ? 1 : 0], { size: 12, line: 16, color: MUTED_FG }),
            text(COLOR_NOTES[name], { w: 132, size: 11, line: 14, color: MUTED_FG }),
        ])))),
    ]);
    page('Foundations', add(build(col({ w: 1440, pad: 64, gap: 64, fill: 'color/surface', name: 'Foundations' }, [
        col({ gap: 8 }, [text('Foundations', { size: 40, line: 48, weight: 700 }), text('Token dasar design system. Semua nilai di sini adalah Variables — dipakai komponen dan menjadi token CSS --theme-* di kode.', { w: 760, size: 16, line: 24, color: MUTED_FG })]),
        section('Warna', 'Collection "Color" dengan mode Light & Dark. Komponen hanya memakai warna semantik ini — tidak ada nilai hex lepas.', col({ w: 'fill', gap: 24 }, [swatches('Light'), swatches('Dark')])),
        section('Tipografi', `${FONT_FAMILY} untuk seluruh UI. Skala mengikuti kelas Tailwind yang dipakai komponen.`, col({ w: 'fill', gap: 0, radius: 12, fill: 'color/background', stroke: 'color/border', clip: true },
            TYPE_SCALE.map(t => row({ w: 'fill', pad: [16, 24], gap: 24, stroke: 'color/border', strokeSides: [0, 0, 1, 0] }, [
                text(t.name, { w: 'fill', size: t.size, line: t.line, weight: t.weight }),
                text(`${t.size}/${t.line} · ${t.weight === 600 ? 'Semibold' : t.weight === 500 ? 'Medium' : 'Regular'}`, { w: 160, size: 12, line: 16, color: MUTED_FG }),
                text(t.use, { w: 280, size: 12, line: 16, color: MUTED_FG }),
            ])))),
        section('Spacing', 'Spacing semantik — dipakai lewat class .page-padding, .stack-gap, .field-gap, dan padding card.', col({ gap: 12 },
            Object.entries(SPACING).map(([name, v]) => row({ gap: 16 }, [text(name, { w: 160, size: 12, line: 16, weight: 600 }), frame({ w: v * 4, h: 16, radius: 4, fill: 'color/primary', fillOpacity: 0.25 }), text(`${v}px`, { size: 12, line: 16, color: MUTED_FG })])))),
        section('Radius', 'lg untuk kontrol (button, input, card), xl untuk dialog & button besar, sm/md untuk elemen kecil.', row({ gap: 32, align: 'end' },
            Object.entries(RADIUS).map(([name, v]) => col({ gap: 8, align: 'center' }, [frame({ w: 96, h: 96, radius: `radius/${name}`, fill: 'color/background', stroke: 'color/primary', strokeWidth: 2 }), text(`radius/${name} · ${v}px`, { size: 12, line: 16, color: MUTED_FG })])))),
        section('Elevasi', 'Bayangan hanya untuk elemen yang mengambang di atas halaman.', row({ gap: 32 },
            ELEVATION.map(e => col({ w: 240, h: 120, pad: 20, gap: 4, radius: 'radius/lg', fill: 'color/background', stroke: e.shadow ? undefined : 'color/border', shadow: e.shadow }, [text(e.name, { size: 14, weight: 600 }), text(e.use, { w: 200, size: 12, line: 16, color: MUTED_FG })])))),
        section('Ikonografi', 'Dua gaya: outline (default, untuk aksi & navigasi) dan bold-duotone (status aktif & penekanan). Ukuran 16 px di dalam kontrol, 20 px di navigasi. Warna mengikuti teks (currentColor).', row({ gap: 24 },
            ['widget', 'user', 'eye', 'pen', 'trash-bin', 'add', 'magnifer', 'filter', 'calendar', 'chart', 'info-circle', 'check-circle'].map(n => col({ gap: 8, align: 'center' }, [
                row({ gap: 8 }, ICON_STYLES.map(st => icon(ctx.icon(n, st, 'color/foreground'), { size: 24 }))),
                text(n, { size: 11, line: 14, color: MUTED_FG }),
            ])))),
    ]), ctx, { key: 'page:foundations' })));

    page('Components', compNodes);

    // ---- Icons (outline + bold-duotone)
    const iconPage = buildIconPage([...wds, ...uiIconFiles()], { uid: () => ids.fresh() });
    stabilizeIconIds(iconPage, assets);
    pages.push({ ...iconPage.page, id: ids.get('page:Icons'), name: 'Icons' });

    // ---- Templates (instance komponen)
    const btn = (variant, label) => instance(ctx.variant('Button', { Variant: variant, Size: 'Md' }), { Label: label });
    // Sidebar instance menandai "Dashboard" aktif; layar lain memakai susunan yang sama dengan item aktifnya sendiri.
    const screen = (name, title, content, active = 'Dashboard') => row({ w: 1440, h: 900, align: 'start', fill: 'color/surface', clip: true, name }, [
        active === 'Dashboard' ? instance(ctx.root('Sidebar')) : sidebar(ctx, active),
        col({ w: 'fill', h: 'fill' }, [
            instance(ctx.root('PageHeader'), { Title: title }),
            col({ w: 'fill', pad: 24, gap: 16, name: 'Content' }, content),
        ]),
    ]);
    const formRow = (label, comp, extra = {}) => col({ gap: 6 }, [text(label, { size: 14, weight: 500 }), instance(ctx.variant(comp, { Size: 'Md' }), { Placeholder: extra.placeholder || '' }, extra.w ? { w: extra.w } : {})]);
    const templates = [
        screen('List — Daftar user', 'Daftar User', [
            card(1136, ctx, { title: 'Daftar User', actions: [btn('Secondary', 'Export'), btn('Primary', 'Tambah user')] }, [
                instance(ctx.root('FilterToolbar')),
                instance(ctx.root('Table')),
            ]),
        ], 'User'),
        screen('Form — Tambah user', 'Tambah User', [
            // Form 2 kolom (2 × 280 + gap 24): lebar baca nyaman, tidak membentang ke seluruh layar.
            card(624, ctx, { title: 'Tambah User' }, [
                row({ gap: 24, align: 'start' }, [formRow('Nama lengkap', 'TextField', { placeholder: 'Mis. Budi Santoso' }), formRow('Email', 'TextField', { placeholder: 'nama@perusahaan.id' })]),
                row({ gap: 24, align: 'start' }, [formRow('Role', 'SelectField', { placeholder: 'Pilih role' }), formRow('Kata sandi', 'PasswordField')]),
                formRow('Catatan', 'TextAreaField', { placeholder: 'Opsional', w: 584 }),
                instance(ctx.variant('SwitchField', { Size: 'Md' }), { 'Switch Label': 'Aktifkan akun' }),
                row({ w: 'fill', gap: 8, justify: 'end', pad: [16, 0, 0, 0], stroke: 'color/border', strokeSides: [1, 0, 0, 0] }, [btn('Secondary', 'Batal'), btn('Primary', 'Simpan')]),
            ]),
        ], 'User'),
        screen('Detail — User', 'Detail User', [
            // Aksi halaman di kanan atas konten; informasi pendukung di samping kartu detail.
            row({ w: 'fill', justify: 'between' }, [
                text('Informasi akun dan aktivitas terakhir.', { size: 14, color: MUTED_FG }),
                row({ gap: 8 }, [btn('Secondary', 'Ubah'), btn('Danger', 'Hapus')]),
            ]),
            row({ gap: 16, align: 'start' }, [
                instance(ctx.root('DetailCard')),
                instance(ctx.variant('Alert', { Variant: 'Info' }), { Message: 'Terakhir login 2 jam yang lalu.' }),
            ]),
        ], 'User'),
        screen('Dashboard', 'Dashboard', [
            row({ w: 'fill', gap: 16 }, [['Total user', '1.248', '+12%', 'Success'], ['User aktif', '1.032', '83%', 'Info'], ['Menunggu verifikasi', '47', 'Perlu tindakan', 'Warning'], ['Diblokir', '9', '-2', 'Error']].map(([label, value, trend, variant]) =>
                col({ w: 'fill', gap: 8, pad: 20, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border' }, [
                    text(label, { size: 14, color: MUTED_FG }),
                    text(value, { size: 30, line: 36, weight: 600 }),
                    instance(ctx.variant('Badge', { Variant: variant }), { Label: trend }),
                ]))),
            instance(ctx.variant('Alert', { Variant: 'Warning' }), { Message: '47 user menunggu verifikasi email.' }),
            card(1136, ctx, { title: 'User terbaru' }, [instance(ctx.root('Table'))]),
        ]),
    ];
    let tx = 0;
    const templateNodes = templates.flatMap((t, i) => {
        const nodes = add(build(t, ctx, { x: tx, y: 0, key: `template:${i}` }));
        tx += nodes[0].w + 120;
        return nodes;
    });
    page('Templates', templateNodes);

    // Urutan page: Cover, Foundations, Components, Icons, Templates
    const order = ['Cover', 'Foundations', 'Components', 'Icons', 'Templates'];
    pages.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    const doc = { format: 'midas', version: 1, name: 'Midas Base Design System', pageId: pages[0].id, pages, tokens: {}, variables: vars.toJSON(), assets };
    return { doc, iconCount: iconPage.count, iconStyles: iconPage.styles };
}
