// A slot whose icon def names a role takes the glyph the file has for that role (the Icon/<name> component of the ICON_SET entry with that role) when
// it is created or newly shown; a role the file has no glyph for falls back to the file-wide default icon. A slot with no role is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newlyShownIconDefaults, createdIconDefaults } from '../src/behavior-engine/anatomy.js';
import { roleIconsOf } from '../src/behavior-engine/icon-set.js';

const ICON_TOKENS = { colour: 'fg', disabledColour: 'fg', size: 'iconSize' };
/** A template with one switched icon slot that asks for the close role, and one slot with no role. */
const WITH_ROLE = {
    id: 'rolecase', name: 'RoleCase', props: {
        on: { source: 'literal', type: 'boolean', default: false },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'on', is: true } },
        plainIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'on', is: true } },
    },
    anatomy: [{ id: 'close', kind: 'icon', optional: true, managed: true }, { id: 'plain', kind: 'icon', optional: true, managed: true }],
    icons: [
        { show: 'on', slot: 'close', component: 'closeIcon', role: 'close', tokens: ICON_TOKENS },
        { show: 'on', slot: 'plain', component: 'plainIcon', tokens: ICON_TOKENS },
    ],
};
const DEFAULT = 'def-circle', CLOSE = 'icon-close';

test('a role the file has a glyph for: the slot takes that glyph when newly shown, not the file default', () => {
    assert.deepEqual(newlyShownIconDefaults(WITH_ROLE, { on: false }, { on: true }, DEFAULT, { close: CLOSE }), { closeIcon: CLOSE, plainIcon: DEFAULT });
});

test('a role the file has no glyph for falls back to the file-wide default icon', () => {
    assert.deepEqual(newlyShownIconDefaults(WITH_ROLE, { on: false }, { on: true }, DEFAULT, {}), { closeIcon: DEFAULT, plainIcon: DEFAULT });
});

test('a slot with no role is unchanged: it takes the file default even when a role glyph exists', () => {
    const out = newlyShownIconDefaults(WITH_ROLE, { on: false }, { on: true }, DEFAULT, { close: CLOSE, default: 'x' });
    assert.equal(out.plainIcon, DEFAULT);
});

test('a slot holding a chosen icon is left alone, role or not', () => {
    assert.deepEqual(newlyShownIconDefaults(WITH_ROLE, { on: true, closeIcon: 'mine' }, { on: true, closeIcon: 'mine' }, DEFAULT, { close: CLOSE }), {});
});

test('creation takes the role glyph too: createdIconDefaults passes the role map through', () => {
    assert.deepEqual(createdIconDefaults(WITH_ROLE, { on: true }, DEFAULT, { close: CLOSE }), { closeIcon: CLOSE, plainIcon: DEFAULT });
    assert.deepEqual(createdIconDefaults(WITH_ROLE, { on: true }, DEFAULT), { closeIcon: DEFAULT, plainIcon: DEFAULT }, 'no map: as before');
});

test('the role map of a file: each ICON_SET role with a component named Icon/<name> in the file', () => {
    const pages = [{ nodes: [{ id: 'c', name: 'Icon/circle', component: true, type: 'frame' }] }];
    assert.deepEqual(roleIconsOf(pages), { default: 'c' });
    assert.deepEqual(roleIconsOf([{ nodes: [] }]), {}, 'no icon in the file, no role glyph');
});
