// Literal cells for the fixture models. A component cell never holds a literal: every literal (a hex colour or a number)
// becomes one Primitive that holds the value, and one Semantic item that aliases it. Component cells alias the Semantic item.
// Ids are deterministic by value, so two model calls over the same literals agree on them.

import TEXT_STYLES from '../packages/builder-core/src/base-tokens/text-styles.json' with { type: 'json' };
import BASE_SNAPSHOT from '../packages/builder-core/src/base-tokens/base-snapshot.json' with { type: 'json' };

// The antd scale names of the base snapshot's Primitives (group and step, e.g. `danger/500`): a literal that is on the scale takes its name.
const primitivesId = BASE_SNAPSHOT.collections.find(c => c.name === 'Primitives').id;
const SCALE_NAMES = new Map(BASE_SNAPSHOT.items.filter(i => i.collectionId === primitivesId).map(i => [String(i.values.base?.literal ?? '').toLowerCase(), i.name]).filter(([value]) => value !== ''));

const keyOf = value => (typeof value === 'number' ? `n${value}` : `h${value.slice(1)}`);

/** The name of a literal: its scale name when it has one (`color/danger/500`), else a numbered literal (`color/literal-3`, `number/literal-3`). */
const nameOf = (value, index) => {
    const scale = SCALE_NAMES.get(String(value).toLowerCase());
    if (scale) return typeof value === 'number' ? `number/${scale}` : `color/${scale}`;
    return typeof value === 'number' ? `number/literal-${index}` : `color/literal-${index}`;
};

/**
 * @param {string} primitives the Primitives collection id
 * @param {string} semantic the Semantic collection id
 */
/**
 * The Semantic text styles as fixture items: the typography Primitives (literal members, read from text-styles.json) and the
 * Semantic whole aliases of them. `ref(name)` is the Semantic item id of a style, e.g. `textBase`.
 * @param {string} primitives the Primitives collection id
 * @param {string} semantic the Semantic collection id
 * @param {string} prefix put in front of every id
 */
export function textStyleBank(primitives, semantic, prefix = '') {
    const items = [];
    for (const p of TEXT_STYLES.items.filter(i => i.collection === 'Primitives')) {
        items.push({ id: `${prefix}tp-${p.name}`, name: p.name, type: 'typography', collectionId: primitives, values: { base: p.values.Base.literal } });
    }
    for (const s of TEXT_STYLES.items.filter(i => i.collection === 'Semantic')) {
        items.push({ id: `${prefix}ts-${s.name}`, name: s.name, type: 'typography', collectionId: semantic, values: { base: { alias: `${prefix}tp-${s.values.Light.alias.name}` } } });
    }
    return { items, ref: name => `${prefix}ts-${name}` };
}

export function literalBank(primitives, semantic) {
    /** @type {Map<string, { value: string | number, primitive: string, semantic: string }>} */
    const refs = new Map();
    const entry = value => {
        const key = keyOf(value);
        if (!refs.has(key)) refs.set(key, { value, primitive: `p-${key}`, semantic: `sem-${key}`, name: nameOf(value, refs.size) });
        return refs.get(key);
    };
    return {
        /** The Semantic item id holding `value`. */
        ref: value => entry(value).semantic,
        /** The Primitive item id holding `value`. */
        primitiveOf: value => entry(value).primitive,
        /** Every Primitive and Semantic item created so far. */
        items() {
            return [...refs.values()].flatMap(({ value, primitive, semantic: sem, name }) => [
                { id: primitive, name, type: typeof value === 'number' ? 'number' : 'color', collectionId: primitives, values: { base: value } },
                { id: sem, name, type: typeof value === 'number' ? 'number' : 'color', collectionId: semantic, values: { base: { alias: primitive } } },
            ]);
        },
    };
}
