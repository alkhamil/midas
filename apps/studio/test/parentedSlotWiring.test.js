// A managed slot inside a container (the checkmark in the box) lives under the instance's copy of the container. midas.js needs a browser, so the wiring is
// read from its source: the anatomy plan sees those layers, an insert goes under the container, and the icon pass and the visibility loop find them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const body = name => {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return src.slice(at, src.indexOf('\n}\n', at));
};

test('managedLayersOf lists the instance\'s children and the children of its containers', () => {
    const fn = body('managedLayersOf');
    assert.ok(fn.includes('doc.children(inst.id)') && fn.includes('behavior?.group'));
});

test('the anatomy plan is given every managed layer, containers included', () => {
    assert.ok(body('anatomyPlanOf').includes('managedLayersOf(inst).map('));
});

test('an insert op goes under the container it names, and the other steps look through the containers', () => {
    const sync = body('syncInstance');
    assert.ok(sync.includes('op.parent'), 'the insert op names its container');
    assert.ok(sync.includes('containerOf(inst, op.parent)'));
    assert.ok(body('applyIconSlotBindings').includes('managedLayersOf(inst).find('), 'the icon pass finds a holder inside a container');
    assert.ok(body('applyLiteralFields').includes('managedLayersOf(inst)'), 'the visibility loop covers them');
});
