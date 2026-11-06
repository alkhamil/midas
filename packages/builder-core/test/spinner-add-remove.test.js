// The spinner is an add/remove layer, like a managed slot: no hidden spinner lives on a
// master or an instance while loading is off; turning loading on creates it bound and placed,
// turning it off removes it again. Play and the export draw it from the definition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { conditionHolds } from '../src/behavior-engine/display.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const SPINNERS = [
    ['button', null],
    ['icon-button', null],
    ['switch', 'handle'],
];

function variableIds(model) {
    return new Set(model.variables.items.map(i => i.id));
}

function spinnerOf(nodes) {
    return nodes.filter(n => n.behavior?.part === 'spinner');
}

for (const [id, holder] of SPINNERS) {
    const sw = TEMPLATES.get(id);

    test(`${id}: a fresh master holds no hidden layer and no spinner`, () => {
        const model = modelFor(sw);
        const nodes = [model.frame, ...model.created];
        assert.ok(nodes.every(n => n.visible !== false), 'no hidden layer on the master');
        assert.deepEqual(spinnerOf(nodes), [], 'no spinner layer while loading is off');
    });

    test(`${id}: an instance with loading off holds no hidden layer and no spinner`, () => {
        const model = modelFor(sw);
        const nodes = instanceFor(model, {});
        assert.ok(nodes.every(n => n.visible !== false), 'no hidden layer on the instance');
        assert.deepEqual(spinnerOf(nodes), [], 'no spinner layer while loading is off');
    });

    test(`${id}: loading on creates the spinner bound and placed; the plan stays quiet`, () => {
        const model = modelFor(sw);
        const nodes = instanceFor(model, { loading: true });
        const spins = spinnerOf(nodes);
        assert.equal(spins.length, 1, 'exactly one spinner layer');
        const spin = spins[0];
        assert.ok(spin.visible !== false, 'the spinner is shown');
        assert.equal(spin.w, spin.h, 'the spinner is square');
        const size = sw.parts.find(p => p.id === 'spinner').arc.size;
        assert.deepEqual([spin.w, spin.h], [size, size], 'spinner size comes from the Size token geometry');
        const ids = variableIds(model);
        for (const key of Object.values(spin.vars ?? {})) assert.ok(ids.has(key), `spinner binding ${key} is a variable, not a literal`);
        const parent = nodes.find(n => n.id === spin.parentId);
        if (holder === null) assert.equal(parent, nodes[0], 'the spinner hangs directly under the root');
        else assert.equal(parent?.behavior?.group, holder, `the spinner hangs under the ${holder}`);
        // Parts are not anatomy slots: their presence never disturbs the backstop plan.
        const children = nodes.slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name, ...(n.parentId !== nodes[0].id ? { parent: nodes.find(p => p.id === n.parentId)?.behavior?.group } : {}) }));
        const { ops, reason } = planInstanceAnatomy({ binding: model.binding, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'x', type: 'text' }], stored: { loading: true }, children });
        assert.equal(reason, undefined);
        assert.deepEqual(ops, []);
    });

    test(`${id}: the schema shows the spinner only while loading`, () => {
        assert.ok(conditionHolds(sw.parts.find(p => p.id === 'spinner').shownWhen, { loading: true }));
        assert.ok(!conditionHolds(sw.parts.find(p => p.id === 'spinner').shownWhen, { loading: false }));
    });
}
