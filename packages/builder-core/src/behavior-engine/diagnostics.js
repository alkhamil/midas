// Diagnostics (pure). A document in, a list of findings out, in document order. An error means preview or generated code would be
// wrong (a variable missing from a collection or a mode, a token that cannot be resolved for an instance's modes). A warning means
// something is left out or set by hand (a master token not bound, a layer rebound by hand). An
// info note says something is stored but not drawn. Nothing is repaired; the editor shows the list.
import { TEMPLATES, variableProps, sameModes, fallbackCollection } from './registry.js';
import { resolveTokens, tokenValueOf, valueIn, variableIdNamed, variableKey, splitColor, withOpacity, restOf } from './tokens.js';
import { roleOf } from './auto-fix.js';
import { primarySlotOf } from './anatomy.js';
import ROLES from '../base-tokens/roles.json' with { type: 'json' };
import { resolveProps } from './instance-props.js';
import { resolveMode } from './modes.js';
import { planStateBindings } from './state-bindings.js';
import { VARIABLE_KEYS, conditionHolds, partWrites } from './display.js';
import { strokePaintMissing } from '../geometry/shapes.js';
import { dimensionOfGroup } from './validate-schema.js';
import { masterLayersOf } from './layers.js';
import { layerSpecsOf, masterLayersByKey } from './template-master.js';
import { diagnoseSlots } from './slot-diagnostics.js';

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
    // An alias reads in its own collection's mode: the same mode name when it has it, else the first
    // mode holding a value, else the first mode (the read path variableValue falls back the same way).
    const modes = collections.find(c => c.id === item.collectionId)?.modes ?? [];
    const modeId = modes.find(m => modeKey(m.name) === modeKey(modeName))?.id
        ?? modes.find(m => item.values?.[m.id] !== undefined)?.id ?? modes[0]?.id;
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
 * Whether a token must stay transparent: its role is the transparent token (the rest colour of a ring). Generic:
 * any token whose role resolves to the transparent base reads this path, never a token name.
 */
const transparentToken = (template, token, modeName) => {
    const role = roleOf(template, token, modeName);
    if (!role || typeof role !== 'string' || role.includes('/')) return false;
    return ROLES[role]?.base === 'Semantic/colorTransparent';
};

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
            // Bound to another template's collection: the template cannot use it. One mismatch error names the
            // collection actually bound; the missing variables behind it are not reported again. Auto Fix binds the
            // dimension to the template's own "<Template> <Name>" collection instead.
            const servesTemplate = collection.name === `${template.name} ${def.collection}`;
            const schemaModes = Array.isArray(def.modes) ? def.modes : [];
            if (!servesTemplate && !sameModes(collection.modes ?? [], schemaModes)) {
                out.push({ severity: 'error', code: 'mode-mismatch', node: m.name, nodeId: m.id, dimension: dim, collection: collection.name,
                    message: `${m.name}: collection "${collection.name}" bound for "${dim}" has modes (${(collection.modes ?? []).map(m => m.name).join(', ')}), not the schema modes (${schemaModes.join(', ')}). Auto Fix binds "${dim}" to "${fallbackCollection(template, def)}" instead.` });
                continue;
            }
            // A standard prop (the Size scale) on the template's own collection: a schema mode it lacks, missing or renamed, is reported; Auto Fix adds it.
            const have = (collection.modes ?? []).map(mode => String(mode.name).toLowerCase());
            const missing = schemaModes.filter(mode => !have.includes(String(mode).toLowerCase()));
            if (def.standard === true && missing.length) out.push({ severity: 'error', code: 'mode-missing', node: m.name, nodeId: m.id, dimension: dim, collection: collection.name, modes: missing,
                message: `${m.name}: collection "${collection.name}" has no mode ${missing.join(', ')}. Auto Fix adds ${missing.length === 1 ? 'it' : 'them'} with the Semantic values.` });
            for (const [group, names] of Object.entries(template.tokens)) {
                if (dimensionOfGroup(group, template.props) !== dim) continue;
                for (const token of names) {
                    const variable = token;
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
                        const chain = value === undefined ? undefined : restOf(item, mode.name, items, collections);
                        if (value !== undefined && !chain?.trail.includes('Semantic')) {
                            const kind = (value !== null && typeof value === 'object') ? 'a non-Semantic variable' : 'a raw value';
                            out.push({ severity: 'error', code: 'component-not-semantic', node: m.name, nodeId: m.id, variable, mode: mode.name, collection: collection.name, message: `${m.name}: variable "${variable}" must alias a Semantic token in mode "${mode.name}" of "${collection.name}", not ${kind}. Auto Fix rebinds it when its role resolves.` });
                        }
                        if (value !== null && typeof value === 'object' && transparentToken(template, token, mode.name)) {
                            const split = chain && typeof chain.literal === 'string' && splitColor(chain.literal);
                            if (!chain || !chain.trail.includes('Semantic') || !split || split.alpha > 0) {
                                out.push({ severity: 'warning', code: 'outline-not-transparent', node: m.name, nodeId: m.id, variable, mode: mode.name, message: `${m.name}: variable "${variable}" must stay transparent through a Semantic alias in mode "${mode.name}". Auto Fix rebinds it.` });
                            }
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
        // A managed icon slot the props show holds an icon when one is chosen; an empty one keeps its box and draws nothing, and is reported.
        // A glyph is a drawn outline with nothing inside it by design, so only an icon slot can be empty.
        for (const slot of childrenOf(inst.id).filter(c => c.behavior?.slot !== undefined && c.type !== 'text' && template.anatomy.find(s => s.id === c.behavior.slot)?.kind === 'icon')) {
            if (childrenOf(slot.id).length) continue;
            out.push({ severity: 'warning', code: 'icon-slot-empty', node: inst.name, nodeId: inst.id, slot: slot.behavior.slot, message: `${inst.name}: the ${slot.behavior.slot} icon slot is empty: no icon is chosen.` });
        }
        const props = resolveProps(template, inst.behavior.props);
        const { warnings } = planStateBindings({ template, binding, props, layers: instanceLayers(inst, master, childrenOf, primarySlotOf(template)), variables });
        for (const w of warnings) {
            out.push({ severity: 'warning', code: 'rebound-by-hand', node: inst.name, nodeId: inst.id, layer: w.key, prop: w.prop, state: w.state, message: `${inst.name}: ${w.key} ${w.prop} was set by hand, so state "${w.state}" does not change it.` });
        }
    }

    for (const m of masters) {
        const template = TEMPLATES.get(m.behavior.templateId);
        if (!template) continue;
        // A layer the template requires (a non-optional anatomy slot, or a canvas part) that the master lacks: Auto Fix has the generator add it.
        const present = new Set(masterLayersByKey(template, m, nodes).map(l => l.key));
        const sampleShown = new Set(partWrites(template, resolveProps(template, template.sampleProps ?? {})).filter(w => w.field === 'visible' && w.value === true).map(w => w.key));
        for (const spec of layerSpecsOf(template).slice(1)) {
            // A managed icon slot is a layer of an instance only; a conditional part hidden at the sample props is an instance layer too.
            // Every other layer of the template (an affix text included) is the master's.
            if (spec.role === 'slot' || present.has(spec.key)) continue;
            if ((spec.role === 'part' || spec.role === 'text') && spec.part?.shownWhen !== undefined && !sampleShown.has(spec.key)) continue;
            if (spec.role === 'group' && spec.slot?.shownWhen !== undefined && !conditionHolds(spec.slot.shownWhen, resolveProps(template, template.sampleProps ?? {}))) continue;
            out.push({ severity: 'warning', code: 'part-missing', node: m.name, nodeId: m.id, layer: spec.key, message: `${m.name}: the ${spec.key} layer is missing: ${template.name} needs it. Auto Fix adds it.` });
        }
        const known = new Set(items.map(i => i.id));
        for (const [layer, prop, token] of unboundTokens(template, m, childrenOf, known)) {
            // A text part is bound to its typography role (the token minus its suffix), and Auto Fix binds it.
            const message = prop === 'typography' ? `${m.name}: text ${layer} is not bound to ${token.replace(/Typography$/, '')}.` : `${m.name}: ${layer} ${prop} is not bound to "${token}".`;
            out.push({ severity: 'warning', code: 'unbound-token', node: m.name, nodeId: m.id, layer, prop, token, message });
        }
        // A focus ring no wider than the border is invisible: warn with both resolved widths, naming the master.
        // Missing bindings are reported as unbound-token instead, so this only fires when both widths resolve.
        if (template.outline) {
            const borderWidth = tokenValueOf(template, m.behavior, variables, 'borderWidth');
            const outlineWidth = tokenValueOf(template, m.behavior, variables, 'outlineWidth');
            if (borderWidth !== null && outlineWidth !== null && outlineWidth <= borderWidth) {
                out.push({ severity: 'warning', code: 'outline-swallowed', node: m.name, nodeId: m.id, borderWidth, outlineWidth, message: `${m.name}: outline width ${outlineWidth}px is not wider than border width ${borderWidth}px, so no focus ring is visible.` });
            }
            // A width token is single-step: one value in every mode. Geometry reads the first mode, so differing
            // per-mode values warn (missing or ambiguous values are reported as unbound-token instead and skip here).
            const sizeId = m.behavior.variables?.size ?? null;
            const sizeColl = sizeId ? collections.find(c => c.id === sizeId) : null;
            for (const token of ['borderWidth', 'outlineWidth']) {
                const item = sizeColl ? items.find(i => i.id === variableIdNamed(items, sizeColl.id, token)) : null;
                if (!item) continue;
                const seen = new Map();
                for (const mode of sizeColl.modes || []) {
                    const r = valueIn(item, () => mode.id, items);
                    if (!('reason' in r) && typeof r.value === 'number' && Number.isFinite(r.value)) seen.set(mode.name ?? mode.id, r.value);
                }
                if (new Set(seen.values()).size > 1) {
                    const each = [...seen].map(([name, value]) => `${name} ${value}px`).join(', ');
                    out.push({ severity: 'warning', code: 'width-modes-differ', node: m.name, nodeId: m.id, token, message: `${m.name}: ${token} differs by mode (${each}), so geometry uses the first mode's value.` });
                }
            }
        }

        // A bound stroke width whose master literal differs from the resolved token: hand-set values win on
        // every surface (canvas, Play and the export all draw the literal), so this warns instead of fixing.
        // A missing or dangling binding is reported as unbound-token instead and skips here.
        if (template.display?.root && 'strokeWidth' in template.display.root && typeof m.strokeWidth === 'number' && m.strokeWidth > 0
            && typeof m.vars?.strokeWidth === 'string' && known.has(m.vars.strokeWidth)) {
            const tokenWidth = tokenValueOf(template, m.behavior, variables, 'borderWidth');
            if (typeof tokenWidth === 'number' && Number.isFinite(tokenWidth) && tokenWidth !== m.strokeWidth) {
                out.push({ severity: 'warning', code: 'stroke-literal-diverges', node: m.name, nodeId: m.id, literal: m.strokeWidth, token: 'borderWidth', value: tokenWidth, message: `${m.name}: stroke width ${m.strokeWidth}px on the master differs from the bound border-width token (${tokenWidth}px). Edit the variable or detach the strokeWidth binding; the hand-set literal is what canvas, Play and the export draw.` });
            }
        }
    }
    // The content slots of every page: a slot below its minimum, above its maximum, or holding a layer it does not take (see slot-diagnostics.js).
    out.push(...diagnoseSlots(nodes));
    return out;
}

/**
 * The instance's layers paired with their master layers, for the state binding plan.
 * @param {any} inst
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 */
function instanceLayers(inst, master, childrenOf, primary) {
    if (!master) return [];
    const instChildren = childrenOf(inst.id);
    return masterLayersOf(master, childrenOf, primary).map(({ key, node }) => {
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
    const layers = new Map(masterLayersOf(master, childrenOf, primarySlotOf(template)).map(({ key, node }) => [key, node]));
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
