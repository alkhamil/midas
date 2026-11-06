// The Icon Button variable model shared by the tests. It is Button's own Variant, Color and Size collections (the Icon Button reads Button's tokens and roles, so
// they are the same variables) with the names of the Icon Button, plus two collections of its own: Type (default | float) holds the elevation, and Shape (square |
// circle) holds the radius (the full radius for a circle, the Size radius through an alias for a square). Every literal sits in a Primitive and is reached through a
// Semantic alias (see literal-bank.mjs); the two effects (no shadow, the float elevation) are Primitives with Semantic aliases too.
import { buttonModel } from './button-model.mjs';
import { literalBank } from './literal-bank.mjs';

export const ICON_BUTTON_TYPES = ['default', 'float'];
export const ICON_BUTTON_SHAPES = ['square', 'circle'];

/** The float elevation: Semantic/boxShadowSecondary of the base data (three drop shadows). */
export const FLOAT_SHADOW = [
    { type: 'drop', visible: true, color: '#000000', opacity: 0.08, x: 0, y: 6, blur: 16, spread: 0 },
    { type: 'drop', visible: true, color: '#000000', opacity: 0.12, x: 0, y: 3, blur: 6, spread: -4 },
    { type: 'drop', visible: true, color: '#000000', opacity: 0.05, x: 0, y: 9, blur: 28, spread: 8 },
];

/** The full radius, as Semantic/borderRadiusFull holds it. */
const FULL_RADIUS = 9999;
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Icon Button collections and variables. Item ids: Button's (`v-`, `c-`, `s-`) for Variant, Color and Size, `t-shadow` (Type) and `sh-shape-radius` (Shape).
 * @param {Parameters<typeof buttonModel>[0] & { ids?: { type?: string, shape?: string } }} [options]
 */
export function iconButtonModel({ ids = {}, ...button } = {}) {
    const base = buttonModel({ ids: { variant: 'c-ib-variant', color: 'c-ib-color', size: 'c-ib-size', semantic: 'c-ib-semantic', primitives: 'c-ib-primitives', ...ids }, ...button });
    const { variant, color, size, semantic, primitives } = base.ids;
    const type = ids.type ?? 'c-ib-type';
    const shape = ids.shape ?? 'c-ib-shape';
    const bank = literalBank(primitives, semantic);
    const named = { [variant]: 'Icon Button Variant', [color]: 'Icon Button Color', [size]: 'Icon Button Size' };
    const collections = [
        ...base.collections.map(c => ({ ...c, name: named[c.id] ?? c.name })),
        { id: type, name: 'Icon Button Type', modes: ICON_BUTTON_TYPES.map(titled) },
        { id: shape, name: 'Icon Button Shape', modes: ICON_BUTTON_SHAPES.map(titled) },
    ];
    const items = [
        ...base.items,
        { id: 'p-shadow-none', name: 'shadow/none', type: 'effect', collectionId: primitives, values: { base: [] } },
        { id: 'p-shadow-secondary', name: 'shadow/secondary', type: 'effect', collectionId: primitives, values: { base: structuredClone(FLOAT_SHADOW) } },
        { id: 'sem-boxShadowNone', name: 'boxShadowNone', type: 'effect', collectionId: semantic, values: { base: { alias: 'p-shadow-none' } } },
        { id: 'sem-boxShadowSecondary', name: 'boxShadowSecondary', type: 'effect', collectionId: semantic, values: { base: { alias: 'p-shadow-secondary' } } },
        { id: 't-shadow', name: 'shadow', type: 'effect', collectionId: type, values: { default: { alias: 'sem-boxShadowNone' }, float: { alias: 'sem-boxShadowSecondary' } } },
        { id: 'sh-shape-radius', name: 'shapeRadius', type: 'number', collectionId: shape, values: { square: { alias: 's-radius' }, circle: { alias: bank.ref(FULL_RADIUS) } } },
    ];
    // The full radius is a Primitive the bank makes on demand: keep the bank's items that the first call did not hold.
    for (const item of bank.items()) if (!items.some(i => i.id === item.id)) items.unshift(item);
    return { collections, items, ids: { variant, color, size, type, shape, semantic, primitives }, binding: { version: 2, templateId: 'icon-button', variables: { variant, color, size, type, shape } } };
}
