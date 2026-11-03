// A condition may be `{ any: [...] }`: it holds when one of its conditions does (`all` holds when every one does). Needed where a prop shows for either of two
// switches: the Button's icon placement says where the icon goes and where the spinner goes, so it shows while hasIcon or loading is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionHolds, conditionProps } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const either = { any: [{ prop: 'hasIcon', is: true }, { prop: 'loading', is: true }] };

test('any holds when one condition holds, all when each does, and they nest', () => {
    assert.equal(conditionHolds(either, { hasIcon: false, loading: false }), false);
    assert.equal(conditionHolds(either, { hasIcon: true, loading: false }), true);
    assert.equal(conditionHolds(either, { hasIcon: false, loading: true }), true);
    assert.equal(conditionHolds({ all: [either, { prop: 'x', empty: true }] }, { loading: true, x: '' }), true);
    assert.equal(conditionHolds({ all: [either, { prop: 'x', empty: true }] }, { loading: true, x: 'a' }), false);
    assert.deepEqual(conditionProps({ all: [either, { prop: 'x', empty: true }] }), ['hasIcon', 'loading', 'x']);
});

test('the validator holds an any condition to the same rules: a non-empty list of valid conditions', () => {
    const withCond = cond => ({ ...structuredClone(TEMPLATES.get('button')), props: { ...structuredClone(TEMPLATES.get('button').props), iconPlacement: { ...TEMPLATES.get('button').props.iconPlacement, visibleIf: cond } } });
    assert.deepEqual(validateTemplateSchema(withCond(either)), []);
    assert.match(validateTemplateSchema(withCond({ any: [] })).join('\n'), /"any" must be a non-empty list of conditions/);
    assert.match(validateTemplateSchema(withCond({ any: [{ prop: 'nope', is: true }] })).join('\n'), /unknown prop "nope"/);
});

test('the Button shows its placement while it has an icon or is loading, so the spinner has a side with no icon', () => {
    const button = TEMPLATES.get('button');
    assert.deepEqual(button.props.iconPlacement.visibleIf, either);
    assert.equal(resolveProps(button, { iconPlacement: 'end', loading: true }).iconPlacement, 'end');
    assert.equal(resolveProps(button, { iconPlacement: 'end', hasIcon: true }).iconPlacement, 'end');
    assert.equal(resolveProps(button, { iconPlacement: 'end' }).iconPlacement, 'start', 'neither: the default');
});

test('the export reads an any condition as ||', async () => {
    const { inputModel } = await import('../../../scripts/input-model.mjs');
    const input = structuredClone(TEMPLATES.get('input'));
    input.anatomy.find(slot => slot.id === 'prefixText').shownWhen = { any: [{ prop: 'hasPrefix', is: true }, { prop: 'hasSuffix', is: true }] };
    const model = inputModel();
    const jsx = generateComponent(input, model.binding, { collections: model.collections, items: model.items }, 'Input', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []).files['Input.jsx'];
    assert.match(jsx, /(hasPrefix === true) || (hasSuffix === true)/);
});
