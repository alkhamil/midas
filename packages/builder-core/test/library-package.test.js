import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformSync } from 'esbuild';
import { buildPropsMap, iconSvg, isIconComponent, libraryPackage, tokensCss } from '../src/index.js';

// A small library: Button (a set: Variant × Size, a text and a boolean property, an icon slot), Card (uses a Button) and a Plus icon.
const variables = {
    collections: [
        { id: 'c-prim', name: 'Primitives', modes: [{ id: 'm-base', name: 'Base' }] },
        { id: 'c-sem', name: 'Semantic', modes: [{ id: 'm-light', name: 'Light' }, { id: 'm-dark', name: 'Dark' }] },
        { id: 'c-fnd', name: 'Foundations', modes: [{ id: 'm-f', name: 'Base' }] },
    ],
    items: [
        { id: 'v-blue', name: 'color/blue/600', type: 'color', collectionId: 'c-prim', values: { 'm-base': '#2563EB' } },
        { id: 'v-blue-d', name: 'color/blue/500', type: 'color', collectionId: 'c-prim', values: { 'm-base': '#3B82F6' } },
        { id: 'v-primary', name: 'color/primary', type: 'color', collectionId: 'c-sem', values: { 'm-light': { alias: 'v-blue' }, 'm-dark': { alias: 'v-blue-d' } } },
        { id: 'v-radius', name: 'radius/md', type: 'number', collectionId: 'c-fnd', values: { 'm-f': 8 } },
        { id: 'v-font', name: 'font/family', type: 'string', collectionId: 'c-fnd', values: { 'm-f': 'Inter' } },
    ],
};
const button = [
    { id: 'btn', name: 'Button', type: 'frame', componentSet: true, parentId: null, cprops: [
        { id: 'cp-l', name: 'Label', type: 'text', def: 'Button' },
        { id: 'cp-s', name: 'Show leading icon', type: 'boolean', def: false },
        { id: 'cp-i', name: 'Leading icon', type: 'instance', def: 'plus' },
    ] },
    { id: 'b1', parentId: 'btn', name: 'Variant=primary, Size=sm', type: 'frame', component: true, variant: { Variant: 'primary', Size: 'sm' }, layout: 'horizontal', gap: 8, padL: 12, padR: 12, padT: 0, padB: 0, w: 80, h: 32, layoutSizingH: 'hug', radii: [8, 8, 8, 8], fill: '#2563EB', vars: { 'fills.0': 'v-primary' } },
    { id: 'b1-i', parentId: 'b1', name: 'Plus', type: 'frame', isInstance: true, sourceId: 'plus', w: 20, h: 20, visible: false, propBind: { visible: 'cp-s', swap: 'cp-i' } },
    { id: 'b1-i-v', parentId: 'b1-i', name: 'Vector', type: 'path', sourceId: 'plus-v', x: 1, y: 1, w: 18, h: 18, fill: '#FFFFFF', vars: { 'fills.0': 'v-primary' } },
    { id: 'b1-t', parentId: 'b1', name: 'Label', type: 'text', text: 'Button', fontSize: 12, autoW: true, w: 40, h: 16, propBind: { text: 'cp-l' }, fill: '#FFFFFF' },
    { id: 'b2', parentId: 'btn', name: 'Variant=secondary, Size=lg', type: 'frame', component: true, variant: { Variant: 'secondary', Size: 'lg' }, layout: 'horizontal', gap: 8, w: 90, h: 48, layoutSizingH: 'hug', fill: '#F3F4F6' },
    { id: 'b2-t', parentId: 'b2', name: 'Label', type: 'text', text: 'Button', fontSize: 16, autoW: true, w: 40, h: 20, propBind: { text: 'cp-l' }, fill: '#111827' },
];
const plus = [
    { id: 'plus', name: 'Outline / Essential, UI / Plus', type: 'frame', component: true, parentId: null, w: 24, h: 24 },
    { id: 'plus-v', parentId: 'plus', name: 'Vector', type: 'path', x: 3, y: 3, w: 18, h: 18, pathW: 18, pathH: 18, closed: true, fill: '#1c274c', fillRule: 'evenodd',
        points: [{ x: 0, y: 8 }, { x: 18, y: 8 }, { x: 18, y: 10 }, { x: 0, y: 10 }] },
];
const card = [
    { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, layout: 'vertical', gap: 8, w: 200, h: 80, fill: '#FFFFFF' },
    { id: 'card-b', parentId: 'card', name: 'Button', type: 'frame', isInstance: true, sourceId: 'b2', w: 90, h: 48, layoutSizingH: 'fill' },
];
const snapshot = { components: [{ id: 'btn', name: 'Button', set: true, nodes: button }, { id: 'plus', name: 'Outline / Essential, UI / Plus', nodes: plus }, { id: 'card', name: 'Card', nodes: card }], variables };

test('buildPropsMap: variant properties become unions, component properties become props (text, boolean, slot)', () => {
    const { props } = buildPropsMap(button[0], button.filter(n => n.parentId === 'btn'));
    const by = Object.fromEntries(props.map(p => [p.name, p]));
    assert.deepEqual(Object.keys(by).sort(), ['label', 'leadingIcon', 'showLeadingIcon', 'size', 'variant']);
    assert.deepEqual(by.variant.values, { primary: 'primary', secondary: 'secondary' });
    assert.equal(by.variant.def, 'primary');                    // the first variant is the design's default
    assert.equal(by.size.type, 'enum');
    assert.equal(by.label.def, 'Button');
    assert.equal(by.showLeadingIcon.def, false);
    assert.equal(by.leadingIcon.type, 'node');                  // an instance-swap property is a slot
});

test('buildPropsMap: Yes / No variants are booleans, values are kebab-cased, names never clash with reserved props', () => {
    const set = { id: 's', name: 'Row', componentSet: true, cprops: [{ id: 'c', name: 'Style', type: 'text', def: '' }, { id: 'd', name: 'Children', type: 'text', def: '' }] };
    const kids = [
        { id: 'a', component: true, variant: { Selected: 'No', Layout: 'With shortcuts' } },
        { id: 'b', component: true, variant: { Selected: 'Yes', Layout: 'Plain' } },
    ];
    const by = Object.fromEntries(buildPropsMap(set, kids).props.map(p => [p.key, p]));
    assert.equal(by.Selected.type, 'boolean');
    assert.deepEqual(by.Selected.values, { Yes: 'true', No: 'false' });
    assert.deepEqual(by.Layout.values, { 'With shortcuts': 'with-shortcuts', Plain: 'plain' });
    assert.notEqual(by.c.name, 'style');                       // `style` and `children` are the component's own props
    assert.notEqual(by.d.name, 'children');
});

test('iconSvg turns bezier layers into SVG parts, scaled into the icon box', () => {
    const svg = iconSvg(plus, 'plus');
    assert.equal(svg.width, 24);
    assert.equal(svg.parts.length, 1);
    assert.equal(svg.parts[0].tag, 'path');
    assert.equal(svg.parts[0].attrs.fillRule, 'evenodd');
    assert.match(svg.parts[0].attrs.d, /^M3 11 L21 11 L21 13 L3 13 L3 11 Z$|^M3 11 L21 11 L21 13 L3 13 Z$/);   // the layer sits at (3, 3)
    const curved = iconSvg([{ id: 'r', w: 10, h: 10 }, { id: 'p', parentId: 'r', type: 'path', x: 0, y: 0, w: 10, h: 10, pathW: 10, pathH: 10, closed: true, fill: '#000', points: [{ x: 0, y: 0, out: { x: 5, y: 0 } }, { x: 10, y: 10, in: { x: 10, y: 5 } }] }], 'r');
    assert.match(curved.parts[0].attrs.d, /C5 0 10 5 10 10/);  // handles are absolute positions
    assert.equal(isIconComponent({ id: 'plus', nodes: plus }), true);
    assert.equal(isIconComponent({ id: 'btn', set: true, nodes: button }), false);
    assert.equal(isIconComponent({ id: 'card', nodes: card }), false);
});

test('tokensCss: the first mode is :root, other modes are themes, aliases are followed, numbers are px', () => {
    const css = tokensCss(variables);
    assert.match(css, /:root \{[\s\S]*--theme-primary: #2563EB;/);
    assert.match(css, /--theme-md: 8px;|--theme-radius-md: 8px;/);
    assert.match(css, /\[data-theme="dark"\] \{\s*--theme-primary: #3B82F6;/);
    assert.ok(!/\[data-theme="dark"\][^}]*--theme-blue/.test(css), 'single-mode collections are not repeated in a theme');
});

test('libraryPackage: files, exports, props, and valid TSX', () => {
    const out = libraryPackage(snapshot, { packageName: '@midas/ui-test', version: '2.1.0', libraryName: 'Test UI' });
    assert.deepEqual(out.warnings, []);
    assert.deepEqual(out.components.map(c => c.exportName).sort(), ['Button', 'Card']);
    assert.deepEqual(out.icons.map(i => i.exportName), ['PlusIcon']);
    const pkg = JSON.parse(out.files['package.json']);
    assert.equal(pkg.name, '@midas/ui-test');
    assert.equal(pkg.version, '2.1.0');
    assert.equal(pkg.exports['./tokens.css'], './dist/tokens.css');
    assert.deepEqual(pkg.peerDependencies, { react: '>=18', 'react-dom': '>=18' });
    for (const f of ['src/index.ts', 'src/tokens.css', 'src/components/Button.tsx', 'src/components/Card.tsx', 'src/components/index.ts', 'src/icons/PlusIcon.ts', 'src/icons/createIcon.ts', 'dist/index.d.ts', 'dist/components/Button.d.ts', 'dist/icons/PlusIcon.d.ts', 'dist/tokens.css', 'README.md'])
        assert.ok(f in out.files, `${f} is part of the package`);
    const src = out.files['src/components/Button.tsx'];
    assert.match(src, /import \{ PlusIcon \} from '\.\.\/icons\/PlusIcon';/);       // icons live in their own folder
    assert.match(src, /size\?: "sm" \| "lg";/);
    assert.match(src, /const buttonDefaults: Partial<DesignProps> = \{[^}]*variant: "primary"[^}]*showLeadingIcon: false/);
    assert.match(src, /showLeadingIcon && \(leadingIcon \?\? \(/);                   // slot: the passed node, else the design's icon; shown by the boolean
    assert.match(src, /<PlusIcon size=\{20\} className="mds:(text-primary|\[color:var\(--theme-primary,_#FFFFFF\)\])" \/>/);
    assert.ok(!/style=\{\{ "/.test(src), 'the look is Tailwind classes, not an inline style');
    assert.match(src, /mds:\[border-radius:8px/);                                   // per-corner radii
    assert.ok(out.classes.includes('mds:flex') && out.classes.every(c => c.startsWith('mds:')), 'every class has the prefix');
    assert.ok(out.themeCss.includes('--color-primary: var(--theme-primary)'), 'the Tailwind theme maps the colour tokens');
    assert.equal(pkg.exports['./styles.css'], './dist/styles.css');
    for (const f of ['dist/tailwind.theme.css', 'dist/tailwind.preset.cjs']) assert.ok(f in out.files, `${f} is part of the package`);
    assert.match(out.files['src/components/Card.tsx'], /<Button variant=\{"secondary"\} size=\{"lg"\}/);
    assert.match(out.files['dist/components/Button.d.ts'], /export \{\};/);          // helper types stay private
    for (const [file, code] of Object.entries(out.files))
        if (/\.(tsx?|ts)$/.test(file) && file.startsWith('src/'))
            assert.doesNotThrow(() => transformSync(code, { loader: file.endsWith('.tsx') ? 'tsx' : 'ts', jsx: 'automatic' }), `${file} is valid`);
});

test('libraryPackage: internal parts (_Name) are generated for the components that use them, but not exported', () => {
    const inner = [{ id: 'in', name: '_Option', type: 'frame', component: true, parentId: null, layout: 'horizontal', w: 40, h: 20, fill: '#FFF' }];
    const outer = [{ id: 'out', name: 'Select', type: 'frame', component: true, parentId: null, layout: 'vertical', w: 100, h: 40, fill: '#FFF' }, { id: 'out-o', parentId: 'out', name: 'Option', type: 'frame', isInstance: true, sourceId: 'in', w: 40, h: 20 }];
    const out = libraryPackage({ components: [{ id: 'in', name: '_Option', nodes: inner }, { id: 'out', name: 'Select', nodes: outer }], variables: { collections: [], items: [] } });
    assert.ok('src/components/Option.tsx' in out.files);
    assert.match(out.files['src/components/Select.tsx'], /import \{ Option \} from '\.\/Option';/);
    assert.ok(!/Option/.test(out.files['src/components/index.ts']), 'internal parts are not part of the public API');
});

test('libraryPackage: each problem names the component and the layer, and says what to fix', () => {
    const nodes = [
        { id: 'c', name: 'Panel', type: 'frame', component: true, parentId: null, layout: 'vertical', gap: 8, w: 200, h: 120, fill: '#FFFFFF' },     // a raw hex fill: no Variable
        { id: 'c-r', parentId: 'c', name: 'Decor', type: 'line', w: 10, h: 10, stroke: '#FF0000' },                                                    // a loose line: cannot be drawn
        { id: 'c-i', parentId: 'c', name: 'Ghost', type: 'frame', isInstance: true, sourceId: 'missing', w: 20, h: 20 },                                // its component is not published
        { id: 'c-f', parentId: 'c', name: 'Stack', type: 'frame', w: 50, h: 50 },
        { id: 'c-f1', parentId: 'c-f', name: 'A', type: 'text', text: 'a', fontSize: 12, w: 8, h: 12 },
        { id: 'c-f2', parentId: 'c-f', name: 'B', type: 'text', text: 'b', fontSize: 12, w: 8, h: 12 },                                              // two children, no auto layout
    ];
    const empty = [{ id: 'e', name: 'Empty set', type: 'frame', componentSet: true, parentId: null }];                                                 // a set without variants
    const events = [];
    const out = libraryPackage({ components: [{ id: 'c', name: 'Panel', nodes }, { id: 'e', name: 'Empty set', set: true, nodes: empty }], variables: { collections: [], items: [] } }, { onProgress: e => events.push(e.phase) });
    const by = re => out.issues.find(i => re.test(i.message));
    assert.deepEqual(by(/does not use a Variable/), { level: 'warning', kind: 'design', component: 'Panel', layer: 'Panel', nodeId: 'c', message: by(/does not use a Variable/).message, fix: by(/does not use a Variable/).fix });
    assert.match(by(/does not use a Variable/).fix, /Variable/);
    assert.equal(by(/free Line/).layer, 'Decor');
    assert.match(by(/free Line/).fix, /component/);
    assert.equal(by(/Main component not found/).level, 'error');
    assert.equal(by(/Main component not found/).layer, 'Ghost');
    assert.match(by(/Main component not found/).fix, /Publish that component/);
    assert.equal(by(/without auto layout/).layer, 'Stack');
    assert.equal(by(/without auto layout/).kind, 'design');
    const failed = out.issues.find(i => i.component === 'Empty set');
    assert.equal(failed.level, 'error');
    assert.match(failed.fix, /variant/i);
    assert.ok('src/components/EmptySet.tsx' in out.files, 'a component that failed still gets a stub, so what imports it keeps compiling');
    assert.ok(out.warnings.some(w => /Panel: Decor/.test(w)) && !out.warnings.some(w => /Variable/.test(w)), 'warnings keep only what could not become code');
    assert.deepEqual([...new Set(events)], ['analyze', 'components', 'tokens']);
});

test('libraryPackage: shapes that are drawn inline are not problems; a design tip repeated in every variant is one issue with a count', () => {
    const variant = (id, name, kids) => [{ id, parentId: 'set', name, type: 'frame', component: true, variant: { Size: name }, layout: 'horizontal', w: 40, h: 40, fill: '#FFF', vars: {} }, ...kids];
    const stack = id => [{ id: `${id}-s`, parentId: id, name: `Stack ${id}`, type: 'frame', w: 20, h: 20 }, { id: `${id}-a`, parentId: `${id}-s`, name: 'A', type: 'text', text: 'a', fontSize: 12, w: 8, h: 12 }, { id: `${id}-b`, parentId: `${id}-s`, name: 'B', type: 'text', text: 'b', fontSize: 12, w: 8, h: 12 }];
    const shapes = id => [{ id: `${id}-r`, parentId: id, name: 'Dot', type: 'ellipse', x: 0, y: 0, w: 8, h: 8, fill: '#000' }, { id: `${id}-v`, parentId: id, name: 'Arrow', type: 'path', x: 0, y: 0, w: 8, h: 8, pathW: 8, pathH: 8, closed: true, fill: '#000', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 8 }] }];
    const nodes = [{ id: 'set', name: 'Spin', type: 'frame', componentSet: true, parentId: null }, ...variant('v1', 'sm', [...stack('v1'), ...shapes('v1')]), ...variant('v2', 'lg', [...stack('v2'), ...shapes('v2')])];
    const out = libraryPackage({ components: [{ id: 'set', name: 'Spin', set: true, nodes }], variables: { collections: [], items: [] } });
    assert.ok(!out.issues.some(i => /free (Ellipse|Vector)/.test(i.message)), 'ellipses and vectors are drawn, not reported');
    assert.match(out.files['src/components/Spin.tsx'], /<ellipse /);
    const tips = out.issues.filter(i => /without auto layout/.test(i.message));
    assert.equal(tips.length, 1);
    assert.equal(tips[0].count, 2);
});
