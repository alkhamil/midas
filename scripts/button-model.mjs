// The Button variable model shared by the fixtures and the tests. Three collections, the same as the Ant Design library:
// Color (default | primary | danger) holds the accent tokens of each colour, Variant (outlined | dashed | solid | filled | text | link)
// aliases into Color for the colours that depend on the colour, Size holds the metrics. The colour values are plain hex, so a
// fixture is self-contained. Every fixture and every test builds its Button variables here.

export const BUTTON_VARIANTS = ['outlined', 'dashed', 'solid', 'filled', 'text', 'link'];
export const BUTTON_COLORS = ['default', 'primary', 'danger'];
export const BUTTON_SIZES = [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }];

/** Hex values per colour: the accent, its tint, its solid fill, and the text on solid. */
const PALETTE = {
    default: { accent: '#18181b', accentHover: '#4338ca', accentActive: '#312e81', tint: '#f4f4f5', tintHover: '#e4e4e7', tintActive: '#d4d4d8', text: '#18181b', textHover: '#18181b', textActive: '#18181b', solid: '#18181b', solidHover: '#3f3f46', solidActive: '#27272a', solidText: '#ffffff' },
    primary: { accent: '#4338ca', accentHover: '#3730a3', accentActive: '#312e81', tint: '#e0e7ff', tintHover: '#c7d2fe', tintActive: '#a5b4fc', text: '#4338ca', textHover: '#3730a3', textActive: '#312e81', solid: '#4338ca', solidHover: '#3730a3', solidActive: '#312e81', solidText: '#ffffff' },
    danger: { accent: '#dc2626', accentHover: '#b91c1c', accentActive: '#991b1b', tint: '#fee2e2', tintHover: '#fecaca', tintActive: '#fca5a5', text: '#dc2626', textHover: '#b91c1c', textActive: '#991b1b', solid: '#dc2626', solidHover: '#b91c1c', solidActive: '#991b1b', solidText: '#ffffff' },
};

/** Colour tokens: the palette key each one holds. */
const COLOR_TOKENS = {
    color: 'accent', 'color-hover': 'accentHover', 'color-active': 'accentActive',
    'color-border': 'accent', 'color-border-hover': 'accentHover', 'color-border-active': 'accentActive',
    'color-bg': 'tint', 'color-bg-hover': 'tintHover', 'color-bg-active': 'tintActive',
    'color-text': 'text', 'color-text-hover': 'textHover', 'color-text-active': 'textActive',
    'color-text-bg-hover': 'tint', 'color-text-bg-active': 'tintActive',
    'color-solid': 'solid', 'color-solid-hover': 'solidHover', 'color-solid-active': 'solidActive', 'color-solid-text': 'solidText',
};

/** Variant values per mode: `c:` a Color token, a hex literal, or `transparent`. The same rules as the library's Button. */
const OUTLINED = {
    bg: '#ffffff', fg: 'c:color', border: 'c:color-border',
    'bg-hover': '#ffffff', 'fg-hover': 'c:color-hover', 'border-hover': 'c:color-border-hover',
    'bg-active': '#ffffff', 'fg-active': 'c:color-active', 'border-active': 'c:color-border-active',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'border-focus': 'c:color-border',
};
const SOLID = {
    bg: 'c:color-solid', fg: 'c:color-solid-text', border: 'transparent',
    'bg-hover': 'c:color-solid-hover', 'fg-hover': 'c:color-solid-text', 'border-hover': 'transparent',
    'bg-active': 'c:color-solid-active', 'fg-active': 'c:color-solid-text', 'border-active': 'transparent',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'border-focus': 'c:color-border',
};
const FILLED = {
    bg: 'c:color-bg', fg: 'c:color', border: 'transparent',
    'bg-hover': 'c:color-bg-hover', 'fg-hover': 'c:color', 'border-hover': 'transparent',
    'bg-active': 'c:color-bg-active', 'fg-active': 'c:color', 'border-active': 'transparent',
    'bg-disabled': '#f4f4f5', 'fg-disabled': '#a1a1aa', 'border-focus': 'c:color-border',
};
const TEXT = {
    bg: 'transparent', fg: 'c:color-text', border: 'transparent',
    'bg-hover': 'c:color-text-bg-hover', 'fg-hover': 'c:color-text-hover', 'border-hover': 'transparent',
    'bg-active': 'c:color-text-bg-active', 'fg-active': 'c:color-text-active', 'border-active': 'transparent',
    'bg-disabled': 'transparent', 'fg-disabled': '#a1a1aa', 'border-focus': 'c:color-border',
};
const LINK = { ...TEXT, 'bg-hover': 'transparent', 'bg-active': 'transparent' };
const VARIANT_VALUES = { outlined: OUTLINED, dashed: OUTLINED, solid: SOLID, filled: FILLED, text: TEXT, link: LINK };
const VARIANT_TOKENS = Object.keys(OUTLINED);
const DEFAULT_SIZE_VALUES = {
    height: { sm: 32, lg: 40 },
    fontSize: { sm: 14, lg: 18 }, lineHeight: { sm: 22 / 14, lg: 26 / 18 }, paddingX: { sm: 12, lg: 16 }, paddingY: { sm: 6, lg: 8 },
    gap: { sm: 6, lg: 8 }, radius: { sm: 6, lg: 8 }, iconSize: { sm: 14, lg: 16 },
};
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Button collections and variables. Item ids: `c-<token>` (Color), `v-<token>` (Variant), `s-<token>` (Size), with `prefix` put in
 * front of the Variant ids, so a second Variant set can sit beside the first.
 *
 * `shared` reuses the Color and Size collections of another call (its `ids`): the second call then adds only its Variant set.
 * @param {{ ids?: { variant?: string, color?: string, size?: string }, prefix?: string, variantModes?: string[], shared?: { color: string, size: string } }} [options]
 */
export function buttonModel({ ids = {}, prefix = '', variantModes = BUTTON_VARIANTS, colors = BUTTON_COLORS, palette = PALETTE, sizeModes = BUTTON_SIZES, sizeValues = {}, shared = null } = {}) {
    const sizes = { ...DEFAULT_SIZE_VALUES, ...sizeValues };
    const variant = ids.variant ?? 'c-variant';
    const color = shared ? shared.color : ids.color ?? 'c-color';
    const size = shared ? shared.size : ids.size ?? 'c-size';
    const collections = [{ id: variant, name: 'Variant', modes: variantModes.map(titled) }];
    const items = [];
    if (!shared) {
        collections.unshift({ id: color, name: 'Color', modes: colors.map(titled) }, { id: size, name: 'Size', modes: sizeModes });
        for (const [token, key] of Object.entries(COLOR_TOKENS)) {
            const values = Object.fromEntries(colors.map(c => [c, palette[c][key]]));
            items.push({ id: `c-${token}`, name: `button/${token}`, type: 'color', collectionId: color, values });
        }
        for (const [token, values] of Object.entries(sizes)) {
            items.push({ id: `s-${token}`, name: `button/${token}`, type: 'number', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, values[m.id]])) });
        }
    }
    for (const token of VARIANT_TOKENS) {
        const values = {};
        for (const mode of variantModes) {
            const spec = VARIANT_VALUES[mode][token];
            if (spec === 'transparent') values[mode] = '#00000000';
            else if (spec.startsWith('c:')) values[mode] = { alias: `c-${spec.slice(2)}` };
            else values[mode] = spec;
        }
        items.push({ id: `${prefix}v-${token}`, name: `button/${token}`, type: 'color', collectionId: variant, values });
    }
    return { collections, items, ids: { variant, color, size }, binding: { version: 2, templateId: 'button', variables: { variant, color, size } } };
}

