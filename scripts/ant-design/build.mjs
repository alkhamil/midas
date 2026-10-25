// Builds "Ant Design.midas": the Ant Design component library as a Midas design system, made the way the WDS file is made
// (Primitives → Semantic → Size → one collection per component axis; layers only bind to variables).
//
//   node scripts/ant-design/build.mjs [output.midas]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { b, finish, frame, layout, store, text, uid } from './lib.mjs';
import { buildFoundations } from './system.mjs';
import { buildSet, combos, instanceSpec, registry } from './define.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(here, 'Ant Design.midas');
const PROPS = JSON.parse(readFileSync(join(here, 'ant-props.json'), 'utf8'));

buildFoundations();
await import('./components.mjs');
await import('./components2.mjs');
await import('./components3.mjs');
await import('./components4.mjs');

// ---------- helpers ----------
const sem = n => b('Semantic', n);
const label = (s, o = {}) => text(s, { fs: 12, fill: sem('text/tertiary'), ...o });
const heading = (s, o = {}) => text(s, { fs: 14, fw: 600, fill: sem('text/primary'), ...o });
const CATEGORIES = ['General', 'Layout', 'Navigation', 'Data Entry', 'Data Display', 'Feedback', 'Other'];

/** Documentation frame of a component: looks × states matrix, sizes, variants, dark theme and the React props. */
function documentation(entry) {
    const { def, axis, states } = entry;
    const ms = axis.modes, ss = states && !def.noStateMatrix ? states.modes : [null];
    const first = combos(def)[0];
    const cell = (props, modes, w) => frame('cell', { dir: 'h', alignC: 'center', w, h: 'hug', pad: [6, 0, 6, 0] }, [instanceSpec(entry, props, modes)]);
    // column width = widest instance of the matrix
    const probe = ms.flatMap(m => ss.map(s => instanceSpec(entry, first, { [axis.coll]: m, ...(s ? { [states.coll]: s } : {}) })));
    const colW = Math.max(...probe.map(p => p.w)) + 24;
    const rowLabelW = 96;
    const matrix = frame('Looks × states', { dir: 'v', gap: 0 }, [
        ...(ss[0] ? [frame('header', { dir: 'h', alignC: 'center' }, [frame('corner', { w: rowLabelW, h: 20 }), ...ss.map(s => frame('h', { dir: 'h', w: colW, h: 20 }, [label(s)]))])] : []),
        ...ms.map(m => frame(m, { dir: 'h', alignC: 'center' }, [
            frame('row label', { dir: 'h', w: rowLabelW, h: 'hug', alignC: 'center' }, [label(m)]),
            ...ss.map(s => cell({ ...first, ...(def.variants?.Dashed && m === 'dashed' ? { Dashed: 'Yes' } : {}) }, { [axis.coll]: m, ...(s ? { [states.coll]: s } : {}) }, colW)),
        ])),
    ]);
    const sections = [heading('Looks' + (ss[0] ? ' × states' : '')), matrix];
    // variant properties other than the first value
    const extra = combos(def).slice(1);
    if (extra.length) {
        sections.push(heading('Variants'));
        for (const p of extra) {
            const dashed = def.variants?.Dashed && p.Dashed === 'Yes';
            sections.push(frame('variant', { dir: 'v', gap: 6 }, [label(Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ')), frame('row', { dir: 'h', gap: 16, alignC: 'center' }, (dashed ? ['dashed'] : ms).map(m => instanceSpec(entry, p, { [axis.coll]: m })))]));
        }
    }
    if (def.sizes) {
        sections.push(heading('Sizes'));
        sections.push(frame('Sizes', { dir: 'h', gap: 24, alignC: 'end' }, ['small', 'middle', 'large'].map(z => frame('size', { dir: 'v', gap: 6 }, [label(z), instanceSpec(entry, first, { Size: z })]))));
    }
    sections.push(heading('Dark theme'));
    sections.push(frame('Dark', { dir: 'h', gap: 16, pad: [16, 16, 16, 16], radius: 8, fill: sem('bg/container'), modes: { Semantic: 'Dark' }, varModes: { Semantic: 'Dark' } }, ms.slice(0, 5).map(m => instanceSpec(entry, first, { [axis.coll]: m, Semantic: 'Dark' }))));
    const props = PROPS.find(c => c.name === def.name)?.props || [];
    if (props.length) {
        sections.push(heading(`React props (${props.length})`));
        sections.push(text(props.map(p => `${p.name}: ${p.type}${p.default && p.default !== '-' ? ' = ' + p.default : ''}`.slice(0, 120)).join('\n'), { name: 'Props', fs: 11, lh: 1.55, w: 560, mono: true, fill: sem('text/secondary') }));
    }
    return frame(`${def.name} — Documentation`, { dir: 'v', gap: 16, pad: [32, 32, 32, 32], w: 'hug', fill: sem('bg/container'), radius: 12, stroke: sem('border/secondary'), sw: 1 }, [
        text(def.name, { name: 'Title', fs: 24, fw: 600, fill: sem('text/primary') }),
        text(def.description, { fs: 14, fill: sem('text/secondary') }),
        text(`import { ${def.name.split('.')[0]} } from 'antd';`, { fs: 12, mono: true, fill: sem('text/brand') }),
        ...sections,
    ]);
}

// ---------- pages ----------
const pages = [];
const page = (name, nodes) => { const p = { id: uid('page'), name, nodes, parentId: null }; pages.push(p); return p; };

// Cover
{
    const lines = [
        text('Ant Design — Midas design system', { fs: 32, fw: 600, fill: sem('text/primary') }),
        text('Built like the WDS file: Primitives → Semantic (Light / Dark) → Size → one collection per component axis.', { fs: 16, fill: sem('text/secondary') }),
        frame('rule', { w: 640, h: 1, fill: sem('border/secondary') }),
        heading('How it works'),
        text('A component is one set (a few variants) whose layers are bound to variables. Looks, states and sizes are variable modes:', { fs: 14, w: 640, fill: sem('text/primary') }),
        text('• “<Component> type / variant / styles” — the look (primary, dashed, outlined, …)\n• “<Component> states” — default, hover, pressed, disabled, focused … (Preview switches them by itself)\n• “Size” — small, middle, large\n• “Semantic” — Light and Dark', { fs: 14, w: 640, fill: sem('text/secondary') }),
        text('On an instance, pick the modes in the Design tab; in Preview, hover and press it.', { fs: 14, w: 640, fill: sem('text/secondary') }),
    ];
    page('Cover', layout(frame('Cover', { dir: 'v', gap: 14, pad: [48, 48, 48, 48], w: 760, fill: sem('bg/container'), radius: 12, stroke: sem('border/secondary'), sw: 1 }, lines), 0, 0));
}

// Components, one page per category
const docIds = new Map();
const byCategory = new Map(CATEGORIES.map(c => [c, []]));
registry.forEach(e => byCategory.get(e.def.category)?.push(e));
for (const category of CATEGORIES) {
    const list = byCategory.get(category);
    if (!list.length) continue;
    const nodes = [];
    let y = 0;
    for (const entry of list) {
        const set = buildSet(entry, 0, y);
        nodes.push(...set.nodes);
        const doc = layout(documentation(entry), set.w + 96, y, null);
        docIds.set(entry.def.name, doc[0].id);
        nodes.push(...doc);
        y += Math.max(set.h, doc[0].h) + 96;
    }
    page(category, nodes);
}

// ---------- Overview (like ant.design/components/overview) ----------
{
    const groups = new Map();
    for (const c of PROPS) {
        const base = c.name.split('.')[0];
        if (!groups.has(base)) groups.set(base, { name: base, category: c.category, props: [] });
        groups.get(base).props.push(...c.props);
    }
    const find = name => registry.find(e => e.def.name === name) || registry.find(e => e.def.name.startsWith(name + '.')) || registry.find(e => name.startsWith(e.def.name));
    const card = g => {
        const e = find(g.name), first = e && combos(e.def)[0];
        const thumb = frame('Thumb', { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 120, clip: true, fill: sem('bg/fill-tertiary'), radius: 6 }, e ? [instanceSpec(e, first, {})] : [text('—', { fs: 14, fill: sem('text/disabled') })]);
        const spec = frame(g.name, { dir: 'v', gap: 8, w: 240, pad: [12, 12, 12, 12], radius: 8, fill: sem('bg/container'), stroke: sem('border/secondary'), sw: 1 }, [thumb, text(g.name, { name: 'Name', fs: 14, fw: 600, fill: sem('text/primary') }), text(e ? e.def.description : `${g.props.length} props`, { fs: 12, fill: sem('text/tertiary'), w: 216 })]);
        const target = e && docIds.get(e.def.name);
        if (target) spec.extra = { prototypeTarget: target, interactions: [{ id: uid('i'), trigger: 'onClick', actions: [{ type: 'navigate', targetFrameId: target }] }] };
        return spec;
    };
    const sections = [];
    for (const category of CATEGORIES) {
        const list = [...groups.values()].filter(g => g.category === category);
        if (!list.length) continue;
        sections.push(text(`${category} (${list.length})`, { name: category, fs: 20, fw: 600, fill: sem('text/primary') }));
        for (let i = 0; i < list.length; i += 4) sections.push(frame('Row', { dir: 'h', gap: 16 }, list.slice(i, i + 4).map(card)));
    }
    const spec = frame('Components Overview', { dir: 'v', gap: 20, pad: [48, 48, 48, 48], w: 'hug', fill: sem('bg/layout') }, [
        text('Components Overview', { fs: 30, fw: 600, fill: sem('text/primary') }),
        text('antd provides plenty of UI components to enrich your web applications. Click a component to open its documentation; hover and press the instances in Preview.', { fs: 14, fill: sem('text/secondary'), w: 700 }),
        ...sections,
    ]);
    page('Overview', layout(spec, 0, 0));
    pages.splice(1, 0, pages.pop());
}

// ---------- Foundations: the palettes and the semantic colours, bound to their variables ----------
{
    const swatch = (coll, name, w = 56) => frame(name, { dir: 'v', gap: 4, w }, [frame('Swatch', { w, h: 32, radius: 4, fill: b(coll, name), stroke: sem('border/secondary'), sw: 1 }), text(name.split('/').pop(), { fs: 10, fill: sem('text/tertiary') })]);
    const palettes = ['blue', 'purple', 'cyan', 'green', 'magenta', 'red', 'volcano', 'orange', 'gold', 'yellow', 'lime', 'geekblue'];
    const prim = frame('Palettes', { dir: 'v', gap: 12 }, palettes.map(p => frame(p, { dir: 'h', gap: 6, alignC: 'center' }, [text(p, { fs: 12, w: 72, fill: sem('text/secondary') }), ...Array.from({ length: 10 }, (_, i) => swatch('Primitives', `${p}/${i + 1}`))])));
    const semNames = store.items.filter(i => store.collections.find(c => c.id === i.collectionId)?.name === 'Semantic' && i.type === 'color').map(i => i.name);
    const groupsOf = new Map();
    semNames.forEach(n => { const g = n.split('/')[0]; (groupsOf.get(g) || groupsOf.set(g, []).get(g)).push(n); });
    const semFrame = mode => frame(`Semantic · ${mode}`, { dir: 'v', gap: 16, pad: [24, 24, 24, 24], radius: 12, fill: sem('bg/container'), varModes: { Semantic: mode }, modes: { Semantic: mode } }, [
        text(`Semantic · ${mode}`, { fs: 16, fw: 600, fill: sem('text/primary') }),
        ...[...groupsOf.entries()].map(([g, names]) => frame(g, { dir: 'v', gap: 8 }, [text(g, { fs: 12, fw: 600, fill: sem('text/secondary') }), ...Array.from({ length: Math.ceil(names.length / 8) }, (_, r) => frame('row', { dir: 'h', gap: 8 }, names.slice(r * 8, r * 8 + 8).map(n => swatch('Semantic', n, 72))))])),
    ]);
    const spec = frame('Foundations', { dir: 'v', gap: 24, pad: [48, 48, 48, 48], fill: sem('bg/layout'), w: 'hug' }, [
        text('Foundations', { fs: 30, fw: 600, fill: sem('text/primary') }),
        text('Primitives hold the Ant Design palettes; Semantic maps them to roles for Light and Dark; components bind to Semantic through their own collections.', { fs: 14, w: 700, fill: sem('text/secondary') }),
        frame('Primitives', { dir: 'v', gap: 12, pad: [24, 24, 24, 24], radius: 12, fill: sem('bg/container') }, [text('Primitives · palettes', { fs: 16, fw: 600, fill: sem('text/primary') }), prim]),
        frame('Themes', { dir: 'h', gap: 24 }, [semFrame('Light'), semFrame('Dark')]),
    ]);
    page('Foundations', layout(spec, 0, 0));
    pages.splice(2, 0, pages.pop());
}

// ---------- write ----------
finish();
const doc = { format: 'midas', version: 1, name: 'Ant Design', pageId: pages[0].id, pages, tokens: { colors: [], typography: [] }, variables: store, guideStyles: [], created: Date.now(), assets: {} };
writeFileSync(OUT, JSON.stringify(doc));
const nodes = pages.reduce((a, p) => a + p.nodes.length, 0);
console.log(`${OUT}\n  ${registry.length} components · ${store.items.length} variables in ${store.collections.length} collections · ${nodes} nodes · ${pages.length} pages`);
