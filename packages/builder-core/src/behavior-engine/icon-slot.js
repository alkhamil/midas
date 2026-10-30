// Icon slot bindings (pure). A managed icon slot is a frame that holds the icon component the instance chose. The slot's width and
// height follow the size variable, and the icon's colour follows the foreground variable of the variant (the disabled one while the
// instance is disabled). The engine writes these bindings with each sync of the instance; nothing here writes to a document.

import { variableNameOf } from './tokens.js';

/**
 * The sort rank of a page in the icon picker: a page named Icon or Icons holds the file's icons, so its entries list first
 * under their own group. Every other page keeps document order after them.
 * @param {string} name
 * @returns {number}
 */
export function iconPageRank(name) {
    return /^icons?$/i.test(String(name ?? '').trim()) ? 0 : 1;
}

/**
 * Whether a picker entry matches the search: a case-insensitive substring of its group and leaf name. An empty search matches all.
 * @param {{ group?: string, leaf?: string }} entry
 * @param {string} query
 * @returns {boolean}
 */
export function iconEntryMatches(entry, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return true;
    return `${entry.group ? entry.group + ' ' : ''}${entry.leaf ?? ''}`.toLowerCase().includes(q);
}

/**
 * Every component the icon picker offers, from every page given: components and component sets (one entry per set, starting from
 * its default variant), with no naming rule and no flag. Entries from a page named Icon or Icons list first (see iconPageRank).
 * Soft-deleted components are skipped. An entry is { id, page, group, path, leaf, ids } like the component swap entries.
 * @param {{ name?: string, nodes?: any[] }[]} pages
 * @returns {{ id: string, page: string, group: string, path: string[], leaf: string, ids: Set<string> }[]}
 */
export function iconPickerEntries(pages) {
    const all = (pages || []).flatMap(p => (p.nodes || []).map(node => ({ node, page: (p.name || '').trim() || 'Page' })));
    const byId = new Map(all.map(e => [e.node.id, e.node]));
    const softDeleted = n => !!n.softDeleted || (!!n.parentId && byId.get(n.parentId)?.componentSet === true && !!byId.get(n.parentId)?.softDeleted);
    const variantsOf = set => all.filter(e => e.node.parentId === set.id && e.node.component && !softDeleted(e.node)).map(e => e.node);
    // The variant an entry starts from: every variant property at its first value, else the first variant layer.
    const defaultOf = set => {
        const vs = variantsOf(set);
        if (!vs.length) return null;
        const props = [...new Set(vs.flatMap(v => Object.keys(v.variant || {})))];
        if (props.length) {
            const firstOf = p => {
                const vals = [...new Set(vs.map(v => v.variant?.[p]).filter(x => x !== undefined))];
                const order = set.valueOrder?.[p];
                if (!order) return vals[0];
                const rank = x => { const i = order.indexOf(x); return i < 0 ? order.length : i; };
                return vals.map((x, i) => [x, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])[0][0];
            };
            const want = Object.fromEntries(props.map(p => [p, firstOf(p)]));
            const hit = vs.find(v => Object.entries(want).every(([k, x]) => v.variant?.[k] === x));
            if (hit) return hit;
        }
        return vs[0];
    };
    const out = [];
    const seenSets = new Set();
    for (const { node: c, page } of all) {
        // A set is one entry, through its variants; the set node itself is skipped, as are plain layers.
        if (!c.component || c.componentSet || softDeleted(c)) continue;
        const set = c.parentId && byId.get(c.parentId)?.componentSet === true ? byId.get(c.parentId) : null;
        const def = set ? (defaultOf(set) || c) : c;
        let group, leaf;
        if (set) {
            if (seenSets.has(set.id)) continue;
            seenSets.add(set.id);
            const parts = String(set.name || '').split('/').map(s => s.trim());
            leaf = parts.pop();
            group = parts.join(' / ');
        }
        else {
            const parts = String(c.name || '').split('/').map(s => s.trim());
            leaf = parts.pop();
            group = parts.join(' / ');
        }
        out.push({ id: def.id, page, group, path: group ? group.split(' / ') : [], leaf, ids: set ? new Set(variantsOf(set).map(v => v.id)) : new Set([c.id]) });
    }
    out.sort((a, b) => iconPageRank(a.page) - iconPageRank(b.page));
    return out;
}
import { dimensionOfGroup } from './validate-schema.js';
import { iconDefsOf, slotDefsOf } from './anatomy.js';

/**
 * The variables one managed slot follows, from its def's icon tokens: for each of colour, disabled colour and size, the variable
 * name, and the variable prop (dimension) whose collection holds it.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} slot the managed slot
 * @returns {Record<'colour' | 'disabledColour' | 'size', { name: string, dimension: string | null }>}
 */
export function iconSlotTargets(template, slot) {
    const def = slotDefsOf(template, slot)[0] ?? iconDefsOf(template)[0];
    const dimensionOf = token => {
        const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
        return group ? dimensionOfGroup(group, template.props) : null;
    };
    const { tokens } = def;
    return Object.fromEntries(['colour', 'disabledColour', 'size'].map(role => [role, { name: variableNameOf(template, tokens[role]), dimension: dimensionOf(tokens[role]) }]));
}

/**
 * The collections one template's icon slots need, as { prop, dimension, collection, variables, role }: for each icon def
 * whose show prop declares `requires`, the required dimensions with the icon variables in them (from the def's tokens).
 * Driven entirely by schema data; no component names.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
export function iconNeedsOf(template) {
    const out = [];
    for (const def of iconDefsOf(template)) {
        const requires = template.props[def.show]?.requires;
        if (!Array.isArray(requires)) continue;
        for (const dimension of requires) {
            const target = template.props[dimension];
            if (!target || target.source !== 'variable') continue;
            const variables = [];
            let role = null;
            for (const [r, token] of Object.entries(def.tokens ?? {})) {
                const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
                if (group && dimensionOfGroup(group, template.props) === dimension) { variables.push(variableNameOf(template, token)); role ??= r; }
            }
            if (!variables.length) continue;
            out.push({ prop: def.show, dimension, collection: target.collection, variables, role });
        }
    }
    return out.filter((need, at) => out.findIndex(o => o.dimension === need.dimension) === at);
}

/**
 * The text that says a missing icon variable: its name, the collection it was searched in and the mode the instance has for it.
 * @param {{ name: string, collectionName: string, modeName: string }} input
 * @returns {string}
 */
export function missingIconVariable({ name, collectionName, modeName }) {
    return `${name} in the ${collectionName} collection (mode ${modeName})`;
}

/**
 * Whether a vars key is one the icon slot owns: a fill by index, a stroke, or the slot's width and height. The engine derives these
 * on every sync, so the copy from the icon component never overwrites them.
 * @param {string} key
 */
export function isIconSlotVarKey(key) {
    return /^(fills\.\d+|stroke|w|h)$/.test(key);
}

/**
 * The bindings an icon slot's layers carry. `fg`, `fgDisabled` and `size` are the variable ids (null when the variable is missing).
 * A layer's visible fills bind by index to the colour; a layer with no fill but a stroke binds its stroke. A missing variable is listed
 * in `missing` (by variable name, from `names`) and nothing is bound in its place (never the plain colour while disabled).
 * @param {{
 *   fg: string | null, fgDisabled: string | null, size: string | null, disabled: boolean,
 *   names: { colour: string, disabledColour: string, size: string },
 *   layers: { id: string, fillIndexes: number[], stroke: boolean }[]
 * }} input
 * @returns {{ slot: Record<string, string>, layers: { id: string, vars: Record<string, string> }[], missing: string[] }}
 */
export function iconSlotBindings({ fg, fgDisabled, size, disabled, names, layers }) {
    const missing = [];
    const colour = disabled ? fgDisabled : fg;
    if (disabled && !fgDisabled) missing.push(names.disabledColour);
    else if (!disabled && !fg) missing.push(names.colour);
    if (!size) missing.push(names.size);
    const slot = size ? { w: size, h: size } : {};
    return {
        slot,
        layers: layers.map(layer => {
            /** @type {Record<string, string>} */
            const vars = {};
            if (colour) {
                for (const i of layer.fillIndexes) vars[`fills.${i}`] = colour;
                if (layer.fillIndexes.length === 0 && layer.stroke) vars.stroke = colour;
            }
            return { id: layer.id, vars };
        }),
        missing,
    };
}
