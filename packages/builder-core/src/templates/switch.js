/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Switch: a track and, inside it, a handle. The root is the track (fill, radius, a fixed height and width, padding); the handle is a container of the anatomy (a
// group frame with its own fill, radius and size). Checked moves the handle to the end of the track (the root's alignment is written by the prop) and swaps the
// track colour; Disabled is declared last, so it wins. There is no text and no border. Size is the antd small | default. Structure follows Ant Design
// (components/switch: checked, disabled, size); every value is a token.

/** @type {TemplateSchema} */
export const SWITCH = {
    id: 'switch',
    name: 'Switch',
    isControl: true,
    element: { tag: 'button', attrs: { type: 'button', role: 'switch' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'handle', kind: 'frame', layout: 'horizontal' },
    ],
    icons: [],
    // The handle sits at the start of the track and is centred across it; checked moves it to the end.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: ['small', 'default'], defaultMode: 'default' },
        // Checked writes the root's alignment: on puts the handle at the end of the track, off at the start.
        checked: { source: 'literal', type: 'boolean', default: false, node: { key: 'root', field: 'primaryAlign' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['trackHeight', 'trackWidth', 'trackPadding', 'handleSize', 'radiusFull', 'track-bg', 'track-bg-checked', 'track-bg-disabled', 'handle-bg'],
    },
    tokenKinds: {
        trackHeight: 'length', trackWidth: 'length', trackPadding: 'length', handleSize: 'length', radiusFull: 'length',
        'track-bg': 'color', 'track-bg-checked': 'color', 'track-bg-disabled': 'color', 'handle-bg': 'color',
    },
    tokenRoles: {
        trackHeight: { small: 'switch-height-sm', default: 'switch-height' },
        trackWidth: { small: 'switch-min-width-sm', default: 'switch-min-width' },
        trackPadding: 'switch-padding',
        handleSize: { small: 'switch-handle-sm', default: 'switch-handle' },
        radiusFull: 'radius-full',
        'track-bg': 'track-off', 'track-bg-checked': 'brand', 'track-bg-disabled': 'border', 'handle-bg': 'solid-text',
    },
    // Checked swaps the track colour; Disabled is declared last, so it wins over Checked.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'track-bg': 'track-bg-checked' } },
        disabled: { prop: 'disabled', tokens: { 'track-bg': 'track-bg-disabled' } },
    },
    previewStates: {},
    statePseudo: { checked: '[data-checked]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { fill: 'track-bg', radius: 'radiusFull', height: 'trackHeight', width: 'trackWidth', paddingX: 'trackPadding', paddingY: 'trackPadding' },
        handle: { fill: 'handle-bg', radius: 'radiusFull', size: 'handleSize' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
