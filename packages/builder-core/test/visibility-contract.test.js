import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { canvasPartsOf, partWrites } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { INPUT } from '../src/templates/input.js';
import { BUTTON } from '../src/templates/button.js';

const visibleOf = (template, props) => Object.fromEntries(partWrites(template, resolveProps(template, props)).filter(w => w.field === 'visible').map(w => [w.key, w.value]));

test('every registered template declares its parts and its play-only behaviours, each with an id and a reason', () => {
    for (const template of TEMPLATES.values()) {
        for (const part of template.parts ?? []) {
            assert.ok(part.id && part.kind, `${template.id} part ${JSON.stringify(part)} needs an id and a kind`);
            assert.ok(['text', 'icon', 'control', 'frame'].includes(part.kind), `${template.id} part ${part.id} has kind ${part.kind}`);
            if (part.canvas === false) assert.ok(part.reason, `${template.id} part ${part.id} is not on the canvas and needs a reason`);
        }
        for (const play of template.playOnly ?? []) assert.ok(play.reason, `${template.id} play-only ${play.id} needs a reason`);
    }
});

test('a part is on the canvas unless its contract says otherwise', () => {
    assert.deepEqual(canvasPartsOf(INPUT).map(p => p.id), ['placeholder', 'clear', 'count']);
    assert.deepEqual(canvasPartsOf(BUTTON).map(p => p.id), ['spinner']);
});

test('Input visibility matrix: placeholder while the value is empty, clear with a value and allowClear, count with showCount', () => {
    const cases = [
        [{}, { placeholder: true, clear: false, count: false }],
        [{ value: 'a' }, { placeholder: false, clear: false, count: false }],
        [{ value: '', allowClear: true }, { placeholder: true, clear: false, count: false }],
        [{ value: 'a', allowClear: true }, { placeholder: false, clear: true, count: false }],
        [{ value: 'a', showCount: true, maxLength: '20' }, { placeholder: false, clear: false, count: true }],
        [{ value: '', allowClear: true, showCount: true }, { placeholder: true, clear: false, count: true }],
    ];
    for (const [props, expected] of cases) {
        const got = visibleOf(INPUT, props);
        assert.deepEqual({ placeholder: got.placeholder, clear: got.clear, count: got.count }, expected, JSON.stringify(props));
        // The value layer shows only while the value is not empty, so the placeholder takes its place and no more.
        assert.equal(got.label, !!props.value, `label while the value is ${props.value ? 'set' : 'empty'}`);
    }
});

test('Input count text is the value length, with the maximum when there is one', () => {
    const text = props => partWrites(INPUT, resolveProps(INPUT, props)).find(w => w.key === 'count' && w.field === 'text').value;
    assert.equal(text({ value: 'hi', maxLength: '20' }), '2 / 20');
    assert.equal(text({ value: 'hi' }), '2');
    assert.equal(text({ value: '' }), '0');
});

test('Button spinner is on the canvas while loading, and hidden otherwise', () => {
    assert.deepEqual(visibleOf(BUTTON, { loading: true }), { spinner: true });
    assert.deepEqual(visibleOf(BUTTON, {}), { spinner: false });
});
