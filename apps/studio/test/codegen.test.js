import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent, tokenVar, pascalCase, kebabCase, usageSnippet } from '../src/engine/codegen.js';

const N = o => ({ x: 0, y: 0, w: 100, h: 40, visible: true, type: 'frame', opacity: 1, ...o });

// A tiny stand-in for the editor: `nodes` is the whole document.
function ctxFor(nodes) {
    const by = new Map(nodes.map(n => [n.id, n]));
    const ctx = {
        kids: id => nodes.filter(n => n.parentId === id),
        variants: set => nodes.filter(n => n.parentId === set.id && n.component),
        parentSet: n => (by.get(n.parentId)?.componentSet ? by.get(n.parentId) : null),
        chain: n => (n.component ? n : by.get(n.sourceId) || null),
        isAuto: n => !!n.layout && n.layout !== 'none',
        sizing: (n, a) => (a === 'h' ? n.layoutSizingH : n.layoutSizingV) || (n.type === 'text' ? 'hug' : 'fixed'),
        pads: n => ({ t: n.padT ?? 0, r: n.padR ?? 0, b: n.padB ?? 0, l: n.padL ?? 0 }),
        fills: n => (n.fill && n.fill !== 'none' ? [{ type: 'solid', color: n.fill, opacity: 1, visible: true }] : []),
        effects: () => [],
        radii: n => [n.radius || 0, n.radius || 0, n.radius || 0, n.radius || 0],
        sides: n => ({ t: n.strokeWidth || 0, r: n.strokeWidth || 0, b: n.strokeWidth || 0, l: n.strokeWidth || 0 }),
        strokeOn: n => (n.strokeWidth || 0) > 0,
        token: (n, p) => (n.vars?.[p] ? tokenVar(n.vars[p], 'color') : null),
        svg: () => null,
        exportName: h => pascalCase(h.name),
        isIcon: () => false,
        gen: h => generateComponent(ctx, h),
        codeProps: () => [],
    };
    return ctx;
}

test('names follow the Library Kit', () => {
    assert.equal(tokenVar('color/Primary Foreground', 'color'), '--theme-primary-foreground');
    assert.equal(tokenVar('radius/sm', 'number'), '--theme-radius-sm');
    assert.equal(pascalCase('Pro/Mini'), 'ProMini');
    assert.equal(kebabCase('Leading icon'), 'leading-icon');
});

test('a button: auto layout, token fill, text bound to a property', () => {
    const nodes = [
        N({ id: 'b', name: 'Button', component: true, layout: 'horizontal', gap: 8, padT: 12, padB: 12, padL: 16, padR: 16, radius: 6, fill: '#0058ca', vars: { fill: 'color/primary' }, layoutSizingH: 'hug', layoutSizingV: 'hug', cprops: [{ id: 'p1', name: 'Label', type: 'text', def: 'Save' }] }),
        N({ id: 't', parentId: 'b', name: 'Label', type: 'text', text: 'Save', fill: '#ffffff', fontFamily: 'Inter', fontSize: 14, fontWeight: 600, lineHeight: 1.4, propBind: { text: 'p1' } }),
    ];
    const g = generateComponent(ctxFor(nodes), nodes[0]);
    assert.equal(g.exportName, 'Button');
    assert.match(g.css, /\.button \{[^}]*display: flex;/);
    assert.match(g.css, /gap: 8px;/);
    assert.match(g.css, /padding: 12px 16px;/);
    assert.match(g.css, /background-color: var\(--theme-primary, #0058ca\);/);
    assert.match(g.css, /border-radius: 6px;/);
    assert.match(g.css, /font-weight: 600;/);
    assert.match(g.tsx, /label = "Save"/);
    assert.match(g.tsx, /\{label\}/);
    assert.match(g.tsx, /export function Button\(/);
    assert.deepEqual(g.props.map(p => [p.name, p.type]), [['label', 'string']]);
});

test('variants become props, states become CSS', () => {
    const nodes = [
        N({ id: 's', name: 'Chip', componentSet: true }),
        N({ id: 'v1', parentId: 's', name: 'Size=Small, State=Default', component: true, variant: { Size: 'Small', State: 'Default' }, layout: 'horizontal', padT: 4, padL: 8, padR: 8, padB: 4, fill: '#eeeeee' }),
        N({ id: 'v2', parentId: 's', name: 'Size=Large, State=Default', component: true, variant: { Size: 'Large', State: 'Default' }, layout: 'horizontal', padT: 8, padL: 16, padR: 16, padB: 8, fill: '#eeeeee' }),
        N({ id: 'v3', parentId: 's', name: 'Size=Small, State=Hover', component: true, variant: { Size: 'Small', State: 'Hover' }, layout: 'horizontal', padT: 4, padL: 8, padR: 8, padB: 4, fill: '#dddddd' }),
    ];
    const g = generateComponent(ctxFor(nodes), nodes[0]);
    assert.deepEqual(g.props.map(p => p.name), ['size']);
    assert.equal(g.props[0].def, 'small');
    assert.match(g.css, /\.chip\[data-size="large"\] \{[^}]*padding: 8px 16px;/);
    assert.match(g.css, /\.chip\[data-size="small"\]:hover \{[^}]*background-color: #dddddd;/);
    assert.match(g.tsx, /size = "small"/);
    assert.match(g.tsx, /data-size=\{size\}/);
});

test('a stroke is drawn above the children by an ::after layer', () => {
    const nodes = [N({ id: 'i', name: 'Input', component: true, layout: 'horizontal', stroke: '#d0d5dd', strokeWidth: 1, strokeAlign: 'inside', fill: 'none', vars: { stroke: 'color/border' } })];
    const g = generateComponent(ctxFor(nodes), nodes[0]);
    assert.match(g.css, /\.input::after \{[^}]*border: 1px solid var\(--theme-border, #d0d5dd\);/);
    assert.match(g.css, /\.input \{[^}]*position: relative;/);
});

test('layers that only some variants have are hidden by default', () => {
    const nodes = [
        N({ id: 's', name: 'Row', componentSet: true }),
        N({ id: 'a', parentId: 's', name: 'Kind=Plain', component: true, variant: { Kind: 'Plain' }, layout: 'horizontal' }),
        N({ id: 'a1', parentId: 'a', name: 'Text', type: 'text', text: 'Hi', fill: '#000000', fontFamily: 'Inter', fontSize: 14 }),
        N({ id: 'b', parentId: 's', name: 'Kind=Badge', component: true, variant: { Kind: 'Badge' }, layout: 'horizontal' }),
        N({ id: 'b1', parentId: 'b', name: 'Text', type: 'text', text: 'Hi', fill: '#000000', fontFamily: 'Inter', fontSize: 14 }),
        N({ id: 'b2', parentId: 'b', name: 'Dot', type: 'ellipse', w: 8, h: 8, fill: '#ff0000' }),
    ];
    const g = generateComponent(ctxFor(nodes), nodes[0]);
    assert.match(g.css, /\.row__dot \{[^}]*display: none;/);
    assert.match(g.css, /\.row\[data-kind="badge"\] \.row__dot \{[^}]*display: block;/);
});

test('an instance is written as JSX', () => {
    const nodes = [
        N({ id: 's', name: 'Chip', componentSet: true }),
        N({ id: 'v1', parentId: 's', name: 'Size=Small', component: true, variant: { Size: 'Small' } }),
        N({ id: 'v2', parentId: 's', name: 'Size=Large', component: true, variant: { Size: 'Large' } }),
        N({ id: 'i', name: 'Chip', isInstance: true, sourceId: 'v2' }),
    ];
    const ctx = ctxFor(nodes);
    ctx.codeProps = (holder, main) => { const g = generateComponent(ctx, holder); return g.props.filter(p => p.source === 'variant').map(p => `${p.name}=${JSON.stringify(p.values[main.variant[p.vkey]])}`); };
    assert.equal(usageSnippet(ctx, nodes[3]), '<Chip size="large" />');
});
