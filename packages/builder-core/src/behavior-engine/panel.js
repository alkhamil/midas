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
        persistentStates: Object.keys(template.persistentStates),
        previewStates: Object.keys(template.previewStates),
        events: template.events.map(e => ({ name: e.name, exposeAsTrigger: e.exposeAsTrigger })),
    };
    return { templateId: template.id, templates, rows, contract };
}

/**
 * What an instance's Behavior tab shows: variable props with the modes of their bound collection, literal props with their
 * current value (the schema default when unset). Props hidden by visibleIf are not listed. An icon prop is a swap row: its value is
 * the id of the icon component the slot shows (null for none).
 * @param {{ behavior?: any }} instance
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 * @param {Record<string, string | null>} modes the instance's Appearance mode per variable prop (see modes.js)
 */
export function instancePanel(instance, master, collections, modes) {
    const bound = boundTemplate(master);
    if (!bound) return { templateId: null, rows: [] };
    const { binding, template } = bound;
    const values = resolveProps(template, instance?.behavior?.props ?? {});
    // The props that drive the managed icon slots: they are listed under Slots.
    const slotProps = template.icons.flatMap(def => [def.show, def.placement, def.component].filter(Boolean));
    const rows = [];
    for (const [name, def] of Object.entries(template.props)) {
        if (def.source === 'variable') {
            const collection = collections.find(c => c.id === binding.variables[name]);
            rows.push({
                prop: name,
                kind: 'variable',
                label: def.collection,
                value: modes[name] ?? null,
                options: collection ? options(collection.modes ?? []) : [],
                disabled: !collection,
                hint: collection ? '' : `Bind a "${def.collection}" collection to the component to pick a mode.`,
            });
            continue;
        }
        if (!isPropVisible(template, name, values)) continue;
        if (def.type === 'iconComponent') {
            rows.push({ prop: name, kind: 'icon', slot: true, value: values[name] ?? null });
            continue;
        }
        rows.push({
            prop: name,
            kind: 'literal',
            slot: slotProps.includes(name),
            type: def.type,
            value: values[name],
            options: def.type === 'enum' ? def.options.map(o => ({ id: o, name: o })) : [],
        });
    }
    return { templateId: template.id, rows };
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
 * The instance's behavior data after one edit of a literal prop (undefined unsets it). Refused when the prop is a variable prop
 * (its mode is an Appearance mode, written through varModes), hidden, or the value does not fit.
 * @param {{ behavior?: any }} instance
 * @param {{ behavior?: any }} master
 * @param {import('./binding.js').Collection[]} collections
 * @param {string} prop
 * @param {string | boolean | null | undefined} value
 */
export function setInstanceValue(instance, master, prop, value) {
    const bound = boundTemplate(master);
    if (!bound) throw new Error('The component is not bound to a template');
    const { template } = bound;
    if (!template.props[prop]) throw new Error(`Unknown prop "${prop}" on ${template.id}`);
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
 * Plans one variable prop of a master getting another collection (or none). Instances hold no variable values (their modes are
 * Appearance modes), so only the binding changes.
 * @param {{ behavior?: any }} master
 * @param {string} prop
 * @param {string | null} collectionId
 * @param {import('./binding.js').Collection[]} collections
 */
export function planCollectionChange(master, prop, collectionId, collections) {
    const binding = setMasterCollection(master, collections, prop, collectionId);
    return { changed: true, binding, updates: [] };
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
 * Forgets a deleted collection in the behavior data of the given masters: each binding to it is unbound. Instance literal values
 * are not touched. Mutates the nodes given (they are the document's nodes).
 * @param {any[]} nodes
 * @param {string} collectionId
 */
export function forgetCollection(nodes, collectionId) {
    for (const n of nodes) {
        const b = n.behavior;
        if (!b || !('templateId' in b)) continue;
        for (const prop of Object.keys(b.variables)) if (b.variables[prop] === collectionId) b.variables[prop] = null;
    }
}

/**
 * After the collections of the file changed (a library update removed some): every binding to a collection that is gone is
 * unbound. Mutates the nodes given (they are the document's nodes, on every page).
 * @param {any[]} nodes
 * @param {import('./binding.js').Collection[]} collections
 */
export function pruneBehaviorData(nodes, collections) {
    const known = new Set(collections.map(c => c.id));
    const gone = new Set();
    for (const n of nodes) {
        const b = n.behavior;
        if (b && 'templateId' in b) for (const id of Object.values(b.variables)) if (id !== null && !known.has(id)) gone.add(id);
    }
    for (const id of gone) forgetCollection(nodes, id);
}
