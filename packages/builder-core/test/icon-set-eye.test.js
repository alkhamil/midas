// The eye and eyeOff icons of ICON_SET are the solar eye glyphs converted losslessly: every sub-path (contour), each point with its handles, the
// even-odd fill rule. The icon's vector node is the glyph's vector layer, so the geometry is what the canvas draws for the glyph today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_SET, iconNodes, planIcons } from '../src/behavior-engine/icon-set.js';
import { glyphFields } from '../src/behavior-engine/glyphs.js';

/** A node's outline moved back by its offset in the frame: the entry's own coordinates (the node's box is the tight bounds, see icon-tight-box.test.js). */
const inFrame = (pts, node) => pts.map(p => ({ ...p, x: p.x + node.x, y: p.y + node.y, ...(p.in ? { in: { x: p.in.x + node.x, y: p.in.y + node.y } } : {}), ...(p.out ? { out: { x: p.out.x + node.x, y: p.out.y + node.y } } : {}) }));
const near = (a, b) => { assert.equal(a.length, b.length); a.forEach((p, i) => { for (const k of ['x', 'y']) assert.ok(Math.abs(p[k] - b[i][k]) < 1e-9, k + ' ' + p[k] + ' vs ' + b[i][k]); for (const h of ['in', 'out']) { assert.equal(!!p[h], !!b[i][h]); if (p[h]) for (const k of ['x', 'y']) assert.ok(Math.abs(p[h][k] - b[i][h][k]) < 1e-9, h); } }); };

const idOf = key => `id-${key.replace(/[^a-z0-9]/gi, '')}`;

for (const [name, role] of [['eye', 'eyeOn'], ['eyeOff', 'eyeOff']]) {
    test(`${name} is in ICON_SET with the role ${role}, a closed even-odd outline`, () => {
        const entry = ICON_SET.find(e => e.name === name);
        assert.ok(entry, `${name} is in the set`);
        assert.equal(entry.role, role);
        assert.equal(entry.closed, true);
        assert.equal(entry.fillRule, 'evenodd');
    });

    test(`${name}: the vector node is the solar glyph's layer, with every sub-path, its handles and the fill rule (translated into the tight box, no other change)`, () => {
        const glyph = glyphFields(name);
        const path = iconNodes(ICON_SET.find(e => e.name === name), idOf)[1];
        near(inFrame(path.points, path), glyph.points);
        assert.equal(path.contours.length, glyph.contours.length, 'every other sub-path');
        path.contours.forEach((c, i) => near(inFrame(c.points, path), glyph.contours[i].points));
        assert.equal(path.fillRule, glyph.fillRule, 'the even-odd fill rule');
    });
}

test('eye has its four sub-paths (the outline and three inner ones) and eyeOff three, as the glyph has', () => {
    assert.equal(1 + glyphFields('eye').contours.length, 4);
    assert.equal(1 + glyphFields('eyeOff').contours.length, 3);
});

test('the bundle creates only the icons the registry asks for: with its roles, eye and eyeOff are left out until a template asks', () => {
    const plan = planIcons({ pages: [{ nodes: [] }], roles: ['default', 'close'] });
    assert.deepEqual(plan.create.map(e => e.name), ['circle', 'close']);
    assert.deepEqual([...plan.create, ...plan.present].map(e => e.name).filter(n => n.startsWith('eye')), []);
});

test('without a roles list the plan covers the whole set, as before', () => {
    const plan = planIcons({ pages: [{ nodes: [] }] });
    assert.ok(plan.create.some(e => e.name === 'eye') && plan.create.some(e => e.name === 'eyeOff'));
});
