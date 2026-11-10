import { INPUT_BASE } from './input-base.js';
import { inputFamily } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Input: one template with a `kind` (text | password | textarea), as antd has Input, Input.Password and Input.TextArea. The text kind is the base (input-base.js). Password adds an
// eye at the end that shows or hides the text; TextArea wraps its text in a box at least `rows` lines tall, with the count and a resize grip on a line of their own below
// the text. A prop that applies to one kind is shown for that kind only (a hidden prop resolves to its default), and a layer a kind needs is made when the kind is chosen and
// removed when it is not: the eye (password), and the footer with the count and the grip (textarea). The clear icon and the sides are not kept
// across kinds that do not have them. The password eye is always on: pressing its box flips a local state that swaps the eye and unmasks the text.
// InputNumber is its own template.

const KIND = prop => ({ prop: 'kind', is: prop });
const KIND_TEXT = KIND('text'), KIND_PASSWORD = KIND('password'), KIND_TEXTAREA = KIND('textarea');
const TEXT_OR_PASSWORD = { any: [KIND_TEXT, KIND_PASSWORD] };
/** The eye box of a password: shown for the password kind (pressing it flips a local revealed state, no prop). */
/** The text area's footer line holds the count, so it is there while the count is. */
const FOOTER = { all: [KIND_TEXTAREA, { prop: 'showCount', is: true }] };
/** The eye icons: the glyph colour, its disabled and hover colours, and the icon size. */
const EYE_TOKENS = { colour: 'glyph-fg', disabledColour: 'glyph-fg-disabled', size: 'iconSize', hoverColour: 'glyph-fg-hover' };

/** @type {TemplateSchema} */
export const INPUT = inputFamily({
    id: 'input',
    name: 'Input',
    sampleProps: { placeholder: 'Input placeholder' },
    dropped: { anatomy: [], icons: [], props: [], tokens: [], playOnly: [] },
    added: {
        isControl: true,
        // The eye icons: each names its picker and its role (the default glyph the icon set gives it). Both show for the password kind through one
        // derived switch; the hidden state's eye holds the canvas layer, while the revealed state's eye is prop-only, drawn by Play and the export from its component.
        icons: [
            { show: 'eyeShown', slot: 'eyeOn', component: 'eyeOnIcon', role: 'eyeOn', label: 'Icon eyeOn', tokens: EYE_TOKENS, swap: { by: 'revealed', is: true } },
            { show: 'eyeShown', slot: 'eyeOff', component: 'eyeOffIcon', role: 'eyeOff', label: 'Icon eyeOff', tokens: EYE_TOKENS, swap: { by: 'revealed', is: false } },
        ],
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
            // Password: the eye is always on for the kind. Pressing the eye box flips a local revealed state that swaps the eye and unmasks the text: no prop, no panel control.
            // The eye icons: each picks its icon (role default from the icon set), shown for the password kind; one derived switch drives both defs, so the kind stays out of the Slots section.
            eyeShown: { source: 'literal', type: 'boolean', default: false, derived: { when: KIND_PASSWORD } },
            eyeOnIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: KIND_PASSWORD, remembered: true },
            eyeOffIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: KIND_PASSWORD, remembered: true },
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
            // The eye box holds the hidden state's eye only (one layer, never hidden): the box is the toggle's click target.
            { id: 'eyeBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: KIND_PASSWORD },
            { id: 'eyeOff', kind: 'icon', parent: 'eyeBox', optional: true, managed: true },
            { id: 'footer', kind: 'frame', layout: 'horizontal', primaryAlign: 'end', counterAlign: 'center', fill: true, managed: true, shownWhen: FOOTER },
            { id: 'countArea', kind: 'text', optional: true, managed: true, parent: 'footer', typography: 'count', fill: true, align: 'right', shownWhen: { all: [KIND_TEXTAREA, { prop: 'showCount', is: true }] }, text: { counter: { value: 'value', max: 'maxLength' } } },
            // The grip is out of the flow, in the bottom right corner of the box (corner): it ignores the padding and the footer.
            { id: 'resizeHandle', kind: 'glyph', glyph: 'resizeHandle', corner: 'bottom-right', inset: 'glyphInset', optional: true, managed: true, shownWhen: { all: [KIND_TEXTAREA, { prop: 'resize', is: 'vertical' }] } },
        ],
        tokens: { fromSize: ['glyphInset'], fromVariant: ['glyph-fg', 'glyph-fg-hover', 'glyph-fg-disabled'] },
        tokenKinds: { glyphInset: 'length', 'glyph-fg': 'color', 'glyph-fg-hover': 'color', 'glyph-fg-disabled': 'color' },
        // The glyphs rest in the placeholder colour (antd's icon tint), the eyes take the text colour while hovered (Play and the export only), and the disabled text colour when disabled.
        tokenRoles: { glyphInset: 'glyph-inset', 'glyph-fg': 'placeholder', 'glyph-fg-hover': 'fg', 'glyph-fg-disabled': 'fg-disabled' },
        display: {
            countArea: { fill: 'placeholder', typography: 'countTypography' },
            // The eyes are drawn at the icon size (the icon slots' size token).
            eyeOn: { size: 'iconSize' },
            eyeOff: { size: 'iconSize' },
            resizeHandle: { fill: 'glyph-fg', size: 'clearIconSize' },
        },
        persistentStates: {
            disabled: { prop: 'disabled', tokens: { ...INPUT_BASE.persistentStates.disabled.tokens, 'glyph-fg': 'glyph-fg-disabled' } },
        },
        // The control is an input, a masked one for the password kind, a textarea for the text area kind whose whole box acts as the field.
        control: {
            ...INPUT_BASE.control,
            maskUnless: 'revealed', maskWhen: KIND_PASSWORD,
            multiline: { rows: 'rows', autoSize: 'autoSize', minRows: 'minRows', maxRows: 'maxRows', resize: 'resize', when: KIND_TEXTAREA },
        },
        press: [{ slot: 'eyeBox', toggleState: 'revealed' }, { slot: 'resizeHandle', resize: true }],
        // The export also carries Input.Password and Input.TextArea, as antd does.
        subcomponents: [{ name: 'Password', props: { kind: 'password' } }, { name: 'TextArea', props: { kind: 'textarea' } }],
    },
});
