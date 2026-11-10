// Rotate without a handle: no top-center handle exists; hovering just outside a corner (past the
// resize hit area, on the outer side only) offers rotate, with a curved double-arrow cursor oriented
// per corner. Resize always wins its own area. Dragging rotates around the box center with the
// existing shift snap and nothing new.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The helpers are cut out of midas.js by name (as studioReplay.js does): a missing helper is a
// ReferenceError here, so the test can never pass over a re-implementation.
const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) >= 0 ? src.indexOf(`\nfunction ${name}(`) + 1 : src.indexOf(`function ${name}(`);
    if (head < 0) throw new Error(`midas.js has no function ${name}`);
    const lineEnd = src.indexOf('\n', head);
    const firstLine = src.slice(head, lineEnd);
    if (/\}\s*$/.test(firstLine) && (firstLine.match(/\{/g) || []).length === (firstLine.match(/\}/g) || []).length) return firstLine;
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}

const fns = ['cornerRotateAt', 'rotateCursorFor', 'snapRotateDelta'];
const body = `${fns.map(sliceFunction).join('\n')}\nreturn { ${fns.join(', ')} };`;
const { cornerRotateAt, rotateCursorFor, snapRotateDelta } = new Function(body)();

// A 100x100 box on screen, corners and center in screen px.
const corners = [
    { name: 'nw', x: 0, y: 0 },
    { name: 'ne', x: 100, y: 0 },
    { name: 'se', x: 100, y: 100 },
    { name: 'sw', x: 0, y: 100 },
];
const center = { x: 50, y: 50 };

test('the resize area stays resize: at and inside 7px of a corner there is no rotate zone', () => {
    assert.equal(cornerRotateAt(corners, center, { x: 100, y: 0 }), null, 'on the corner');
    assert.equal(cornerRotateAt(corners, center, { x: 105, y: 0 }), null, '5px out along the edge');
    assert.equal(cornerRotateAt(corners, center, { x: 103, y: 4 }), null, '5px out diagonally');
    assert.equal(cornerRotateAt(corners, center, { x: 95, y: 5 }), null, 'inside the box by the corner');
});

test('just outside each corner offers rotate for that corner', () => {
    assert.deepEqual(cornerRotateAt(corners, center, { x: 108, y: -8 }), { name: 'rotate', corner: 'ne' });
    assert.deepEqual(cornerRotateAt(corners, center, { x: -8, y: -8 }), { name: 'rotate', corner: 'nw' });
    assert.deepEqual(cornerRotateAt(corners, center, { x: 108, y: 108 }), { name: 'rotate', corner: 'se' });
    assert.deepEqual(cornerRotateAt(corners, center, { x: -8, y: 108 }), { name: 'rotate', corner: 'sw' });
});

test('the zone is small and outside only: far away or toward the center is nothing', () => {
    assert.equal(cornerRotateAt(corners, center, { x: 130, y: -30 }), null, 'too far');
    assert.equal(cornerRotateAt(corners, center, { x: 90, y: 10 }), null, 'toward the center');
    assert.equal(cornerRotateAt(corners, center, { x: 50, y: 50 }), null, 'the center');
    assert.equal(cornerRotateAt(corners, center, { x: 100, y: -12 }), null, 'straight above the edge, not past a corner');
});

test('each corner gets its own curved double-arrow cursor, never the crosshair', () => {
    const cursors = Object.fromEntries(['nw', 'ne', 'se', 'sw'].map(c => [c, rotateCursorFor(c)]));
    assert.equal(new Set(Object.values(cursors)).size, 4, 'one cursor per corner');
    for (const [corner, cursor] of Object.entries(cursors)) {
        assert.match(cursor, /^url\("data:image\/svg\+xml,/, `${corner}: a data-url svg cursor`);
        assert.ok(!/crosshair/.test(cursor), `${corner}: not the crosshair`);
        assert.ok(cursor.includes('12 12') || cursor.includes('12%2012'), `${corner}: centered hotspot`);
    }
});

test('rotation math: the pointer angle around the center, snapped to 15 degrees with shift only', () => {
    assert.equal(snapRotateDelta(16, false), 16, 'no snap without shift');
    assert.equal(snapRotateDelta(16, true), 15, 'shift snaps to 15');
    assert.equal(snapRotateDelta(-16, true), -15, 'negative snaps too');
    assert.equal(snapRotateDelta(7.4, true), 0, 'rounds to the nearest step');
    assert.equal(snapRotateDelta(0, true), 0);
});
