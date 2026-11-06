import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Radio (standalone; Radio.Group belongs to a later tier): a round box and, beside it, its label. The box is a container of the anatomy (a group frame): it
// draws the one border, the fill, the radius (the full radius, clamped to a circle) and its size, and holds the dot (checked), a managed icon slot. The label is
// a managed text layer, made while the text is not empty and the switch is on. Checked recolours the border only (the box keeps its fill and the dot is the
// mark, as in antd); Disabled is declared last, so it wins. Structure follows Ant Design (components/radio: checked, disabled); every value is a token.

const DOT = { colour: 'dot-fg', disabledColour: 'dot-fg-disabled', size: 'indicatorSize' };

/** @type {TemplateSchema} */
export const RADIO = {
    id: 'radio',
    name: 'Radio',
    isControl: true,
    // The primary text part: the label.
    primarySlot: 'label',
    // What Generate Design System builds the demo instance with: a label that reads.
    sampleProps: { label: 'Radio label' },
    element: { tag: 'label', attrs: { role: 'radio' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'box', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' },
        { id: 'dot', kind: 'icon', managed: true, alwaysVisible: true, parent: 'box' },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'hasLabel', is: true }, { prop: 'label', empty: false }] } },
    ],
    icons: [
        { showWhen: 'checked', slot: 'dot', component: 'dotIcon', role: 'dot', label: 'Dot icon', tokens: DOT },
    ],
    // The row is left aligned and centred: the box and the label sit on one line.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        // The one dimension: the Size collection holds every token (as FormItem's does); the antd box has one size, so only the label's type follows the mode.
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        checked: { source: 'literal', type: 'boolean', default: false },
        dotIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'checked', is: true }, remembered: true },
        hasLabel: { source: 'literal', type: 'boolean', default: true },
        label: { source: 'literal', type: 'string', default: 'Radio', node: { key: 'label', field: 'text' }, visibleIf: { prop: 'hasLabel', is: true }, remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['box-bg', 'box-border', 'box-border-checked', 'box-bg-disabled', 'box-border-disabled', 'boxSize', 'boxRadius', 'borderWidth', 'indicatorSize', 'gap', 'labelTypography', 'dot-fg', 'dot-fg-disabled', 'fg', 'fg-disabled'],
    },
    tokenKinds: {
        'box-bg': 'color', 'box-border': 'color', 'box-border-checked': 'color', 'box-bg-disabled': 'color', 'box-border-disabled': 'color',
        boxSize: 'length', boxRadius: 'length', borderWidth: 'length', indicatorSize: 'length', gap: 'length', labelTypography: 'typography',
        'dot-fg': 'color', 'dot-fg-disabled': 'color', fg: 'color', 'fg-disabled': 'color',
    },
    tokenRoles: {
        'box-bg': 'bg', 'box-border': 'border', 'box-border-checked': 'brand', 'box-bg-disabled': 'bg-disabled', 'box-border-disabled': 'border',
        boxSize: 'box-size', boxRadius: 'radius-full', borderWidth: 'border-width', indicatorSize: 'indicator-size', gap: 'gap',
        labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        'dot-fg': 'brand', 'dot-fg-disabled': 'fg-disabled', fg: 'fg', 'fg-disabled': 'fg-disabled',
    },
    // Checked recolours the border; Disabled is declared last, so it wins over Checked. The dot colours are the icon slot's own tokens.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'box-border': 'box-border-checked' } },
        disabled: { prop: 'disabled', tokens: { 'box-bg': 'box-bg-disabled', 'box-border': 'box-border-disabled', fg: 'fg-disabled' } },
    },
    // A click selects the radio; it does not unselect it.
    toggle: { prop: 'checked', once: true },
    previewStates: {},
    statePseudo: { checked: '[data-checked]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        box: { fill: 'box-bg', stroke: 'box-border', strokeWidth: 'borderWidth', radius: 'boxRadius', size: 'boxSize' },
        dot: { size: DOT.size },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
