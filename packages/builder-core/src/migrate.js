// Behavior data versions of a file. `behaviorVersion` is separate from the file's own `version` (which stays 1).
//   1 (absent)  List variables lived in Tokens (doc.data.variables, type 'array')
//   2           State is its own collection: doc.data.state = { variables, derived }
import { cleanState, normalizeStateVariable, uniqueStateName } from './state.js';

export const BEHAVIOR_VERSION = 2;

/** Rows of an old array token: the first mode that holds a list (a token had one list per mode; State has one). */
function oldRows(item, collection) {
    for (const m of collection?.modes || []) if (Array.isArray(item.values?.[m.id])) return item.values[m.id];
    for (const v of Object.values(item.values || {})) if (Array.isArray(v)) return v;
    return [];
}

/**
 * Bring file data (doc.data) to the current behavior model. Pure and idempotent: returns a new top-level object and leaves
 * the input alone. Old array tokens become State lists (scope page, ids kept, so a Repeat's `variableId` still resolves);
 * a newer behaviorVersion is kept as it is and only the State is cleaned, which drops fields this version does not know.
 */
export function migrateBehavior(data) {
    if (!data || typeof data !== 'object') return data;
    const found = Number(data.behaviorVersion);
    const from = Number.isFinite(found) && found >= 1 ? found : 1;
    let state = cleanState(data.state);
    let variables = data.variables;
    if (from < 2 && variables && Array.isArray(variables.items)) {
        const moved = variables.items.filter(i => i && i.type === 'array');
        if (moved.length) {
            const colls = new Map((variables.collections || []).map(c => [c.id, c]));
            const out = { ...state, variables: [...state.variables] };
            for (const item of moved) {
                if (out.variables.some(v => v.id === item.id)) continue;
                const v = normalizeStateVariable({
                    id: item.id, name: uniqueStateName(out, String(item.name ?? 'List').split('/').pop() || 'List'), type: 'list', itemType: 'object',
                    schema: item.schema, initial: oldRows(item, colls.get(item.collectionId)), scope: 'page', description: item.description,
                });
                if (v) out.variables.push(v);
            }
            state = out;
            variables = { ...variables, items: variables.items.filter(i => !(i && i.type === 'array')) };
        }
    }
    return { ...data, ...(variables ? { variables } : {}), state, behaviorVersion: Math.max(BEHAVIOR_VERSION, from) };
}
