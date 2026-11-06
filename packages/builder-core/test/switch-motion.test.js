// Switch motion (antd): the track recolours over 0.2s ease-in-out; the handle slides
// by transform over 0.2s ease-in-out (travel is track - handle - 2*padding, the same
// resting positions the canvas lays out) and grows 4px while pressed. Play uses the
// same stylesheet as the export; the canvas stays static. Disabled never animates;
// reduced motion kills the travel and the grow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');

function css() {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files['Switch.css'];
}

test('the schema declares the motion as data: track and handle transitions, the slide and the press grow', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)).filter(p => /motion/i.test(p)), []);
    assert.deepEqual(sw.motion.transitions, [
        { key: 'root', props: ['background-color'], duration: '0.2s', timing: 'ease-in-out' },
        { key: 'handle', props: ['transform', 'width'], duration: '0.2s', timing: 'ease-in-out' },
    ]);
    assert.deepEqual(sw.motion.slide, { key: 'handle', prop: 'checked', travel: { track: 'trackWidth', handle: 'handleSize', padding: 'trackPadding' } });
    assert.deepEqual(sw.motion.press, { key: 'handle', token: 'handleSize', prop: 'width', grow: '4px' });
});

test('the export transitions the track colour and the handle travel', () => {
    const text = css();
    assert.match(text, /\.switch \{\s*[^}]*transition: background-color 0\.2s ease-in-out;\s*[^}]*\}/s);
    assert.match(text, /\.switch-handle \{\s*[^}]*transition: transform 0\.2s ease-in-out, width 0\.2s ease-in-out;\s*[^}]*\}/s);
});

test('the handle slides by transform: track - handle - 2*padding, resting where the canvas puts it', () => {
    const text = css();
    assert.match(text, /\.switch \.switch-handle \{\s*transform: translateX\(0\);\s*\}/s);
    assert.match(text, /\.switch\[data-checked\] \{\s*justify-content: flex-start;\s*\}/s);
    assert.match(text, /\.switch\[data-checked\] \.switch-handle \{\s*transform: translateX\(calc\(var\(--switch-track-width\) - var\(--switch-handle-size\) - 2 \* var\(--switch-track-padding\)\)\);\s*\}/s);
});

test('the handle grows 4px while pressed', () => {
    assert.match(css(), /\.switch:active:not\(:disabled\) \.switch-handle \{\s*width: calc\(var\(--switch-handle-size\) \+ 4px\);\s*\}/s);
});

test('a slid handle grows toward the inside: pressed and checked widens leftwards to the padding', () => {
    assert.match(css(), /\.switch\[data-checked\]:active:not\(:disabled\) \.switch-handle \{\s*width: calc\(var\(--switch-handle-size\) \+ 4px\);\s*transform: translateX\(calc\(var\(--switch-track-width\) - var\(--switch-handle-size\) - 2 \* var\(--switch-track-padding\) - 4px\)\);\s*\}/s);
});

test('a disabled switch does not animate', () => {
    const text = css();
    assert.match(text, /\.switch:disabled \{\s*transition: none;\s*\}/s);
    assert.match(text, /\.switch:disabled \.switch-handle \{\s*transition: none;\s*\}/s);
});

test('reduced motion kills the travel', () => {
    const text = css();
    const tail = text.slice(text.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(tail, /\.switch-handle \{\s*transition: none;\s*\}/s);
});

test('Play applies the same motion stylesheet as the export', () => {
    const model = modelFor(sw);
    const nodes = instanceFor(model, { checked: true });
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    assert.match(styles, /transition: background-color 0\.2s ease-in-out;/s);
    assert.match(styles, /transform: translateX\(calc\(var\(--switch-track-width\) - var\(--switch-handle-size\) - 2 \* var\(--switch-track-padding\)\)\);/s);
});
