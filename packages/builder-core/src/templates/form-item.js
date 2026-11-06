import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/**
 * FormItem: a label and the control it labels. The label sits in a box with the required mark; the control is a content slot (a frame that instances fill),
 * not a layer of the template: an Input goes into it. Vertical (the default) puts the label above the control, Horizontal to its left. The space between
 * them is the `labelGap` prop and nothing else (no token), and the control fills the width it is given. Schema only; validation (rules, status) is not part of it.
 * @type {TemplateSchema}
 */
export const FORM_ITEM = {
    id: 'formitem',
    name: 'FormItem',
    // The primary text part: the label text.
    primarySlot: 'label',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'labelBox', kind: 'frame', layout: 'horizontal' },
        // The required mark sits before the label, shown while `required` is on.
        { id: 'requiredMark', kind: 'text', optional: true, managed: true, parent: 'labelBox', typography: 'label', shownWhen: { prop: 'required', is: true } },
        { id: 'label', kind: 'text', parent: 'labelBox', typography: 'label' },
    ],
    icons: [],
    // The label is above the control until the layout says Horizontal.
    rootLayout: 'vertical',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        label: { source: 'literal', type: 'string', default: 'Label', node: { key: 'label', field: 'text' } },
        required: { source: 'literal', type: 'boolean', default: false },
        requiredMark: { source: 'literal', type: 'string', default: '*', node: { key: 'requiredMark', field: 'text' }, visibleIf: { prop: 'required', is: true } },
        // The label's place: above the control (Vertical) or to its left (Horizontal). The root's own layout, written on each instance.
        layout: { source: 'literal', type: 'enum', options: ['vertical', 'horizontal'], default: 'vertical', node: { key: 'root', field: 'layout' } },
        // The width of the label box in Horizontal (none: it hugs its label); not used in Vertical, so not shown there.
        labelWidth: { source: 'literal', type: 'number', default: null, node: { key: 'labelBox', field: 'width' }, visibleIf: { prop: 'layout', is: 'horizontal' } },
        // The space between the label and the control, in both layouts: the root's gap, the one source of it.
        labelGap: { source: 'literal', type: 'number', default: 8, node: { key: 'root', field: 'gap' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['labelTypography', 'fg', 'fg-disabled', 'mark'] },
    tokenKinds: { labelTypography: 'typography', fg: 'color', 'fg-disabled': 'color', mark: 'color' },
    tokenRoles: {
        labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        fg: 'fg',
        'fg-disabled': 'fg-disabled',
        mark: 'error',
    },
    persistentStates: { disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    // The control this item labels takes an Input; a Select joins it once that template exists.
    slots: [{ id: 'control', name: 'Control', description: 'The control this item labels', min: 1, max: 1, accepts: ['input'], onlyAccepts: true, showEmpty: true, fillCounter: true, fill: true, layout: 'vertical' }],
    display: {
        root: {},
        label: { fill: 'fg', typography: 'labelTypography' },
        requiredMark: { fill: 'mark', typography: 'labelTypography' },
    },
    events: [],
};
