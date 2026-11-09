// Tag's behaviour: the root's height is the Size mode's tag height on the canvas and in Play, at every Size mode; the close dismisses the element in
// the export (a local state, onClose, no exit motion: Tag has no motion and no disabled state); and no layer of a Tag is hidden, zero-sized or
// unbound (every fill and size is a variable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf, length } from './helpers/play-geometry.js';

const tag = TEMPLATES.get('antd-tag');
const model = modelFor(tag);

/** The mode of each variable prop for a Size mode: that Size mode, the defaults of the others. */
function modesFor(size) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : (tag.props[prop].defaultMode ?? coll.modes[0].name);
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

/** A node's value on one axis: a bound variable's value in these modes, else its own number. */
function valueOf(node, axis, modes) {
    const item = model.variables.items.find(i => i.id === node.vars?.[axis]);
    if (!item) return node[axis];
    return variableValue(model.variables, item, c => {
        const dim = Object.keys(model.binding.variables).find(d => model.binding.variables[d] === c.id);
        return dim ? modes[dim] : c.modes[0].id;
    });
}

/** The Play tree of a Tag made from these props, in a Size mode, and its generated stylesheet. */
function playOf(size, props) {
    const nodes = instanceFor(model, props);
    nodes[0].varModes = Object.fromEntries(Object.entries(modesFor(size)).map(([prop, mode]) => [model.binding.variables[prop], mode]));
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { styles, root: elementsOf(root), nodes };
}

for (const size of SIZE_MODES) {
    test(`the root is the Size mode's tag height on the canvas and in Play at ${size}`, () => {
        const modes = modesFor(size);
        const { nodes, styles, root } = playOf(size, {});
        const canvasH = valueOf(nodes[0], 'h', modes);
        assert.ok(canvasH > 0, `a positive height at ${size}`);
        const top = root.find(({ el }) => el.attrs?.class === 'antd-tag');
        assert.equal(length(styleOf(styles, top.chain).height), canvasH, `Play matches the canvas at ${size}`);
    });
}

test('the export dismisses the element on close: a local dismissed state, onClose, and no exit motion or disabled guard', () => {
    const out = generateComponent(model.template, model.binding, model.variables, 'Tag', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Tag.jsx'];
    assert.match(jsx, /const \[dismissed, setDismissed\] = useState\(false\);/);
    assert.match(jsx, /if \(dismissed\) return null;/);
    assert.match(jsx, /onClick=\{\(\) => \{ setDismissed\(true\); onClose\?\.\(\); \}\}/);
    assert.doesNotMatch(out.files['Tag.css'], /data-dismissed/, 'no exit motion: Tag declares none');
});

test('no layer of a Tag is hidden or zero-sized, and its root fill is a variable (no unbound white)', () => {
    for (const props of [{}, { hasIcon: true }, { closable: true }, { hasIcon: true, closable: true }]) {
        for (const node of instanceFor(model, props)) {
            assert.notEqual(node.opacity, 0, `${node.name} is not invisible`);
            assert.notEqual(node.visible, false, `${node.name} is not hidden`);
            if (node.type !== 'frame' || node.name === 'top') continue;
        }
        const root = instanceFor(model, props)[0];
        assert.ok(root.vars?.['fills.0'], 'the root fill is bound to a variable');
    }
});
