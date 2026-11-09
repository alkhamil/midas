// Three Play/export fixes: a rounded opaque box keeps its fill under the border (no hairline seam), a button root without a stroke resets the browser's
// button border, and a frame's own min size bounds it in Play (a hug Switch master keeps its track width).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor } from './helpers/box-template.js';

function css(id) {
    const t = TEMPLATES.get(id);
    const m = modelFor(t);
    return generateComponent(t, m.binding, m.variables, 'X', m.frame, i => m.created.filter(n => n.parentId === i)).files['X.css'];
}

test('Checkbox box clips its fill to the border box: no seam between fill and border', () => {
    const text = css('checkbox');
    assert.match(text, /\.checkbox-box \{[^}]*background-clip: border-box;/s);
    assert.doesNotMatch(text, /padding-box/);
});

test('Switch root resets the default button border; Checkbox, Radio and Switch roots draw no browser outline', () => {
    assert.match(css('switch'), /\.switch \{[^}]*border: 0;/s);
    for (const id of ['checkbox', 'radio', 'switch']) assert.match(css(id), new RegExp(`\.${id} \{[^}]*outline: none;`, 's'));
});

test('Play bounds a frame by its own min width, but leaves an instance to its class rule', () => {
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'horizontal', x: 0, y: 0, w: 100, h: 40, fills: [], layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
    const track = { id: 't', name: 'Track', type: 'frame', parentId: 'top', layout: 'horizontal', x: 0, y: 0, w: 28, h: 16, minW: 28, fills: [], layoutSizingH: 'hug', layoutSizingV: 'fixed' };
    const inst = { id: 'i', name: 'Inst', type: 'frame', parentId: 'top', layout: 'horizontal', x: 0, y: 0, w: 28, h: 16, minW: 28, fills: [], layoutSizingH: 'hug', layoutSizingV: 'fixed', isInstance: true, sourceId: 'zz' };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, track, inst] }], variables: { collections: [], items: [] } }, 'top');
    const kids = root.children.filter(c => typeof c === 'object');
    assert.equal(kids[0].style.minWidth, '28px');
    assert.equal(kids[1]?.style?.minWidth, undefined);
});
