// The Input's text layers on demand (docs/input-managed-text.md): a fresh Input has no text node until a prop asks for one; the value, the affix texts
// and the counter are made when the matching prop turns on and removed when it stops asking, the text a designer typed stays in its prop, and
// Play and the export draw the control from the props whether or not a value layer exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `m-${key}-${++seq}`;
const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 343, h: 32, fills: [], layout: 'horizontal', component: true };
const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
const copies = props => instanceOf(input, frame, made.created, props, { id: idOf });
const texts = props => copies(props).filter(n => n.type === 'text').map(n => n.name);

test('a fresh Input master shows the sample placeholder; an instance shows it only while its own placeholder text is set', () => {
    assert.deepEqual(made.created.filter(n => n.type === 'text').map(n => n.name), ['placeholder']);
    assert.deepEqual(texts({}), [], 'no placeholder text, no layer');
    assert.deepEqual(texts({ placeholder: 'Search' }), ['placeholder']);
});

test('each text layer is made when its prop turns on, in order, carrying its text', () => {
    assert.deepEqual(texts({ value: 'Hi' }), ['value']);
    assert.deepEqual(texts({ value: 'Hi', showCount: true, maxLength: 10 }), ['value', 'count']);
    assert.deepEqual(texts({ value: 'Hi', hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com' }), ['prefixText', 'value', 'suffixText']);
    const all = copies({ value: 'Hi', showCount: true, maxLength: 10, hasPrefix: true, prefixText: 'Rp' });
    assert.equal(all.find(n => n.name === 'value').text, 'Hi');
    assert.equal(all.find(n => n.name === 'count').text, '2 / 10');
    assert.equal(all.find(n => n.name === 'prefixText').text, 'Rp');
    assert.deepEqual(texts({ hasPrefix: true, prefixText: '' }), [], 'a switch on with no text asks for no layer');
    assert.deepEqual(texts({ hasPrefix: true, prefixKind: 'icon', prefixText: 'Rp' }), [], 'the Icon kind asks for no text layer');
});

test('turning a prop off removes the layer and turning it on again makes it with the text that was kept', () => {
    const on = { hasPrefix: true, prefixText: 'Rp' };
    const layers = copies(on).slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name }));
    const off = { ...on, hasPrefix: false };
    assert.deepEqual(planAnatomy(input, resolveProps(input, off), layers).filter(op => op.op === 'remove').length, 1);
    assert.equal(copies(off).some(n => n.name === 'prefixText'), false);
    assert.equal(copies(on).find(n => n.name === 'prefixText').text, 'Rp', 'prefixText was kept in the prop, so the new layer shows it');
});

test('the Input master is complete with the placeholder only: no part-missing, and Auto Fix has nothing to add', () => {
    const doc = { variables, pages: [{ name: 'p', nodes: [frame, ...made.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.code === 'part-missing'), []);
    assert.deepEqual(applyTemplateToFrame(input, { frame, children: made.created, binding: model.binding, variables, idOf }).created, []);
});

test('the export writes the input, the placeholder and the value from props, with no value layer needed', () => {
    const jsx = generateComponent(input, model.binding, variables, 'Input', frame, id => made.created.filter(n => n.parentId === id)).files['Input.jsx'];
    assert.match(jsx, /<Control className="input-value" value=\{value\}/);
    assert.doesNotMatch(jsx, /\{\(String\(value \?\? ""\) !== ""\) && <input/, 'the input is not conditional on the value');
    assert.match(jsx, /\{\(\(showCount === true\) && \(kind === "text"\)\) && <span className="input-count">/);
});

test('Play draws the input from the props with no value layer, and the counter and affix text from their own layers', () => {
    const run = props => {
        const nodes = copies(props);
        const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, ...made.created, ...nodes] }], variables }, nodes[0].id);
        assert.deepEqual(problems, []);
        return root;
    };
    const bare = run({ placeholder: 'Search' });
    const el = bare.children.find(c => c.tag === 'input');
    assert.equal(el.attrs.value, '');
    assert.equal(el.attrs.placeholder, 'Search');
    assert.equal(bare.children.some(c => c.attrs?.['data-role'] === 'count'), false, 'no counter without Show count');
    const full = run({ value: 'Hello', showCount: true, maxLength: 10, hasPrefix: true, prefixText: 'Rp' });
    assert.equal(full.children.find(c => c.tag === 'input').attrs.value, 'Hello');
    assert.equal(full.children.find(c => c.attrs?.['data-role'] === 'count').text, '5 / 10');
    assert.equal(full.children[0].text, 'Rp', 'the prefix text is drawn first, from its own layer');
});
