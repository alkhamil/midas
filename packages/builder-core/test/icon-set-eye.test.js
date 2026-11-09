// The eye and eyeOff icons of ICON_SET are the solar eye glyphs converted losslessly: every sub-path (contour), each point with its handles, the
// even-odd fill rule. The icon's vector node is the glyph's vector layer, so the geometry is what the canvas draws for the glyph today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_SET, iconNodes, planIcons } from '../src/behavior-engine/icon-set.js';
import { glyphFields } from '../src/behavior-engine/glyphs.js';

const idOf = key => `id-${key.replace(/[^a-z0-9]/gi, '')}`;

for (const [name, role] of [['eye', 'eyeOn'], ['eyeOff', 'eyeOff']]) {
    test(`${name} is in ICON_SET with the role ${role}, a closed even-odd outline`, () => {
        const entry = ICON_SET.find(e => e.name === name);
        assert.ok(entry, `${name} is in the set`);
        assert.equal(entry.role, role);
        assert.equal(entry.closed, true);
        assert.equal(entry.fillRule, 'evenodd');
    });

    test(`${name}: the vector node is the solar glyph's layer, with every sub-path, its handles and the fill rule (no geometry change)`, () => {
        const glyph = glyphFields(name);
        const path = iconNodes(ICON_SET.find(e => e.name === name), idOf)[1];
        assert.deepEqual(path.points, glyph.points, 'the first sub-path and its handles');
        assert.deepEqual(path.contours, glyph.contours, 'every other sub-path, with its handles');
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
