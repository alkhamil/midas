import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Radio Group (antd Radio.Group): a row or a column of Radio instances. The group has no look of its own: its root holds one frame (the options) that
// lays the Radio instances out, and the Direction prop writes that frame's layout (horizontal, the antd default, or vertical). Size is the one variable
// dimension: it sets the gap between the options; the Radios follow their own Size. The options are instances, so the selection is
// each Radio is exclusive in the options frame: picking one in Play or on the canvas clears the others. A group with a value prop of its own and data options is not built.

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
        // The Radio instances in the options frame. Only Radios go in (accepts and onlyAccepts). A new group starts with two Radios, never fewer
        // than two, and the Plus row adds one.
        {
            id: 'items', name: 'Options', description: 'The Radio buttons of the group', holds: 'instance', accepts: ['radio'], onlyAccepts: true, min: 2, start: 2, showEmpty: true,
            layout: 'horizontal', box: 'options', seed: [{ template: 'radio', props: { label: 'Radio' }, follow: { size: 'size' } }],
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
