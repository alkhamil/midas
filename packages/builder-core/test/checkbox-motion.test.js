// Checkbox motion (antd): the box recolours over 0.3s with the antd ease; the
// checkmark draws in with scale/opacity/rotate (0.1s ease-in-out after a 0.1s
// delay) and the indeterminate dash scales in. Play uses the same stylesheet as
// the export; the canvas stays static. Disabled never animates; reduced motion
// kills transitions and the draw-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const checkbox = TEMPLATES.get('checkbox');

function css() {
    const model = modelFor(checkbox);
    const out = generateComponent(checkbox, model.binding, model.variables, 'Checkbox', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files['Checkbox.css'];
}

test('the schema declares the motion as data: box transition plus check and dash draw-in', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(checkbox)).filter(p => /motion/i.test(p)), []);
    assert.ok(checkbox.motion, 'checkbox declares motion');
    assert.deepEqual(checkbox.motion.transitions, [
        { key: 'box', props: ['background-color', 'border-color'], duration: '0.3s', timing: 'ease' },
    ]);
    assert.equal(checkbox.motion.appearances.length, 2);
});

test('bad motion is refused: unknown key, unknown state, bad duration', () => {
    const bad = patch => { const t = structuredClone(checkbox); Object.assign(t.motion, patch); return validateTemplateSchema(t); };
    assert.ok(bad({ transitions: [{ key: 'nope', props: ['color'], duration: '0.3s', timing: 'ease' }] }).some(p => /motion/i.test(p)));
    assert.ok(bad({ appearances: [{ key: 'check', states: ['hover'], from: { transform: 'scale(0)' }, duration: '0.1s', timing: 'ease-in-out' }] }).some(p => /motion/i.test(p)));
    assert.ok(bad({ transitions: [{ key: 'box', props: ['color'], duration: 'fast', timing: 'ease' }] }).some(p => /motion/i.test(p)));
});

test('the export transitions the box colours over 0.3s with the antd ease', () => {
    const text = css();
    assert.match(text, /\.checkbox-box \{\s*[^}]*transition: background-color 0\.3s ease, border-color 0\.3s ease;/s);
});

test('the checkmark draws in with scale, rotate and opacity; the dash scales in', () => {
    const text = css();
    assert.match(text, /@keyframes midas-checkbox-check-in \{\s*from \{\s*transform: scale\(0\) rotate\(-45deg\);\s*opacity: 0;\s*\}\s*\}/s);
    assert.match(text, /\.checkbox\[data-checked\]:not\(\[aria-disabled="true"\]\) \.checkbox-check \{\s*animation: midas-checkbox-check-in 0\.2s cubic-bezier\(0\.12, 0\.4, 0\.29, 1\.46\) 0\.1s backwards;\s*\}/s);
    assert.match(text, /@keyframes midas-checkbox-indeterminate-in \{\s*from \{\s*transform: scale\(0\);\s*\}\s*\}/s);
    assert.match(text, /\.checkbox\[data-indeterminate\]:not\(\[aria-disabled="true"\]\) \.checkbox-indeterminate \{\s*animation: midas-checkbox-indeterminate-in 0\.1s cubic-bezier\(0\.71, -0\.46, 0\.88, 0\.6\) backwards;\s*\}/s);
});

test('a disabled checkbox does not animate: transitions are killed and the draw-in is guarded', () => {
    const text = css();
    assert.match(text, /\.checkbox\[aria-disabled="true"\] \.checkbox-box \{\s*transition: none;\s*\}/s);
    assert.ok(!text.includes('.checkbox[data-checked] .checkbox-check'), 'the draw-in never applies without the disabled guard');
});

test('reduced motion kills the transitions and the draw-in', () => {
    const text = css();
    const at = text.indexOf('@media (prefers-reduced-motion: reduce)');
    assert.ok(at >= 0, 'reduced-motion block exists');
    const tail = text.slice(at);
    assert.match(tail, /\.checkbox-box \{\s*transition: none;\s*\}/s);
    assert.match(tail, /animation: none;/s);
});

test('Play applies the same motion stylesheet as the export', () => {
    const model = modelFor(checkbox);
    const nodes = instanceFor(model, { checked: true });
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    assert.match(styles, /transition: background-color 0\.3s ease/s);
    assert.match(styles, /animation: midas-checkbox-check-in 0\.2s cubic-bezier\(0\.12, 0\.4, 0\.29, 1\.46\) 0\.1s backwards;/s);
});
