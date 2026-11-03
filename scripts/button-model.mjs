import { SIZE_MODES } from '../packages/builder-core/src/templates/size-modes.js';
// The Button variable model shared by the fixtures and the tests. Three component collections, the same as the Ant Design library,
// Color (default | primary | danger) holds the accent tokens of each colour, Variant (outlined | dashed | solid | filled | text | link)
// aliases into Color for the colours that depend on the colour, Size holds the metrics. Every literal sits in a Primitive and is
// reached through a Semantic alias (see literal-bank.mjs), so a fixture is self-contained and follows the chain Primitives →
// Semantic → component. Every fixture and every test builds its Button variables here.
import { literalBank, textStyleBank } from './literal-bank.mjs';

export const BUTTON_VARIANTS = ['outlined', 'dashed', 'solid', 'filled', 'text', 'link'];
export const BUTTON_COLORS = ['default', 'primary', 'danger'];
export const BUTTON_SIZES = SIZE_MODES.map(id => ({ id, name: id }));

/** Hex values per colour: the accent, its tint, its solid fill, and the text on solid. */
const PALETTE = {
    default: { accent: '#18181b', accentHover: '#4338ca', accentActive: '#312e81', tint: '#f4f4f5', tintHover: '#e4e4e7', tintActive: '#d4d4d8', text: '#18181b', textHover: '#18181b', textActive: '#18181b', solid: '#18181b', solidHover: '#3f3f46', solidActive: '#27272a', solidText: '#ffffff', outline: '#18181b1a' },
    primary: { accent: '#4338ca', accentHover: '#3730a3', accentActive: '#312e81', tint: '#e0e7ff', tintHover: '#c7d2fe', tintActive: '#a5b4fc', text: '#4338ca', textHover: '#3730a3', textActive: '#312e81', solid: '#4338ca', solidHover: '#3730a3', solidActive: '#312e81', solidText: '#ffffff', outline: '#4338ca33' },
    danger: { accent: '#dc2626', accentHover: '#b91c1c', accentActive: '#991b1b', tint: '#fee2e2', tintHover: '#fecaca', tintActive: '#fca5a5', text: '#dc2626', textHover: '#b91c1c', textActive: '#991b1b', solid: '#dc2626', solidHover: '#b91c1c', solidActive: '#991b1b', solidText: '#ffffff', outline: '#dc262633' },
};

/** Colour tokens: the palette key each one holds. */
const COLOR_TOKENS = {
    color: 'accent', 'color-hover': 'accentHover', 'color-active': 'accentActive',
    'color-border': 'accent', 'color-border-hover': 'accentHover', 'color-border-active': 'accentActive',
    'color-bg': 'tint', 'color-bg-hover': 'tintHover', 'color-bg-active': 'tintActive',
    'color-text': 'text', 'color-text-hover': 'textHover', 'color-text-active': 'textActive',
    'color-text-bg-hover': 'tint', 'color-text-bg-active': 'tintActive',
    'color-solid': 'solid', 'color-solid-hover': 'solidHover', 'color-solid-active': 'solidActive', 'color-solid-text': 'solidText', 'color-outline': 'outline',
};

/** Variant values per mode: `c:` a Color token, a hex literal, or `transparent`. The same rules as the library's Button. */
const OUTLINED = {
    bg: '#ffffff', fg: 'c:color', border: 'c:color-border',
    'bg-hover': '#ffffff', 'fg-hover': 'c:color-hover', 'border-hover': 'c:color-border-hover',
    'bg-active': '#ffffff', 'fg-active': 'c:color-active', 'border-active': 'c:color-border-active',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'c:color-outline', 'wave-color': 'c:color-border',
};
const SOLID = {
    bg: 'c:color-solid', fg: 'c:color-solid-text', border: 'transparent',
    'bg-hover': 'c:color-solid-hover', 'fg-hover': 'c:color-solid-text', 'border-hover': 'transparent',
    'bg-active': 'c:color-solid-active', 'fg-active': 'c:color-solid-text', 'border-active': 'transparent',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'c:color-outline', 'wave-color': 'c:color-solid',
};
const FILLED = {
    bg: 'c:color-bg', fg: 'c:color', border: 'transparent',
    'bg-hover': 'c:color-bg-hover', 'fg-hover': 'c:color', 'border-hover': 'transparent',
    'bg-active': 'c:color-bg-active', 'fg-active': 'c:color', 'border-active': 'transparent',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'c:color-outline', 'wave-color': 'c:color',
};
const TEXT = {
    bg: 'transparent', fg: 'c:color-text', border: 'transparent',
    // The Text hover and active backgrounds stay transparent (the token roles): the state is the text colour alone.
    'bg-hover': 'transparent', 'fg-hover': 'c:color-text-hover', 'border-hover': 'transparent',
    'bg-active': 'transparent', 'fg-active': 'c:color-text-active', 'border-active': 'transparent',
    'bg-disabled': 'transparent', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'c:color-outline', 'wave-color': 'c:color-text',
};
const LINK = { ...TEXT };
const VARIANT_VALUES = { outlined: OUTLINED, dashed: OUTLINED, solid: SOLID, filled: FILLED, text: TEXT, link: LINK };
const VARIANT_TOKENS = Object.keys(OUTLINED);
const DEFAULT_SIZE_VALUES = {
    height: { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 },
    paddingX: { xs: 7, sm: 7, md: 15, lg: 15, xl: 15 }, paddingY: { xs: 4, sm: 6, md: 6, lg: 8, xl: 8 },
    gap: { xs: 4, sm: 6, md: 8, lg: 8, xl: 10 }, radius: { xs: 4, sm: 6, md: 6, lg: 8, xl: 8 }, iconSize: { xs: 12, sm: 14, md: 14, lg: 16, xl: 20 }, borderWidth: { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }, outlineWidth: { xs: 2, sm: 2, md: 2, lg: 2, xl: 2 },
};
/** The Size modes each typography token takes, as the Semantic text style it aliases (the Button's text roles). */
const BUTTON_TYPOGRAPHY = { labelTypography: { xs: 'textXs', sm: 'textSm', md: 'textBase', lg: 'textLg', xl: 'textXl' } };
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Button collections and variables. Item ids: `c-<token>` (Color), `v-<token>` (Variant), `s-<token>` (Size), with `prefix` put in
 * front of the Variant ids, so a second Variant set can sit beside the first.
 *
 * `shared` reuses the Color, Size, Semantic and Primitives collections of another call (its `ids`): the second call then adds only
 * its Variant set. The first call creates every Primitive and Semantic literal that any call can reference.
 * @param {{ ids?: { variant?: string, color?: string, size?: string, semantic?: string, primitives?: string }, prefix?: string, variantModes?: string[], colors?: string[], palette?: typeof PALETTE, sizeModes?: { id: string, name: string }[], sizeValues?: Record<string, Record<string, number>>, shared?: { color: string, size: string, semantic: string, primitives: string, semanticItem: string } }} [options]
 */
export function buttonModel({ ids = {}, prefix = '', variantModes = BUTTON_VARIANTS, colors = BUTTON_COLORS, palette = PALETTE, sizeModes = BUTTON_SIZES, sizeValues = {}, typography = BUTTON_TYPOGRAPHY, shared = null } = {}) {
    const sizes = { ...DEFAULT_SIZE_VALUES, ...sizeValues };
    const variant = ids.variant ?? 'c-variant';
    const color = shared ? shared.color : ids.color ?? 'c-color';
    const size = shared ? shared.size : ids.size ?? 'c-size';
    const semantic = shared?.semantic ?? ids.semantic ?? 'c-semantic';
    const primitives = shared?.primitives ?? ids.primitives ?? 'c-primitives';
    const semItem = shared?.semanticItem ?? `${prefix}sem-outlineTransparent`;
    const bank = literalBank(primitives, semantic);
    const text = shared ? null : textStyleBank(primitives, semantic, prefix);
    const collections = [{ id: variant, name: 'Button Variant', modes: variantModes.map(titled) }];
    const items = [];
    if (!shared) {
        collections.unshift({ id: color, name: 'Button Color', modes: colors.map(titled) }, { id: size, name: 'Button Size', modes: sizeModes },
            { id: semantic, name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] }, { id: primitives, name: 'Primitives', modes: [{ id: 'base', name: 'Base' }] });
        for (const [token, key] of Object.entries(COLOR_TOKENS)) {
            const values = Object.fromEntries(colors.map(c => [c, { alias: bank.ref(palette[c][key]) }]));
            items.push({ id: `c-${token}`, name: token, type: 'color', collectionId: color, values });
        }
        for (const [token, values] of Object.entries(sizes)) {
            items.push({ id: `s-${token}`, name: token, type: 'number', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, { alias: bank.ref(values[m.id]) }])) });
        }
        for (const [token, styles] of Object.entries(typography)) {
            items.push({ id: `s-${token}`, name: token, type: 'typography', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, { alias: text.ref(styles[m.id]) }])) });
        }
        items.push({ id: semItem, name: 'outlineTransparent', type: 'color', collectionId: semantic, values: { base: { alias: bank.primitiveOf('#00000000') } } });
    }
    for (const token of VARIANT_TOKENS) {
        const values = {};
        for (const mode of variantModes) {
            const spec = VARIANT_VALUES[mode][token];
            if (spec === 'transparent') values[mode] = { alias: semItem };
            else if (spec.startsWith('c:')) values[mode] = { alias: `c-${spec.slice(2)}` };
            else values[mode] = { alias: bank.ref(spec) };
        }
        items.push({ id: `${prefix}v-${token}`, name: token, type: 'color', collectionId: variant, values });
    }
    if (!shared) items.unshift(...bank.items(), ...text.items);
    return { collections, items, ids: { variant, color, size, semantic, primitives, semanticItem: semItem }, binding: { version: 2, templateId: 'button', variables: { variant, color, size } } };
}
