// Literal cells for the fixture models. A component cell never holds a literal: every literal (a hex colour or a number)
// becomes one Primitive that holds the value, and one Semantic item that aliases it. Component cells alias the Semantic item.
// Ids are deterministic by value, so two model calls over the same literals agree on them.

const keyOf = value => (typeof value === 'number' ? `n${value}` : `h${value.slice(1)}`);

/**
 * @param {string} primitives the Primitives collection id
 * @param {string} semantic the Semantic collection id
 */
export function literalBank(primitives, semantic) {
    /** @type {Map<string, { value: string | number, primitive: string, semantic: string }>} */
    const refs = new Map();
    const entry = value => {
        const key = keyOf(value);
        if (!refs.has(key)) refs.set(key, { value, primitive: `p-${key}`, semantic: `sem-${key}` });
        return refs.get(key);
    };
    return {
        /** The Semantic item id holding `value`. */
        ref: value => entry(value).semantic,
        /** The Primitive item id holding `value`. */
        primitiveOf: value => entry(value).primitive,
        /** Every Primitive and Semantic item created so far. */
        items() {
            return [...refs.values()].flatMap(({ value, primitive, semantic: sem }) => [
                { id: primitive, name: keyOf(value), type: typeof value === 'number' ? 'number' : 'color', collectionId: primitives, values: { base: value } },
                { id: sem, name: `fx-${keyOf(value)}`, type: typeof value === 'number' ? 'number' : 'color', collectionId: semantic, values: { base: { alias: primitive } } },
            ]);
        },
    };
}
