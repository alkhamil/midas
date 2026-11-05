// The built-in icon set: the icons the registry's templates need to be complete, as data (a name and a vector path). Every icon slot of every template takes the file's
// default icon (the first component named Icon/<name>), so the set holds one icon per role the schemas ask for, found from the schemas. The bundle creates what the file lacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { ICON_SET, ICON_PREFIX, defaultIconOf, iconNodes, iconRolesOf, planIcons } from '../src/behavior-engine/icon-set.js';
import { iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { pathCommands } from '../src/geometry/shapes.js';

const component = (id, name, parentId = null) => ({ id, name, type: 'frame', parentId, component: true });

test('the icon prefix is the file convention, Icon/', () => {
    assert.equal(ICON_PREFIX, 'Icon/');
});

test('the registry asks for one role: every icon slot of every template takes the default icon', () => {
    const roles = iconRolesOf([...BUILT_IN_TEMPLATES.values()]);
    assert.deepEqual(roles, ['default']);
    // The slots behind it, by template: nothing is special-cased, every icon def is a default-role slot.
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
