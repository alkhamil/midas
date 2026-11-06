// An icon def may name a `role` (check, indeterminate, dot): its slot starts with the file's icon of that role (Icon/<name> whose set entry has that role), and
// with the default icon when the file has none. The bundle creates one icon per role the set holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_PREFIX, defaultIconOf, iconResolverOf } from '../src/behavior-engine/icon-set.js';
import { newlyShownIconDefaults } from '../src/behavior-engine/anatomy.js';
import { BOXY } from './helpers/box-template.js';

const roleBoxy = (() => {
    const t = structuredClone(BOXY);
    t.icons[0].role = 'check';
    return t;
})();
const pageOf = names => ({ nodes: names.map((name, i) => ({ id: `n${i}`, name: ICON_PREFIX + name, component: true })) });

test('the resolver gives the icon of a role, else the default icon, else nothing', () => {
    const set = [{ name: 'disc', role: 'default' }, { name: 'tick', role: 'check' }];
    const role = { default: 'disc', check: 'tick' };
    const resolve = iconResolverOf([pageOf([role.default, role.check])], set);
    assert.equal(resolve('check'), 'n1');
    assert.equal(resolve('dot'), 'n0', 'no dot icon: the default icon');
    assert.equal(resolve('default'), 'n0');
    assert.equal(iconResolverOf([pageOf([])], set)('check'), null);
    assert.equal(defaultIconOf([pageOf([role.default])]), 'n0');
});

test('a slot that starts to show takes the icon of its role; a plain id still means the default icon for every slot', () => {
    const resolve = role => ({ check: 'icon-check', default: 'icon-disc' })[role] ?? null;
    assert.deepEqual(newlyShownIconDefaults(roleBoxy, null, { checked: true }, resolve), { checkIcon: 'icon-check' });
    assert.deepEqual(newlyShownIconDefaults(roleBoxy, null, { checked: true }, 'icon-disc'), { checkIcon: 'icon-disc' });
    assert.deepEqual(newlyShownIconDefaults(BOXY, null, { checked: true }, resolve), { checkIcon: 'icon-disc' }, 'a def with no role takes the default');
    assert.deepEqual(newlyShownIconDefaults(roleBoxy, null, { checked: true }, () => null), {}, 'nothing to take');
});
