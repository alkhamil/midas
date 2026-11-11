// The built-in icon set: the icons the registry's templates need to be complete, as data (a name and a vector path). Every icon slot of every template takes the file's
// default icon (the first component named Icon/<name>), so the set holds one icon per role the schemas ask for, found from the schemas. The bundle creates what the file lacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { ICON_SET, ICON_PREFIX, defaultIconOf, iconNodes, iconRolesOf, planIcons } from '../src/behavior-engine/icon-set.js';
import { iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { pathCommands, pathSegments } from '../src/geometry/shapes.js';

const component = (id, name, parentId = null) => ({ id, name, type: 'frame', parentId, component: true });

test('the icon prefix is the file convention, Icon/', () => {
    assert.equal(ICON_PREFIX, 'Icon/');
});

test('the registry asks for five roles: default, close (Tag), eyeOn and eyeOff (Password), copy (Paragraph); every other icon slot takes the default icon', () => {
    const roles = iconRolesOf([...BUILT_IN_TEMPLATES.values()]);
    assert.deepEqual(roles, ['default', 'eyeOn', 'eyeOff', 'close', 'copy', 'alertSuccess', 'alertInfo', 'alertWarning', 'alertError']);
    // The slots behind them, by template: the close def names its role, every other icon def is a default-role slot.
    const slots = [...BUILT_IN_TEMPLATES.values()].flatMap(t => iconDefsOf(t).map(d => `${t.id}.${d.slot ?? d.placement}`));
    assert.ok(slots.includes('icon-button.icon') && slots.includes('input.clear') && slots.includes('button.iconStart'));
});

test('the set holds an icon for each role the registry asks for, and nothing else', () => {
    const roles = new Set(iconRolesOf([...BUILT_IN_TEMPLATES.values()]));
    assert.ok(ICON_SET.length >= 1);
    for (const entry of ICON_SET) assert.ok(roles.has(entry.role), `${entry.name} fills a role a template asks for`);
    for (const role of roles) assert.ok(ICON_SET.some(e => e.role === role), `${role} has an icon`);
    assert.deepEqual(ICON_SET.map(e => e.name), [...new Set(ICON_SET.map(e => e.name))], 'names are unique');
});

test('an icon is a component frame named Icon/<name> holding one vector path with a fill, so the foreground and the icon size bind', () => {
    for (const entry of ICON_SET) {
        const [root, path, ...rest] = iconNodes(entry, key => `n-${key}`);
        assert.deepEqual(rest, []);
        assert.equal(root.name, `Icon/${entry.name}`);
        assert.equal(root.type, 'frame');
        assert.equal(root.component, true);
        assert.equal(root.parentId, null);
        assert.deepEqual([root.w, root.h], [24, 24]);
        assert.equal(path.type, 'path');
        assert.equal(path.parentId, root.id);
        assert.ok(path.fills.some(f => f.visible !== false && f.type === 'solid'), 'a visible fill: the icon colour binds to it');
        assert.ok(pathCommands(path).length > 2, 'the outline draws');
        assert.notEqual(root.id, path.id);
    }
});

test('the default icon of a file is the first component named Icon/<name>, nested or not, on any page', () => {
    const pages = [{ nodes: [component('x', 'Button'), component('b', 'Icon/b', 'row'), component('a', 'Icon/a')] }, { nodes: [component('c', 'Icon/c')] }];
    assert.equal(defaultIconOf(pages), 'b');
    assert.equal(defaultIconOf([{ nodes: [component('x', 'Iconic')] }]), null);
    assert.equal(defaultIconOf([{ nodes: [{ id: 'f', name: 'Icon/f', type: 'frame' }] }]), null, 'a frame that is not a component is no icon');
    assert.equal(defaultIconOf([]), null);
});

test('in an empty file every icon of the set is to be created', () => {
    const plan = planIcons({ pages: [{ nodes: [] }] });
    assert.deepEqual(plan.create.map(e => e.name), ICON_SET.map(e => e.name));
    assert.deepEqual(plan.present, []);
});

test('an icon the file already has by name is never created again', () => {
    const own = ICON_SET[0];
    const plan = planIcons({ pages: [{ nodes: [component('mine', `Icon/${own.name}`)] }] });
    assert.deepEqual(plan.create.map(e => e.name), ICON_SET.slice(1).map(e => e.name));
    assert.deepEqual(plan.present.map(e => e.name), [own.name]);
});

test('a file that already has a default icon gets no icon for the default role, whatever it is called', () => {
    const plan = planIcons({ pages: [{ nodes: [component('theirs', 'Icon/arrow')] }] });
    assert.deepEqual(plan.create.filter(e => e.role === 'default'), []);
    assert.deepEqual(plan.present.filter(e => e.role === 'default').map(e => e.name), ICON_SET.filter(e => e.role === 'default').map(e => e.name));
});

/** The points of a cubic Bezier segment, sampled, as the outline the renderers draw. */
function sampleSegment(a, b, steps = 24) {
    const c1 = a.out ?? a, c2 = b.in ?? b, out = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        out.push({ x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x, y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y });
    }
    return out;
}

test('the circle is round: every sample along all four segments, the closing one included, is within a hair of the radius', () => {
    const circle = ICON_SET.find(e => e.name === 'circle');
    const [cx, cy, r] = [12, 12, 10];
    const segments = pathSegments(circle.points, circle.closed);
    assert.equal(segments.length, 4, 'a closed path has as many segments as points');
    for (const { from, to } of segments) {
        for (const p of sampleSegment(from, to)) assert.ok(Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) < 0.05, `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) is on the circle`);
    }
});

test('the four quadrants are identical by symmetry: the same handle length on every anchor', () => {
    const { points } = ICON_SET.find(e => e.name === 'circle');
    const lengths = points.flatMap(p => [Math.hypot(p.in.x - p.x, p.in.y - p.y), Math.hypot(p.out.x - p.x, p.out.y - p.y)]);
    for (const l of lengths) assert.ok(Math.abs(l - 10 * 0.5523) < 0.001, `handle ${l.toFixed(4)} is kappa times the radius`);
});

test('the segments of an outline: one per neighbouring pair, and for a closed one the closing segment from the last point back to the first, with its handles', () => {
    const pts = [{ x: 0, y: 0, out: { x: 1, y: 0 } }, { x: 5, y: 0 }, { x: 5, y: 5, out: { x: 5, y: 6 } }];
    assert.equal(pathSegments(pts, false).length, 2);
    const closed = pathSegments(pts, true);
    assert.equal(closed.length, 3);
    assert.deepEqual([closed[2].from, closed[2].to], [pts[2], pts[0]]);
    assert.equal(closed[2].curve, true, 'the closing segment has handles: it is drawn as a curve, not a chord');
    assert.equal(closed[1].curve, false, 'a segment with no handle is a straight line');
    assert.deepEqual(pathSegments([pts[0]], true), [], 'one point has no segment');
    assert.deepEqual(pathSegments([], true), []);
});

test('the outline commands walk the same segments, so the closing curve is drawn on every surface that reads them', () => {
    const circle = ICON_SET.find(e => e.name === 'circle');
    const [, path] = iconNodes(circle, key => key);
    const curves = pathCommands(path).filter(c => c.op === 'C');
    assert.equal(curves.length, 4);
    assert.deepEqual(pathCommands(path).filter(c => c.op === 'L'), [], 'no straight segment');
});

test('the icon path follows its component frame by Scale, so an instance at the icon size draws the whole outline, not a corner of it (see icon-tight-box.test.js)', () => {
    for (const entry of ICON_SET) {
        const [root, path] = iconNodes(entry, key => key);
        assert.equal(root.layout, 'horizontal', 'an auto layout frame holds the path');
        assert.deepEqual([path.layoutPositioning, path.constraintH, path.constraintV], ['absolute', 'scale', 'scale']);
        assert.deepEqual([path.pathW, path.pathH], [path.w, path.h], 'the outline is drawn in its own box');
    }
});


test('the close icon is a closed filled 12-point polygon in the 24 x 24 box, with straight edges (no handles), and Tag asks for it by the close role', () => {
    const close = ICON_SET.find(e => e.name === 'close');
    assert.ok(close, 'close is in the set');
    assert.equal(close.role, 'close');
    assert.equal(close.closed, true);
    assert.deepEqual(close.points.map(p => [p.x, p.y]), [
        [5.293, 6.707], [6.707, 5.293], [12, 10.586], [17.293, 5.293], [18.707, 6.707], [13.414, 12],
        [18.707, 17.293], [17.293, 18.707], [12, 13.414], [6.707, 18.707], [5.293, 17.293], [10.586, 12],
    ]);
    assert.ok(close.points.every(p => p.in === undefined && p.out === undefined), 'straight edges: no handles');
    assert.ok(iconRolesOf([BUILT_IN_TEMPLATES.get('antd-tag')]).includes('close'));
});
