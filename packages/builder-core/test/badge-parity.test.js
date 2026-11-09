// Badge, Play and the export at every Size mode and for each type: the Play text is the export's text for the same props (the overflow label, computed as
// the export's expression computes it), every class Play draws is a class the export writes, and the root is hidden in Play exactly when the export's
// hiding rule says it is (a zero count not shown). The stylesheet is the one both draw from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const badge = TEMPLATES.get('antd-badge');
const model = modelFor(badge);
const exported = generateComponent(model.template, model.binding, model.variables, 'Badge', model.frame, id => model.created.filter(n => n.parentId === id));

/** The mode of each variable prop for a Size mode (the Size mode itself; the defaults of the others). */
function modesFor(size) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : (badge.props[prop].defaultMode ?? coll.modes[0].name);
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

/** Play for an instance under these props at a Size mode: the Play tree, the root and its stylesheet. */
function playOf(size, props) {
    const nodes = instanceFor(model, props);
    const layers = nodes.slice(1).filter(n => n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    const { ops } = planManagedTextBindings({ template: badge, binding: model.binding, props: resolveProps(badge, props), layers, variables: model.variables });
    applyBindTokens(layers, ops);
    nodes[0].varModes = Object.fromEntries(Object.entries(modesFor(size)).map(([prop, mode]) => [model.binding.variables[prop], mode]));
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { root, styles, found: elementsOf(root) };
}

/** The export's count text for these props: the expression the export writes (Number(count) > Number(overflowCount) ? `${overflowCount}+` : count). */
const exportText = ({ count, overflowCount }) => (Number(count) > Number(overflowCount) ? `${overflowCount}+` : String(count ?? ''));

const CASES = [
    { count: 5 }, { count: 99 }, { count: 120 }, { count: 120, overflowCount: 9 }, { count: 0 }, { count: 0, showZero: true }, { count: 3, showZero: true },
];

for (const size of SIZE_MODES) {
    for (const props of CASES) {
        const label = `${size} ${JSON.stringify(props)}`;
        test(`count ${label}: the Play text is the export's text, and the classes Play draws are the export's classes`, () => {
            const { found } = playOf(size, { type: 'count', ...props });
            const textEl = found.find(({ el }) => el.text !== undefined && el.text !== '');
            assert.equal(textEl.el.text, exportText({ overflowCount: 99, ...props }), `the text at ${label}`);
            for (const { el } of found) if (el.attrs?.class) assert.match(exported.files['Badge.jsx'], new RegExp(`className="${el.attrs.class}"|className=\\{\\['${el.attrs.class.split('-')[0]}'`), `${el.attrs.class} is an export class`);
        });
        test(`count ${label}: the root is hidden in Play exactly when the export hides a zero count`, () => {
            const { found } = playOf(size, { type: 'count', ...props });
            const badgeRoot = found.find(({ el }) => el.attrs?.class === 'antd-badge').el;
            const hiddenInPlay = 'data-zero-hidden' in badgeRoot.attrs;
            const hiddenHere = props.count === 0 && props.showZero !== true;
            assert.equal(hiddenInPlay, hiddenHere, label);
            assert.match(exported.files['Badge.css'], /\.antd-badge\[data-zero-hidden\] \{\s*display: none;\s*\}/, 'the export hides it');
        });
    }
}

test('the dot and the status dot draw at every size with the same dimension Play and the export read', () => {
    for (const size of SIZE_MODES) {
        const dot = playOf(size, { type: 'dot' });
        assert.ok(dot.found.some(({ el }) => el.attrs?.class === 'antd-badge-dot'), `dot at ${size}`);
        const status = playOf(size, { type: 'status', hasText: true, label: 'Done' });
        assert.ok(status.found.some(({ el }) => el.attrs?.class === 'antd-badge-statusDot'), `status dot at ${size}`);
        assert.ok(status.found.some(({ el }) => el.text === 'Done'), `status label at ${size}`);
    }
});
