// The editing rules of the typography editor and the Design panel: aliases per member, weight names per family, px line heights,
// and attach and detach between a node's literal fields and its typography variable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TYPOGRAPHY, attachedVars, detachedVars, literalFor, nodeFieldsOf, setMember, summaryOf, unaliasMember, weightForFamily, weightNamesOf } from '../src/behavior-engine/typography-edit.js';

test('a member takes a literal of its type, and an alias keeps its target', () => {
    assert.deepEqual(setMember(DEFAULT_TYPOGRAPHY, 'fontSize', { literal: '16' }), { style: { ...DEFAULT_TYPOGRAPHY, fontSize: 16 } });
    assert.deepEqual(setMember(DEFAULT_TYPOGRAPHY, 'fontFamily', { alias: 'fam-1' }), { style: { ...DEFAULT_TYPOGRAPHY, fontFamily: { alias: 'fam-1' } } });
});

test('a member only takes a literal of its own type', () => {
    assert.match(setMember(DEFAULT_TYPOGRAPHY, 'fontFamily', { literal: '   ' }).error, /needs a name/);
    assert.match(setMember(DEFAULT_TYPOGRAPHY, 'fontSize', { literal: 'big' }).error, /needs a number/);
    assert.match(setMember(DEFAULT_TYPOGRAPHY, 'fontSize', { literal: 0 }).error, /above zero/);
    assert.match(setMember(DEFAULT_TYPOGRAPHY, 'nope', { literal: 1 }).error, /not a typography member/);
});

test('a px line height is accepted, and a ratio-like one is rejected with a message', () => {
    assert.deepEqual(literalFor('lineHeight', 22), { value: 22 });
    const ratio = literalFor('lineHeight', 1.5);
    assert.match(ratio.error, /is a ratio/);
    assert.match(ratio.error, /pixels/);
    assert.ok('error' in setMember(DEFAULT_TYPOGRAPHY, 'lineHeight', { literal: 2 }));
});

test('a weight is a name the CSS knows, and an unknown name is refused', () => {
    assert.deepEqual(literalFor('fontWeight', 'SemiBold'), { value: 'SemiBold' });
    assert.match(literalFor('fontWeight', 'Heavyish').error, /not a weight name/);
});

test('a family\'s weights are the typography names of its numeric weights, thinnest first', () => {
    assert.deepEqual(weightNamesOf([700, 400, 600, 150]), ['Regular', 'SemiBold', 'Bold']);
});

test('a weight the new family does not have falls back to the nearest one, with a note', () => {
    const { weight, note } = weightForFamily('Lora', 'ExtraBold', ['Regular', 'Medium', 'SemiBold', 'Bold']);
    assert.equal(weight, 'Bold');
    assert.match(note, /Lora has no ExtraBold; the weight is Bold/);
});

test('a weight the family has is kept, and a family with no list keeps the name', () => {
    assert.deepEqual(weightForFamily('Inter', 'SemiBold', ['Regular', 'SemiBold']), { weight: 'SemiBold', note: null });
    assert.deepEqual(weightForFamily('Custom', 'Bold', null), { weight: 'Bold', note: null });
});

test('unaliasing a member keeps its resolved value as a literal', () => {
    const style = { ...DEFAULT_TYPOGRAPHY, fontSize: { alias: 'size-md' } };
    assert.deepEqual(unaliasMember(style, 'fontSize', { fontSize: 14 }).style, DEFAULT_TYPOGRAPHY);
    assert.match(unaliasMember(style, 'fontSize', {}).error, /no value to keep/);
});

test('the summary shows values, and the variable name for an aliased member', () => {
    assert.equal(summaryOf({ fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: 'Regular' }), 'Inter 14/20 · Regular');
    assert.equal(summaryOf({ fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: 'Regular' }, { fontSize: 'textBase' }), 'Inter {textBase}/20 · Regular');
});

test('a detached style writes its node fields: a CSS weight number and the line height as a ratio of the size', () => {
    assert.deepEqual(nodeFieldsOf({ fontFamily: 'Inter', fontSize: 14, fontWeight: 'SemiBold', lineHeight: 20, letterSpacing: 0 }), {
        fontFamily: 'Inter', fontSize: 14, fontWeight: 600, lineHeight: 20 / 14, letterSpacing: 0,
    });
});

test('attaching clears the per-field bindings and keeps the others; detaching drops the typography binding only', () => {
    const vars = { 'fills.0': 'v-fg', fontSize: 'v-size', lineHeight: 'v-lh', typography: 'old' };
    const attached = attachedVars(vars, 'ts-1');
    assert.deepEqual(attached, { 'fills.0': 'v-fg', typography: 'ts-1' });
    assert.deepEqual(detachedVars(attached), { 'fills.0': 'v-fg' });
});
