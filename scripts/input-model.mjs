// The Input variable model shared by the fixtures and the tests. Three collections: Variant (outlined | filled | borderless)
// drives the box, Status (default | error | warning) drives the border and focus colours through aliases, Size
// (large | middle | small) holds the metrics. The colour values are plain hex, so a fixture is self-contained.
// Every fixture and every test builds its Input variables here.

export const INPUT_VARIANTS = ['outlined', 'filled', 'borderless'];
export const INPUT_STATUSES = ['default', 'error', 'warning'];
export const INPUT_SIZES = [{ id: 'large', name: 'Large' }, { id: 'middle', name: 'Middle' }, { id: 'small', name: 'Small' }];

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
};
const FILLED = {
    bg: '#f5f5f5', fg: '#18181b', border: 'transparent', placeholder: '#bfbfbf',
    'bg-hover': '#eeeeee', 'border-hover': 'transparent', 'border-focus': 'transparent',
    'bg-disabled': '#f5f5f5', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
};
const BORDERLESS = {
    bg: 'transparent', fg: '#18181b', border: 'transparent', placeholder: '#bfbfbf',
    'bg-hover': 'transparent', 'border-hover': 'transparent', 'border-focus': 'transparent',
    'bg-disabled': 'transparent', 'fg-disabled': '#a1a1aa', 'outline-color': 'transparent',
};
const VARIANT_VALUES = { outlined: OUTLINED, filled: FILLED, borderless: BORDERLESS };
const VARIANT_TOKENS = Object.keys(OUTLINED);
const DEFAULT_SIZE_VALUES = {
    height: { large: 40, middle: 32, small: 24 },
    fontSize: { large: 16, middle: 14, small: 14 }, lineHeight: { large: 22, middle: 22, small: 20 },
    paddingX: { large: 16, middle: 12, small: 8 }, paddingY: { large: 8, middle: 6, small: 4 },
    gap: { large: 8, middle: 8, small: 6 }, radius: { large: 8, middle: 6, small: 4 }, iconSize: { large: 16, middle: 14, small: 12 },
};
const titled = id => ({ id, name: id[0].toUpperCase() + id.slice(1) });

/**
 * The Input collections and variables. Item ids: `{prefix}st-<token>` (Status), `{prefix}v-<token>` (Variant),
 * `{prefix}s-<token>` (Size).
 */
export function inputModel({ ids = {}, prefix = '', variantModes = INPUT_VARIANTS, statusModes = INPUT_STATUSES, sizeModes = INPUT_SIZES, sizeValues = {} } = {}) {
    const sizes = { ...DEFAULT_SIZE_VALUES, ...sizeValues };
    const variant = ids.variant ?? 'c-variant';
    const status = ids.status ?? 'c-status';
    const size = ids.size ?? 'c-size';
    const collections = [
        { id: variant, name: 'Variant', modes: variantModes.map(titled) },
        { id: status, name: 'Status', modes: statusModes.map(titled) },
        { id: size, name: 'Size', modes: sizeModes },
    ];
    const items = [];
    for (const [token, values] of Object.entries(STATUS_VALUES)) {
        items.push({ id: `${prefix}st-${token}`, name: `input/${token}`, type: 'color', collectionId: status, values: Object.fromEntries(statusModes.map(m => [m, values[m]])) });
    }
    for (const [token, values] of Object.entries(sizes)) {
        items.push({ id: `${prefix}s-${token}`, name: `input/${token}`, type: 'number', collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, values[m.id]])) });
    }
    for (const token of VARIANT_TOKENS) {
        const values = {};
        for (const mode of variantModes) {
            const spec = VARIANT_VALUES[mode][token];
            if (spec === 'transparent') values[mode] = '#00000000';
            else if (spec.startsWith('st:')) values[mode] = { alias: `${prefix}st-${spec.slice(3)}` };
            else values[mode] = spec;
        }
        items.push({ id: `${prefix}v-${token}`, name: `input/${token}`, type: 'color', collectionId: variant, values });
    }
    return { collections, items, ids: { variant, status, size }, binding: { version: 2, templateId: 'input', variables: { variant, status, size } } };
}
