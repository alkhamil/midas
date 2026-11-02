// A prop is shown under one condition or several: `visibleIf` takes the same `{ prop, is }` or `{ all: [...] }` a text slot's `shownWhen`
// takes, so a prop can depend on a switch and on a mode together (the Input's prefix text: the prefix is on and its content is Text).
// An enum may ask the panel for a segmented control (`control: 'segmented'`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { isPropVisible, resolveProps, setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { BUTTON } from '../src/templates/button.js';

const clone = o => structuredClone(o);

/** Button with a prop that shows only while the icon is on and the placement is `end`. */
function withBoth() {
    const t = clone(BUTTON);
    t.props.endNote = { source: 'literal', type: 'string', default: '', visibleIf: { all: [{ prop: 'hasIcon', is: true }, { prop: 'iconPlacement', is: 'end' }] }, remembered: true };
    return t;
}

test('a prop with an all-condition is shown only while every test holds', () => {
    const t = withBoth();
    assert.equal(isPropVisible(t, 'endNote', { hasIcon: true, iconPlacement: 'end' }), true);
    assert.equal(isPropVisible(t, 'endNote', { hasIcon: true, iconPlacement: 'start' }), false);
    assert.equal(isPropVisible(t, 'endNote', { hasIcon: false, iconPlacement: 'end' }), false);
});

test('a hidden prop with an all-condition is refused a write, and a remembered one keeps its value', () => {
    const t = withBoth();
    assert.throws(() => setInstanceProp(t, {}, 'endNote', 'x'), /hidden by visibleIf/);
    const shown = setInstanceProp(t, { hasIcon: true, iconPlacement: 'end' }, 'endNote', 'x');
    assert.equal(shown.endNote, 'x');
    const moved = setInstanceProp(t, shown, 'iconPlacement', 'start');
    assert.equal(moved.endNote, 'x', 'remembered while the placement hides it');
    assert.equal(resolveProps(t, moved).endNote, '', 'but it resolves to the default while hidden');
});

test('the schema accepts an all-condition in visibleIf', () => {
    assert.deepEqual(validateTemplateSchema(withBoth()), []);
});

test('an all-condition in visibleIf is checked test by test', () => {
    const empty = withBoth();
    empty.props.endNote.visibleIf = { all: [] };
    assert.match(validateTemplateSchema(empty).join('\n'), /"endNote" visibleIf "all" must be a non-empty list/);
    const unknown = withBoth();
    unknown.props.endNote.visibleIf = { all: [{ prop: 'hasIcon', is: true }, { prop: 'nope', is: true }] };
    assert.match(validateTemplateSchema(unknown).join('\n'), /"endNote" visibleIf refers to unknown prop "nope"/);
    const notBoolOrEnum = withBoth();
    notBoolOrEnum.props.endNote.visibleIf = { all: [{ prop: 'label', is: 'x' }] };
    assert.match(validateTemplateSchema(notBoolOrEnum).join('\n'), /"endNote" visibleIf tests "label" with "is", which needs a boolean or enum prop/);
    const variable = withBoth();
    variable.props.endNote.visibleIf = { prop: 'variant', is: 'solid' };
    assert.match(validateTemplateSchema(variable).join('\n'), /"endNote" visibleIf tests "variant", which is not a literal prop/);
});

test('a remembered prop still needs a visibleIf, with the all form too', () => {
    const t = withBoth();
    delete t.props.endNote.visibleIf;
    assert.match(validateTemplateSchema(t).join('\n'), /endNote.*remembered but has no visibleIf/);
});

test('an enum may ask for a segmented control; any other prop, or an unknown control, is refused', () => {
    const ok = clone(BUTTON);
    ok.props.iconPlacement.control = 'segmented';
    assert.deepEqual(validateTemplateSchema(ok), []);
    const onBoolean = clone(BUTTON);
    onBoolean.props.hasIcon.control = 'segmented';
    assert.match(validateTemplateSchema(onBoolean).join('\n'), /prop "hasIcon" control "segmented" needs an enum prop/);
    const unknown = clone(BUTTON);
    unknown.props.iconPlacement.control = 'dial';
    assert.match(validateTemplateSchema(unknown).join('\n'), /prop "iconPlacement" control "dial" is not segmented/);
    const many = clone(BUTTON);
    many.props.iconPlacement.options = ['start', 'end', 'top', 'bottom', 'left'];
    many.props.iconPlacement.control = 'segmented';
    assert.match(validateTemplateSchema(many).join('\n'), /prop "iconPlacement" control "segmented" takes 2 to 3 options/);
});
