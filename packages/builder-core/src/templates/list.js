import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/**
 * List: one item that is repeated. The `item` slot is min 1 and max 1 on purpose: a List has one item template, authored once on the canvas, and
 * `itemCount` says how many copies Play and the export draw. Size is the one variable dimension: it sets the gap between the copies (the Size
 * scale, xs to xl, as every component). Nothing else is in it: no label, no typography, no colour.
 * @type {TemplateSchema}
 */
export const LIST = {
    id: 'list',
    name: 'List',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [],
    icons: [],
    rootLayout: 'vertical',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        itemCount: { source: 'literal', type: 'number', default: 3 },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['gap'] },
    tokenKinds: { gap: 'length' },
    tokenRoles: {
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
    },
    persistentStates: { disabled: { prop: 'disabled', tokens: {} } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    slots: [{ id: 'item', name: 'Item', description: 'The item that is repeated', min: 1, max: 1, showEmpty: true, fillCounter: true, layout: 'vertical', repeat: 'itemCount' }],
    display: { root: { gap: 'gap' } },
    events: [],
};
