import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/**
 * FormItem: a label and the control it labels. The control is a content slot (a frame that instances fill), not a layer of the template: an Input goes
 * into it. Schema only; validation (rules, status) is not part of it.
 * @type {TemplateSchema}
 */
export const FORM_ITEM = {
    id: 'formitem',
    name: 'FormItem',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [{ id: 'label', kind: 'text', typography: 'label' }],
    icons: [],
    // The label sits above the control.
    rootLayout: 'vertical',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        label: { source: 'literal', type: 'string', default: 'Label', node: { key: 'label', field: 'text' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['labelTypography', 'gap', 'fg', 'fg-disabled'] },
    tokenKinds: { labelTypography: 'typography', gap: 'length', fg: 'color', 'fg-disabled': 'color' },
    tokenRoles: {
        labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        gap: 'gap',
        fg: 'fg',
        'fg-disabled': 'fg-disabled',
    },
    persistentStates: { disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    // The control this item labels takes an Input; a Select joins it once that template exists.
    slots: [{ id: 'control', name: 'Control', description: 'The control this item labels', min: 1, max: 1, accepts: ['input'], onlyAccepts: true, showEmpty: true, fillCounter: true, layout: 'vertical' }],
    display: {
        root: { gap: 'gap' },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    events: [],
};
