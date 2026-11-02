import { SIZE_MODES } from '../packages/builder-core/src/templates/size-modes.js';
// The Input variable model shared by the fixtures and the tests. Three collections: Variant (outlined | filled | borderless)
// drives the box, Status (default | error | warning) drives the border and focus colours through aliases, Size
// (large | middle | small) holds the metrics. Every literal sits in a Primitive and is reached through a Semantic alias (see
// literal-bank.mjs), so a fixture is self-contained. Every fixture and every test builds its Input variables here.
import { literalBank, textStyleBank } from './literal-bank.mjs';

export const INPUT_VARIANTS = ['outlined', 'filled', 'borderless'];
export const INPUT_STATUSES = ['default', 'error', 'warning'];
export const INPUT_SIZES = SIZE_MODES.map(id => ({ id, name: id }));

/** Status tokens: the border and focus colours of each status. */
const STATUS_VALUES = {
    'status-border': { default: '#d9d9d9', error: '#ff4d4f', warning: '#faad14' },
    'status-border-hover': { default: '#4096ff', error: '#ff4d4f', warning: '#faad14' },
    'status-border-focus': { default: '#4096ff', error: '#ff4d4f', warning: '#faad14' },
    'status-outline': { default: '#4096ff33', error: '#ff4d4f33', warning: '#faad1433' },
};

/** Variant values per mode: `st:` a Status token, a hex literal, or `transparent`. */
const OUTLINED = {
    bg: '#ffffff', fg: '#18181b', border: 'st:status-border', placeholder: '#bfbfbf',
    'bg-hover': '#ffffff', 'border-hover': 'st:status-border-hover', 'border-focus': 'st:status-border-focus',
    'bg-disabled': '#f5f5f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'st:status-outline',
};
const FILLED = {
    bg: '#f5f5f5', fg: '#18181b', border: 'transparent', placeholder: '#bfbfbf',
    'bg-hover': '#eeeeee', 'border-hover': 'transparent', 'border-focus': 'transparent',
    'bg-disabled': '#f5f5f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'st:status-outline',
};
const BORDERLESS = {
    bg: 'transparent', fg: '#18181b', border: 'transparent', placeholder: '#bfbfbf',
    'bg-hover': 'transparent', 'border-hover': 'transparent', 'border-focus': 'transparent',
    'bg-disabled': 'transparent', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
    'outline-color-active': 'st:status-outline',
};
const VARIANT_VALUES = { outlined: OUTLINED, filled: FILLED, borderless: BORDERLESS };
const VARIANT_TOKENS = Object.keys(OUTLINED);
const DEFAULT_SIZE_VALUES = {
    height: { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 },
    paddingX: { xs: 4, sm: 8, md: 12, lg: 16, xl: 16 }, paddingY: { xs: 4, sm: 6, md: 6, lg: 8, xl: 8 },
    gap: { xs: 4, sm: 6, md: 8, lg: 8, xl: 8 }, radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 8 }, iconSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 },
};
/** The Size modes of the Input's typography tokens (value, addon, placeholder, clear, count), as the Semantic text style each takes. */
const INPUT_TYPOGRAPHY_STYLE = { xs: 'textXs', sm: 'textSm', md: 'textBase', lg: 'textLg', xl: 'textXl' };
const INPUT_TYPOGRAPHY = ['valueTypography', 'addonTypography', 'placeholderTypography', 'clearTypography', 'countTypography'];
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Input collections and variables. Item ids: `{prefix}st-<token>` (Status), `{prefix}v-<token>` (Variant),
 * `{prefix}s-<token>` (Size). Literal Primitives and Semantic items are created once per fixture.
 */
export function inputModel({ ids = {}, prefix = '', variantModes = INPUT_VARIANTS, statusModes = INPUT_STATUSES, sizeModes = INPUT_SIZES, sizeValues = {}, shared = null } = {}) {
    const sizes = { ...DEFAULT_SIZE_VALUES, ...sizeValues };
    const variant = ids.variant ?? 'c-variant';
    const status = ids.status ?? 'c-status';
    const size = ids.size ?? 'c-size';
    // `shared` reuses the Semantic and Primitives collections of another call (its ids): the literal and typography items then share ids with it.
    const semantic = shared?.semantic ?? ids.semantic ?? 'c-semantic';
    const primitives = shared?.primitives ?? ids.primitives ?? 'c-primitives';
    const common = shared ? '' : prefix;
    const semItem = `${common}sem-outlineTransparent`;
    const bank = literalBank(primitives, semantic);
    const text = textStyleBank(primitives, semantic, common);
    const collections = [
        { id: variant, name: 'Input Variant', modes: variantModes.map(titled) },
        { id: status, name: 'Input Status', modes: statusModes.map(titled) },
        { id: size, name: 'Input Size', modes: sizeModes },
        ...(shared ? [] : [
            { id: semantic, name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] },
            { id: primitives, name: 'Primitives', modes: [{ id: 'base', name: 'Base' }] },
        ]),
    ];
    const items = [{ id: semItem, name: 'outlineTransparent', type: 'color', collectionId: semantic, values: { base: { alias: bank.primitiveOf('#00000000') } } }];
    for (const [token, values] of Object.entries(STATUS_VALUES)) {
        items.push({ id: `${prefix}st-${token}`, name: token, type: 'color', collectionId: status, values: Object.fromEntries(statusModes.map(m => [m, { alias: bank.ref(values[m]) }])) });
    }
    for (const [token, values] of Object.entries(sizes)) {
        items.push({ id: `${prefix}s-${token}`, name: token, type: 'number', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, { alias: bank.ref(values[m.id]) }])) });
    }
    for (const token of INPUT_TYPOGRAPHY) {
        items.push({ id: `${prefix}s-${token}`, name: token, type: 'typography', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, { alias: text.ref(INPUT_TYPOGRAPHY_STYLE[m.id]) }])) });
    }
    for (const token of VARIANT_TOKENS) {
        const values = {};
        for (const mode of variantModes) {
            const spec = VARIANT_VALUES[mode][token];
            if (spec === 'transparent') values[mode] = { alias: semItem };
            else if (spec.startsWith('st:')) values[mode] = { alias: `${prefix}st-${spec.slice(3)}` };
            else values[mode] = { alias: bank.ref(spec) };
        }
        items.push({ id: `${prefix}v-${token}`, name: token, type: 'color', collectionId: variant, values });
    }
    items.unshift(...bank.items(), ...text.items);
    return { collections, items, ids: { variant, status, size, semantic, primitives }, binding: { version: 2, templateId: 'input', variables: { variant, status, size } } };
}
