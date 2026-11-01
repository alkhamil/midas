// Typography variables: a composite per mode. Members are literals or aliases of a scalar of their type; the whole value may alias
// another typography variable; lineHeight is px only; colour is not part of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typographyCss, typographyOf } from '../src/behavior-engine/typography.js';

const coll = (id, name, modes) => ({ id, name, modes: modes.map(m => ({ id: `${id}-${m}`, name: m })) });
const item = (id, collectionId, type, values) => ({ id, collectionId, type, name: id, values });
const modeOfNamed = picks => collection => picks[collection.id];

/** Semantic (Base) holds the scalars; Size holds the whole styles per mode; Button Size has none of its own. */
function fixture() {
    const semantic = coll('c-sem', 'Semantic', ['Base']);
    const size = coll('c-size', 'Button Size', ['sm', 'md']);
    const items = [
        item('fs-sm', 'c-sem', 'number', { 'c-sem-Base': 12 }),
        item('fs-md', 'c-sem', 'number', { 'c-sem-Base': 14 }),
        item('lh-sm', 'c-sem', 'number', { 'c-sem-Base': 20 }),
        item('lh-md', 'c-sem', 'number', { 'c-sem-Base': 22 }),
        item('family', 'c-sem', 'string', { 'c-sem-Base': 'Inter' }),
        item('style-sm', 'c-size', 'typography', {
            'c-size-sm': { fontFamily: { alias: 'family' }, fontSize: { alias: 'fs-sm' }, fontWeight: 'Regular', lineHeight: { alias: 'lh-sm' }, letterSpacing: 0 },
            'c-size-md': { fontFamily: { alias: 'family' }, fontSize: { alias: 'fs-md' }, fontWeight: 'Regular', lineHeight: { alias: 'lh-md' }, letterSpacing: 0 },
        }),
    ];
    return { collections: [semantic, size], items };
}

test('a literal typography resolves to its members in the mode read', () => {
    const variables = { collections: [coll('c', 'Button Size', ['sm'])], items: [] };
    const style = item('t', 'c', 'typography', { 'c-sm': { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 22, letterSpacing: 0 } });
    variables.items.push(style);
    const out = typographyOf(variables, style, modeOfNamed({ c: 'c-sm' }));
    assert.deepEqual(out, { style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 22, letterSpacing: 0 }, problems: [] });
});

test('member aliases follow scalars of their type, read in the mode of the mode they are in', () => {
    const variables = fixture();
    const style = variables.items.find(i => i.id === 'style-sm');
    assert.deepEqual(typographyOf(variables, style, modeOfNamed({ 'c-size': 'c-size-sm', 'c-sem': 'c-sem-Base' })).style, { fontFamily: 'Inter', fontSize: 12, fontWeight: 'Regular', lineHeight: 20, letterSpacing: 0 });
    assert.equal(typographyOf(variables, style, modeOfNamed({ 'c-size': 'c-size-md', 'c-sem': 'c-sem-Base' })).style.fontSize, 14, 'the md mode alias');
});

test('a whole-style alias follows another typography variable and its mode', () => {
    const variables = fixture();
    variables.items.push(item('label', 'c-size', 'typography', { 'c-size-sm': { alias: 'style-sm' }, 'c-size-md': { alias: 'style-sm' } }));
    const label = variables.items.find(i => i.id === 'label');
    const out = typographyOf(variables, label, modeOfNamed({ 'c-size': 'c-size-md', 'c-sem': 'c-sem-Base' }));
    assert.equal(out.style.lineHeight, 22);
    assert.deepEqual(out.problems, []);
});

test('a member that aliases a variable of another type is a problem, not a value', () => {
    const variables = fixture();
    variables.items.push(item('bad', 'c-size', 'typography', { 'c-size-sm': { fontFamily: 'Inter', fontSize: { alias: 'family' }, fontWeight: 'Regular', lineHeight: 20, letterSpacing: 0 }, 'c-size-md': {} }));
    const out = typographyOf(variables, variables.items.find(i => i.id === 'bad'), modeOfNamed({ 'c-size': 'c-size-sm', 'c-sem': 'c-sem-Base' }));
    assert.equal(out.style, null);
    assert.match(out.problems.join(), /fontSize alias is missing or not a number/);
});

test('lineHeight is px only: a ratio is refused with a problem', () => {
    const variables = { collections: [coll('c', 'Size', ['sm'])], items: [] };
    const style = item('t', 'c', 'typography', { 'c-sm': { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 1.5, letterSpacing: 0 } });
    variables.items.push(style);
    const out = typographyOf(variables, style, modeOfNamed({ c: 'c-sm' }));
    assert.equal(out.style, null);
    assert.match(out.problems.join(), /lineHeight is a ratio; it must be px/);
});

test('a cycle between typography aliases stops with a problem', () => {
    const variables = { collections: [coll('c', 'Size', ['sm'])], items: [] };
    variables.items.push(item('a', 'c', 'typography', { 'c-sm': { alias: 'b' } }), item('b', 'c', 'typography', { 'c-sm': { alias: 'a' } }));
    const out = typographyOf(variables, variables.items[0], modeOfNamed({ c: 'c-sm' }));
    assert.equal(out.style, null);
    assert.match(out.problems.join(), /alias cycle/);
});

test('a missing mode value is a problem', () => {
    const variables = { collections: [coll('c', 'Size', ['sm', 'md'])], items: [] };
    const style = item('t', 'c', 'typography', { 'c-sm': { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 22, letterSpacing: 0 } });
    variables.items.push(style);
    // The fallback is the first mode, so md reads sm; an item with no value in any mode is the problem.
    assert.deepEqual(typographyOf(variables, style, modeOfNamed({ c: 'c-md' })).problems, []);
    const empty = item('e', 'c', 'typography', {});
    variables.items.push(empty);
    assert.match(typographyOf(variables, empty, modeOfNamed({ c: 'c-md' })).problems.join(), /no value in this mode/);
});

test('a weight name the CSS does not know is a problem', () => {
    const variables = { collections: [coll('c', 'Size', ['sm'])], items: [] };
    const style = item('t', 'c', 'typography', { 'c-sm': { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Heavyish', lineHeight: 22, letterSpacing: 0 } });
    variables.items.push(style);
    assert.match(typographyOf(variables, style, modeOfNamed({ c: 'c-sm' })).problems.join(), /fontWeight "Heavyish" is not a known weight/);
});

test('the CSS of a style is px for lengths and the family as written', () => {
    assert.deepEqual(typographyCss({ fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 22, letterSpacing: 0 }), {
        'font-family': 'Inter', 'font-size': '14px', 'font-weight': '400', 'line-height': '22px', 'letter-spacing': '0px',
    });
});
