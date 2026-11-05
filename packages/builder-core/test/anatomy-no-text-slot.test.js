// A template with no text slot: its managed icon slot, parts and ordering must still work (the engine asks the template, not the master's layers).
// The anatomy plan asks the template whether it has a text slot, not the master whether it has a text layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planInstanceAnatomy, planAnatomy, newlyShownIconDefaults } from '../src/behavior-engine/anatomy.js';
import { sidedPartOrder, slotShown, slotWanted, instanceOf } from '../src/behavior-engine/template-master.js';
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
        icon: { source: 'literal', type: 'iconComponent', default: null, remembered: true },
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

test('a master of a template with no text slot still gets its icon slot from the anatomy plan', () => {
    const switched = { ...ONLY_ICON, anatomy: [{ id: 'icon', kind: 'icon', optional: true, managed: true }], icons: [{ show: 'hasIcon', slot: 'icon', component: 'icon', tokens: ICON_TOKENS }], props: { ...ONLY_ICON.props, hasIcon: { source: 'literal', type: 'boolean', default: false } } };
    for (const [template, stored] of [[switched, { hasIcon: true, icon: 'ic1' }]]) {
        TEMPLATES.set(template.id, template);
        try {
            const out = planInstanceAnatomy({ binding: { templateId: template.id }, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'r', type: 'frame' }], stored, children: [] });
            assert.equal(out.reason, undefined);
            assert.deepEqual(out.ops, [{ op: 'insert', slot: 'icon', index: 0, component: 'ic1' }]);
        } finally { TEMPLATES.delete(template.id); }
    }
});

test('a template that declares a text slot still needs a text layer in its master, and an auto layout root', () => {
    const button = planInstanceAnatomy({ binding: { templateId: 'button' }, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'r', type: 'frame' }], stored: {}, children: [] });
    assert.equal(button.reason, 'the master has no text layer');
    const flat = planInstanceAnatomy({ binding: { templateId: 'button' }, masterRoot: { isAutoLayout: false }, masterTree: [{ id: 'r', type: 'text' }], stored: {}, children: [] });
    assert.equal(flat.reason, 'the master is not an auto layout frame');
});
