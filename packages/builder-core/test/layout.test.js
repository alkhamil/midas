import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootLayoutOf, labelLayoutOf } from '../src/behavior-engine/layout.js';

const master = (over = {}) => ({ id: 'm', type: 'frame', layout: 'horizontal', ...over });
const label = (over = {}) => ({ id: 'l', type: 'text', ...over });

test('a horizontal root justifies by its primary axis and aligns by its counter axis', () => {
    assert.deepEqual(rootLayoutOf(master({ primaryAlign: 'start', counterAlign: 'start' }), 2), {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        alignContent: 'flex-start',
    });
    assert.deepEqual(rootLayoutOf(master({ primaryAlign: 'center', counterAlign: 'center' }), 2), {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'center',
        alignItems: 'center',
        alignContent: 'flex-start',
    });
    assert.deepEqual(rootLayoutOf(master({ primaryAlign: 'end', counterAlign: 'center' }), 2), {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        alignContent: 'flex-start',
    });
});

test('absent alignments are the start, like the canvas flex helper', () => {
    assert.deepEqual(rootLayoutOf(master({}), 1), {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        alignContent: 'flex-start',
    });
});

test('a vertical root stacks in a column', () => {
    const style = rootLayoutOf(master({ layout: 'vertical', primaryAlign: 'center', counterAlign: 'end' }), 2);
    assert.equal(style.flexDirection, 'column');
    assert.equal(style.justifyContent, 'center');
    assert.equal(style.alignItems, 'flex-end');
});

test('space-between comes from gapAuto with more than one child', () => {
    assert.equal(rootLayoutOf(master({ primaryAlign: 'start', gapAuto: true, gapMode: 'between' }), 2).justifyContent, 'space-between');
    assert.equal(rootLayoutOf(master({ primaryAlign: 'start', gapAuto: true, gapMode: 'between' }), 1).justifyContent, 'flex-start');
});

test('the root layout never sets display, gap or padding: the surface and the tokens own those', () => {
    const style = rootLayoutOf(master({ primaryAlign: 'center', counterAlign: 'center', gap: 6, padding: 12 }), 2);
    assert.ok(!('display' in style) && !('gap' in style) && !('columnGap' in style) && !('padding' in style));
});

test('a fill label stretches across the row and aligns its text', () => {
    assert.deepEqual(labelLayoutOf(label({ layoutSizingH: 'fill', textAlign: 'center' }), master({})), {
        flex: '1 1 0',
        minWidth: '0px',
        textAlign: 'center',
    });
});

test('a hug label sizes to its text and never squeezes, like the canvas flow', () => {
    assert.deepEqual(labelLayoutOf(label({ layoutSizingH: 'hug', textAlign: 'left' }), master({})), { flexShrink: '0', textAlign: 'left' });
});

test('a fixed text layer takes its natural size, like the canvas flow', () => {
    assert.deepEqual(labelLayoutOf(label({ layoutSizingH: 'fixed', w: 80, textAlign: 'right' }), master({})), { flexShrink: '0', textAlign: 'right' });
});

test('a label without a layer or alignment renders no layout of its own', () => {
    assert.deepEqual(labelLayoutOf(null, master({})), {});
    assert.deepEqual(labelLayoutOf(label({ layoutSizingH: 'hug' }), master({})), { flexShrink: '0' });
});
