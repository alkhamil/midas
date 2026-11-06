import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Checkbox: a box and, beside it, its label. The box is a container of the anatomy (a group frame): it draws the one border, the fill, the radius and its size,
// and holds the checkmark (checked) or the square (indeterminate), each a managed icon slot of its own. The label is a managed text layer, made while the text
// is not empty and the switch is on; the text stays in its prop. Checked and Indeterminate exclude each other, and the box reads the checked tokens only while
// checked (Disabled is declared last, so it wins). The glyph slots are on the instance from the start and drawn only while their state holds (showWhen), so Play can
// show them on a click. Structure follows Ant Design (components/checkbox: checked, indeterminate, disabled); values are tokens.

const CHECK = { colour: 'check-fg', disabledColour: 'glyph-fg-disabled', size: 'checkSize' };
const SQUARE = { colour: 'dash-fg', disabledColour: 'glyph-fg-disabled', size: 'indicatorSize' };

/** @type {TemplateSchema} */
export const CHECKBOX = {
    id: 'checkbox',
    name: 'Checkbox',
    isControl: true,
    // The primary text part: the label.
    primarySlot: 'label',
    // What Generate Design System builds the demo instance with: a label that reads.
    sampleProps: { label: 'Checkbox label' },
    element: { tag: 'label', attrs: { role: 'checkbox', tabindex: '0' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'box', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' },
        { id: 'check', kind: 'icon', managed: true, alwaysVisible: true, parent: 'box' },
        { id: 'indeterminate', kind: 'icon', managed: true, alwaysVisible: true, parent: 'box' },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'hasLabel', is: true }, { prop: 'label', empty: false }] } },
    ],
    icons: [
        { showWhen: 'checked', slot: 'check', component: 'checkIcon', role: 'check', label: 'Check icon', tokens: CHECK },
        { showWhen: 'indeterminate', slot: 'indeterminate', component: 'indeterminateIcon', role: 'indeterminate', label: 'Indeterminate icon', tokens: SQUARE },
    ],
    // The row is left aligned and centred: the box and the label sit on one line.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        // The one dimension: the Size collection holds every token (as FormItem's does). The antd box has one size, so only the label's type follows the mode.
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        checked: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'indeterminate' },
        checkIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'checked', is: true }, remembered: true },
        indeterminate: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'checked' },
        indeterminateIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'indeterminate', is: true }, remembered: true },
        hasLabel: { source: 'literal', type: 'boolean', default: true },
        label: { source: 'literal', type: 'string', default: 'Checkbox', node: { key: 'label', field: 'text' }, visibleIf: { prop: 'hasLabel', is: true }, remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['box-bg', 'box-border', 'box-bg-checked', 'box-border-checked', 'box-border-hover', 'box-border-focus', 'box-bg-disabled', 'box-border-disabled', 'boxSize', 'boxRadius', 'borderWidth', 'checkSize', 'indicatorSize', 'gap', 'labelTypography', 'check-fg', 'dash-fg', 'glyph-fg-disabled', 'fg', 'fg-disabled'],
    },
    tokenKinds: {
        'box-bg': 'color', 'box-border': 'color', 'box-bg-checked': 'color', 'box-border-checked': 'color', 'box-border-hover': 'color', 'box-border-focus': 'color', 'box-bg-disabled': 'color', 'box-border-disabled': 'color',
        boxSize: 'length', boxRadius: 'length', borderWidth: 'length', checkSize: 'length', indicatorSize: 'length', gap: 'length', labelTypography: 'typography',
        'check-fg': 'color', 'dash-fg': 'color', 'glyph-fg-disabled': 'color', fg: 'color', 'fg-disabled': 'color',
    },
    tokenRoles: {
        'box-bg': 'bg', 'box-border': 'border', 'box-bg-checked': 'brand', 'box-border-checked': 'brand', 'box-border-hover': 'brand', 'box-border-focus': 'brand', 'box-bg-disabled': 'bg-disabled', 'box-border-disabled': 'border',
        boxSize: 'box-size', boxRadius: 'radius-sm', borderWidth: 'border-width', checkSize: 'icon-sm', indicatorSize: 'indicator-size', gap: 'gap', labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        'check-fg': 'bg', 'dash-fg': 'brand', 'glyph-fg-disabled': 'fg-disabled', fg: 'fg', 'fg-disabled': 'fg-disabled',
    },
    // Checked swaps the box colours; Disabled is declared last, so it wins over Checked. The glyph colours are the icon slots' own tokens.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'box-bg': 'box-bg-checked', 'box-border': 'box-border-checked' } },
        // Indeterminate swaps no token (the box keeps its colours, the square is the mark); it is a state so the root says it as an attribute.
        indeterminate: { prop: 'indeterminate', tokens: {} },
        disabled: { prop: 'disabled', tokens: { 'box-bg': 'box-bg-disabled', 'box-border': 'box-border-disabled', fg: 'fg-disabled' } },
    },
    // A click turns Checked on and off and ends Indeterminate.
    toggle: { prop: 'checked', clears: 'indeterminate' },
    // Hover and focus draw the box border in the brand colour while nothing replaces it (the checked look wins, as a persistent state does over a preview).
    previewStates: {
        hover: { 'box-border': 'box-border-hover' },
        focus: { 'box-border': 'box-border-focus' },
    },
    statePseudo: { hover: ':hover', focus: ':focus-visible', checked: '[data-checked]', indeterminate: '[data-indeterminate]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        box: { fill: 'box-bg', stroke: 'box-border', strokeWidth: 'borderWidth', radius: 'boxRadius', size: 'boxSize' },
        check: { size: CHECK.size },
        indeterminate: { size: SQUARE.size },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
