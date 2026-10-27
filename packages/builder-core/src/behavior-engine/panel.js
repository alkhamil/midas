// Panel model (stage 5): what the Behavior tab shows and how its edits are written. Pure: nothing here draws or touches the
// document. The renderer reads these models; every edit goes back through the binding model and the instance props store.
import { TEMPLATES, variableProps } from './registry.js';
import { autoMatchCollection, createBinding, setVariableBinding } from './binding.js';
import { isPropVisible, resolveProps, setInstanceProp } from './instance-props.js';
import { BEHAVIOR_DATA_VERSION } from './data.js';

/** @typedef {import('../templates/schema.js').TemplateSchema} TemplateSchema */

/** @param {any} binding */
const isBound = binding => !!binding && 'templateId' in binding;
/** The template a master is bound to, with its binding; null when the master is not bound (or names an unknown template). */
/** @param {any} master */
const boundTemplate = master => {
    const binding = master?.behavior;
    if (!isBound(binding)) return null;
    const template = TEMPLATES.get(binding.templateId);
    return template ? { binding, template } : null;
};
/** @param {import('./binding.js').Collection[]} list */
const options = list => list.map(c => ({ id: c.id, name: c.name }));

/**
 * A prop is icon-related when it is an icon component, is shown only under a condition, or is the condition of another prop.
 * Those are the icon choices the master never holds (the instance does).
 * @param {TemplateSchema} template
 * @param {string} name
 */
function isIconRelated(template, name) {
    const def = template.props[name];
    if (def.source !== 'literal') return false;
    if (def.type === 'iconComponent' || def.visibleIf) return true;
    return Object.values(template.props).some(p => p.visibleIf?.prop === name);
}

/**
 * What the master's Behavior tab shows: the template to bind, the collection for each variable prop (prefilled by auto-match),
 * and the contract of the template, read-only.
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 */
export function masterPanel(master, collections) {
    const templates = [...TEMPLATES.values()].map(t => ({ id: t.id, name: t.name }));
    const bound = boundTemplate(master);
    if (!bound) return { templateId: null, templates, rows: [], contract: null };
    const { binding, template } = bound;
    const rows = variableProps(template).map(([prop, def]) => {
        const collectionId = binding.variables[prop] ?? null;
        return {
            prop,
            collection: def.collection,
            collectionId,
            matched: collectionId !== null && collectionId === autoMatchCollection(def.collection, collections),
            options: options(collections),
        };
    });
    const contractProps = [];
    for (const [name, def] of Object.entries(template.props)) {
        if (def.source === 'literal' && !isIconRelated(template, name)) contractProps.push({ name, type: def.type, default: def.default });
    }
    const contract = {
        props: contractProps,
        states: template.states,
        events: template.events.map(e => ({ name: e.name, exposeAsTrigger: e.exposeAsTrigger })),
    };
    return { templateId: template.id, templates, rows, contract };
}

/**
 * What an instance's Behavior tab shows: variable props with the modes of their bound collection, literal props with their
 * current value (the schema default when unset). Props hidden by visibleIf are not listed. Icon props are listed as deferred.
 * @param {{ behavior?: any }} instance
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 */
export function instancePanel(instance, master, collections) {
    const bound = boundTemplate(master);
    if (!bound) return { templateId: null, rows: [], deferred: [] };
    const { binding, template } = bound;
    const values = resolveProps(template, instance?.behavior?.props ?? {});
    const rows = [], deferred = [];
    for (const [name, def] of Object.entries(template.props)) {
        if (def.source === 'variable') {
            const collection = collections.find(c => c.id === binding.variables[name]);
            rows.push({
                prop: name,
                kind: 'variable',
                label: def.collection,
                value: values[name] ?? null,
                options: collection ? options(collection.modes ?? []) : [],
                disabled: !collection,
                hint: collection ? '' : `Bind a "${def.collection}" collection to the component to pick a mode.`,
            });
            continue;
        }
        if (def.type === 'iconComponent') {
            deferred.push(name);
            continue;
        }
        if (!isPropVisible(template, name, values)) continue;
        rows.push({
            prop: name,
            kind: 'literal',
            type: def.type,
            value: values[name],
            options: def.type === 'enum' ? def.options.map(o => ({ id: o, name: o })) : [],
        });
    }
    return { templateId: template.id, rows, deferred };
}

/**
 * The master's binding after choosing a template (auto-matched collections). Choosing none removes the binding.
 * @param {string | null} templateId
 * @param {import('./binding.js').Collection[]} collections
 */
function setMasterTemplate(templateId, collections) {
    if (templateId === null) return undefined;
    const template = TEMPLATES.get(templateId);
    if (!template) throw new Error(`No template "${templateId}"`);
    return createBinding(template, collections);
}

/**
 * The master's binding after choosing (or clearing, with null) the collection of one variable prop.
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 * @param {string} prop
 * @param {string | null} collectionId
 */
function setMasterCollection(master, collections, prop, collectionId) {
    const bound = boundTemplate(master);
    if (!bound) throw new Error('The component is not bound to a template');
    return setVariableBinding(bound.binding, bound.template, prop, collectionId, collections);
}

/**
 * The instance's behavior data after one edit. A variable prop takes a mode of the collection the master binds to it;
 * a literal prop takes its value (undefined unsets it). Refused when the prop is hidden or the value does not fit.
 * @param {{ behavior?: any }} instance
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 * @param {string} prop
 * @param {string | boolean | null | undefined} value
 */
export function setInstanceValue(instance, master, collections, prop, value) {
    const bound = boundTemplate(master);
    if (!bound) throw new Error('The component is not bound to a template');
    const { binding, template } = bound;
    const def = template.props[prop];
    if (!def) throw new Error(`Unknown prop "${prop}" on ${template.id}`);
    if (def.source === 'variable' && value !== null && value !== undefined) {
        const collection = collections.find(c => c.id === binding.variables[prop]);
        if (!collection) throw new Error(`"${prop}" has no bound collection`);
        if (!collection.modes?.some(m => m.id === value)) throw new Error(`"${value}" is not a mode of the bound collection`);
    }
    return { version: BEHAVIOR_DATA_VERSION, props: setInstanceProp(template, instance?.behavior?.props ?? {}, prop, value) };
}

/**
 * The instance value data after clearing some props through the store: undefined when nothing is left.
 * @param {import('../templates/schema.js').TemplateSchema | null} template
 * @param {Record<string, any>} props
 * @param {string[]} names
 */
function afterClearing(template, props, names) {
    // Without a template the props cannot be checked against one: only a file the load check already rejects gets here, so they go.
    let next = props;
    for (const name of names) next = template ? setInstanceProp(template, next, name, undefined) : {};
    return Object.keys(next).length ? { version: BEHAVIOR_DATA_VERSION, props: next } : undefined;
}

/**
 * Plans a master changing its template. The instances clear their values through the store, using the old template. Choosing
 * the template the master already has plans nothing. `binding` is undefined when the master becomes unbound.
 * @param {{ behavior?: any }} master
 * @param {{ behavior?: any }[]} instances every instance of the master, on every page
 * @param {string | null} templateId
 * @param {import('./binding.js').Collection[]} collections
 */
export function planTemplateChange(master, instances, templateId, collections) {
    const current = boundTemplate(master);
    if ((current?.template.id ?? null) === templateId) return { changed: false, binding: undefined, updates: [] };
    const binding = setMasterTemplate(templateId, collections);
    const updates = [];
    for (const inst of instances) {
        if (!inst.behavior?.props) continue;
        updates.push({ node: inst, behavior: afterClearing(current?.template ?? null, inst.behavior.props, Object.keys(inst.behavior.props)) });
    }
    return { changed: true, binding, updates };
}

/**
 * Plans one variable prop of a master getting another collection (or none). An instance keeps its mode only when the new
 * collection still has it; otherwise that value is cleared through the store.
 * @param {{ behavior?: any }} master
 * @param {{ behavior?: any }[]} instances every instance of the master, on every page
 * @param {string} prop
 * @param {string | null} collectionId
 * @param {import('./binding.js').Collection[]} collections
 */
export function planCollectionChange(master, instances, prop, collectionId, collections) {
    const bound = boundTemplate(master);
    if (!bound) throw new Error('The component is not bound to a template');
    const binding = setMasterCollection(master, collections, prop, collectionId);
    const coll = collections.find(c => c.id === collectionId);
    const updates = [];
    for (const inst of instances) {
        const props = inst.behavior?.props;
        if (!props || !(prop in props)) continue;
        const mode = props[prop];
        if (mode === null || coll?.modes?.some(m => m.id === mode)) continue;
        updates.push({ node: inst, behavior: afterClearing(bound.template, props, [prop]) });
    }
    return { changed: true, binding, updates };
}

/**
 * Writes a plan onto the master and the instances it names. The only place a plan is written, so the editor and tests share it.
 * @param {{ behavior?: any }} master
 * @param {{ changed: boolean, binding: any, updates: { node: any, behavior: any }[] }} plan
 */
export function applyPlan(master, plan) {
    if (!plan.changed) return;
    if (plan.binding === undefined) delete master.behavior;
    else master.behavior = plan.binding;
    for (const u of plan.updates) {
        if (u.behavior === undefined) delete u.node.behavior;
        else u.node.behavior = u.behavior;
    }
}

/**
 * Forgets a deleted collection (or one deleted mode of it) in the behavior data of the given nodes: instance values that used
 * it are cleared through the store, and a deleted collection is unbound from the masters that used it. Instances are read
 * before the bindings change. Mutates the nodes given (they are the document's nodes).
 * @param {any[]} nodes
 * @param {string} collectionId
 * @param {string | null} [modeId] set when one mode of the collection goes; null when the whole collection goes
 */
export function forgetCollection(nodes, collectionId, modeId = null) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const n of nodes) {
        if (!n.isInstance || !n.behavior?.props) continue;
        const bound = boundTemplate(byId.get(n.sourceId));
        if (!bound) continue;
        const props = n.behavior.props;
        const names = Object.keys(props).filter(prop => bound.binding.variables[prop] === collectionId && (modeId === null || props[prop] === modeId));
        setInstanceBehavior(n, afterClearing(bound.template, props, names));
    }
    if (modeId !== null) return;
    for (const n of nodes) {
        const b = n.behavior;
        if (!b || !('templateId' in b)) continue;
        for (const prop of Object.keys(b.variables)) if (b.variables[prop] === collectionId) b.variables[prop] = null;
    }
}

/**
 * Puts a computed instance behavior onto a node: undefined removes it.
 * @param {any} node
 * @param {{ version: number, props: Record<string, any> } | undefined} behavior
 */
function setInstanceBehavior(node, behavior) {
    if (behavior === undefined) delete node.behavior;
    else node.behavior = behavior;
}

/**
 * After the collections of the file changed (a library update removed or replaced some): every binding to a collection that
 * is gone is unbound, and every instance value naming a mode its collection no longer has is cleared through the store.
 * Mutates the nodes given (they are the document's nodes, on every page).
 * @param {any[]} nodes
 * @param {import('./binding.js').Collection[]} collections
 */
export function pruneBehaviorData(nodes, collections) {
    const known = new Map(collections.map(c => [c.id, c]));
    const gone = new Set();
    for (const n of nodes) {
        const b = n.behavior;
        if (b && 'templateId' in b) for (const id of Object.values(b.variables)) if (id !== null && !known.has(id)) gone.add(id);
    }
    for (const id of gone) forgetCollection(nodes, id);
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const n of nodes) {
        if (!n.isInstance || !n.behavior?.props) continue;
        const bound = boundTemplate(byId.get(n.sourceId));
        if (!bound) continue;
        const props = n.behavior.props;
        const names = Object.keys(props).filter(prop => {
            const id = bound.binding.variables[prop];
            return props[prop] !== null && id != null && !known.get(id)?.modes?.some((/** @type {{ id: string }} */ m) => m.id === props[prop]);
        });
        if (names.length) setInstanceBehavior(n, afterClearing(bound.template, props, names));
    }
}
