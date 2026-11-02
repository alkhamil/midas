// Auto layout alignment has nine positions (primary start/center/end x counter start/center/end). The canvas places children by both;
// Play and the export read the same mapper (layout.js), for a plain frame and for a template root, in a row and in a column, whether
// the frame hugs or has a fixed size. A template's rootAlign is only the default a new master is created with; the master decides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flexOf, rootLayoutOf } from '../src/behavior-engine/layout.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const ALIGNS = ['start', 'center', 'end'];
const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' };
const NINE = ALIGNS.flatMap(primaryAlign => ALIGNS.map(counterAlign => ({ primaryAlign, counterAlign })));
const white = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };

for (const layout of ['horizontal', 'vertical']) {
    for (const sizing of ['hug', 'fixed']) {
        const frame = align => ({ id: 'f', type: 'frame', layout, layoutSizingH: sizing, layoutSizingV: sizing, w: 200, h: 100, ...align });

        test(`the shared mapper honours all nine positions: ${layout}, ${sizing}`, () => {
            for (const align of NINE) {
                const flex = flexOf(frame(align), 2);
                assert.equal(flex.flexDirection, layout === 'vertical' ? 'column' : 'row');
                assert.equal(flex.justifyContent, FLEX[align.primaryAlign], JSON.stringify(align));
                assert.equal(flex.alignItems, FLEX[align.counterAlign], JSON.stringify(align));
                assert.deepEqual(rootLayoutOf(frame(align), 2), { flexDirection: flex.flexDirection, flexWrap: 'nowrap', justifyContent: flex.justifyContent, alignItems: flex.alignItems, alignContent: 'flex-start' });
            }
        });

        test(`Play draws a plain auto layout frame at all nine positions: ${layout}, ${sizing}`, () => {
            for (const align of NINE) {
                const box = (id, w, h) => ({ id, name: id, type: 'rect', parentId: 'f', x: 0, y: 0, w, h, fills: white });
                const nodes = [{ id: 'f', name: 'F', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 100, fills: white, layout, layoutSizingH: sizing, layoutSizingV: sizing, ...align }, box('a', 20, 10), box('b', 30, 40)];
                const { root } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes }] }, 'f');
                assert.equal(root.style.justifyContent, FLEX[align.primaryAlign], JSON.stringify(align));
                assert.equal(root.style.alignItems, FLEX[align.counterAlign], JSON.stringify(align));
            }
        });

        test(`a Button root honours all nine positions in Play and in the export, whatever its template's rootAlign: ${layout}, ${sizing}`, () => {
            for (const align of NINE) {
                const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout, gap: 6, padding: 12, fills: white, radius: 6, x: 400, y: 0, w: 120, h: 40, layoutSizingH: sizing, layoutSizingV: sizing, behavior: { version: 2, templateId: 'button', variables: model.binding.variables }, ...align };
                const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, layoutSizingH: sizing, layoutSizingV: sizing, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'solid', 'c-color': 'primary', 'c-size': 'md' } };
                const { root } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [master, instance] }], variables }, 'i1');
                assert.equal(root.style.flexDirection, layout === 'vertical' ? 'column' : 'row');
                assert.equal(root.style.justifyContent, FLEX[align.primaryAlign], `Play ${JSON.stringify(align)}`);
                assert.equal(root.style.alignItems, FLEX[align.counterAlign], `Play ${JSON.stringify(align)}`);
                const css = generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', master, () => []).files['Button.css'];
                const rule = /\.button \{\n([\s\S]*?)\n\}/.exec(css)[1];
                assert.match(rule, new RegExp(`\\n {2}justify-content: ${FLEX[align.primaryAlign]};`), `export ${JSON.stringify(align)}`);
                assert.match(rule, new RegExp(`\\n {2}align-items: ${FLEX[align.counterAlign]};`), `export ${JSON.stringify(align)}`);
            }
        });
    }
}

test('a Button instance with its own alignment is drawn at it in Play: the canvas lays the instance out by its own fields, at all nine positions', () => {
    for (const align of NINE) {
        const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', gap: 6, padding: 12, fills: white, radius: 6, x: 400, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
        const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'solid', 'c-color': 'primary', 'c-size': 'md' }, ...align };
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [master, instance] }], variables }, 'i1');
        assert.equal(root.style.justifyContent, FLEX[align.primaryAlign], JSON.stringify(align));
        assert.equal(root.style.alignItems, FLEX[align.counterAlign], JSON.stringify(align));
    }
});

test('a master that aligns its cross axis at the start is laid out at the start, whatever the template\'s rootAlign default', () => {
    assert.equal(rootLayoutOf({ id: 'm', type: 'frame', layout: 'horizontal', counterAlign: 'start' }, 2).alignItems, 'flex-start');
});
