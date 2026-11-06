// A managed text layer (docs/input-managed-text.md, step 3): a text or control anatomy slot with `managed: true` is a layer of an instance only.
// The schema must say when it is wanted (`shownWhen`), it is optional on a master, and the primary slot may be one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';

const SHOWN = { prop: 'hint', empty: false };
/** A template whose only text layer, the primary one, is managed, plus a plain placeholder-like required text. */
const BASE = {
    id: 'simple', name: 'Simple',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'note', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: SHOWN },
        { id: 'label', kind: 'text', typography: 'label' },
    ],
    primarySlot: 'label',
    icons: [],
    props: {
        size: BUTTON.props.size,
        label: { source: 'literal', type: 'string', default: 'Label', node: { key: 'label', field: 'text' } },
        hint: { source: 'literal', type: 'string', default: '' },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['labelTypography', 'gap', 'fg', 'fg-disabled'] },
    tokenKinds: { labelTypography: 'typography', gap: 'length', fg: 'color', 'fg-disabled': 'color' },
    tokenRoles: { labelTypography: BUTTON.tokenRoles.labelTypography, gap: 'gap', fg: 'fg', 'fg-disabled': 'fg-disabled' },
    persistentStates: { disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    display: { root: { gap: 'gap' }, label: { fill: 'fg', typography: 'labelTypography' } },
    events: [],
};
const problems = schema => validateTemplateSchema(schema).join('\n');
const withSlot = patch => ({ ...BASE, anatomy: [{ ...BASE.anatomy[0], ...patch }, BASE.anatomy[1]] });

test('a managed text slot with a condition is valid, and it needs no icon def', () => {
    assert.deepEqual(validateTemplateSchema(BASE), []);
});

test('a managed text slot must be optional and must say when it is wanted', () => {
    assert.match(problems(withSlot({ optional: false })), /managed anatomy slot "note" must be optional/);
    assert.match(problems(withSlot({ shownWhen: undefined })), /managed text slot "note" needs a shownWhen/);
    assert.match(problems(withSlot({ shownWhen: { prop: 'nope', empty: false } })), /anatomy slot "note" shownWhen/);
});

test('a managed frame is still refused, and alwaysVisible needs an icon slot', () => {
    assert.match(problems(withSlot({ alwaysVisible: true })), /alwaysVisible needs a managed icon slot/);
    assert.match(problems(withSlot({ kind: 'frame', layout: 'vertical' })), /frame slot "note" cannot be optional or managed/);
});

test('an icon def cannot name a managed text slot', () => {
    const icons = [{ show: 'disabled', component: 'hint', slot: 'note', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'gap' } }];
    assert.match(problems({ ...BASE, icons }), /slot "note" is not a managed anatomy slot/);
});

test('the primary slot may be managed: a template with no required text slot is valid when its primary one is managed', () => {
    const only = { ...BASE, primarySlot: 'note', anatomy: [BASE.anatomy[0]], props: { ...BASE.props, label: { ...BASE.props.label, node: { key: 'note', field: 'text' } } }, display: { root: { gap: 'gap' }, note: BASE.display.label } };
    assert.deepEqual(validateTemplateSchema(only), []);
});

test('a managed slot that is not text, control or icon is still refused', () => {
    assert.match(problems(withSlot({ kind: 'frame', layout: 'vertical', optional: undefined })), /cannot be optional or managed/);
});
