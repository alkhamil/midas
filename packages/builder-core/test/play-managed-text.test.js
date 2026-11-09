// A managed text layer of an instance is drawn in Play as the export draws it: the element carries its template class (<template>-<slot>), and its
// bound typography comes from the stylesheet's rule, not from an inline size the node keeps from its master (the canvas reads the variable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf } from './helpers/play-geometry.js';

/** An instance of a template under props, its managed layers bound as the studio binds them, and its Play tree with the stylesheet. */
function playOf(id, props) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    const nodes = instanceFor(model, props);
    const layers = nodes.slice(1).filter(n => n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    const { ops } = planManagedTextBindings({ template, binding: model.binding, props: resolveProps(template, props), layers, variables: model.variables });
    applyBindTokens(layers, ops);
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    return { root, styles, found: elementsOf(root) };
}

test('the Badge count text carries its template class and its size comes from the stylesheet (text-xs, 10px)', () => {
    const { styles, found } = playOf('antd-badge', { type: 'count', count: 5 });
    const pill = found.find(({ el }) => el.attrs?.class === 'antd-badge-pill');
    const text = found.find(({ el, chain }) => chain.includes(pill.el) && el !== pill.el);
    assert.equal(text.el.attrs?.class, 'antd-badge-countText');
    assert.equal(text.el.style.fontSize, undefined, 'no inline size: the bound typography is the stylesheet\'s');
    assert.equal(styleOf(styles, text.chain)['font-size'], '10px');
});

test('the Checkbox label carries its template class and no inline size of its master', () => {
    const { found } = playOf('checkbox', { label: 'Accept' });
    const label = found.find(({ el }) => el.text === 'Accept');
    assert.equal(label.el.attrs?.class, 'checkbox-label');
    assert.equal(label.el.style.fontSize, undefined);
});
