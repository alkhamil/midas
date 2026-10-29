import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';

const clone = o => structuredClone(o);

test('the Button schema is valid', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
});

test('a schema without a required text slot is rejected', () => {
    const bad = clone(BUTTON);
    bad.anatomy = bad.anatomy.filter(s => s.kind !== 'text');
    assert.match(validateTemplateSchema(bad).join('\n'), /text slot/);
});

test('duplicate anatomy slot ids are rejected', () => {
    const bad = clone(BUTTON);
    bad.anatomy.push({ id: 'label', kind: 'text' });
    assert.match(validateTemplateSchema(bad).join('\n'), /duplicate anatomy slot "label"/);
});

test('visibleIf must name a boolean or enum prop that exists', () => {
    const bad = clone(BUTTON);
    bad.props.icon.visibleIf = { prop: 'missing', is: true };
    assert.match(validateTemplateSchema(bad).join('\n'), /visibleIf refers to unknown prop "missing"/);
});

test('a variable prop must name its collection', () => {
    const bad = clone(BUTTON);
    bad.props.variant.collection = '';
    assert.match(validateTemplateSchema(bad).join('\n'), /variant.*collection/);
});

test('an enum default must be one of its options', () => {
    const bad = clone(BUTTON);
    bad.props.iconPlacement.default = 'top';
    assert.match(validateTemplateSchema(bad).join('\n'), /iconPlacement.*default "top"/);
});

test('a token group must draw from a variable prop of the same name', () => {
    const bad = clone(BUTTON);
    bad.tokens.fromWidth = bad.tokens.fromSize;
    delete bad.tokens.fromSize;
    assert.match(validateTemplateSchema(bad).join('\n'), /tokens group "fromWidth" has no variable prop "Width"/);
});

test('a preview-only state may change colours only: a size, padding or radius change is refused', () => {
    const bad = clone(BUTTON);
    bad.previewStates = { hover: { bg: 'bg-hover', radius: 'radius' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /preview state "hover" changes "radius", but preview states change colours only/);
});

test('a preview-only state must map to a token of the template', () => {
    const bad = clone(BUTTON);
    bad.previewStates = { hover: { bg: 'bg-nope' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /preview state "hover" maps "bg" to "bg-nope", which is not a token/);
});

test('a persistent state needs a boolean literal prop, and tokens of the template', () => {
    const notBoolean = clone(BUTTON);
    notBoolean.persistentStates = { disabled: { prop: 'label', tokens: { bg: 'bg-disabled' } } };
    assert.match(validateTemplateSchema(notBoolean).join('\n'), /persistent state "disabled" needs a boolean prop, not "label"/);
    const unknownToken = clone(BUTTON);
    unknownToken.persistentStates = { disabled: { prop: 'disabled', tokens: { bg: 'bg-nope' } } };
    assert.match(validateTemplateSchema(unknownToken).join('\n'), /persistent state "disabled" maps "bg" to "bg-nope", which is not a token/);
});

test('a state is persistent or preview-only, not both', () => {
    const bad = clone(BUTTON);
    bad.previewStates = { disabled: { bg: 'bg-hover' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /state "disabled" is declared as both persistent and preview-only/);
});

test('a template must name its variable group', () => {
    const bad = clone(BUTTON);
    delete bad.group;
    assert.match(validateTemplateSchema(bad).join('\n'), /schema has no group/);
});

test('a token with no kind is refused', () => {
    const bad = clone(BUTTON);
    delete bad.tokenKinds.bg;
    assert.match(validateTemplateSchema(bad).join('\n'), /token "bg" has no kind/);
});

test('an icon placement must map to a managed anatomy slot', () => {
    const bad = clone(BUTTON);
    bad.props.iconPlacement.slots.end = 'label';
    assert.match(validateTemplateSchema(bad).join('\n'), /icon placement "end" maps to "label", which is not a managed anatomy slot/);
});

test('the element must name a persistent state that disables it', () => {
    const bad = clone(BUTTON);
    bad.element.disabledState = 'hover';
    assert.match(validateTemplateSchema(bad).join('\n'), /element disabledState "hover" is not a persistent state/);
});

test('every state has a pseudo-class', () => {
    const bad = clone(BUTTON);
    delete bad.statePseudo.hover;
    assert.match(validateTemplateSchema(bad).join('\n'), /state "hover" has no pseudo-class/);
});
