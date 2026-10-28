import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCopiedField, isLayoutOwnedField } from '../src/behavior-engine/instance-vars.js';

// The master-to-instance copy writes a geometry field only when the field is not bound through vars and the layout engine does
// not own it. These cases check that decision on the Kopi Kita sample (auto-layout children) and on the shapes the sample lacks.
const sample = JSON.parse(readFileSync(new URL('../../../scripts/fixtures/sample-app.midas', import.meta.url), 'utf8'));
const nodes = sample.pages.flatMap(page => page.nodes);
const byId = new Map(nodes.map(n => [n.id, n]));
const GEOMETRY = ['x', 'y', 'w', 'h'];
const copiedOf = (node, parent) => GEOMETRY.filter(k => isCopiedField(k, node.vars) && !isLayoutOwnedField(node, parent, k));
const ownedOf = (node, parent) => GEOMETRY.filter(k => isLayoutOwnedField(node, parent, k));

test('Kopi Kita: every instance child is positioned by its auto-layout parent, so x and y are never copied', () => {
    const children = nodes.filter(n => n.parentId && byId.get(n.parentId)?.isInstance);
    assert.ok(children.length > 0);
    for (const child of children) {
        const parent = byId.get(child.parentId);
        assert.equal(parent.layout === 'horizontal' || parent.layout === 'vertical' || parent.layout === 'grid', true, child.name);
        assert.equal(copiedOf(child, parent).includes('x'), false, child.name);
        assert.equal(copiedOf(child, parent).includes('y'), false, child.name);
    }
});

test('Kopi Kita: no field is both copied from the master and owned by the layout', () => {
    for (const child of nodes.filter(n => n.parentId)) {
        const parent = byId.get(child.parentId);
        const overlap = copiedOf(child, parent).filter(k => ownedOf(child, parent).includes(k));
        assert.deepEqual(overlap, [], child.name);
    }
});

test('a fill child of a plain frame: its width is layout-owned, its position is copied', () => {
    const plain = { type: 'frame', layout: 'none' };
    const fill = { type: 'frame', layoutSizingH: 'fill', layoutSizingV: 'fixed' };
    assert.deepEqual(ownedOf(fill, plain), ['w']);
    assert.deepEqual(copiedOf(fill, plain), ['x', 'y', 'h']);
});

test('an absolute child of a plain frame keeps its whole geometry: all four fields are copied', () => {
    const plain = { type: 'frame', layout: 'none' };
    const badge = { type: 'frame', layoutPositioning: 'absolute', layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
    assert.deepEqual(ownedOf(badge, plain), []);
    assert.deepEqual(copiedOf(badge, plain), ['x', 'y', 'w', 'h']);
});

test('a nested instance inside an auto-layout parent: position is owned, a hug size is owned, a fixed size is copied', () => {
    const row = { type: 'frame', layout: 'horizontal' };
    const nested = { type: 'frame', isInstance: true, sourceId: 'icon-master', layoutSizingH: 'hug', layoutSizingV: 'fixed' };
    assert.deepEqual(ownedOf(nested, row), ['x', 'y', 'w']);
    assert.deepEqual(copiedOf(nested, row), ['h']);
});

test('a field bound through vars is never copied, whatever the layout does', () => {
    const row = { type: 'frame', layout: 'horizontal' };
    const bound = { type: 'frame', layoutSizingH: 'fixed', layoutSizingV: 'fixed', vars: { padH: 'i-px' } };
    assert.equal(copiedOf(bound, row).includes('w'), true);
    const boundW = { ...bound, vars: { w: 'i-w' } };
    assert.equal(copiedOf(boundW, row).includes('w'), false);
});
