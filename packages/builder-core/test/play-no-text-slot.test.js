// Play draws a template that has no text slot: its frame parts (the spinner) come after its slots, as the export writes them, and a border with its own dash
// pattern needs no padding token (the root of such a template maps none). Drawn here with the Icon Button, the template with neither.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { iconButtonModel } from '../../../scripts/icon-button-model.mjs';

const template = BUILT_IN_TEMPLATES.get('icon-button');
const model = iconButtonModel();
const variables = { collections: model.collections, items: model.items };
const { variant, shape, size } = model.ids;
/** The instance's mode per collection (varModes), and per dimension (what the token resolver takes). */
const modes = (v, s, z) => ({ [variant]: v, [shape]: s, [size]: z });

/** A master built by the generator, with its layers. */
function master() {
    const frame = { id: 'm', name: 'Icon Button', type: 'frame', parentId: null, fills: [], x: 400, y: 0 };
    const { created } = applyTemplateToFrame(template, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
    return { frame, created };
}
/** An instance of the master with the props and modes, sized as the editor sizes it (a square of `box`). */
function instance({ frame, created }, props = {}, varModes = modes('default', 'square', 'md'), box = 32) {
    const nodes = instanceOf(template, frame, created, props, { id: src => `i-${src}`, varModes });
    Object.assign(nodes[0], { parentId: 'stage', x: 10, y: 10, w: box, h: box });
    return nodes;
}
/** The instance drawn in Play: its element. */
function played(m, nodes, extra = {}) {
    const stage = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [] };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [stage, m.frame, ...m.created, ...nodes] }], variables }, 'stage');
    assert.deepEqual(problems ?? [], []);
    return { el: root.children.find(c => c.nodeId === nodes[0].id), ...extra };
}

test('Play: the host is the template, the icon shows at rest, the spinner while loading, and the box is the instance square', () => {
    const m = master();
    const rest = played(m, instance(m, {}, modes('float', 'circle', 'md'))).el;
    assert.deepEqual([rest.attrs.class, rest.attrs['data-variant'], rest.attrs['data-shape'], rest.attrs['data-size']], ['icon-button', 'float', 'circle', 'md']);
    assert.deepEqual(rest.children.map(c => c.attrs.class), ['icon-button-icon']);
    assert.deepEqual([rest.style.width, rest.style.height], ['32px', '32px']);
    const busy = played(m, instance(m, { loading: true })).el;
    assert.equal(busy.children.length, 1, 'the spinner replaces the icon');
    assert.ok(busy.children[0].style.animation, 'the spinner turns');
    assert.equal(busy.attrs['data-blocked'], true);
});

test('Play draws the host with a dash pattern on its border without a padding token (an SVG-drawn border)', () => {
    const m = master();
    const nodes = instance(m, {});
    Object.assign(nodes[0], { stroke: '#18181b', strokeWidth: 1, strokeAlign: 'inside', strokeDash: 3, strokeGap: 2, vars: {} });
    assert.doesNotThrow(() => played(m, nodes));
});
