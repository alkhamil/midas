// Switch children sit in inner containers with asymmetric padding, as Ant Design's
// inner margins do: the checked text shows left of the handle with a wide pad on the
// far side and a narrow one by the handle, mirrored when unchecked. The containers are
// managed and conditional (canvas = Play = export parity per state).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/index.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { layerSpecsOf, applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const sw = TEMPLATES.get('switch');
const byId = id => sw.anatomy.find(s => s.id === id);

test('each text side lives in a managed conditional container, padded far from the handle and near it', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)), []);
    assert.deepEqual(layerSpecsOf(sw).map(s => s.key), ['root', 'innerOn', 'checkedChildren', 'checkedIcon', 'handle', 'innerOff', 'uncheckedChildren', 'uncheckedIcon', 'spinner']);
    for (const [box, text, kind] of [['innerOn', 'checkedChildren', 'checkedKind'], ['innerOff', 'uncheckedChildren', 'uncheckedKind']]) {
        assert.equal(byId(box).kind, 'frame', `${box} is a container`);
        assert.equal(byId(box).managed, true, `${box} is an instance layer`);
        assert.equal(byId(text).parent, box, `${text} sits inside ${box}`);
    }
    assert.deepEqual(sw.display.innerOn, { paddingStart: 'innerPadFar', paddingEnd: 'innerPadNear' });
    assert.deepEqual(sw.display.innerOff, { paddingStart: 'innerPadNear', paddingEnd: 'innerPadFar' });
});

test('the master holds no inner box, and the tokens alias the inner-pad roles per Size', () => {
    const model = modelFor(sw);
    assert.ok(!model.created.some(n => n.behavior?.group === 'innerOn' || n.behavior?.group === 'innerOff'), 'no inner box on the master');
    assert.deepEqual(sw.tokens.fromSize.filter(t => /innerPad/.test(t)).sort(), ['innerPadFar', 'innerPadNear']);
    assert.equal(sw.tokenKinds.innerPadNear, 'length');
    assert.equal(sw.tokenKinds.innerPadFar, 'length');
    assert.equal(sw.tokenRoles.innerPadNear, 'switch-inner-pad-near');
    assert.deepEqual(sw.tokenRoles.innerPadFar, { small: 'switch-inner-pad-far-sm', default: 'switch-inner-pad-far' });
});

test('an instance holds the text inside its box, before the handle when checked and after it when unchecked', () => {
    for (const [props, box, text] of [
        [{ checked: true, checkedKind: 'text', checkedChildren: 'on' }, 'innerOn', 'on'],
        [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'off' }, 'innerOff', 'off'],
    ]) {
        const model = modelFor(sw);
        const nodes = instanceFor(model, props);
        const holder = nodes.find(n => n.behavior?.slot === box);
        assert.ok(holder, `${box} layer for ${JSON.stringify(props)}`);
        assert.equal(holder.type, 'frame', 'the box is a frame');
        const inner = nodes.find(n => n.behavior?.slot === (box === 'innerOn' ? 'checkedChildren' : 'uncheckedChildren'));
        assert.equal(inner.parentId, holder.id, 'the text sits inside the box');
        assert.equal(inner.text, text);
        const order = nodes.filter(n => n.parentId === nodes[0].id).map(n => n.behavior?.slot ?? n.behavior?.group);
        assert.deepEqual(order, box === 'innerOn' ? ['innerOn', 'handle'] : ['handle', 'innerOff']);
    }
});

test('the export guards each box by its condition and pads it from the inner-pad tokens', () => {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Switch.jsx'];
    assert.match(jsx, /\{\(\(checked === true\) && \(checkedKind === "text"\) && \(String\(checkedChildren \?\? ""\) !== ""\)\) && <div className="switch-innerOn">/);
    assert.match(jsx, /\{\(\(checked === false\) && \(uncheckedKind === "text"\) && \(String\(uncheckedChildren \?\? ""\) !== ""\)\) && <div className="switch-innerOff">/);
    const css = out.files['Switch.css'];
    assert.match(css, /\.switch-innerOn \{\s*[^}]*padding-inline-start: var\(--switch-inner-pad-far\);/s);
    assert.match(css, /\.switch-innerOn \{\s*[^}]*padding-inline-end: var\(--switch-inner-pad-near\);/s);
    assert.match(css, /\.switch-innerOff \{\s*[^}]*padding-inline-start: var\(--switch-inner-pad-near\);/s);
    assert.match(css, /\.switch-innerOff \{\s*[^}]*padding-inline-end: var\(--switch-inner-pad-far\);/s);
    // A checked Switch keeps its checked colours while loading: only hover and focus yield to the blocked guard.
    assert.match(css, /\.switch(\[data-[\w-]+="[^"]+"\])*\[data-checked\]:not\(:disabled\) \{/);
    assert.doesNotMatch(css, /\[data-checked\]:not\(:disabled\):not\(\[data-blocked\]\)/);
});

test('Play draws the text inside its box, opposite the handle', () => {
    for (const [props, box, text, handleFirst] of [
        [{ checked: true, checkedKind: 'text', checkedChildren: 'on' }, 'switch-innerOn', 'on', false],
        [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'off' }, 'switch-innerOff', 'off', true],
    ]) {
        const model = modelFor(sw);
        const nodes = instanceFor(model, props);
        const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
        nodes[0].parentId = 'top';
        const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
        assert.deepEqual(problems, []);
        const swEl = elementsOf(root).find(({ el }) => el.attrs?.class === 'switch');
        const kids = swEl.el.children;
        const at = kids.findIndex(c => c.attrs?.class === box);
        assert.ok(at !== -1, `Play draws ${box}`);
        assert.equal(kids[at].children.some(c => c.text === text), true, 'the box holds the text');
        assert.equal(kids.findIndex(c => c.attrs?.class === 'switch-handle') === 0, handleFirst, `handle first: ${handleFirst}`);
    }
});
