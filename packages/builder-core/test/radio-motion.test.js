// Radio motion (antd): the ring recolours over 0.3s with the antd ease; the dot
// scales in from 0 over 0.3s with the same ease. Play uses the same stylesheet as
// the export; the canvas stays static. Disabled never animates; reduced motion
// kills both. No click wave: Button's wave targets the host box, while the radio
// host is the label row, so reusing it would ripple the row, not the circle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const radio = TEMPLATES.get('radio');

function css() {
    const model = modelFor(radio);
    const out = generateComponent(radio, model.binding, model.variables, 'Radio', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files['Radio.css'];
}

test('the schema declares the motion as data: border transition plus dot scale-in, and no wave', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(radio)).filter(p => /motion/i.test(p)), []);
    assert.deepEqual(radio.motion.transitions, [
        { key: 'box', props: ['border-color'], duration: '0.3s', timing: 'cubic-bezier(0.78, 0.14, 0.15, 0.86)' },
    ]);
    assert.equal(radio.motion.appearances.length, 1);
    assert.equal(radio.interaction, undefined, 'no wave: the generic wave would ripple the label row, not the circle');
});

test('the export transitions the ring colour over 0.3s with the antd ease', () => {
    assert.match(css(), /\.radio-box \{\s*[^}]*transition: border-color 0\.3s cubic-bezier\(0\.78, 0\.14, 0\.15, 0\.86\);\s*[^}]*\}/s);
});

test('the dot scales in from 0 over 0.3s with the antd ease', () => {
    const text = css();
    assert.match(text, /@keyframes midas-radio-dot-in \{\s*from \{\s*transform: scale\(0\);\s*\}\s*\}/s);
    assert.match(text, /\.radio\[data-checked\]:not\(\[aria-disabled="true"\]\) \.radio-dot \{\s*animation: midas-radio-dot-in 0\.3s cubic-bezier\(0\.78, 0\.14, 0\.15, 0\.86\);\s*\}/s);
});

test('a disabled radio does not animate', () => {
    const text = css();
    assert.match(text, /\.radio\[aria-disabled="true"\] \.radio-box \{\s*transition: none;\s*\}/s);
    assert.ok(!text.includes('.radio[data-checked] .radio-dot'), 'the draw-in never applies without the disabled guard');
});

test('reduced motion kills the transition and the draw-in', () => {
    const text = css();
    const tail = text.slice(text.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(tail, /\.radio-box \{\s*transition: none;\s*\}/s);
    assert.match(tail, /animation: none;/s);
});

test('Play applies the same motion stylesheet as the export', () => {
    const model = modelFor(radio);
    const nodes = instanceFor(model, { checked: true });
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    assert.match(styles, /transition: border-color 0\.3s cubic-bezier\(0\.78, 0\.14, 0\.15, 0\.86\)/s);
    assert.match(styles, /animation: midas-radio-dot-in 0\.3s cubic-bezier\(0\.78, 0\.14, 0\.15, 0\.86\);/s);
});
