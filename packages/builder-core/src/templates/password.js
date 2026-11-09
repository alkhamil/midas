import { INPUT } from './input.js';
import { inputFamily, CLEAR, COUNT } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Password: the Input (value, placeholder, prefix, suffix, disabled, read only, every size and status) with the text masked, and an eye at the end that shows or
// hides it (antd Input.Password: visibilityToggle). The eye is a built-in glyph, not an icon a designer picks: one layer of the instance, made while the toggle is on and
// removed when it is off. `eye` shows while the text is visible and `eyeOff` while it is hidden, so only one of them is ever a layer. A click on it flips
// `passwordVisible`, which Play and the export write as the input's type. The clear icon and the counter are out of scope here.

/** The glyph's colour is the placeholder's (antd's icon tint); disabled it is the disabled text. */
const TOGGLE = { fill: 'toggle-fg', size: 'iconSize' };

/** @type {TemplateSchema} */
export const PASSWORD = inputFamily({
    id: 'password',
    name: 'Password',
    sampleProps: { placeholder: 'Input password' },
    dropped: { anatomy: [...CLEAR.anatomy, ...COUNT.anatomy], icons: CLEAR.icons, props: [...CLEAR.props, ...COUNT.props], tokens: [...CLEAR.tokens, ...COUNT.tokens], playOnly: CLEAR.playOnly },
    added: {
        isControl: true,
        anatomy: [
            { id: 'eye', kind: 'glyph', glyph: 'eye', optional: true, managed: true, shownWhen: { all: [{ prop: 'visibilityToggle', is: true }, { prop: 'passwordVisible', is: true }] } },
            { id: 'eyeOff', kind: 'glyph', glyph: 'eyeOff', optional: true, managed: true, shownWhen: { all: [{ prop: 'visibilityToggle', is: true }, { prop: 'passwordVisible', is: false }] } },
        ],
        props: {
            // The eye is on by default. What the eye shows is the stored state `passwordVisible` (a click in Play flips it for the moment; the canvas holds the designer's choice).
            visibilityToggle: { source: 'literal', type: 'boolean', default: true },
            passwordVisible: { source: 'literal', type: 'boolean', default: false, visibleIf: { prop: 'visibilityToggle', is: true } },
        },
        tokens: { fromVariant: ['toggle-fg', 'toggle-fg-disabled'] },
        tokenKinds: { 'toggle-fg': 'color', 'toggle-fg-disabled': 'color' },
        tokenRoles: { 'toggle-fg': 'placeholder', 'toggle-fg-disabled': 'fg-disabled' },
        display: { eye: TOGGLE, eyeOff: TOGGLE },
        persistentStates: {
            visibilityToggle: { prop: 'visibilityToggle', tokens: {} },
            passwordVisible: { prop: 'passwordVisible', tokens: {} },
            disabled: { prop: 'disabled', tokens: { ...INPUT.persistentStates.disabled.tokens, 'toggle-fg': 'toggle-fg-disabled' } },
        },
        statePseudo: { visibilityToggle: '[data-visibility-toggle]', passwordVisible: '[data-password-visible]' },
        // The text is masked unless passwordVisible holds; the control has no counter.
        control: Object.fromEntries(Object.entries({ ...INPUT.control, maskUnless: 'passwordVisible' }).filter(([k]) => k !== 'count')),
        press: [{ slot: 'eye', toggle: 'passwordVisible' }, { slot: 'eyeOff', toggle: 'passwordVisible' }],
    },
});
