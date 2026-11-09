// NO HIDDEN LAYERS, as an instance tree: every managed slot of an instance is one layer exactly while its condition (shownWhen) holds at the
// instance's props, never a layer the active type or state does not use, and no slot has two layers. Checked per Badge type and toggle, and on the
// default instance of every built-in template and of the Input's password kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { conditionHolds } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

/** The problems of one instance under these props: a conditional slot that is present while its condition fails, absent while it holds, or twice. */
function unusedLayersOf(template, props) {
    const model = modelFor(template);
    const nodes = instanceFor(model, props).slice(1);
    const resolved = resolveProps(template, { ...template.sampleProps, ...props });
    const problems = [];
    for (const slot of template.anatomy) {
        const present = nodes.filter(n => n.behavior?.slot === slot.id).length;
        if (present > 1) problems.push(`${slot.id} has ${present} layers`);
        if (slot.shownWhen === undefined) continue;
        const wanted = conditionHolds(slot.shownWhen, resolved);
        if (present === 1 && !wanted) problems.push(`${slot.id} is a layer while its condition fails`);
        if (present === 0 && wanted) problems.push(`${slot.id} has no layer while its condition holds`);
    }
    return problems;
}

const badge = BUILT_IN_TEMPLATES.get('antd-badge');
const BADGE_CASES = [
    { type: 'count', count: 5 }, { type: 'count', count: 0 }, { type: 'count', count: 0, showZero: true },
    { type: 'dot' }, { type: 'status', hasText: true, label: 'Syncing' }, { type: 'status', hasText: false },
];
for (const props of BADGE_CASES) {
    test(`Badge ${JSON.stringify(props)}: the instance holds exactly the layers its type and toggles use, no unused pill`, () => {
        assert.deepEqual(unusedLayersOf(badge, props), []);
    });
}

for (const template of BUILT_IN_TEMPLATES.values()) {
    test(`${template.id}: the default instance holds no unused layer`, () => {
        assert.deepEqual(unusedLayersOf(template, {}), []);
    });
}

test('input (password): the eye box and one eye per state, no unused layer', () => {
    const input = BUILT_IN_TEMPLATES.get('input');
    assert.deepEqual(unusedLayersOf(input, { kind: 'password', passwordVisible: true }), []);
    assert.deepEqual(unusedLayersOf(input, { kind: 'password', passwordVisible: false }), []);
});
