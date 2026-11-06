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
    element: { tag: 'button', attrs: { type: 'button', role: 'switch', tabindex: '0' }, disabledState: 'disabled', blockClickProps: ['loading'] },
    anatomy: [
        { id: 'handle', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' },
    ],
    icons: [],
    // The parts the canvas draws: the spinner is an arc node inside the handle, shown while `loading` is set.
    parts: [
        { id: 'spinner', kind: 'frame', parent: 'handle', tokens: { size: 'iconSize', colour: 'track-bg', disabledColour: 'track-bg' }, shownWhen: { prop: 'loading', is: true }, spin: true, arc: { size: 12, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
    ],
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
        // Loading dims the root and blocks clicks (the spinner shows); exclusive with Disabled, like Button.
        loading: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'disabled', clearsPreview: true, node: { key: 'root', field: 'opacity' } },
        disabled: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'loading' },
    },
    tokens: {
        fromColor: ['track-bg', 'track-bg-checked', 'track-bg-disabled', 'track-bg-hover', 'track-bg-focus', 'handle-bg'],
        fromSize: ['trackHeight', 'trackWidth', 'trackPadding', 'handleSize', 'radiusFull', 'iconSize'],
    },
    tokenKinds: {
        trackHeight: 'length', trackWidth: 'length', trackPadding: 'length', handleSize: 'length', radiusFull: 'length', iconSize: 'length',
        'track-bg': 'color', 'track-bg-checked': 'color', 'track-bg-disabled': 'color', 'track-bg-hover': 'color', 'track-bg-focus': 'color', 'handle-bg': 'color',
    },
    tokenRoles: {
        trackHeight: { small: 'switch-height-sm', default: 'switch-height' },
        trackWidth: { small: 'switch-min-width-sm', default: 'switch-min-width' },
        trackPadding: 'switch-padding',
        handleSize: { small: 'switch-handle-sm', default: 'switch-handle' },
        radiusFull: 'radius-full',
        iconSize: { small: 'icon-sm', default: 'icon-md' },
        'track-bg': 'track-off', 'track-bg-checked': ACCENT, 'track-bg-disabled': 'border', 'track-bg-hover': 'track-off-hover', 'track-bg-focus': 'track-off-hover', 'handle-bg': 'solid-text',
    },
    // Checked swaps the track colour; Disabled is declared last, so it wins over Checked.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'track-bg': 'track-bg-checked' } },
        disabled: { prop: 'disabled', tokens: { 'track-bg': 'track-bg-disabled' } },
    },
    // A click turns Checked on and off.
    toggle: { prop: 'checked' },
    // Motion (antd, timings and easings only): the track recolours over 0.2s; the handle slides by
    // transform over 0.2s (travel is track - handle - 2*padding, the resting positions the canvas lays
    // out) and grows 4px while pressed. Play and the export read it; the canvas stays static.
    motion: {
        transitions: [
            { key: 'root', props: ['background-color'], duration: '0.2s', timing: 'ease-in-out' },
            { key: 'handle', props: ['transform', 'width'], duration: '0.2s', timing: 'ease-in-out' },
        ],
        slide: { key: 'handle', prop: 'checked', travel: { track: 'trackWidth', handle: 'handleSize', padding: 'trackPadding' } },
        press: { key: 'handle', token: 'handleSize', prop: 'width', grow: '4px' },
    },
    // Hover and focus darken the off track while nothing replaces it (the checked look wins). The focus ring itself is not drawn.
    previewStates: {
        hover: { 'track-bg': 'track-bg-hover' },
        focus: { 'track-bg': 'track-bg-focus' },
    },
    statePseudo: { hover: ':hover', focus: ':focus-visible', checked: '[data-checked]', disabled: ':disabled' },
    playOnly: [
        { id: 'spin', reason: 'the spinner turns while loading: an animation, so the canvas draws the spinner at rest' },
        { id: 'loading-click', reason: 'a loading Switch fires no click: a click is an interaction the canvas does not have' },
    ],
    display: {
        root: { fill: 'track-bg', radius: 'radiusFull', height: 'trackHeight', width: 'trackWidth', paddingX: 'trackPadding', paddingY: 'trackPadding' },
        handle: { fill: 'handle-bg', radius: 'radiusFull', size: 'handleSize' },
        spinner: { stroke: 'track-bg', size: 'iconSize' },
    },
    events: [{ name: 'onClick', exposeAsTrigger: true }],
};
