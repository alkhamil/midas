import { ICON_PART_DISPLAY, ICON_TOKENS } from './icon-slots.js';
import { BUTTON } from './button.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// The button that holds one icon and no text. Its box is a square (the Size height on both axes); its radius comes from the Shape (a circle is the full radius,
// a square the Size radius). Variant, Color and Size are Button's own (same modes, same tokens and roles), so the panel and the variables are Button's. Type is
// visual only: Float adds an elevation shadow and nothing else, never a position.

/** The Size tokens an Icon Button reads: Button's own (the box is the Size height on both axes, the square radius is the Size radius). */
const SIZE_TOKENS = ['height', 'radius', 'iconSize', 'borderWidth', 'outlineWidth'];
/** The entries of an object for some keys. */
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));

/** @type {TemplateSchema} */
export const ICON_BUTTON = {
    id: 'icon-button',
    name: 'Icon Button',
    element: { tag: 'button', attrs: { type: 'button' }, disabledState: 'disabled', blockClickProps: ['disabled', 'loading'] },
    // The one icon is on every instance (alwaysVisible): there is no switch, and no text to order against.
    anatomy: [{ id: 'icon', kind: 'icon', managed: true, alwaysVisible: true }],
    icons: [{ slot: 'icon', component: 'icon', label: 'Icon', tokens: ICON_TOKENS }],
    outline: { offset: 0 },
    // The click wave is Button's: the host's ::after ring inherits the host radius, so it follows the Shape; wave-color is its colour.
    interaction: { focus: 'outline', wave: true },
    props: {
        // Variant and Color are Button's, with the same modes and the same roles: the box, the icon colour and the states follow them as a Button's do.
        variant: BUTTON.props.variant,
        color: BUTTON.props.color,
        size: BUTTON.props.size,
        // Type is visual only: Default has no elevation, Float has the shadow token. It never moves the button.
        type: { source: 'variable', collection: 'Type', modes: ['default', 'float'], defaultMode: 'default' },
        shape: { source: 'variable', collection: 'Shape', modes: ['square', 'circle'], defaultMode: 'square' },
        icon: { source: 'literal', type: 'iconComponent', default: null },
        loading: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'disabled', clearsPreview: true, node: { key: 'root', field: 'opacity' } },
        disabled: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'loading', clearsPreview: true },
    },
    tokens: {
        fromSize: SIZE_TOKENS,
        fromShape: ['shapeRadius'],
        fromType: ['shadow'],
        fromVariant: BUTTON.tokens.fromVariant,
        fromColor: BUTTON.tokens.fromColor,
    },
    tokenKinds: { ...pick(BUTTON.tokenKinds, [...SIZE_TOKENS, ...BUTTON.tokens.fromVariant, ...BUTTON.tokens.fromColor]), shapeRadius: 'length', shadow: 'effect' },
    tokenRoles: {
        ...pick(BUTTON.tokenRoles, [...SIZE_TOKENS, ...BUTTON.tokens.fromVariant, ...BUTTON.tokens.fromColor]),
        // The Shape picks the radius: the full radius for a circle, the Size radius for a square (followed through the Size collection).
        shapeRadius: { circle: 'radius-full', square: './radius', default: './radius' },
        shadow: { default: 'shadow-none', float: 'shadow-float' },
    },
    // The spinner takes the icon's place while loading, drawn in the icon's colour and size (the same part as Button's, with no side to put it on).
    parts: [
        { id: 'spinner', kind: 'frame', tokens: ICON_TOKENS, shownWhen: { prop: 'loading', is: true }, spin: true, replaces: 'icon', arc: { size: 14, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
    ],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'active', reason: 'pointer press; the canvas shows the rest state and the Preview panel shows pressed' },
        { id: 'focus-ring', reason: 'keyboard focus ring follows focus; the canvas shows the rest state' },
        { id: 'wave', reason: 'click wave is an animation on click; the canvas has no click' },
        { id: 'spin', reason: 'the spinner turns while loading: an animation, so the canvas draws the spinner at rest' },
        { id: 'loading-click', reason: 'a loading Icon Button fires no click and draws no wave: a click is an interaction the canvas does not have' },
    ],
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    previewStates: {
        hover: { bg: 'bg-hover', fg: 'fg-hover', border: 'border-hover' },
        active: { bg: 'bg-active', fg: 'fg-active', border: 'border-active' },
        focus: { 'outline-color': 'outline-color-active' },
    },
    statePseudo: { disabled: ':disabled', hover: ':hover', active: ':active', focus: ':focus-visible' },
    // A new master is centred on both axes; its box is the Size height on both axes.
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    display: {
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'shapeRadius', size: 'height', shadow: 'shadow' },
        icon: { size: ICON_TOKENS.size },
        spinner: ICON_PART_DISPLAY,
    },
    events: [
        { name: 'onClick', exposeAsTrigger: true },
        { name: 'onHover', exposeAsTrigger: true },
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
