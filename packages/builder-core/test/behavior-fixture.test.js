// The manual-test fixture (scripts/make-behavior-fixture.js) passes the phase-2 check on an eager open and on a lazy open, and
// has exactly the problems and behaviour the manual test script expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBehaviorFixture, buildManagedLayerClipboard } from '../../../scripts/make-behavior-fixture.js';
import { managedPasteRefusal } from '../src/behavior-engine/managed-layers.js';
import { assertBehaviorData, assertPagesBehavior } from '../src/behavior-engine/document-check.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { planTemplateChange } from '../src/behavior-engine/panel.js';

const clone = o => structuredClone(o);
const pageNamed = (doc, name) => doc.pages.find(p => p.name === name);

test('the fixture has more than three pages, so a lazy open applies', () => {
    assert.ok(buildBehaviorFixture().pages.length > 3);
});

test('the fixture passes phase 2 on an eager open', () => {
    assert.doesNotThrow(() => assertBehaviorData(buildBehaviorFixture()));
});

test('the fixture passes phase 2 on a lazy open, page by page in order', () => {
    const full = buildBehaviorFixture();
    for (let i = 0; i < full.pages.length; i++) {
        const loaded = { ...full, pages: full.pages.slice(0, i + 1) };
        assert.doesNotThrow(() => assertPagesBehavior(loaded, [full.pages[i].id]), `page ${full.pages[i].name}`);
    }
});

test('the fixture passes phase 2 on a lazy open when the cross-page instance\'s page arrives first', () => {
    const full = buildBehaviorFixture();
    const screens = pageNamed(full, 'Screens');
    const components = pageNamed(full, 'Components');
    assert.doesNotThrow(() => assertPagesBehavior({ ...full, pages: [screens] }, [screens.id]));
    assert.doesNotThrow(() => assertPagesBehavior({ ...full, pages: [screens, components] }, [components.id]));
});

test('the only error in the fixture is the legacy master\'s missing hover token in Solid', () => {
    const errors = diagnoseDocument(buildBehaviorFixture()).filter(f => f.severity === 'error');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'variable-missing-in-mode');
    assert.equal(errors[0].node, 'Button (legacy)');
    assert.equal(errors[0].variable, 'button/bg-hover');
    assert.equal(errors[0].mode, 'Solid');
});

test('binding the unbound master matches Variant, Color and Size, and not Variant B', () => {
    const full = buildBehaviorFixture();
    const unbound = pageNamed(full, 'Components').nodes.find(n => n.name === 'Unbound');
    const plan = planTemplateChange(unbound, [], 'button', full.variables.collections);
    assert.deepEqual(plan.binding.variables, { variant: 'c-variant', color: 'c-color', size: 'c-size' });
});

test('a managed layer removed from the Save instance fails the eager open, naming the page and the node', () => {
    const broken = clone(buildBehaviorFixture());
    const page = pageNamed(broken, 'Components');
    page.nodes = page.nodes.filter(n => n.id !== 'inst-start-icon-start');
    assert.throws(() => assertBehaviorData(broken), /on "Save" \(inst-start\) on page "Components" is invalid: managed layer "iconStart" is missing/);
});

test('the managed-layer clipboard payload is refused by the paste guard, naming the layer', () => {
    const payload = JSON.parse(JSON.stringify(buildManagedLayerClipboard()));
    assert.equal(payload.format, 'midas-clipboard');
    assert.equal(managedPasteRefusal(payload.nodes), '"iconStart" is managed by its instance: pasting it without that instance is not allowed.');
});

test('every variable the fixture binds exists in its variables, so the icon follows fg and Size', () => {
    const doc = buildBehaviorFixture();
    const ids = new Set(doc.variables.items.map(i => i.id));
    const dangling = doc.pages.flatMap(p => p.nodes.flatMap(n => Object.values(n.vars || {}).filter(id => !ids.has(id)).map(id => `${n.id}:${id}`)));
    assert.deepEqual(dangling, []);
});
