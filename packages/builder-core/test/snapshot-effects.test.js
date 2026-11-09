// Effects in the base rebuild: the mapping's `Effects` section (ant-map.json) makes buildBasePlan emit the effect Primitives and the Semantic aliases of them,
// after the sizes, so scripts/build-base-snapshot.js produces the effect items of the committed snapshot. The token JSON is not in the repo, so the rebuild is
// checked on the part the mapping owns: the effect items and the report. The snapshot's report names exactly the variables it holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTokenJson, buildBasePlan, ANT_MAP } from '../src/base-tokens/importer.js';
import { BASE_SNAPSHOT } from '../src/index.js';

const color = value => ({ $type: 'color', $value: value });
const MINI = [
    { Primitives: { modes: { Base: { white: color('#ffffff') } } } },
    { Semantic: { modes: { Light: { text: { primary: color('{white}') } }, Dark: { text: { primary: color('{white}') } } } } },
    { Typography: { modes: { 'Mode 1': { font: { 'line height': { 12: { $type: 'float', $value: 12 } } } } } } },
];
const MINI_MAP = {
    Primitives: { source: 'Primitives', modes: ['Base'], naming: 'raw' },
    Semantic: { source: 'Semantic', modes: ['Light', 'Dark'], items: { colorText: { Light: 'text/primary', Dark: 'text/primary', role: 'text', derived: false } } },
    Typography: { source: 'Typography', modes: ['Mode 1'], naming: 'raw' },
};
const DROP = { type: 'drop', visible: true, color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 4, spread: 0 };
const EFFECTS = { primitives: { 'shadow/none': [], 'shadow/lift': [DROP] }, items: { boxNone: { primitive: 'shadow/none', role: 'no elevation' }, boxLift: { primitive: 'shadow/lift', role: 'a lift' } } };
const build = effects => buildBasePlan(parseTokenJson(MINI), effects ? { ...MINI_MAP, Effects: effects } : MINI_MAP, {});

test('a mapping with an Effects section emits the effect Primitives, then the Semantic aliases of them, after everything else', () => {
    const plan = build(EFFECTS);
    const tail = plan.items.slice(-4);
    assert.deepEqual(tail.map(i => `${i.collection}/${i.name}`), ['Primitives/shadow/none', 'Primitives/shadow/lift', 'Semantic/boxNone', 'Semantic/boxLift']);
    assert.deepEqual(tail.map(i => i.type), ['effect', 'effect', 'effect', 'effect']);
    assert.deepEqual(tail[0].values, { Base: { literal: [] } });
    assert.deepEqual(tail[1].values, { Base: { literal: [DROP] } });
    assert.deepEqual(tail[3].values, { Light: { alias: { collection: 'Primitives', name: 'shadow/lift' } }, Dark: { alias: { collection: 'Primitives', name: 'shadow/lift' } } });
    assert.ok(plan.report.created.includes('Semantic/boxLift') && plan.report.created.includes('Primitives/shadow/none'));
});

test('a mapping without the section emits no effect, and an item whose primitive is missing is refused', () => {
    assert.equal(build(null).items.filter(i => i.type === 'effect').length, 0);
    assert.throws(() => build({ ...EFFECTS, items: { boxGone: { primitive: 'shadow/gone', role: 'x' } } }), /Effects\/boxGone .*shadow\/gone/);
    assert.throws(() => build({ primitives: { 'shadow/odd': 'not a list' }, items: {} }), /Effects primitive "shadow\/odd" must be a list of effects/);
});

test('the real mapping emits the effect items the committed snapshot holds, in the same order and at the end', () => {
    const plan = buildBasePlan(parseTokenJson(MINI), { ...MINI_MAP, Effects: ANT_MAP.Effects }, {});
    const built = plan.items.filter(i => i.type === 'effect');
    const committed = BASE_SNAPSHOT.items.filter(i => i.type === 'effect');
    assert.equal(committed.length, 6);
    assert.deepEqual(built, committed);
    assert.deepEqual(BASE_SNAPSHOT.items.slice(-6), committed, 'the effects close the snapshot, as the builder emits them');
});

test('the snapshot report names exactly the variables the snapshot holds, in order (a rebuild writes it the same way)', () => {
    assert.deepEqual(BASE_SNAPSHOT.report.created, [...new Set(BASE_SNAPSHOT.items.map(i => `${i.collection}/${i.name}`))]);
});
