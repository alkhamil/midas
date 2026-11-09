// InputNumber on the canvas: the handler column is a pinned container whose frame comes from the box's size and its own tokens (pinnedFrame), not from numbers the layout has not
// settled: at every Size it ends on the inside of the right border, spans the control inside its border, is split into two equal halves with the chevron centred in each, and the input
// text ends before it. Master and instance alike (the editor places both with the same function; see the studio replay test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { pinnedFrame } from '../src/behavior-engine/template-master.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const number = TEMPLATES.get('inputnumber');
const model = modelFor(number);
const modesOf = size => Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
    const coll = model.variables.collections.find(c => c.id === cid);
    const want = prop === 'size' ? size : number.props[prop].defaultMode ?? coll.modes[0].name;
    return [prop, (coll.modes.find(m => m.id === want || m.name === want) ?? coll.modes[0]).id];
}));
const varsAt = size => previewOf(number, model.binding, modesOf(size), model.variables, resolveProps(number, number.sampleProps), 'default').vars;
const px = (vars, token) => parseFloat(vars[cssVarOf('inputnumber', token)]);
const slot = id => number.anatomy.find(s => s.id === id);

test('the pinned container is fixed in both axes: its width is its token and its height is written from the box, never what its content hugs to', () => {
    const stepper = instanceFor(model, number.sampleProps).find(n => n.name === 'stepper');
    assert.deepEqual([stepper.layoutSizingH, stepper.layoutSizingV], ['fixed', 'fixed'], 'a hugging column of fill halves would collapse to its chevrons');
    assert.deepEqual([stepper.layoutPositioning, stepper.constraintH, stepper.constraintV], ['absolute', 'right', 'stretch']);
    const master = model.created.find(n => n.name === 'stepper');
    assert.deepEqual([master.layoutSizingH, master.layoutSizingV, master.layoutPositioning], ['fixed', 'fixed', 'absolute'], 'the master too');
});

for (const size of SIZES) {
    test(`${size}: the column ends on the inside of the right border, spans the control inside its border, in two equal halves with the chevron centred in each, and the input text ends before it`, () => {
        const vars = varsAt(size);
        const border = px(vars, 'borderWidth'), height = px(vars, 'height'), width = number.rootWidth;
        for (const box of [{ w: width, h: height }, { w: width, h: height + 20 }]) {
            const f = pinnedFrame(number, slot('stepper'), box, vars);
            assert.equal(f.w, px(vars, 'stepWidth'), 'a small control wide');
            assert.equal(f.x + f.w, box.w - border, 'its right edge is the inside of the right border');
            assert.equal(f.y, 0, 'it starts on the top border line of the box');
            assert.equal(f.h, height, 'and is the box height token, whatever the box is');
            // Two halves of 50% each (fill x fill in a column): together the column, each with its chevron centred on both axes.
            const half = f.h / 2, glyph = px(vars, 'stepIconSize');
            assert.equal(half * 2, f.h);
            assert.ok(glyph <= half && glyph <= f.w, `${size}: the chevron fits its half`);
            assert.equal((f.w - glyph) / 2, f.w - glyph - (f.w - glyph) / 2, 'centred across');
            assert.equal((half - glyph) / 2, half - glyph - (half - glyph) / 2, 'centred down');
            // The text ends where the root padding on the end side ends, which is at or before the column's left edge.
            const textEnd = box.w - px(vars, 'paddingEnd');
            assert.ok(textEnd <= f.x, `${size}: the text area ends at ${textEnd}, the column starts at ${f.x}`);
        }
    });
}

test('without the column the end padding is the side padding again, and the column is nothing', () => {
    const vars = previewOf(number, model.binding, modesOf('md'), model.variables, resolveProps(number, { ...number.sampleProps, controls: false }), 'default').vars;
    assert.deepEqual(number.persistentStates.noStepper.tokens, { paddingEnd: 'paddingEndSide' });
    assert.equal(parseFloat(vars[cssVarOf('inputnumber', 'paddingEnd')]), parseFloat(vars[cssVarOf('inputnumber', 'paddingX')]), 'the state hands the side padding back');
});

test('a corner glyph is placed from the box and its own size token: the inset to the right and the bottom', () => {
    const grip = TEMPLATES.get('input').anatomy.find(s => s.id === 'resizeHandle');
    const input = TEMPLATES.get('input');
    const vars = { [cssVarOf('input', 'glyphInset')]: '2px', [cssVarOf('input', input.display.resizeHandle.size)]: '12px', [cssVarOf('input', 'borderWidth')]: '1px' };
    const f = pinnedFrame(input, grip, { w: 343, h: 84 }, vars);
    assert.deepEqual([343 - (f.x + f.w), 84 - (f.y + f.h), f.w, f.h], [2, 2, 12, 12]);
});
