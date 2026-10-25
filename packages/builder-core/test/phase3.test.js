// Phase 3: capabilities and slots, Convention, presets, Select logic, Ant style field rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateByRules, validateInput, normalizeFieldRules, patternProblem } from '../src/validate.js';
import { DEFAULT_CONVENTION, cleanConvention, matchScore, suggestSlots, suggestStates, suggestPreset } from '../src/convention.js';
import { CAPABILITIES, PRESETS, PRESET_MAP, PRESET_FAMILIES, applicability, inputSummary, normalizeBehaviors, normalizeOverrides, planPreset, resolveBehaviors, slotIssues, summaryOf, BEHAVIOR_KINDS } from '../src/capabilities.js';
import { filterOptions, hasValue, itemStates, normalizeOptions, optionsText, parseOptions, pickOption, removeValue, selectedLabels, showsEmpty, toValue, validateSelection, valueText } from '../src/select.js';
import { normalizeInputBehavior, normalizeInteractions, TRIGGERS } from '../src/behavior.js';

// ---------- Ant style rules ----------
test('rules: required, type, length, range, pattern, custom message', () => {
    const v = (rules, value, opts) => validateByRules(rules, value, { label: 'Email', ...opts });
    assert.equal(v({ required: true }, '').reason, 'required');
    assert.equal(v({ required: true }, '  ', { touched: false }).valid, true);          // never touched
    assert.equal(v({ required: true }, '', { touched: false, strict: true }).valid, false);
    assert.equal(v({ type: 'email' }, 'a@b.co').valid, true);
    assert.equal(v({ type: 'email' }, 'nope').reason, 'email');
    assert.equal(v({ type: 'url' }, 'https://x.io/a').valid, true);
    assert.equal(v({ type: 'url' }, 'x.io').reason, 'url');
    assert.equal(v({ type: 'integer' }, '4.5').reason, 'integer');
    assert.equal(v({ type: 'number' }, 'abc').reason, 'number');
    assert.equal(v({ min: 3 }, 'ab').reason, 'min');
    assert.equal(v({ max: 3 }, 'abcd').reason, 'max');
    assert.equal(v({ len: 4 }, 'abc').reason, 'len');
    assert.equal(v({ len: 4 }, 'abcd').valid, true);
    assert.equal(v({ type: 'number', min: 18 }, '17').reason, 'min');                   // numbers: the value, not the length
    assert.equal(v({ type: 'number', max: 10 }, '11').reason, 'max');
    assert.equal(v({ pattern: '^[A-Z]+$' }, 'abc').reason, 'pattern');
    assert.equal(v({ pattern: '^[A-Z]+$' }, 'ABC').valid, true);
    assert.equal(v({ pattern: '(' }, 'x').valid, true);                                   // a broken pattern never blocks (the editor reports it)
    assert.equal(v({ required: true, message: 'Tell us your email' }, '').message, 'Tell us your email');
    assert.match(v({ min: 3 }, 'ab').message, /^Email must be at least 3 characters/);
});

test('rules: a list counts its picks (multiple Select)', () => {
    assert.equal(validateByRules({ required: true }, [], { strict: true }).reason, 'required');
    assert.equal(validateByRules({ min: 2 }, ['a']).reason, 'min');
    assert.match(validateByRules({ min: 2 }, ['a'], { label: 'Tags' }).message, /at least 2 items/);
    assert.equal(validateByRules({ max: 2 }, ['a', 'b', 'c']).reason, 'max');
    assert.equal(validateByRules({ len: 1 }, ['a']).valid, true);
    assert.equal(validateSelection({ required: true, min: 1 }, ['x'], 'Country').valid, true);
});

test('rules: normalize, pattern check, and validateInput still answers like before', () => {
    assert.deepEqual(normalizeFieldRules({ required: 1, type: 'email', min: '3', max: '', len: 'x', pattern: '^a', junk: 1 }), { required: true, type: 'email', min: 3, pattern: '^a' });
    assert.deepEqual(normalizeFieldRules({ type: 'string' }), {});
    assert.deepEqual(normalizeFieldRules(undefined), {});
    assert.equal(patternProblem('^ok$'), null);
    assert.match(patternProblem('('), /./);
    assert.equal(validateInput({ inputType: 'email' }, 'nope').reason, 'email');
    assert.equal(validateInput({ inputType: 'number' }, 'x').reason, 'number');
    assert.equal(validateInput({ required: true }, '', { strict: true }).reason, 'required');
    assert.equal(validateInput({ inputType: 'text', rules: { min: 5 } }, 'abc').reason, 'rule');
    assert.equal(validateInput({ inputType: 'text', rules: { required: true } }, '', { strict: true }).valid, false);
});

test('old inputBehavior data is read as before; rules and the off switch are kept', () => {
    const old = { typeable: { frameId: 'f1', inputType: 'email' }, validation: { required: true, trigger: 'blur' } };
    assert.deepEqual(normalizeInputBehavior(old), { typeable: { frameId: 'f1', inputType: 'email', showIconId: undefined, hideIconId: undefined }, validation: { required: true, trigger: 'blur' } });
    const now = normalizeInputBehavior({ typeable: { inputType: 'text' }, validation: { rules: { required: true, min: '2', bogus: 1 }, trigger: 'submit', off: true } });
    assert.deepEqual(now.validation, { required: false, trigger: 'submit', rules: { required: true, min: 2 }, off: true });
    assert.equal(normalizeInputBehavior({ validation: { rules: {} } }).validation.rules, undefined);
    assert.ok(['onFinish', 'onFinishFailed', 'onSearch', 'onOpenChange', 'onClick', 'onChange'].every(t => TRIGGERS.some(x => x.id === t)));
    assert.equal(normalizeInteractions([{ trigger: 'onFinishFailed', actions: [{ type: 'list-clear' }] }])[0].trigger, 'onFinishFailed');
});

// ---------- Convention ----------
test('convention: defaults fill what the file did not set, and cleaning twice changes nothing', () => {
    const c = cleanConvention({ slots: { value: ['Typed Text', 'typed text'], bogus: ['x'] }, states: { loading: [] }, feedback: { alert: 'cmpA', junk: 'z' } });
    assert.deepEqual(c.slots.value, ['typed text']);                  // normalized and de-duplicated
    assert.deepEqual(c.states.loading, DEFAULT_CONVENTION.states.loading);
    assert.equal(c.slots.bogus, undefined);
    assert.equal(c.feedback.alert, 'cmpA');
    assert.equal(c.feedback.junk, undefined);
    assert.equal(c.feedback.modal, '');
    assert.deepEqual(cleanConvention(c), c);
    assert.deepEqual(cleanConvention(undefined), cleanConvention({}));
});

test('convention: name matching scores exact > edge > word', () => {
    const names = ['value', 'selected'];
    assert.equal(matchScore('Value', names), 3);
    assert.equal(matchScore('Input Value', names), 2);
    assert.equal(matchScore('selectedValue', names), 2);              // camelCase is split
    assert.equal(matchScore('The value text', names), 1);
    assert.equal(matchScore('Valuable', names), 0);
    assert.equal(matchScore('', names), 0);
});

const layers = [
    { id: 'l1', name: 'Value', type: 'text' }, { id: 'l2', name: 'Placeholder', type: 'text' }, { id: 'l3', name: 'Arrow icon', type: 'frame' },
    { id: 'l4', name: 'Chip', type: 'frame' }, { id: 'l5', name: 'Label', type: 'text' }, { id: 'l6', name: 'Frame 12', type: 'frame' }, { id: 'l7', name: 'text', type: 'text' },
];
test('convention: one layer per role, text roles take text layers, mapped roles are left alone', () => {
    const roles = [{ role: 'value', kind: 'text' }, { role: 'placeholder', kind: 'text' }, { role: 'icon', kind: 'any' }, { role: 'chip', kind: 'frame' }, { role: 'popup', kind: 'component' }, { role: 'label', kind: 'text' }];
    const s = suggestSlots(roles, layers, undefined);
    const by = Object.fromEntries(s.map(x => [x.role, x.layerId]));
    assert.deepEqual(by, { value: 'l1', placeholder: 'l2', icon: 'l3', chip: 'l4', label: 'l5' });
    assert.equal(by.popup, undefined);                                // a component slot is not a layer
    assert.equal(new Set(s.map(x => x.layerId)).size, s.length);
    assert.deepEqual(suggestSlots([{ role: 'value', kind: 'text' }], layers, undefined, { value: 'l9' }), []);   // already mapped
    assert.equal(suggestSlots([{ role: 'icon', kind: 'text' }], [{ id: 'f', name: 'Icon', type: 'frame' }], undefined).length, 0);   // kind mismatch
    // the file's own names win
    const own = suggestSlots([{ role: 'value', kind: 'text' }], [{ id: 'z', name: 'Typed text', type: 'text' }, { id: 'y', name: 'Value', type: 'text' }], { slots: { value: ['typed text'] } });
    assert.equal(own[0].layerId, 'z');
});

test('convention: states of a collection and the preset of a component name', () => {
    const modes = [{ id: 'm1', name: 'Default' }, { id: 'm2', name: 'Hover' }, { id: 'm3', name: 'Pressed' }, { id: 'm4', name: 'Disabled' }, { id: 'm5', name: 'Loading' }, { id: 'm6', name: 'Weird' }];
    assert.deepEqual(suggestStates(modes, undefined), { default: 'm1', hover: 'm2', pressed: 'm3', disabled: 'm4', loading: 'm5' });
    assert.equal(suggestPreset('Button / Primary', PRESETS), 'button');
    assert.equal(suggestPreset('Select', PRESETS), 'select');
    assert.equal(suggestPreset('Modal/Dialog', PRESETS), 'modal');
    assert.equal(suggestPreset('Frame 12', PRESETS), null);
});

// ---------- capabilities ----------
test('behaviors: only known kinds, one per kind, slots and config cleaned', () => {
    const list = normalizeBehaviors([
        { kind: 'has-options', slots: { value: 'a', bogus: 'x', chip: 5 }, config: { mode: 'multiple', options: ['a', { value: 'b', label: 'Bee' }], junk: 1 } },
        { kind: 'has-options' }, { kind: 'bogus' }, { kind: 'can-type' }, null,
        { kind: 'opens-popup', slots: { popup: 'cmp1' }, config: { placement: 'left-end', trigger: 'hover' } },
    ]);
    assert.deepEqual(list.map(b => b.kind), ['has-options', 'opens-popup']);       // can-type lives in inputBehavior, not here
    assert.deepEqual(list[0].slots, { value: 'a' });
    assert.deepEqual(list[0].config, { mode: 'multiple', showSearch: false, allowClear: false, options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'Bee' }] });
    assert.equal(list[1].config.placement, 'left-end');
    assert.equal(list[1].config.trigger, 'hover');
    assert.equal(new Set(list.map(b => b.id)).size, 2);
    assert.deepEqual(normalizeBehaviors(list), list);                                // idempotent
    assert.deepEqual(normalizeBehaviors(undefined), []);
});

test('instances inherit the master and store only overrides', () => {
    const master = normalizeBehaviors([{ id: 'b1', kind: 'has-options', slots: { value: 'v', placeholder: 'p' }, config: { options: ['x', 'y'] } }, { id: 'b2', kind: 'opens-popup', slots: { popup: 'menu' } }]);
    assert.deepEqual(resolveBehaviors(master, undefined), master);                    // no overrides: the master's
    const r = resolveBehaviors(master, { b1: { slots: { value: 'v2', placeholder: '' }, config: { mode: 'multiple' } }, b2: { enabled: false }, ghost: { enabled: false } });
    assert.equal(r[0].slots.value, 'v2');
    assert.equal(r[0].slots.placeholder, undefined);                                  // cleared on this instance
    assert.equal(r[0].config.mode, 'multiple');
    assert.deepEqual(r[0].config.options.map(o => o.value), ['x', 'y']);              // not overridden: inherited
    assert.equal(r[1].enabled, false);
    assert.equal(r.length, 2);
    assert.equal(master[0].slots.value, 'v');                                         // the master is untouched
    assert.deepEqual(normalizeOverrides({ b1: { enabled: true, slots: { value: 'a', bogus: 'b' }, junk: 1 }, b2: {}, b3: null }), { b1: { enabled: true, slots: { value: 'a' } } });
});

test('unmapped required slots are reported, with the reason', () => {
    const [b] = normalizeBehaviors([{ kind: 'has-options', slots: {} }]);
    assert.deepEqual(slotIssues(b).map(i => i.role), ['value']);
    assert.match(slotIssues(b)[0].why, /Value is not set/);
    const [m] = normalizeBehaviors([{ kind: 'has-options', slots: { value: 'gone' } }]);
    assert.match(slotIssues(m, id => id !== 'gone')[0].why, /is gone/);
    assert.deepEqual(slotIssues(m, () => true), []);
    const [p] = normalizeBehaviors([{ kind: 'opens-popup', slots: { popup: 'cmp' } }]);
    assert.deepEqual(slotIssues(p, () => false), []);                                 // a popup is a component, not a layer of this one
    assert.equal(slotIssues(normalizeBehaviors([{ kind: 'opens-popup' }])[0])[0].role, 'popup');
});

test('capabilities only show where they make sense', () => {
    const text = [{ id: 't', name: 'Label', type: 'text' }], none = [{ id: 'f', name: 'Box', type: 'frame' }];
    const ctx = (layers, has = [], states = []) => ({ layers, has: k => has.includes(k), hasState: s => states.includes(s) });
    assert.equal(applicability('can-type', ctx(text)).ok, true);
    assert.match(applicability('can-type', ctx(none)).reason, /text layer/);
    assert.equal(applicability('can-type', ctx(text, ['can-type'])).reason, 'Already added.');
    assert.match(applicability('has-validation', ctx(text)).reason, /Can type or Has options first/);
    assert.equal(applicability('has-validation', ctx(text, ['has-options'])).ok, true);
    assert.equal(applicability('has-validation', ctx(text, ['can-type'])).ok, true);
    assert.equal(applicability('on-click', ctx(none)).ok, true);
    assert.match(applicability('has-loading', ctx(none, ['on-click'])).reason, /loading/);
    assert.equal(applicability('has-loading', ctx(none, ['on-click'], ['loading'])).ok, true);
    assert.match(applicability('has-loading', ctx(none, [], ['loading'])).reason, /On click first/);
    assert.equal(applicability('opens-popup', ctx(none)).ok, true);
    assert.equal(applicability('show-feedback', ctx(none)).ok, false);
    assert.equal(applicability('nope', ctx(text)).ok, false);
});

test('one-line summaries', () => {
    const [o, p, l, f] = normalizeBehaviors([
        { kind: 'has-options', config: { mode: 'multiple', showSearch: true, options: ['a', 'b'] } }, { kind: 'opens-popup', slots: { popup: 'c' }, config: { matchWidth: true } },
        { kind: 'has-loading' }, { kind: 'show-feedback', config: { kind: 'modal' } }]);
    assert.equal(summaryOf(o), 'Multiple · 2 options · search');
    assert.equal(summaryOf(p, () => 'Dropdown Menu'), 'Opens “Dropdown Menu” bottom, same width');
    assert.equal(summaryOf(l), 'Switches to “loading” while a request runs');
    assert.match(summaryOf(f), /^modal/);
    assert.equal(inputSummary('has-validation', { validation: { rules: { required: true, type: 'email', min: 3 } } }), 'Required, email format, min 3');
    assert.equal(inputSummary('has-validation', { validation: { required: true } }), 'Required');
    assert.equal(inputSummary('has-validation', {}), 'No rules yet');
    assert.equal(inputSummary('can-type', { typeable: { inputType: 'email' } }), 'Email · pick the value layer');
});

// ---------- presets ----------
test('presets: every family, only known capabilities, Ant names, events', () => {
    assert.deepEqual(PRESET_FAMILIES, ['Trigger', 'Text entry', 'Choice', 'Navigation', 'Data', 'Feedback']);
    for (const p of PRESETS) {
        assert.ok(PRESET_FAMILIES.includes(p.family), p.id);
        for (const c of p.caps) assert.ok(CAPABILITIES[c.kind], `${p.id}: ${c.kind}`);
        const plan = planPreset(p.id);
        assert.equal(plan.preset, p.id);
        for (const b of plan.behaviors) assert.ok(BEHAVIOR_KINDS.includes(b.kind));
    }
    const labels = PRESETS.map(p => p.label);
    for (const n of ['Button', 'FloatButton', 'Input', 'Input.TextArea', 'Input.Password', 'Input.Search', 'InputNumber', 'AutoComplete', 'Select', 'Radio', 'Checkbox', 'Switch', 'Segmented', 'Alert', 'Message', 'Notification', 'Modal', 'Drawer', 'Popconfirm'])
        assert.ok(labels.includes(n), n);
    assert.ok(PRESET_MAP['input-search'].events.includes('onSearch'));
});

test('presets: a preset is a bundle, nothing is hardcoded', () => {
    const b = planPreset('button');
    assert.deepEqual(b.behaviors.map(x => x.kind), ['has-loading']);                  // On click is the onClick interaction, not stored
    assert.deepEqual(b.events, ['onClick']);
    const i = planPreset('input');
    assert.equal(i.input.typeable.inputType, 'text');
    assert.deepEqual(i.input.validation.rules, {});
    assert.equal(planPreset('input-password').input.typeable.inputType, 'password');
    assert.equal(planPreset('input-password').input.validation.rules.required, true);
    assert.equal(planPreset('input-search').input.typeable.inputType, 'search');
    assert.equal(planPreset('input-search').input.validation, undefined);
    assert.equal(planPreset('input-number').input.validation.rules.type, 'number');
    const s = planPreset('select-multiple');
    assert.deepEqual(s.behaviors.map(x => x.kind), ['has-options', 'opens-popup']);
    assert.equal(s.behaviors[0].config.mode, 'multiple');
    assert.equal(s.behaviors[0].config.showSearch, true);
    assert.equal(s.input.validation.trigger, 'blur');
    assert.equal(planPreset('select').behaviors[0].config.mode, 'single');
    assert.equal(planPreset('switch').interactions[0].actions[0].mode, 'toggle');
    assert.equal(planPreset('radio').interactions[0].actions[0].mode, 'exclusive');
    assert.equal(planPreset('modal').behaviors[0].config.kind, 'modal');
    assert.equal(planPreset('notification').behaviors[0].config.kind, 'notification');
    assert.equal(planPreset('nope'), null);
    // a plan is a copy: using it twice never shares objects
    assert.notStrictEqual(planPreset('radio').interactions, planPreset('radio').interactions);
});

// ---------- Select ----------
const opts = normalizeOptions(['apple', { value: 'banana', label: 'Banana' }, { value: 'cherry', label: 'Cherry', disabled: true }, 'apple', '', null]);
test('select: options, search and the empty slot', () => {
    assert.deepEqual(opts.map(o => o.value), ['apple', 'banana', 'cherry']);
    assert.equal(opts[2].disabled, true);
    assert.deepEqual(parseOptions('a, b=Bee, ,a').map(o => [o.value, o.label]), [['a', 'a'], ['b', 'Bee']]);
    assert.equal(optionsText(parseOptions('a, b=Bee')), 'a, b=Bee');
    assert.deepEqual(filterOptions(opts, 'AN').map(o => o.value), ['banana']);
    assert.equal(filterOptions(opts, '  ').length, 3);
    assert.equal(showsEmpty(opts, 'zzz'), true);
    assert.equal(showsEmpty(opts, 'a'), false);
});

test('select: single picks set the value and close; multiple toggles and stays open', () => {
    let r = pickOption('single', '', opts[0]);
    assert.deepEqual(r, { value: 'apple', closes: true, changed: true });
    assert.equal(pickOption('single', 'apple', opts[0]).changed, false);              // same pick: closes, nothing changed
    assert.equal(pickOption('single', 'apple', opts[2]).value, 'apple');             // disabled does nothing
    assert.equal(pickOption('single', 'apple', opts[2]).closes, false);
    r = pickOption('multiple', [], opts[0]);
    assert.deepEqual(r, { value: ['apple'], closes: false, changed: true });
    r = pickOption('multiple', r.value, opts[1]);
    assert.deepEqual(r.value, ['apple', 'banana']);
    assert.deepEqual(pickOption('multiple', r.value, opts[0]).value, ['banana']);    // toggled off
    assert.equal(pickOption('multiple', ['apple'], opts[2]).changed, false);
    assert.deepEqual(removeValue('multiple', ['apple', 'banana'], 'apple'), ['banana']);
    assert.equal(removeValue('single', 'apple', 'apple'), '');
    assert.deepEqual(toValue('multiple', 'a'), ['a']);
    assert.equal(toValue('single', ['a', 'b']), 'a');
    assert.equal(hasValue([]), false);
    assert.equal(hasValue('x'), true);
});

test('select: labels, the value slot text, and the look of each row', () => {
    assert.deepEqual(selectedLabels(opts, ['banana', 'gone']), ['Banana', 'gone']);
    assert.equal(valueText(opts, 'banana'), 'Banana');
    assert.equal(valueText(opts, []), '');
    assert.deepEqual(itemStates(opts, ['apple'], 1), ['selected', 'hover', 'disabled']);
    assert.deepEqual(itemStates(opts, 'banana', -1), ['default', 'selected', 'disabled']);
    assert.deepEqual(itemStates(filterOptions(opts, 'an'), '', 0), ['hover']);
});

test('select: validation (required, min picks) uses the shared validator and drives the error state', () => {
    assert.equal(validateSelection({ required: true }, '', 'Country', { strict: true }).valid, false);
    assert.equal(validateSelection({ required: true }, 'id', 'Country').valid, true);
    assert.equal(validateSelection({ min: 2 }, ['a'], 'Tags').reason, 'min');
    assert.equal(validateSelection({ min: 2 }, ['a', 'b'], 'Tags').valid, true);
    assert.match(validateSelection({ required: true }, [], 'Tags', { strict: true }).message, /Tags is required/);
});

import { matchLevel, levelsCovered } from '../src/capabilities.js';
test('feedback type: the value of a component that stands for each level', () => {
    const modes = ['Success', 'Danger', 'Warning', 'Info'];
    assert.deepEqual(['success', 'error', 'warning', 'info'].map(l => matchLevel(modes, l)), ['Success', 'Danger', 'Warning', 'Info']);
    assert.equal(matchLevel(['type=error', 'type=ok'], 'error'), 'type=error');          // one of its words
    assert.equal(matchLevel(['Fine', 'Other'], 'error'), null);                           // nothing is guessed
    assert.equal(matchLevel(['A', 'B'], 'error', { error: 'B' }), 'B');                   // the mapping in the config wins
    assert.equal(matchLevel(['A', 'B'], 'error', { error: 'Z' }), null);                  // ... if it still exists
    assert.equal(levelsCovered(modes), 4);
    assert.equal(levelsCovered(['Success', 'Other']), 1);
    assert.equal(levelsCovered([]), 0);
});

test('convention: a value field with one text layer shares it with the placeholder; a lone text layer fills a required role', () => {
    const one = [{ id: 'p', name: 'Placeholder', type: 'text' }, { id: 'r', name: 'Focus ring', type: 'frame' }];
    const field = suggestSlots([{ role: 'value', kind: 'text', required: true }], one, undefined);
    assert.deepEqual(field.map(x => [x.role, x.layerId, !!x.shared]), [['value', 'p', true]]);
    const both = suggestSlots([{ role: 'value', kind: 'text', required: true }, { role: 'placeholder', kind: 'text' }], one, undefined);
    assert.deepEqual(both.map(x => [x.role, x.layerId]).sort(), [['placeholder', 'p'], ['value', 'p']]);
    // a lone text layer with an odd name is still the message of a feedback component
    const msg = suggestSlots([{ role: 'message', kind: 'text', required: true }], [{ id: 'i', name: 'Icon', type: 'frame' }, { id: 't', name: 'Whatever', type: 'text' }], undefined);
    assert.deepEqual(msg.map(x => [x.layerId, !!x.only]), [['t', true]]);
    // ... but with several text layers nothing is guessed
    assert.deepEqual(suggestSlots([{ role: 'message', kind: 'text', required: true }], [{ id: 'a', name: 'Foo', type: 'text' }, { id: 'b', name: 'Bar', type: 'text' }], undefined), []);
    // a button's own "Label" is not the message of a modal when the body has a named text
    const modal = suggestSlots([{ role: 'message', kind: 'text', required: true }], [{ id: 't', name: 'Title', type: 'text' }, { id: 'c', name: 'Some contents...', type: 'text' }, { id: 'l', name: 'Label', type: 'text' }], undefined);
    assert.equal(modal[0].layerId, 'c');
});

test('a multiple Select with chips does not need a value layer', () => {
    const [b] = normalizeBehaviors([{ kind: 'has-options', slots: { chip: 'c' }, config: { mode: 'multiple' } }]);
    assert.deepEqual(slotIssues(b), []);
    const [s] = normalizeBehaviors([{ kind: 'has-options', slots: { chip: 'c' }, config: { mode: 'single' } }]);
    assert.deepEqual(slotIssues(s).map(i => i.role), ['value']);
    const [m] = normalizeBehaviors([{ kind: 'has-options', slots: {}, config: { mode: 'multiple' } }]);
    assert.deepEqual(slotIssues(m).map(i => i.role), ['value']);
});
