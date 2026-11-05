import { SIZE_MODES } from '../packages/builder-core/src/templates/size-modes.js';
// The Icon Button variable model shared by the fixtures and the tests. Three component collections: Variant (default | float) holds the colours and
// the elevation, Shape (square | circle) holds the radius (the full radius for a circle, the Size radius through an alias for a square), Size holds the
// metrics. Every literal sits in a Primitive and is reached through a Semantic alias (see literal-bank.mjs); the two effects (no shadow, the float
// elevation) are Primitives with Semantic aliases too.
import { literalBank } from './literal-bank.mjs';

export const ICON_BUTTON_VARIANTS = ['default', 'float'];
export const ICON_BUTTON_SHAPES = ['square', 'circle'];
export const ICON_BUTTON_SIZES = SIZE_MODES.map(id => ({ id, name: id }));

/** The float elevation: Semantic/boxShadowSecondary of the base data (three drop shadows). */
export const FLOAT_SHADOW = [
    { type: 'drop', visible: true, color: '#000000', opacity: 0.08, x: 0, y: 6, blur: 16, spread: 0 },
    { type: 'drop', visible: true, color: '#000000', opacity: 0.12, x: 0, y: 3, blur: 6, spread: -4 },
    { type: 'drop', visible: true, color: '#000000', opacity: 0.05, x: 0, y: 9, blur: 28, spread: 8 },
];

/** Variant values per mode: `fx:` an effect item, a hex literal, or `transparent`. */
const DEFAULT = {
    bg: '#ffffff', fg: '#18181b', border: '#18181b', shadow: 'fx:none',
    'bg-hover': '#ffffff', 'fg-hover': '#4338ca', 'border-hover': '#4338ca',
    'bg-active': '#ffffff', 'fg-active': '#312e81', 'border-active': '#312e81',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent', 'outline-color-active': '#4338ca33',
};
const FLOAT = {
    bg: '#ffffff', fg: '#18181b', border: 'transparent', shadow: 'fx:float',
    'bg-hover': '#f4f4f5', 'fg-hover': '#4338ca', 'border-hover': 'transparent',
    'bg-active': '#f4f4f5', 'fg-active': '#312e81', 'border-active': 'transparent',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent', 'outline-color-active': '#4338ca33',
};
const VARIANT_VALUES = { default: DEFAULT, float: FLOAT };
const VARIANT_TOKENS = Object.keys(DEFAULT);
const SIZE_VALUES = {
    height: { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 },
    radiusSquare: { xs: 4, sm: 6, md: 6, lg: 8, xl: 8 },
    iconSize: { xs: 12, sm: 14, md: 14, lg: 16, xl: 20 },
    borderWidth: { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 },
    outlineWidth: { xs: 2, sm: 2, md: 2, lg: 2, xl: 2 },
};
/** The full radius, as Semantic/borderRadiusFull holds it. */
const FULL_RADIUS = 9999;
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Icon Button collections and variables. Item ids: `v-<token>` (Variant), `sh-radius` (Shape), `s-<token>` (Size), with `prefix` put in front of every id.
 * @param {{ ids?: { variant?: string, shape?: string, size?: string, semantic?: string, primitives?: string }, prefix?: string }} [options]
 */
export function iconButtonModel({ ids = {}, prefix = '' } = {}) {
    const variant = ids.variant ?? 'c-ib-variant';
    const shape = ids.shape ?? 'c-ib-shape';
    const size = ids.size ?? 'c-ib-size';
    const semantic = ids.semantic ?? 'c-ib-semantic';
    const primitives = ids.primitives ?? 'c-ib-primitives';
    const bank = literalBank(primitives, semantic);
    const semItem = `${prefix}sem-outlineTransparent`;
    const collections = [
        { id: variant, name: 'Icon Button Variant', modes: ICON_BUTTON_VARIANTS.map(titled) },
        { id: shape, name: 'Icon Button Shape', modes: ICON_BUTTON_SHAPES.map(titled) },
        { id: size, name: 'Icon Button Size', modes: ICON_BUTTON_SIZES },
        { id: semantic, name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] },
        { id: primitives, name: 'Primitives', modes: [{ id: 'base', name: 'Base' }] },
    ];
    const items = [
        { id: semItem, name: 'outlineTransparent', type: 'color', collectionId: semantic, values: { base: { alias: bank.primitiveOf('#00000000') } } },
        { id: `${prefix}p-shadow-none`, name: 'shadow/none', type: 'effect', collectionId: primitives, values: { base: [] } },
        { id: `${prefix}p-shadow-secondary`, name: 'shadow/secondary', type: 'effect', collectionId: primitives, values: { base: structuredClone(FLOAT_SHADOW) } },
        { id: `${prefix}sem-boxShadowNone`, name: 'boxShadowNone', type: 'effect', collectionId: semantic, values: { base: { alias: `${prefix}p-shadow-none` } } },
        { id: `${prefix}sem-boxShadowSecondary`, name: 'boxShadowSecondary', type: 'effect', collectionId: semantic, values: { base: { alias: `${prefix}p-shadow-secondary` } } },
    ];
    for (const [token, values] of Object.entries(SIZE_VALUES)) {
        items.push({ id: `${prefix}s-${token}`, name: token, type: 'number', collectionId: size, values: Object.fromEntries(ICON_BUTTON_SIZES.map(m => [m.id, { alias: bank.ref(values[m.id]) }])) });
    }
    items.push({ id: `${prefix}sh-radius`, name: 'radius', type: 'number', collectionId: shape, values: { square: { alias: `${prefix}s-radiusSquare` }, circle: { alias: bank.ref(FULL_RADIUS) } } });
    for (const token of VARIANT_TOKENS) {
        const values = {};
        for (const mode of ICON_BUTTON_VARIANTS) {
            const spec = VARIANT_VALUES[mode][token];
            if (spec === 'transparent') values[mode] = { alias: semItem };
            else if (spec.startsWith('fx:')) values[mode] = { alias: spec === 'fx:none' ? `${prefix}sem-boxShadowNone` : `${prefix}sem-boxShadowSecondary` };
            else values[mode] = { alias: bank.ref(spec) };
        }
        items.push({ id: `${prefix}v-${token}`, name: token, type: token === 'shadow' ? 'effect' : 'color', collectionId: variant, values });
    }
    items.unshift(...bank.items());
    return { collections, items, ids: { variant, shape, size, semantic, primitives }, binding: { version: 2, templateId: 'icon-button', variables: { variant, shape, size } } };
}
