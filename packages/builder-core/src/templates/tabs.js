import { DEFAULT_SIZE_MODE, SIZE_MODES, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Tabs (antd Tabs, the tab bar): a row of Tab instances. The items box holds the tabs only; a new Tabs starts with two, the first selected, and the Plus
// row adds one more. Selecting is exclusive in the box (a click in Play, or the Behavior tab's Active on a tab, turns the others off), and the first
// tab stays selected when none is. Size sets the gap between the tabs (the tab itself takes its own Size, set on each tab). Ant Design structure only:
// no content panels, no tab positions, no add or close tabs.

/** @type {TemplateSchema} */
export const TABS = {
    id: 'antd-tabs',
    name: 'Tabs',
    element: { tag: 'div', attrs: { role: 'tablist' }, blockClickProps: [] },
    anatomy: [
        { id: 'itemsBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'end' },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'end',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
    },
    slots: [
        {
            id: 'items', name: 'Tab', description: 'The Tab rows of the bar', holds: 'instance', accepts: ['antd-tab'], onlyAccepts: true, min: 0, showEmpty: true,
            layout: 'horizontal', box: 'itemsBox', seed: [{ template: 'antd-tab', props: { label: 'Tab' }, follow: { size: 'size' } }], start: 2,
            // The first tab is selected at creation, and stays selected until another is picked: the box keeps one of its tabs selected.
            selected: 'active',
        },
    ],
    tokens: {
        fromSize: ['gap'],
    },
    tokenKinds: { gap: 'length' },
    tokenRoles: {
        gap: spaceLadder([16, 24, 32, 40, 56]),
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        itemsBox: { gap: 'gap' },
    },
    events: [],
};
