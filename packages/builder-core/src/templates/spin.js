import { ICON_PART_DISPLAY } from './icon-slots.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Spin (antd Spin): a loading indicator with no text. Its one part is the arc Button draws while loading (the same geometry, the same spin), sized by the
// Size's icon token and coloured by the Color preset's text role. It is shown while `spinning` is on and removed when it is off (a conditional part, so no
// hidden layer). The spin itself is an animation: Play and the export turn it, the canvas draws it at rest.

/** @type {TemplateSchema} */
export const SPIN = {
    id: 'antd-spin',
    name: 'Spin',
    // A non-interactive status element: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'span', attrs: { role: 'status' }, blockClickProps: [] },
    // The box the arc sits in: a managed container while spinning is on (a drawn box, the display maps its size).
    anatomy: [{ id: 'spinBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'spinning', is: true } }],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'primary' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        spinning: { source: 'literal', type: 'boolean', default: true },
    },
    tokens: {
        fromColor: ['fg'],
        fromSize: ['iconSize'],
    },
    tokenKinds: { fg: 'color', iconSize: 'length' },
    tokenRoles: {
        fg: presetRoleMap('text'),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    // The arc is the part; it is a canvas part (the canvas draws it), and it turns in Play and the export only.
    parts: [
        { id: 'spinner', kind: 'frame', parent: 'spinBox', shownWhen: { prop: 'spinning', is: true }, spin: true, tokens: { colour: 'fg', disabledColour: 'fg', size: 'iconSize' }, arc: { size: 14, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
    ],
    playOnly: [
        { id: 'spin', reason: 'the spinner turns: an animation, so the canvas draws the arc at rest' },
    ],
    display: {
        spinBox: { size: 'iconSize' },
        spinner: ICON_PART_DISPLAY,
    },
    events: [],
};
