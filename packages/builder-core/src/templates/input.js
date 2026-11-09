import { INPUT_BASE } from './input-base.js';
import { inputFamily } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Input: one template with a `kind` (text | password | textarea), as antd has Input, Input.Password and Input.TextArea. The text kind is the base (input-base.js). Password adds an
// eye at the end that shows or hides the text; TextArea wraps its text in a box at least `rows` lines tall, with the count and a resize grip on a line of their own below
// the text. A prop that applies to one kind is shown for that kind only (a hidden prop resolves to its default), and a layer a kind needs is made when the kind is chosen and
// removed when it is not: the eye (password), and the footer with the count and the grip (textarea). The clear icon, the sides and the visibility toggle are not kept
// across kinds that do not have them. InputNumber is its own template.

const KIND = prop => ({ prop: 'kind', is: prop });
const KIND_TEXT = KIND('text'), KIND_PASSWORD = KIND('password'), KIND_TEXTAREA = KIND('textarea');
const TEXT_OR_PASSWORD = { any: [KIND_TEXT, KIND_PASSWORD] };
/** The glyph of a password: shown while the toggle is on and the text is (or is not) visible. */
const EYE = visible => ({ all: [KIND_PASSWORD, { prop: 'visibilityToggle', is: true }, { prop: 'passwordVisible', is: visible }] });
/** The text area's footer line holds the count and the grip, so it is there while either is. */
const FOOTER = { all: [KIND_TEXTAREA, { any: [{ prop: 'showCount', is: true }, { prop: 'resize', is: 'vertical' }] }] };
/** The glyphs' colour and the disabled one; the eyes follow the icon size, the grip the clear icon's (smaller) size. */
const EYE_DISPLAY = { fill: 'glyph-fg', size: 'iconSize' };

/** @type {TemplateSchema} */
export const INPUT = inputFamily({
    id: 'input',
    name: 'Input',
    sampleProps: { placeholder: 'Input placeholder' },
    dropped: { anatomy: [], icons: [], props: [], tokens: [], playOnly: [] },
    added: {
        isControl: true,
        // Switching the kind lays the box out (a column for the text area) and sizes the text layers: the value and the placeholder fill the box in height too for a text
        // area, so the whole box is the field, and hug it otherwise.
        props: {
            kind: {
                source: 'literal', type: 'enum', options: ['text', 'password', 'textarea'], default: 'text', control: 'segmented',
                nodes: [
                    { key: 'root', field: 'layout', values: { text: 'horizontal', password: 'horizontal', textarea: 'vertical' } },
                    { key: 'value', field: 'heightSizing', values: { text: 'hug', password: 'hug', textarea: 'fill' } },
                    { key: 'placeholder', field: 'heightSizing', values: { text: 'hug', password: 'hug', textarea: 'fill' } },
                ],
            },
            // Password: the eye. Both are shown for that kind only.
            visibilityToggle: { source: 'literal', type: 'boolean', default: true, visibleIf: KIND_PASSWORD },
            passwordVisible: { source: 'literal', type: 'boolean', default: false, visibleIf: { all: [KIND_PASSWORD, { prop: 'visibilityToggle', is: true }] } },
            // TextArea: the rows, autoSize and the resize grip.
            rows: { source: 'literal', type: 'number', default: 3, visibleIf: KIND_TEXTAREA },
            autoSize: { source: 'literal', type: 'boolean', default: false, visibleIf: KIND_TEXTAREA },
            minRows: { source: 'literal', type: 'number', default: null, atMost: 'maxRows', visibleIf: { all: [KIND_TEXTAREA, { prop: 'autoSize', is: true }] } },
            maxRows: { source: 'literal', type: 'number', default: null, visibleIf: { all: [KIND_TEXTAREA, { prop: 'autoSize', is: true }] } },
            resize: { source: 'literal', type: 'enum', options: ['none', 'vertical'], default: 'none', control: 'segmented', visibleIf: { all: [KIND_TEXTAREA, { prop: 'autoSize', is: false }] } },
        },
        // What a kind does not have is hidden for it (and resolves to off).
        propPatch: {
            allowClear: { visibleIf: KIND_TEXT },
            showCount: { visibleIf: { any: [KIND_TEXT, KIND_TEXTAREA] } },
            hasPrefix: { visibleIf: TEXT_OR_PASSWORD },
            hasSuffix: { visibleIf: TEXT_OR_PASSWORD },
        },
        anatomyPatch: {
            // The inline count belongs to the single line; the text area counts in its footer.
            count: { shownWhen: { all: [{ prop: 'showCount', is: true }, KIND_TEXT] } },
        },
        anatomy: [
            { id: 'eye', kind: 'glyph', glyph: 'eye', optional: true, managed: true, shownWhen: EYE(true) },
            { id: 'eyeOff', kind: 'glyph', glyph: 'eyeOff', optional: true, managed: true, shownWhen: EYE(false) },
            { id: 'footer', kind: 'frame', layout: 'horizontal', primaryAlign: 'end', counterAlign: 'center', fill: true, managed: true, shownWhen: FOOTER },
            { id: 'countArea', kind: 'text', optional: true, managed: true, parent: 'footer', typography: 'count', fill: true, align: 'right', shownWhen: { all: [KIND_TEXTAREA, { prop: 'showCount', is: true }] }, text: { counter: { value: 'value', max: 'maxLength' } } },
            { id: 'resizeHandle', kind: 'glyph', glyph: 'resizeHandle', parent: 'footer', optional: true, managed: true, shownWhen: { all: [KIND_TEXTAREA, { prop: 'resize', is: 'vertical' }] } },
        ],
        tokens: { fromVariant: ['glyph-fg', 'glyph-fg-disabled'] },
        tokenKinds: { 'glyph-fg': 'color', 'glyph-fg-disabled': 'color' },
        // The glyphs rest in the placeholder colour (antd's icon tint) and take the disabled text colour when disabled.
        tokenRoles: { 'glyph-fg': 'placeholder', 'glyph-fg-disabled': 'fg-disabled' },
        display: {
            eye: EYE_DISPLAY,
            eyeOff: EYE_DISPLAY,
            countArea: { fill: 'placeholder', typography: 'countTypography' },
            resizeHandle: { fill: 'glyph-fg', size: 'clearIconSize' },
        },
        persistentStates: {
            visibilityToggle: { prop: 'visibilityToggle', tokens: {}, marker: true },
            passwordVisible: { prop: 'passwordVisible', tokens: {}, marker: true },
            disabled: { prop: 'disabled', tokens: { ...INPUT_BASE.persistentStates.disabled.tokens, 'glyph-fg': 'glyph-fg-disabled' } },
        },
        statePseudo: { visibilityToggle: '[data-visibility-toggle]', passwordVisible: '[data-password-visible]' },
        // The control is an input, a masked one for the password kind, a textarea for the text area kind whose whole box acts as the field.
        control: {
            ...INPUT_BASE.control,
            maskUnless: 'passwordVisible', maskWhen: KIND_PASSWORD,
            multiline: { rows: 'rows', autoSize: 'autoSize', minRows: 'minRows', maxRows: 'maxRows', resize: 'resize', when: KIND_TEXTAREA },
        },
        press: [{ slot: 'eye', toggle: 'passwordVisible' }, { slot: 'eyeOff', toggle: 'passwordVisible' }, { slot: 'resizeHandle', resize: true }],
        // The export also carries Input.Password and Input.TextArea, as antd does.
        subcomponents: [{ name: 'Password', props: { kind: 'password' } }, { name: 'TextArea', props: { kind: 'textarea' } }],
    },
});
