import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// List (antd List): a column of List Item instances and nothing else. The Items box holds only List Items, and a new List starts with one; the
// Plus row of the Behavior tab adds one more. Separator puts a Divider between the items: one between each pair, none while it is off (the Divider
// follows the items). The items sit with no gap between them: the Divider, when on, is the only space between two items.

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
        separator: { source: 'literal', type: 'boolean', default: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    slots: [
        // The List Items. Only List Items and the Divider (a preferred instance: the separator) go in (accepts and onlyAccepts). A new List starts with
        // two List Items, never fewer than two, and the Plus row adds a List Item.
        {
            id: 'items', name: 'List Item', description: 'The List Item rows of the list', holds: 'instance', accepts: ['antd-list-item', 'antd-divider'], onlyAccepts: true, min: 2, start: 2, showEmpty: true,
            layout: 'vertical', box: 'listBox', seed: [{ template: 'antd-list-item', props: { title: 'List item' }, follow: { size: 'size' } }],
            // The Divider the Separator prop puts between two items: one per pair, kept in step with the items.
            separator: { template: 'antd-divider', prop: 'separator', follow: { size: 'size' } },
        },
    ],
    tokens: {},
    tokenKinds: {},
    tokenRoles: {},
    persistentStates: { disabled: { prop: 'disabled', tokens: {} } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {},
    events: [],
};
