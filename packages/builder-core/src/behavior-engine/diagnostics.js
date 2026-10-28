// Diagnostics (stage 9). Pure: a document in, a list of findings out, in document order. An error means preview or generated code
// would be wrong (a token that cannot be resolved, a state token missing for a mode). A warning means something is left out
// (a collection no component binds). Nothing is repaired; the editor shows the list.
import { TEMPLATES, variableProps } from './registry.js';
import { previewOf } from './preview.js';
import { resolveTokens } from './tokens.js';

/**
 * Every finding in a document.
 * @param {{ variables?: { collections?: any[], items?: any[] }, pages?: { nodes?: any[] }[] }} doc
 * @returns {Record<string, unknown>[]}
 */
export function diagnoseDocument(doc) {
    const nodes = (doc.pages || []).flatMap(page => page.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const variables = doc.variables || {};
    const collections = variables.collections || [];
    const masters = nodes.filter(n => n.behavior && 'templateId' in n.behavior);
    /** @type {Record<string, unknown>[]} */
    const out = [];

    const bound = new Set(masters.flatMap(m => Object.values(m.behavior.variables).filter(Boolean)));
    for (const c of collections) {
        if (!bound.has(c.id)) out.push({ severity: 'warning', code: 'unused-collection', collection: c.name, message: `Unused collection "${c.name}": excluded from preview and code generation.` });
    }

    for (const m of masters) {
        const template = TEMPLATES.get(m.behavior.templateId);
        if (!template) continue;
        for (const [dim] of variableProps(template)) {
            const collection = collections.find(c => c.id === m.behavior.variables[dim]);
            if (!collection) continue;
            for (const mode of collection.modes || []) {
                const selected = Object.fromEntries(variableProps(template).map(([d]) => [d, d === dim ? mode.id : null]));
                const { unresolved } = resolveTokens(template, m.behavior, selected, variables);
                for (const [state, overrides] of Object.entries(template.stateTokens || {})) {
                    for (const stateToken of Object.values(overrides)) {
                        for (const u of unresolved) {
                            if (u.token !== stateToken || u.dimension !== dim) continue;
                            out.push({
                                severity: 'error', code: 'state-token-missing', node: m.name, nodeId: m.id, state, token: stateToken, mode: mode.name, reason: u.reason,
                                message: `${m.name}: state "${state}" needs token "${stateToken}" in mode "${mode.name}" (${u.reason}).`,
                            });
                        }
                    }
                }
            }
        }
    }

    const stateTokens = new Set(masters.flatMap(m => Object.values(TEMPLATES.get(m.behavior.templateId)?.stateTokens || {}).flatMap(Object.values)));
    for (const inst of nodes) {
        if (!inst.isInstance || !inst.behavior || !('props' in inst.behavior)) continue;
        const binding = byId.get(inst.sourceId)?.behavior;
        const template = binding && 'templateId' in binding ? TEMPLATES.get(binding.templateId) : undefined;
        if (!template) continue;
        const { unresolved } = previewOf(template, binding, inst.behavior.props, variables, 'default');
        for (const u of unresolved) {
            if (stateTokens.has(u.token)) continue;
            out.push({
                severity: 'error', code: 'token-unresolved', node: inst.name, nodeId: inst.id, token: u.token, reason: u.reason,
                message: `${inst.name}: token "${u.token}" is unresolved (${u.reason}).`,
            });
        }
    }
    return out;
}
