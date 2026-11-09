import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Radio (standalone; Radio.Group belongs to a later tier): a round box and, beside it, its label. The box is a container of the anatomy (a group frame): it
// draws the one border, the fill, the radius (the full radius, clamped to a circle) and its size, and holds the dot (checked), a managed icon slot. The label is
// a managed text layer, made while the text is not empty and the switch is on. Checked recolours the border only (the box keeps its fill and the dot is the
// mark, as in antd); Disabled is declared last, so it wins. Structure follows Ant Design (components/radio: checked, disabled); every value is a token.

/** The accent colour of a Color mode: default is the text colour, primary the brand colour, danger the error colour (Button's Color roles). */
const ACCENT = { default: 'text', primary: 'brand', danger: 'danger' };

/** @type {TemplateSchema} */
export const RADIO = {
    id: 'radio',
    name: 'Radio',
    isControl: true,
    // The primary text part: the label.
    primarySlot: 'label',
    // What Generate Design System builds the demo instance with: a label that reads.
    sampleProps: { label: 'Radio label' },
    element: { tag: 'label', attrs: { role: 'radio', tabindex: '0' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'box', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' },
        // The dot is a built-in outline (see glyphs.js), not an icon: a managed layer made while Checked is on, drawn in a colour token at a token's size.
        { id: 'dot', kind: 'glyph', glyph: 'dot', parent: 'box', optional: true, managed: true, shownWhen: { prop: 'checked', is: true } },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'hasLabel', is: true }, { prop: 'label', empty: false }] } },
    ],
    icons: [],
    // The row is left aligned and centred: the box and the label sit on one line.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        // The colours, as Button's Color collection holds its own: default is the text colour, primary the brand colour, danger the error colour. Only the accent follows
        // the mode (the checked fill and border, the glyph, the hover and focus border); the rest is the same in every mode. A new instance takes primary.
        color: { source: 'variable', collection: 'Color', modes: ['default', 'primary', 'danger'], defaultMode: 'primary' },
        // The Size collection holds sizes and typography only; the antd box has one size, so only the label's type follows the mode.
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        checked: { source: 'literal', type: 'boolean', default: false },
        hasLabel: { source: 'literal', type: 'boolean', default: true },
        label: { source: 'literal', type: 'string', default: 'Radio', node: { key: 'label', field: 'text' }, visibleIf: { prop: 'hasLabel', is: true }, remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromColor: ['box-bg', 'box-border', 'box-border-checked', 'box-border-hover', 'box-border-focus', 'box-bg-disabled', 'box-border-disabled', 'dot-fg', 'dot-fg-disabled', 'fg', 'fg-disabled'],
        fromSize: ['boxSize', 'boxRadius', 'borderWidth', 'indicatorSize', 'gap', 'labelTypography'],
    },
    tokenKinds: {
        'box-bg': 'color', 'box-border': 'color', 'box-border-checked': 'color', 'box-border-hover': 'color', 'box-border-focus': 'color', 'box-bg-disabled': 'color', 'box-border-disabled': 'color',
        boxSize: 'length', boxRadius: 'length', borderWidth: 'length', indicatorSize: 'length', gap: 'length', labelTypography: 'typography',
        'dot-fg': 'color', 'dot-fg-disabled': 'color', fg: 'color', 'fg-disabled': 'color',
    },
    tokenRoles: {
        'box-bg': 'transparent', 'box-border': 'border', 'box-border-checked': ACCENT, 'box-border-hover': ACCENT, 'box-border-focus': ACCENT, 'box-bg-disabled': 'bg-disabled', 'box-border-disabled': 'border',
        boxSize: 'box-size', boxRadius: 'radius-full', borderWidth: 'border-width', indicatorSize: 'indicator-size', gap: 'gap',
        labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        'dot-fg': ACCENT, 'dot-fg-disabled': 'fg-disabled', fg: 'fg', 'fg-disabled': 'fg-disabled',
    },
    // Checked recolours the border; Disabled is declared last, so it wins over Checked. The dot colours are the icon slot's own tokens.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'box-border': 'box-border-checked' } },
        disabled: { prop: 'disabled', tokens: { 'box-bg': 'box-bg-disabled', 'box-border': 'box-border-disabled', fg: 'fg-disabled', 'dot-fg': 'dot-fg-disabled' } },
    },
    // A click selects the radio; it does not unselect it.
    toggle: { prop: 'checked', once: true },
    // Motion (antd, timings and easings only): the ring recolours over 0.2s (ease); the dot scales in
    // from 0 over 0.3s (motionEaseInOutCirc). No click wave: the generic wave targets the host box,
    // while this host is the label row, so it would ripple the row, not the circle. Play and the
    // export read it; the canvas stays static.
    motion: {
        transitions: [
            { key: 'box', props: ['border-color'], duration: '0.2s', timing: 'ease' },
        ],
        appearances: [
            { key: 'dot', states: ['checked'], from: { transform: 'scale(0)', opacity: '0' }, duration: '0.3s', timing: 'cubic-bezier(0.78, 0.14, 0.15, 0.86)' },
        ],
    },
    // Hover and focus draw the box border in the brand colour while nothing replaces it (the checked look wins, as a persistent state does over a preview).
    previewStates: {
        hover: { 'box-border': 'box-border-hover' },
        focus: { 'box-border': 'box-border-focus' },
    },
    statePseudo: { hover: ':hover', focus: ':focus-visible', checked: '[data-checked]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        box: { fill: 'box-bg', stroke: 'box-border', strokeWidth: 'borderWidth', radius: 'boxRadius', size: 'boxSize' },
        dot: { fill: 'dot-fg', size: 'indicatorSize' },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
