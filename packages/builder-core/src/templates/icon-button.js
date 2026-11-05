import { ICON_PART_DISPLAY, ICON_TOKENS } from './icon-slots.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';
import { BUTTON } from './button.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// The button that holds one icon and no text. Its box is a square (the Size height on both axes); its radius comes from the Shape (a circle is the
// full radius, a square the Size radius), independent of the Variant. The float variant is visual only: an elevation shadow and no border, never a
// position. The Size, outline, border and disabled tokens are Button's, read from the same roles.

/** @type {TemplateSchema} */
export const ICON_BUTTON = {
    id: 'icon-button',
    name: 'Icon Button',
    element: { tag: 'button', attrs: { type: 'button' }, disabledState: 'disabled', blockClickProps: ['disabled', 'loading'] },
    // The one icon is on every instance (alwaysVisible): there is no switch, and no text to order against.
    anatomy: [{ id: 'icon', kind: 'icon', managed: true, alwaysVisible: true }],
    icons: [{ slot: 'icon', component: 'icon', label: 'Icon', tokens: ICON_TOKENS }],
    outline: { offset: 0 },
    interaction: { focus: 'outline', wave: false },
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['default', 'float'] },
        shape: { source: 'variable', collection: 'Shape', modes: ['square', 'circle'], defaultMode: 'square' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        icon: { source: 'literal', type: 'iconComponent', default: null },
        loading: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'disabled', clearsPreview: true, node: { key: 'root', field: 'opacity' } },
        disabled: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'loading', clearsPreview: true },
    },
    tokens: {
        fromSize: ['height', 'radiusSquare', 'iconSize', 'borderWidth', 'outlineWidth'],
        fromShape: ['radius'],
        fromVariant: ['bg', 'fg', 'border', 'shadow', 'bg-hover', 'fg-hover', 'border-hover', 'bg-active', 'fg-active', 'border-active', 'bg-disabled', 'fg-disabled', 'outline-color', 'outline-color-active'],
    },
    tokenKinds: {
        height: 'length', radiusSquare: 'length', radius: 'length', iconSize: 'length', borderWidth: 'length', outlineWidth: 'length',
        bg: 'color', fg: 'color', border: 'color', shadow: 'effect', 'bg-hover': 'color', 'fg-hover': 'color', 'border-hover': 'color',
        'bg-active': 'color', 'fg-active': 'color', 'border-active': 'color', 'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color', 'outline-color-active': 'color',
    },
    tokenRoles: {
        height: BUTTON.tokenRoles.height,
        radiusSquare: BUTTON.tokenRoles.radius,
        // The Shape picks the radius: the full radius for a circle, the Size radius for a square (followed through the Size collection).
        radius: { circle: 'radius-full', square: './radiusSquare', default: './radiusSquare' },
        iconSize: BUTTON.tokenRoles.iconSize,
        borderWidth: 'border-width',
        outlineWidth: 'outline-width',
        bg: { default: 'bg', float: 'bg' },
        fg: { default: 'text', float: 'text' },
        border: { default: 'text', float: 'transparent' },
        shadow: { default: 'shadow-none', float: 'shadow-float' },
        'bg-hover': { default: 'bg', float: 'bg-subtle' },
        'fg-hover': { default: 'brand-hover', float: 'brand-hover' },
        'border-hover': { default: 'brand-hover', float: 'transparent' },
        'bg-active': { default: 'bg', float: 'bg-subtle' },
        'fg-active': { default: 'brand-active', float: 'brand-active' },
        'border-active': { default: 'brand-active', float: 'transparent' },
        'bg-disabled': 'bg-disabled',
        'fg-disabled': 'fg-disabled',
        'outline-color': 'outline-transparent',
        'outline-color-active': 'outline',
    },
    // The spinner takes the icon's place while loading, drawn in the icon's colour and size (the same part as Button's, with no side to put it on).
    parts: [
        { id: 'spinner', kind: 'frame', tokens: ICON_TOKENS, shownWhen: { prop: 'loading', is: true }, spin: true, replaces: 'icon', arc: { size: 14, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
    ],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'active', reason: 'pointer press; the canvas shows the rest state and the Preview panel shows pressed' },
        { id: 'focus-ring', reason: 'keyboard focus ring follows focus; the canvas shows the rest state' },
        { id: 'spin', reason: 'the spinner turns while loading: an animation, so the canvas draws the spinner at rest' },
        { id: 'loading-click', reason: 'a loading Icon Button fires no click: a click is an interaction the canvas does not have' },
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
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', size: 'height', shadow: 'shadow' },
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
