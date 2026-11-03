// The component properties of a layer imported from a library, with the layer ids they store mapped to the importing file's ids (pure). A library
// component gets new ids on import, so what a property points at must follow: an instance-swap property's default and preferred components, and a
// slot property's preferred components. Template ids (a slot's `accepts`) are not layer ids and stay.

/**
 * @param {any[]} props the layer's `cprops`
 * @param {Map<string, string>} ids the library's layer ids and the ids they became
 * @returns {any[]} new properties; the input is not changed
 */
export function remapCprops(props, ids) {
    const map = (/** @type {string} */ id) => ids.get(id) ?? id;
    const preferred = (/** @type {any} */ p) => (Array.isArray(p.preferred) ? { preferred: p.preferred.map(map) } : {});
    return props.map(p => p?.type === 'instance' ? { ...p, def: ids.has(p.def) ? map(p.def) : p.def, ...preferred(p) }
        : p?.type === 'slot' ? { ...p, ...preferred(p) } : p);
}
