// Diagnostics (pure). A document in, a list of findings out, in document order. An error means preview or generated code would be
// wrong (a variable missing from a collection or a mode, a token that cannot be resolved for an instance's modes). A warning means
// something is left out or set by hand (a master token not bound, a layer rebound by hand). An
// info note says something is stored but not drawn. Nothing is repaired; the editor shows the list.
import { TEMPLATES, variableProps, sameModes, fallbackCollection } from './registry.js';
import { resolveTokens, variableKey } from './tokens.js';
import { resolveProps } from './instance-props.js';
import { resolveMode } from './modes.js';
import { planStateBindings } from './state-bindings.js';
import { VARIABLE_KEYS } from './display.js';
import { strokePaintMissing } from '../geometry/shapes.js';
import { dimensionOfGroup } from './validate-schema.js';
import { masterLayersOf } from './layers.js';

/**
 * Follows a stored mode value through aliases (by item id) to its literal, or undefined when it never lands on one.
 * @param {any} item
 * @param {string} modeId
 * @param {any[]} items
 * @param {Set<string>} [guard]
 */
function literalOf(item, modeName, items, collections, guard = new Set()) {
    if (!item || guard.has(item.id)) return undefined;
    guard.add(item.id);
    // An alias reads in its own collection's mode: the same mode name when it has it, else the first mode.
    const modes = collections.find(c => c.id === item.collectionId)?.modes ?? [];
    const modeId = modes.find(m => modeKey(m.name) === modeKey(modeName))?.id ?? modes[0]?.id;
    const value = modeId === undefined ? undefined : item.values?.[modeId];
    if (typeof value === 'number' || typeof value === 'string') return value;
    if (value && typeof value === 'object' && typeof value.alias === 'string') {
        return literalOf(items.find(i => i.id === value.alias), modeName, items, collections, guard);
    }
    return undefined;
}

/**
 * Whether a stored value is a ratio leftover: a positive number below any plausible px line height.
 * @param {unknown} value
 */
const isRatioValue = value => typeof value === 'number' && value > 0 && value < 4;

/** A mode name as it is matched: trimmed and lower case. */
const modeKey = s => String(s ?? '').trim().toLowerCase();

/**
 * Every finding in a document.
 * @param {{ variables?: { collections?: any[], items?: any[] }, pages?: { varModes?: Record<string, string>, nodes?: any[] }[] }} doc
 * @returns {Record<string, unknown>[]}
 */
export function diagnoseDocument(doc) {
    const pages = doc.pages || [];
    const nodes = pages.flatMap(page => page.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const pageOf = new Map(pages.flatMap(page => (page.nodes || []).map(n => [n.id, page])));
    const variables = doc.variables || {};
    const collections = variables.collections || [];
    const items = variables.items || [];
    const masters = nodes.filter(n => n.behavior && 'templateId' in n.behavior);
    const childrenOf = (/** @type {string} */ id) => nodes.filter(n => n.parentId === id);
    /** @type {Record<string, unknown>[]} */
    const out = [];

    for (const m of masters) {
        const template = TEMPLATES.get(m.behavior.templateId);
        if (!template) continue;
        for (const [dim, def] of variableProps(template)) {
            const collectionId = m.behavior.variables[dim];
            if (!collectionId) {
                out.push({ severity: 'error', code: 'dimension-unbound', node: m.name, nodeId: m.id, dimension: dim, collection: def.collection, message: `${m.name}: no "${def.collection}" collection is bound for "${dim}".` });
                continue;
            }
            const collection = collections.find(c => c.id === collectionId);
            if (!collection) {
                out.push({ severity: 'error', code: 'collection-missing', node: m.name, nodeId: m.id, dimension: dim, collection: collectionId, message: `${m.name}: collection "${collectionId}" bound for "${dim}" does not exist.` });
                continue;
            }
            // Bound to a collection that serves another template with other modes: the template cannot use it.
            // One mismatch error names the collection actually bound; the missing variables behind it are not
            // reported again. Auto Fix binds the dimension to the template-owned fallback collection instead.
            const boundNames = items.filter(i => i.collectionId === collection.id).map(i => String(i.name).toLowerCase());
            const servesTemplate = !boundNames.length || boundNames.some(n => n.startsWith(template.group.toLowerCase() + '/'));
            const schemaModes = Array.isArray(def.modes) ? def.modes : [];
            if (!servesTemplate && !sameModes(collection.modes ?? [], schemaModes)) {
                out.push({ severity: 'error', code: 'mode-mismatch', node: m.name, nodeId: m.id, dimension: dim, collection: collection.name,
                    message: `${m.name}: collection "${collection.name}" bound for "${dim}" has modes (${(collection.modes ?? []).map(m => m.name).join(', ')}), not the schema modes (${schemaModes.join(', ')}). Auto Fix binds "${dim}" to "${fallbackCollection(template, def)}" instead.` });
                continue;
            }
            for (const [group, names] of Object.entries(template.tokens)) {
                if (dimensionOfGroup(group, template.props) !== dim) continue;
                for (const token of names) {
                    const variable = `${template.group}/${token}`;
                    const item = items.find(i => i.collectionId === collection.id && variableKey(i.name) === variableKey(variable));
                    if (!item) {
                        out.push({ severity: 'error', code: 'variable-missing', node: m.name, nodeId: m.id, variable, collection: collection.name, message: `${m.name}: variable "${variable}" is missing from collection "${collection.name}".` });
                        continue;
                    }
                    for (const mode of collection.modes || []) {
                        const value = item.values?.[mode.id];
                        // A bound lineHeight that resolves to a ratio is a leftover of the antd-ratio base, never a px token.
                        if (token === 'lineHeight' && value !== undefined && isRatioValue(literalOf(item, mode.name, items, collections))) {
                            out.push({ severity: 'error', code: 'lineheight-ratio', node: m.name, nodeId: m.id, variable, mode: mode.name, message: `${m.name}: variable "${variable}" resolves to a ratio in mode "${mode.name}", not px. Auto Fix rebinds it to the paired px token.` });
                        }
                        if (value === undefined) {
                            out.push({ severity: 'error', code: 'variable-missing-in-mode', node: m.name, nodeId: m.id, variable, mode: mode.name, message: `${m.name}: variable "${variable}" has no value in mode "${mode.name}" of "${collection.name}".` });
                        }
                    }
                }
            }
        }
    }

    for (const inst of nodes) {
        if (!inst.isInstance || !inst.behavior || !('props' in inst.behavior)) continue;
        const master = byId.get(inst.sourceId);
        const binding = master?.behavior;
        const template = binding && 'templateId' in binding ? TEMPLATES.get(binding.templateId) : undefined;
        if (!template) continue;
        const page = pageOf.get(inst.id);
        /** @type {Record<string, string | null>} */
        const modes = {};
        for (const [dim] of variableProps(template)) {
            const collection = collections.find(c => c.id === binding.variables[dim]);
            modes[dim] = collection ? resolveMode(collection, inst, byId, page?.varModes) : null;
        }
        const { unresolved } = resolveTokens(template, binding, modes, variables);
        for (const u of unresolved) {
            // A missing variable, value or binding is reported once, on the master.
            if (u.reason === 'no-variable' || u.reason === 'no-value-in-mode' || u.reason === 'dimension-unbound' || u.reason === 'collection-missing') continue;
            out.push({ severity: 'error', code: 'token-unresolved', node: inst.name, nodeId: inst.id, token: u.token, reason: u.reason, message: `${inst.name}: token "${u.token}" is unresolved (${u.reason}).` });
        }
        const props = resolveProps(template, inst.behavior.props);
        if (props.loading === true) out.push({ severity: 'info', code: 'loading-not-drawn', node: inst.name, nodeId: inst.id, message: `${inst.name}: loading is stored and generated, but has no visual yet.` });
        const { warnings } = planStateBindings({ template, binding, props, layers: instanceLayers(inst, master, childrenOf), variables });
        for (const w of warnings) {
            out.push({ severity: 'warning', code: 'rebound-by-hand', node: inst.name, nodeId: inst.id, layer: w.key, prop: w.prop, state: w.state, message: `${inst.name}: ${w.key} ${w.prop} was set by hand, so state "${w.state}" does not change it.` });
        }
    }

    for (const m of masters) {
        const template = TEMPLATES.get(m.behavior.templateId);
        if (!template) continue;
        const known = new Set(items.map(i => i.id));
        for (const [layer, prop, token] of unboundTokens(template, m, childrenOf, known)) {
            out.push({ severity: 'warning', code: 'unbound-token', node: m.name, nodeId: m.id, layer, prop, token, message: `${m.name}: ${layer} ${prop} is not bound to "${template.group}/${token}".` });
        }
    }
    return out;
}

/**
 * The instance's layers paired with their master layers, for the state binding plan.
 * @param {any} inst
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 */
function instanceLayers(inst, master, childrenOf) {
    if (!master) return [];
    const instChildren = childrenOf(inst.id);
    return masterLayersOf(master, childrenOf).map(({ key, node }) => {
        const instance = key === 'root' ? inst : instChildren.find(c => c.sourceId === node.id);
        return instance ? { key, instance: { id: instance.id, vars: instance.vars }, master: { vars: node.vars } } : null;
    }).filter(Boolean);
}

/**
 * The master's mapped properties that are not bound to their token, as [layer, prop, token] triples; a mapped stroke with no paint counts as unbound, so one Bind tokens click adds and binds it.
 * A binding to a variable that no longer exists counts as unbound, so a deleted collection never reads as bound.
 * @param {any} template
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @param {Set<string>} known the ids of the variables that still exist
 */
function unboundTokens(template, master, childrenOf, known) {
    const tokens = Object.values(template.tokens).flat();
    const layers = new Map(masterLayersOf(master, childrenOf).map(({ key, node }) => [key, node]));
    /** @type {[string, string, string][]} */
    const out = [];
    for (const [key, props] of Object.entries(template.display)) {
        const layer = layers.get(key);
        if (!layer) continue;
        for (const [prop, source] of Object.entries(props)) {
            if (!tokens.includes(source)) continue;
            for (const varKey of VARIABLE_KEYS[prop] || []) if (layer.vars?.[varKey] === undefined || !known.has(layer.vars[varKey]) || (prop === 'stroke' && strokePaintMissing(layer))) out.push([key, prop, source]);
        }
    }
    return out;
}
