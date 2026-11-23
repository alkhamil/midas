import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Radio Group (antd Radio.Group): a row or a column of Radio instances. The group has no look of its own: its root holds one frame (the options) that
// lays the Radio instances out, and the Direction prop writes that frame's layout (horizontal, the antd default, or vertical). Size is the one variable
// dimension: it sets the gap between the options; the Radios follow their own Size. The options are instances, so the selection is
// each Radio's own `checked` state; a group that owns a single value and disables its options is not built yet.

/** @type {TemplateSchema} */
export const RADIO_GROUP = {
    id: 'antd-radio-group',
    name: 'Radio Group',
    element: { tag: 'div', attrs: { role: 'radiogroup' }, blockClickProps: [] },
    anatomy: [
        // The options frame: the Radio instances sit in it; Direction writes its layout.
        { id: 'options', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
    ],
    icons: [],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        direction: { source: 'literal', type: 'enum', options: ['horizontal', 'vertical'], labels: { horizontal: 'Horizontal', vertical: 'Vertical' }, default: 'horizontal', node: { key: 'options', field: 'layout' } },
    },
    slots: [
        // The Radio instances the designer puts in the options frame. Only Radios are meant to go in (accepts and onlyAccepts: the Design tab and
        // Diagnostics enforce it). A box slot starts empty: a seed is not made for a box, so the group starts with no options.
        {
            id: 'items', name: 'Options', description: 'The Radio buttons of the group', holds: 'content', accepts: ['radio'], onlyAccepts: true, min: 0, showEmpty: true,
            layout: 'horizontal', box: 'options',
        },
    ],
    tokens: { fromSize: ['gap'] },
    tokenKinds: { gap: 'length' },
    tokenRoles: { gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']) },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        options: { gap: 'gap' },
    },
    events: [],
};
