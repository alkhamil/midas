// Stroke panel contract: Solid and Dashed only. Dash length, Gap (follows Dash until
// edited, i.e. an absent gap reads as the dash), and Dash cap (literals, never bound).
// The panel edits node fields; a designer edit must survive Auto Fix and Generate base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strokeDashArray } from '../src/geometry/shapes.js';
import { variantStrokePatch } from '../src/behavior-engine/variant-style.js';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const white = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['outlined', 'dashed'] });
const variables = { collections: model.collections, items: model.items };

test('an absent gap follows the dash; an explicit gap wins; no dash leaves the default', () => {
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6 }), [6, 6]);
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6, strokeGap: 2 }), [6, 2]);
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dash' }), [10, 10]);
    assert.deepEqual(strokeDashArray({ strokeWidth: 2 }), []);
});

test('there is no dot style: dot draws exactly as solid', () => {
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dot' }), []);
});

test('a dashed Variant writes dash only and deletes a stale gap; an explicit gap survives re-apply', () => {
    const patch = variantStrokePatch({}, 'dashed');
    assert.equal(patch.strokeStyle, 'dash');
    assert.equal(patch.strokeDash, 4);
    assert.ok(!('strokeGap' in patch), 'gap follows the dash: no key is written');
    assert.equal(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 4 }, 'dashed'), null);
    assert.equal(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 4, strokeGap: 9 }, 'dashed'), null, 'an explicit gap is kept');
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 9, strokeGap: 9 }, 'dashed').strokeGap, undefined, 'a new dash resets to following');
});

test('a dotted Variant style falls back to solid: dots are removed', () => {
    assert.equal(variantStrokePatch({}, 'dotted'), null, 'already solid: nothing to write');
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dot' }, 'dotted'), { strokeStyle: 'solid' });
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 4 }, 'dotted'), { strokeStyle: 'solid' });
});

function playRoot(extra, { bound = false } = {}) {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: white, radius: 6, x: 0, y: 0, w: 120, h: 32, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const vars = bound ? { stroke: variables.items.find(i => i.name === 'border').id } : undefined;
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 32, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'outlined', 'c-color': 'primary', 'c-size': 'md' }, fills: white, radius: 6, vars, ...extra };
    return toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables }, 'i1').root;
}

test('a dot stroke draws solid on the Play host', () => {
    const root = playRoot({ stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dot' });
    assert.equal(root.style.borderStyle, 'solid');
    assert.equal(root.style.backgroundClip, 'border-box');
});

test('an unbound butt cap stays CSS: caps the host cannot draw force the SVG overlay, butt does not', () => {
    const css = playRoot({ stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dash', strokeCap: 'butt' });
    assert.equal(css.children.some(c => c.html), false, 'no SVG overlay for butt');
    assert.equal(css.style.borderStyle, 'dashed');
    const svg = playRoot({ stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dash', strokeAlign: 'inside', strokeCap: 'round' });
    assert.equal(svg.style.borderStyle, 'none', 'the host draws none while the overlay draws');
    const overlay = svg.children.find(c => c.html);
    assert.ok(overlay, 'the SVG overlay draws the round caps');
    assert.match(overlay.html, /stroke-linecap="round"/);
    const lengths = playRoot({ stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dash', strokeAlign: 'inside', strokeDash: 6, strokeGap: 4, strokeCap: 'butt' });
    assert.ok(lengths.children.some(c => c.html), 'custom lengths still need the overlay, whatever the cap');
});

test('the export draws a dot master solid: no dotted anywhere', () => {
    const css = generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal', radius: 6, stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dot' }, () => []).files['Button.css'];
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*border-style: solid;\n/);
    assert.doesNotMatch(css, /dotted/);
});

test('Auto Fix never writes style, dash, gap or cap: designer lengths survive it', () => {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: white, radius: 6, stroke: '#18181b', strokeWidth: 2, strokeAlign: 'inside', strokeStyle: 'dash', strokeDash: 6, strokeGap: 8, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const { ops } = planBindTokens({ template: TEMPLATES.get('button'), binding: master.behavior, layers: [{ key: 'root', node: master }], variables });
    assert.ok(ops.every(o => o.key !== 'root' || !/strokeStyle|strokeDash|strokeGap|strokeCap/.test(JSON.stringify(o))), 'no dash op is planned');
});

test('Generate base leaves designer dash lengths alone: it only fills variable values', async () => {
    const { default: snapshot } = await import('../src/base-tokens/base-snapshot.json', { with: { type: 'json' } });
    const { planFromSnapshot, applyBasePlan } = await import('../src/base-tokens/importer.js');
    const node = { id: 'n', type: 'frame', stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 8 };
    const before = JSON.parse(JSON.stringify(node));
    const doc = { variables: { collections: [], items: [] }, pages: [{ nodes: [node] }] };
    let n = 0;
    applyBasePlan(doc.variables, planFromSnapshot(snapshot), () => `v${++n}`);
    assert.deepEqual(node, before);
});
