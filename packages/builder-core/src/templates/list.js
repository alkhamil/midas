import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// List (antd List): a column of List Item instances and nothing else. The Items box holds only List Items, and a new List starts with one; the
// Plus row of the Behavior tab adds one more. Separator puts a Divider between the items: one between each pair, none while it is off (the Divider
// follows the items). Size is the one variable dimension: it sets the gap between the items (the Size scale, xs to xl), as every component with a Size.

/** @type {TemplateSchema} */
export const LIST = {
    id: 'list',
    name: 'List',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        // The items frame: the List Item instances sit in it; the Separator's Dividers sit between them.
        { id: 'listBox', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', fill: true },
    ],
    icons: [],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    rootWidth: 343,
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        separator: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    slots: [
        // The List Items. Only List Items go in (accepts and onlyAccepts); a new List starts with one, and the Plus row adds the same kind.
        {
            id: 'items', name: 'List Item', description: 'The List Item rows of the list', holds: 'instance', accepts: ['antd-list-item'], onlyAccepts: true, min: 0, showEmpty: true,
            layout: 'vertical', box: 'listBox', seed: [{ template: 'antd-list-item', props: { title: 'List item' }, follow: { size: 'size' } }],
            // The Divider the Separator prop puts between two items: one per pair, kept in step with the items.
            separator: { template: 'antd-divider', prop: 'separator' },
        },
    ],
    tokens: { fromSize: ['gap'] },
    tokenKinds: { gap: 'length' },
    tokenRoles: {
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
    },
    persistentStates: { disabled: { prop: 'disabled', tokens: {} } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: { listBox: { gap: 'gap' } },
    events: [],
};
