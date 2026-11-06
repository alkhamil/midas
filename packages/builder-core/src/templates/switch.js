/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Switch: a track and, inside it, a handle. The root is the track (fill, radius, a fixed height and width, padding); the handle is a container of the anatomy (a
// group frame with its own fill, radius and size). Checked moves the handle to the end of the track (the root's alignment is written by the prop) and swaps the
// track colour; Disabled is declared last, so it wins. There is no text and no border. Size is the antd small | default. Structure follows Ant Design
// (components/switch: checked, disabled, size); every value is a token.

/** The accent colour of a Color mode: default is the text colour, primary the brand colour, danger the error colour (Button's Color roles). */
const ACCENT = { default: 'text', primary: 'brand', danger: 'danger' };

/** @type {TemplateSchema} */
export const SWITCH = {
    id: 'switch',
    name: 'Switch',
    isControl: true,
    element: { tag: 'button', attrs: { type: 'button', role: 'switch', tabindex: '0' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'handle', kind: 'frame', layout: 'horizontal' },
    ],
    icons: [],
    // The handle sits at the start of the track and is centred across it; checked moves it to the end.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        // The colours, as Button's Color collection holds its own: only the checked track follows the mode (default is the text colour, primary the brand colour,
        // danger the error colour). A new instance takes primary. The Size collection holds sizes only.
        color: { source: 'variable', collection: 'Color', modes: ['default', 'primary', 'danger'], defaultMode: 'primary' },
        size: { source: 'variable', collection: 'Size', modes: ['small', 'default'], defaultMode: 'default' },
        // Checked writes the root's alignment: on puts the handle at the end of the track, off at the start.
        checked: { source: 'literal', type: 'boolean', default: false, node: { key: 'root', field: 'primaryAlign' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromColor: ['track-bg', 'track-bg-checked', 'track-bg-disabled', 'track-bg-hover', 'track-bg-focus', 'handle-bg'],
        fromSize: ['trackHeight', 'trackWidth', 'trackPadding', 'handleSize', 'radiusFull'],
    },
    tokenKinds: {
        trackHeight: 'length', trackWidth: 'length', trackPadding: 'length', handleSize: 'length', radiusFull: 'length',
        'track-bg': 'color', 'track-bg-checked': 'color', 'track-bg-disabled': 'color', 'track-bg-hover': 'color', 'track-bg-focus': 'color', 'handle-bg': 'color',
    },
    tokenRoles: {
        trackHeight: { small: 'switch-height-sm', default: 'switch-height' },
        trackWidth: { small: 'switch-min-width-sm', default: 'switch-min-width' },
        trackPadding: 'switch-padding',
        handleSize: { small: 'switch-handle-sm', default: 'switch-handle' },
        radiusFull: 'radius-full',
        'track-bg': 'track-off', 'track-bg-checked': ACCENT, 'track-bg-disabled': 'border', 'track-bg-hover': 'track-off-hover', 'track-bg-focus': 'track-off-hover', 'handle-bg': 'solid-text',
    },
    // Checked swaps the track colour; Disabled is declared last, so it wins over Checked.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'track-bg': 'track-bg-checked' } },
        disabled: { prop: 'disabled', tokens: { 'track-bg': 'track-bg-disabled' } },
    },
    // A click turns Checked on and off.
    toggle: { prop: 'checked' },
    // Hover and focus darken the off track while nothing replaces it (the checked look wins). The focus ring itself is not drawn.
    previewStates: {
        hover: { 'track-bg': 'track-bg-hover' },
        focus: { 'track-bg': 'track-bg-focus' },
    },
    statePseudo: { hover: ':hover', focus: ':focus-visible', checked: '[data-checked]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { fill: 'track-bg', radius: 'radiusFull', height: 'trackHeight', width: 'trackWidth', paddingX: 'trackPadding', paddingY: 'trackPadding' },
        handle: { fill: 'handle-bg', radius: 'radiusFull', size: 'handleSize' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
