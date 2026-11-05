// A managed icon slot may be `alwaysVisible`: on every instance, with no show switch and not optional. Button and Input do not set it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planInstanceAnatomy, planAnatomy, newlyShownIconDefaults } from '../src/behavior-engine/anatomy.js';
import { slotShown, slotWanted } from '../src/behavior-engine/template-master.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';
import { ICON_TOKENS } from '../src/templates/icon-slots.js';

/** A template with one always visible icon slot and no text slot (only what the engine needs; the registry is not touched). */
const ONLY_ICON = {
    id: 'only-icon', name: 'Only icon',
    element: { tag: 'button', attrs: { type: 'button' }, disabledState: 'disabled', blockClickProps: ['disabled'] },
    anatomy: [{ id: 'icon', kind: 'icon', managed: true, alwaysVisible: true }],
    icons: [{ slot: 'icon', component: 'icon', tokens: ICON_TOKENS }],
    props: {
        size: BUTTON.props.size,
        icon: { source: 'literal', type: 'iconComponent', default: null },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['iconSize', 'fg', 'fg-disabled'] },
    tokenKinds: { iconSize: 'length', fg: 'color', 'fg-disabled': 'color' },
    tokenRoles: { iconSize: BUTTON.tokenRoles.iconSize, fg: 'fg', 'fg-disabled': 'fg-disabled' },
    persistentStates: { disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    display: { root: {}, icon: { size: 'iconSize' } },
    events: [],
};

test('a master of a template with an always visible slot and no text slot gets its icon slot from the anatomy plan', () => {
    const switched = { ...ONLY_ICON, anatomy: [{ id: 'icon', kind: 'icon', optional: true, managed: true }], icons: [{ show: 'hasIcon', slot: 'icon', component: 'icon', tokens: ICON_TOKENS }], props: { ...ONLY_ICON.props, hasIcon: { source: 'literal', type: 'boolean', default: false } } };
    for (const [template, stored] of [[ONLY_ICON, { icon: 'ic1' }]]) {
        TEMPLATES.set(template.id, template);
        try {
            const out = planInstanceAnatomy({ binding: { templateId: template.id }, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'r', type: 'frame' }], stored, children: [] });
            assert.equal(out.reason, undefined);
            assert.deepEqual(out.ops, [{ op: 'insert', slot: 'icon', index: 0, component: 'ic1' }]);
        } finally { TEMPLATES.delete(template.id); }
    }
});

test('an always visible slot is shown with no switch, in the plan, the slot rules and the panel values', () => {
    assert.equal(slotWanted(ONLY_ICON, 'icon', {}), true);
    assert.equal(slotShown(ONLY_ICON, 'icon', {}), true);
    assert.deepEqual(planAnatomy(ONLY_ICON, { icon: null }, []), [{ op: 'insert', slot: 'icon', index: 0 }]);
    const kept = planAnatomy(ONLY_ICON, { icon: 'ic2' }, [{ id: 'x', slot: 'icon', component: 'ic1' }]);
    assert.deepEqual(kept, [{ op: 'swap', id: 'x', component: 'ic2' }]);
});

test('an always visible slot takes the default icon while none was ever chosen, and keeps one it holds or cleared', () => {
    assert.deepEqual(newlyShownIconDefaults(ONLY_ICON, {}, {}, 'def'), { icon: 'def' }, 'never chosen');
    assert.deepEqual(newlyShownIconDefaults(ONLY_ICON, { icon: 'mine' }, { icon: 'mine' }, 'def'), {});
    assert.deepEqual(newlyShownIconDefaults(ONLY_ICON, { icon: 'mine' }, { icon: null }, 'def'), {}, 'an icon cleared on purpose stays cleared');
    assert.deepEqual(newlyShownIconDefaults(ONLY_ICON, { icon: null }, { icon: null }, 'def'), {});
    assert.deepEqual(newlyShownIconDefaults(ONLY_ICON, {}, {}, null), {}, 'no default icon in the document');
});

test('the schema accepts alwaysVisible on a managed icon slot with no show switch', () => {
    assert.deepEqual(validateTemplateSchema(ONLY_ICON), []);
});

test('alwaysVisible must be a boolean, on a managed icon slot, and such a slot has no show switch and is not optional', () => {
    const slot = patch => ({ ...ONLY_ICON, anatomy: [{ ...ONLY_ICON.anatomy[0], ...patch }] });
    assert.match(validateTemplateSchema(slot({ alwaysVisible: 'yes' })).join('\n'), /alwaysVisible must be true or false/);
    assert.match(validateTemplateSchema(slot({ alwaysVisible: true, managed: undefined })).join('\n'), /alwaysVisible needs a managed icon slot/);
    assert.match(validateTemplateSchema(slot({ optional: true })).join('\n'), /alwaysVisible slot "icon" cannot be optional/);
    const withShow = { ...ONLY_ICON, icons: [{ ...ONLY_ICON.icons[0], show: 'hasIcon' }], props: { ...ONLY_ICON.props, hasIcon: { source: 'literal', type: 'boolean', default: true } } };
    assert.match(validateTemplateSchema(withShow).join('\n'), /icon def 0 shows an alwaysVisible slot, so it has no show switch/);
});

test('a managed slot that is not alwaysVisible keeps its rules: it is optional and its def needs a show switch', () => {
    const plain = { ...ONLY_ICON, anatomy: [{ id: 'icon', kind: 'icon', managed: true }] };
    assert.match(validateTemplateSchema(plain).join('\n'), /managed anatomy slot "icon" must be optional/);
    const optional = { ...ONLY_ICON, anatomy: [{ id: 'icon', kind: 'icon', managed: true, optional: true }] };
    assert.match(validateTemplateSchema(optional).join('\n'), /icon def 0 show "undefined" is not a boolean prop/);
    assert.match(validateTemplateSchema({ ...ONLY_ICON, anatomy: [] }).join('\n'), /anatomy needs a required text or control slot/);
});

test('Button and Input set no alwaysVisible', () => {
    for (const id of ['button', 'input']) assert.ok(TEMPLATES.get(id).anatomy.every(s => s.alwaysVisible === undefined), id);
});
