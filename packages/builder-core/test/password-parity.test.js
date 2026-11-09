// Password, Play and the export: for each state, Play draws exactly the eye layers the canvas holds (the eye box and the one eye of the state), the
// export writes the same classes and the same conditions, and the eye box is the toggle in both (a press flips passwordVisible). The text kind has no eye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { pressAttrsOf } from '../src/behavior-engine/display.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const exported = generateComponent(model.template, model.binding, model.variables, 'Input', model.frame, id => model.created.filter(n => n.parentId === id)).files['Input.jsx'];

/** The Play classes of the eye layers, and the eye slots the canvas holds, for an instance under these props. */
function eyesOf(props) {
    const nodes = instanceFor(model, props);
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    const drawn = elementsOf(root).map(({ el }) => el.attrs?.class).filter(c => typeof c === 'string' && c.startsWith('input-eye')).sort();
    const held = nodes.map(n => n.behavior?.slot).filter(s => typeof s === 'string' && s.startsWith('eye')).map(s => `input-${s}`).sort();
    return { drawn, held };
}

for (const [label, props] of [['visible', { kind: 'password', passwordVisible: true }], ['hidden', { kind: 'password', passwordVisible: false }], ['toggle off', { kind: 'password', visibilityToggle: false }], ['text', { kind: 'text' }]]) {
    test(`${label}: Play draws exactly the eye layers the canvas holds`, () => {
        const { drawn, held } = eyesOf(props);
        assert.deepEqual(drawn, held);
    });
}

test('the export writes each eye under its own condition, the same classes Play draws, and the box as the toggle', () => {
    for (const cls of ['input-eyeBox', 'input-eyeOn', 'input-eyeOff']) assert.ok(exported.includes(`className="${cls}"`), `${cls} is an export class`);
    assert.match(exported, /const eyeOnShown = .*passwordVisible === true\);/);
    assert.match(exported, /const eyeOffShown = .*passwordVisible === false\);/);
    assert.match(exported, /className="input-eyeBox" onClick=\{\(\) => \{ if \(!\(disabled \|\| readOnly\)\) onPasswordVisibleChange\?\.\(!passwordVisible\); \}\}/);
});

test('the eye box is the toggle in Play too: its press is a toggle of passwordVisible', () => {
    assert.deepEqual(pressAttrsOf(input, 'eyeBox'), { 'data-press': 'toggle', 'data-press-attr': 'data-password-visible' });
});
