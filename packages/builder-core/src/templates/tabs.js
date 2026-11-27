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
        // The baseline is a line of its own under the tabs, so it never paints over a tab's indicator.
        { id: 'baseline', kind: 'frame', layout: 'none', fill: true },
    ],
    icons: [],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        // Centred: the bar fills its width and its tabs sit in the middle; off, the bar hugs the tabs at the start.
        // The indicator under each tab: full width, or the width (px) when Fixed is on, placed by Align.
        indicatorWidth: { source: 'literal', type: 'number', default: 24 },
        indicatorFixed: { source: 'literal', type: 'boolean', default: false },
        // Every tab shows a close icon; a click removes the tab from the bar in Play.
        closable: { source: 'literal', type: 'boolean', default: false },
        indicatorAlign: { source: 'literal', type: 'enum', options: ['start', 'center', 'end'], default: 'center' },
        centered: { source: 'literal', type: 'boolean', default: false, node: { key: 'itemsBox', field: 'primaryAlign', values: { true: 'center', false: 'start' } } },
    },
    slots: [
        {
            id: 'items', name: 'Tab', description: 'The Tab rows of the bar', holds: 'instance', accepts: ['antd-tab'], onlyAccepts: true, min: 0, showEmpty: true,
            layout: 'horizontal', box: 'itemsBox', seed: [{ template: 'antd-tab', props: { label: 'Tab' }, follow: { size: 'size' } }], start: 2,
            // The Tabs' indicator props are the tabs' own: a change here is copied to every tab in the box (and to a new one).
            propagate: { indicatorWidth: 'indicatorWidth', indicatorFixed: 'indicatorFixed', indicatorAlign: 'indicatorAlign', closable: 'closable' },
            // The first tab is selected at creation, and stays selected until another is picked: the box keeps one of its tabs selected.
            selected: 'active',
        },
    ],
    tokens: {
        fromSize: ['gap', 'baseline', 'baselineWidth'],
    },
    tokenKinds: { gap: 'length', baseline: 'color', baselineWidth: 'length' },
    tokenRoles: {
        gap: spaceLadder([16, 24, 32, 40, 56]),
        baseline: 'border-secondary',
        baselineWidth: 'border-width',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        itemsBox: { gap: 'gap' },
        baseline: { fill: 'baseline', height: 'baselineWidth' },
    },
    events: [],
};
