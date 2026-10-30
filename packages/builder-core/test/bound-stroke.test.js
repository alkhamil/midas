// A stroke bound to a variable (button/border on the Button master): the swatch, the canvas and Play read one resolved colour, in
// the same modes, and the paint draws as soon as the variable resolves to a colour. Real data: the Button example fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { resolveMode } from '../src/behavior-engine/modes.js';
import { restoreStrokePaint, swatchPaint } from '../src/behavior-engine/stroke-paint.js';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { masterLayersOf } from '../src/behavior-engine/layers.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { strokeIsOn } from '../src/geometry/shapes.js';
import { colorWithAlpha } from '../src/geometry/format.js';

const load = () => {
    const doc = JSON.parse(readFileSync(new URL('../../../scripts/fixtures/button-example.midas', import.meta.url), 'utf8'));
    const all = doc.pages.flatMap(p => p.nodes);
    return { doc, all, byId: new Map(all.map(n => [n.id, n])), master: all.find(n => n.name === 'Button'), page: doc.pages[0] };
};
const hex = ({ r, g, b }) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
// The colour the editor writes into a bound layer's stroke: the variable in the layer's modes.
const resolveBorder = ({ doc, byId, master, page }, modes) => {
    master.varModes = modes;
    const border = doc.variables.items.find(i => i.name === 'button/border');
    return variableValue(doc.variables, border, c => resolveMode(c, master, byId, page.varModes));
};

for (const [variant, color, expected] of [['outlined', 'primary', '#4338ca'], ['outlined', 'default', '#18181b'], ['outlined', 'danger', '#dc2626']]) {
    test(`Button master in ${variant} + ${color}: the swatch and the canvas stroke show ${expected} at opacity 100, even from a stale paint`, () => {
        const ctx = load();
        const { master } = ctx;
        // A stale paint: a zero-opacity, hidden stroke with no width, bound already (so Bind tokens plans no stroke op for it).
        Object.assign(master, { strokeWidth: 0, strokeOpacity: 0, strokeVisible: false });
        const resolved = resolveBorder(ctx, { 'c-variant': variant, 'c-color': color });
        assert.equal(resolved, expected);
        master.stroke = resolved;
        const layers = masterLayersOf(master, id => ctx.all.filter(n => n.parentId === id));
        const { ops } = planBindTokens({ template: TEMPLATES.get('button'), binding: master.behavior, layers, variables: ctx.doc.variables });
        assert.equal(ops.some(o => o.varKey === 'stroke'), false, 'the stroke is bound already: only the mode change can repair the paint');
        assert.equal(restoreStrokePaint(master, resolved, { ensureWidth: true }), true);
        assert.equal(master.strokeOpacity, 1);
        assert.equal(master.strokeVisible, undefined);
        assert.equal(strokeIsOn(master), true);
        assert.equal(hex(swatchPaint(master.stroke, master.strokeOpacity)), expected);
        assert.equal(swatchPaint(master.stroke, master.strokeOpacity).a, 1);
        assert.equal(colorWithAlpha(master.stroke, master.strokeOpacity), expected);
    });
}

test('Button master in solid: the variable is transparent, so the paint is left alone and the swatch is clear over its checkerboard', () => {
    const ctx = load();
    const { master } = ctx;
    Object.assign(master, { strokeWidth: 1, strokeOpacity: 0, strokeVisible: false });
    const resolved = resolveBorder(ctx, { 'c-variant': 'solid', 'c-color': 'primary' });
    assert.equal(resolved, '#00000000');
    assert.equal(restoreStrokePaint(master, resolved), false);
    assert.equal(master.strokeOpacity, 0);
    assert.equal(master.strokeVisible, false);
    assert.equal(swatchPaint(resolved, 1).a, 0);
    // The stroke turns opaque again with the next mode: it draws at once.
    master.stroke = resolveBorder(ctx, { 'c-variant': 'outlined', 'c-color': 'primary' });
    assert.equal(restoreStrokePaint(master, master.stroke), true);
    assert.equal(strokeIsOn(master), true);
    assert.equal(master.strokeOpacity, 1);
});

test('a variable with its own alpha keeps it in the swatch instead of drawing grey, and a set opacity is never repaired away', () => {
    assert.deepEqual(swatchPaint('#4338ca33', 1), { r: 67, g: 56, b: 202, a: 0.2 });
    assert.equal(swatchPaint('#4338ca33', 0.5).a, 0.1);
    assert.deepEqual(swatchPaint('not a colour', 1), { r: 217, g: 217, b: 217, a: 1 });
    const stroke = { strokeWidth: 1, strokeOpacity: 0.5 };
    assert.equal(restoreStrokePaint(stroke, '#4338ca'), false);
    assert.equal(stroke.strokeOpacity, 0.5);
    assert.equal(restoreStrokePaint({ strokeWidth: 1, strokeOpacity: 0 }, undefined), false);
});

test('the shared resolver reads an alias target in the target collection\'s own mode, and a missing mode falls back', () => {
    const variables = {
        collections: [{ id: 'a', modes: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b', modes: [{ id: 'b1' }, { id: 'b2' }] }],
        items: [
            { id: 'x', type: 'color', collectionId: 'a', values: { a1: { alias: 'y' }, a2: { alias: 'y', opacity: 50 } } },
            { id: 'y', type: 'color', collectionId: 'b', values: { b1: '#111111', b2: '#222222' } },
            { id: 'z', type: 'color', collectionId: 'b', values: { b2: '#333333' } },
        ],
    };
    const modes = { a: 'a1', b: 'b2' };
    const modeOf = c => modes[c.id];
    assert.equal(variableValue(variables, variables.items[0], modeOf), '#222222');
    assert.equal(variableValue(variables, variables.items[0], c => ({ a: 'a2', b: 'b2' })[c.id]), '#22222280');
    assert.equal(variableValue(variables, variables.items[2], c => 'b1'), '#333333');
});
