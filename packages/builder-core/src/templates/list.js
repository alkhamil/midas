/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/**
 * List: one item that is repeated. The `item` slot is min 1 and max 1 on purpose: a List has one item template, authored once on the canvas, and
 * `itemCount` says how many copies Play and the export draw. The spacing between the copies is the item frame's own auto layout (node-owned, as every
 * slot frame's). Nothing else is in it: no label, no tokens, no variable props.
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
        itemCount: { source: 'literal', type: 'number', default: 3 },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {},
    tokenKinds: {},
    persistentStates: { disabled: { prop: 'disabled', tokens: {} } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    slots: [{ id: 'item', name: 'Item', description: 'The item that is repeated', min: 1, max: 1, showEmpty: true, fillCounter: true, layout: 'vertical', repeat: 'itemCount' }],
    display: { root: {} },
    events: [],
};
