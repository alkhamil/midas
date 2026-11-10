// Password, Play and the export: the canvas holds the eye box and the eye-off layer; Play draws those plus the swapped eye-on from its component
// (hidden until the local revealed state holds), and the export gates each eye by that state. The eye box is the toggle in both (a press flips the
// local state) and the mask is unconditional for the kind. The text kind has no eye.
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

/** A tiny icon library for the harness: the swapped eye draws from its component, like the file's Icon/eye. */
const eyeComp = (id, name) => ({ id, name: 'Icon/' + name, type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, layout: 'horizontal', fills: [], layoutSizingH: 'fixed', layoutSizingV: 'fixed', component: true });
const eyeVec = (id, parentId) => ({ id, name: 'eye', type: 'path', parentId, x: 4, y: 4, w: 16, h: 16, points: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 16 }, { x: 0, y: 16 }], fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], strokeWidth: 0, rotation: 0, opacity: 1, visible: true, locked: false });
/** The Play classes of the eye layers, and the eye slots the canvas holds, for an instance under these props. */
function eyesOf(props) {
    const withIcons = props.kind === 'password' ? { ...props, eyeOnIcon: 'comp-eye-on', eyeOffIcon: 'comp-eye-off' } : props;
    const nodes = instanceFor(model, withIcons);
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const library = props.kind === 'password' ? [eyeComp('comp-eye-on', 'eye'), eyeVec('comp-eye-on-v', 'comp-eye-on'), eyeComp('comp-eye-off', 'eyeOff'), eyeVec('comp-eye-off-v', 'comp-eye-off')] : [];
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes, ...library] }], variables: model.variables }, 'top');
    const drawn = elementsOf(root).map(({ el }) => el.attrs?.class).filter(c => typeof c === 'string' && c.startsWith('input-eye')).sort();
    const held = nodes.map(n => n.behavior?.slot).filter(s => typeof s === 'string' && s.startsWith('eye')).map(s => `input-${s}`).sort();
    return { drawn, held };
}

for (const [label, props] of [['hidden', { kind: 'password' }], ['text', { kind: 'text' }]]) {
    test(`${label}: Play draws the eye layers the canvas holds, plus the swapped eye from its component`, () => {
        const { drawn, held } = eyesOf(props);
        assert.deepEqual(drawn.filter(c => c !== 'input-eyeOn'), held, 'every canvas eye layer is drawn');
        assert.equal(drawn.includes('input-eyeOn'), label === 'hidden', 'the swapped eye is drawn from its component for a password, and only there');
    });
}

test('the export swaps the eyes by the local revealed state, and the box is the toggle', () => {
    for (const cls of ['input-eyeBox', 'input-eyeOn', 'input-eyeOff']) assert.ok(exported.includes(`className="${cls}"`), `${cls} is an export class`);
    assert.match(exported, /const \[revealed, setRevealed\] = useState\(false\);/);
    assert.match(exported, /const eyeShown = kind === "password";/);
    assert.match(exported, /data-revealed=\{revealed \|\| undefined\}/);
    assert.match(exported, /\{eyeShown && !revealed && <span className="input-eyeOff">\{eyeOffIcon\}<\/span>\}/);
    assert.match(exported, /\{eyeShown && revealed && <span className="input-eyeOn">\{eyeOnIcon\}<\/span>\}/);
    assert.match(exported, /className="input-eyeBox" onClick=\{\(\) => \{ if \(!\(disabled \|\| readOnly\)\) setRevealed\(!revealed\); \}\}/);
    assert.match(exported, /type=\{\(kind === "password"\) && !revealed \? "password" : undefined\}/);
});

test('the eye box is the toggle in Play too: its press flips the local revealed state', () => {
    assert.deepEqual(pressAttrsOf(input, 'eyeBox'), { 'data-press': 'toggle', 'data-press-attr': 'data-revealed' });
});
