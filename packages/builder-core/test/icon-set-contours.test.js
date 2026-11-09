// An ICON_SET entry may carry more contours (sub-paths) and a fill rule. Icon creation carries both to the vector node, as the canvas draws them
// (shapes.js pathFor, the even-odd fill of midas.js). An entry with neither is a single contour filled nonzero, as it was before: no extra fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconNodes, ICON_SET } from '../src/behavior-engine/icon-set.js';

const idOf = key => `id-${key.replace(/[^a-z0-9]/gi, '')}`;
const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

test('a multi-contour entry round-trips to the vector node: every contour and the fill rule are carried', () => {
    const entry = { name: 'ring', role: 'test', closed: true, points: square(2, 2, 20), contours: [{ points: square(8, 8, 8), closed: true }], fillRule: 'evenodd' };
    const path = iconNodes(entry, idOf)[1];
    assert.deepEqual(path.points, entry.points, 'the outer contour is the points');
    assert.deepEqual(path.contours, entry.contours, 'the inner contour is carried, unchanged');
    assert.equal(path.fillRule, 'evenodd', 'the fill rule is carried');
});

test('the vector node takes a copy: changing the entry afterwards does not change the node', () => {
    const entry = { name: 'ring', role: 'test', closed: true, points: square(2, 2, 20), contours: [{ points: square(8, 8, 8), closed: true }], fillRule: 'evenodd' };
    const path = iconNodes(entry, idOf)[1];
    entry.contours[0].points[0].x = 99;
    assert.equal(path.contours[0].points[0].x, 8);
});

test('a fill rule without extra contours is carried too', () => {
    const entry = { name: 'one', role: 'test', closed: true, points: square(0, 0, 24), fillRule: 'evenodd' };
    const path = iconNodes(entry, idOf)[1];
    assert.equal(path.fillRule, 'evenodd');
    assert.equal(path.contours, undefined);
});

test('a single-contour entry without a fill rule is unchanged: no contours or fill rule on its node', () => {
    for (const entry of ICON_SET.filter(e => e.contours === undefined && e.fillRule === undefined)) {
        const path = iconNodes(entry, idOf)[1];
        assert.equal(path.contours, undefined, `${entry.name} has no contours`);
        assert.equal(path.fillRule, undefined, `${entry.name} has no fill rule`);
    }
});
