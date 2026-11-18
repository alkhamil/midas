import { inputFamily } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Search Field (antd Input.Search without the enter button): the Input family with the suffix on as a magnifier icon. It keeps the Input's Variant, Status,
// Size, states, managed text, clear icon and counter; the suffix is Input's own icon side, switched on and set to the search icon by default. The enter button and
// onSearch are not built (a button addon and its press need an engine action that does not exist yet).

/** @type {TemplateSchema} */
export const SEARCH = inputFamily({
    id: 'antd-search',
    name: 'Search Field',
    sampleProps: { placeholder: 'Search' },
    dropped: {},
    added: {
        propPatch: {
            hasSuffix: { default: true },
            suffixKind: { default: 'icon' },
        },
    },
});

// The suffix icon of Input carries no role; a Search Field's suffix defaults to the search icon of the set.
SEARCH.icons = SEARCH.icons.map(def => (def.slot === 'suffixIcon' ? { ...def, role: 'search' } : def));
