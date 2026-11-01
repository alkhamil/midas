// The part generator (pure). A template master is built from its schema: the root frame, one layer per anatomy slot (a text or
// control slot is a text layer, a managed icon slot is an empty frame), and one layer per canvas part (a text part, or the arc of a
// frame part). Applying a template to a frame that already has children matches them to the slots and parts they stand for, and
// creates only what is missing; user layers are never deleted or restyled. Bindings go through the existing planner (planBindTokens),
// so a generated master is bound the same way a hand-bound one is. An instance is a copy of its master's subtree with the part
// visibility and text its props say (partWrites, literalFields), which is what the canvas and Play draw.
import { canvasPartsOf, literalFields, partWrites } from './display.js';
import { planBindTokens, applyBindTokens } from './bind-tokens.js';
import { resolveProps } from './instance-props.js';
import { controlOf, placementsOfDef, slotDefsOf } from './anatomy.js';
import { BEHAVIOR_DATA_VERSION } from './data.js';

/** Whether a managed icon slot is shown: one of its definitions is switched on, and its placement (if any) is the one picked. */
function slotShown(template, slotId, resolved) {
    return slotDefsOf(template, slotId).some(def => resolved[def.show] === true && (!def.placement || placementsOfDef(template, def, slotId).includes(String(resolved[def.placement]))));
}

/** A solid paint, as the document stores it. */
const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];

/** The fields every layer has, as the editor stores them. */
const LAYER = { rotation: 0, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0 };

/**
 * The layers a template is made of, in schema order: the root, then each anatomy slot, then each canvas part. Each spec says what the
 * layer is (`role`), its node type, and the marker it carries (`behavior`). The display key names what the token mapping calls it.
 * @param {any} template
 */
export function layerSpecsOf(template) {
    const specs = [{ key: 'root', role: 'root', type: 'frame' }];
    const control = controlOf(template);
    // Frame parts (the spinner) sit before the text layers, as the renderer draws them: the first text layer comes after them.
    const partSpec = part => ({ key: part.id, role: 'part', type: part.arc ? 'ellipse' : part.kind === 'text' ? 'text' : 'frame', part, behavior: { part: part.id } });
    const framed = canvasPartsOf(template).filter(part => part.kind !== 'text').map(partSpec);
    const texted = canvasPartsOf(template).filter(part => part.kind === 'text').map(partSpec);
    let placed = false;
    for (const slot of template.anatomy) {
        if (!placed && slot.kind === 'text' || slot.kind === 'control') { specs.push(...framed); placed = true; }
        // A managed icon slot is a layer of the instance only, shown while its props say so (instanceOf); a master holds none.
        if (slot.kind === 'icon' || slot.managed) specs.push({ key: slot.id, role: 'slot', type: 'frame', behavior: { slot: slot.id }, optional: true });
        else specs.push({ key: slot.id, role: control?.slot === slot.id ? 'control' : 'text', type: 'text', optional: !!slot.optional });
    }
    if (!placed) specs.push(...framed);
    specs.push(...texted);
    return specs;
}

/** The node a spec makes, with its default sizing: text and frames hug, the arc of a frame part is fixed at its size. */
function nodeOf(spec, template, binding, idOf, parentId) {
    const id = idOf(spec.key);
    if (spec.role === 'root') {
        return { ...LAYER, id, name: template.name, type: 'frame', parentId: null, component: true, x: 0, y: 0, w: 0, h: 0, layout: 'horizontal', gap: 0, padding: 0,
            layoutSizingH: 'hug', layoutSizingV: 'hug', counterAlign: template.rootAlign ?? 'start', fills: solid('#ffffff'), clip: false,
            behavior: { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables: { ...binding.variables } } };
    }
    if (spec.type === 'text') {
        // A text layer starts with the default of the prop it shows (a control shows the value prop); a text part starts with its text.
        const prop = spec.role === 'control' ? controlOf(template).value : spec.key;
        const fallback = spec.role === 'part' ? (typeof spec.part?.text === 'string' ? spec.part.text : '') : String(template.props[prop]?.default ?? '');
        return { ...LAYER, id, name: spec.key, type: 'text', parentId, text: fallback,
            fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none',
            textCase: 'none', direction: 'auto', w: 0, h: 0, autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#18181b'),
            ...(spec.behavior ? { behavior: { version: BEHAVIOR_DATA_VERSION, ...spec.behavior } } : {}) };
    }
    if (spec.type === 'ellipse') {
        const arc = spec.part.arc;
        return { ...LAYER, id, name: spec.key, type: 'ellipse', parentId, w: arc.size, h: arc.size, arcStart: arc.start, arcSweep: arc.sweep, fills: [],
            stroke: '#18181b', strokeWidth: arc.width, strokeAlign: 'inside', layoutSizingH: 'fixed', layoutSizingV: 'fixed',
            behavior: { version: BEHAVIOR_DATA_VERSION, part: spec.key } };
    }
    return { ...LAYER, id, name: spec.key, type: 'frame', parentId, w: 0, h: 0, layout: 'none', fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug',
        ...(spec.behavior ? { behavior: { version: BEHAVIOR_DATA_VERSION, ...spec.behavior } } : {}) };
}

/**
 * The children of a frame that stand for a spec: a layer already marked for it, else the first unmarked text layer for a text or
 * control slot. A managed icon slot matches only by its marker. Returns undefined when nothing matches.
 */
function matchOf(spec, children, claimed) {
    const marked = children.find(c => !claimed.has(c.id) && (spec.behavior?.slot !== undefined ? c.behavior?.slot === spec.behavior.slot : c.behavior?.part !== undefined ? c.behavior.part === spec.key : false));
    if (marked) return marked;
    if (spec.role === 'text' || spec.role === 'control') return children.find(c => !claimed.has(c.id) && c.type === 'text' && !c.behavior?.part && !c.behavior?.slot);
    return undefined;
}

/**
 * Builds or completes a template master on a frame. `frame` is the frame node (it becomes the root: its own fields are kept, its
 * template binding is set); `layers` the frame's children; `idOf(key)` gives a new id for a layer. Returns the created layers, the
 * matched ones, the bindings applied, and any problem the binder reports. Applying again creates nothing.
 * @param {any} template
 * @param {{ frame: any, children: any[], binding: { variables: Record<string, string | null> }, variables: { collections: any[], items: any[] }, idOf: (key: string) => string }} opts
 */
export function applyTemplateToFrame(template, { frame, children, binding, variables, idOf }) {
    const created = [], matched = [];
    const claimed = new Set();
    const specs = layerSpecsOf(template);
    frame.component = true;
    // A master lays its parts out as an auto layout frame, the way the canvas lays out a component; a frame that is already auto layout keeps its own.
    if (!frame.layout || frame.layout === 'none') Object.assign(frame, { layout: 'horizontal', gap: 0, padding: 0, counterAlign: template.rootAlign ?? 'start', layoutSizingH: 'hug', layoutSizingV: 'hug' });
    frame.behavior = { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables: { ...binding.variables } };
    const layer = new Map([['root', frame]]);
    for (const spec of specs.slice(1)) {
        const hit = matchOf(spec, children, claimed);
        if (hit) {
            claimed.add(hit.id);
            matched.push({ key: spec.key, nodeId: hit.id });
            layer.set(spec.key, hit);
            continue;
        }
        if (spec.optional) continue;
        const node = nodeOf(spec, template, binding, idOf, frame.id);
        created.push(node);
        claimed.add(node.id);
        layer.set(spec.key, node);
    }
    const layers = [...layer].map(([key, node]) => ({ key, node }));
    const { ops, problems } = planBindTokens({ template, binding: { variables: binding.variables }, layers, variables });
    applyBindTokens(layers, ops);
    return { created, matched, bound: ops.length, problems };
}

/**
 * The layers of a master as the binder sees them: the root and one layer per slot and part, by key (the display key the token
 * mapping names). Used when a master is already built.
 * @param {any} template
 * @param {any} frame
 * @param {any[]} nodes every node of the document
 */
export function masterLayersByKey(template, frame, nodes) {
    const children = nodes.filter(n => n.parentId === frame.id);
    const out = [{ key: 'root', node: frame }];
    for (const spec of layerSpecsOf(template).slice(1)) {
        const hit = spec.role === 'part' ? children.find(c => c.behavior?.part === spec.key) : spec.role === 'slot' ? children.find(c => c.behavior?.slot === spec.key) : children.find(c => c.type === 'text' && !c.behavior?.part && !c.behavior?.slot);
        if (hit) out.push({ key: spec.key, node: hit });
    }
    return out;
}

/**
 * An instance of a master: a copy of its subtree with the instance\'s own props. Each part copy takes its visibility and text from the
 * template\'s writes for the props (partWrites) and each literal prop writes its node field (literalFields), so the copy draws what the
 * props say on the canvas and in Play. Returns the copied nodes, the instance root first.
 * @param {any} template
 * @param {any} master the master frame
 * @param {any[]} subtree the master\'s descendants
 * @param {Record<string, unknown>} props the instance\'s stored props
 * @param {{ id: (src: string) => string, varModes?: Record<string, string> }} opts
 */
export function instanceOf(template, master, subtree, props, { id, varModes = {} }) {
    const resolved = resolveProps(template, props);
    const writes = [...literalFields(template, resolved), ...partWrites(template, resolved)];
    const ids = new Map([[master.id, id(master.id)], ...subtree.map(n => [n.id, id(n.id)])]);
    const copy = (n, parentId) => ({ ...structuredClone(n), id: ids.get(n.id), parentId, sourceId: n.id, component: false, isInstance: n.id === master.id, overrides: {}, version: 0 });
    const root = { ...copy(master, null), behavior: { version: BEHAVIOR_DATA_VERSION, props: { ...props } }, varModes: { ...varModes } };
    const out = [root];
    for (const n of subtree) {
        // A part copy takes its visibility and text from the writes for its key; a text layer takes the text its prop writes.
        const next = copy(n, ids.get(n.parentId ?? master.id));
        const key = n.behavior?.part ?? n.name;
        const visible = writes.find(w => w.key === key && w.field === 'visible');
        if (visible) next.visible = visible.value;
        if (n.behavior?.slot !== undefined) next.visible = slotShown(template, n.behavior.slot, resolved);
        const text = writes.find(w => w.key === key && w.field === 'text');
        if (text && 'text' in next) next.text = text.value;
        out.push(next);
    }
    // A managed slot the props show, that the subtree does not hold, is created on the instance (its frame is empty; the icon is content).
    for (const slot of template.anatomy.filter(s => s.kind === 'icon' || s.managed)) {
        if (!slotShown(template, slot.id, resolved) || subtree.some(n => n.behavior?.slot === slot.id))
            continue;
        const stub = { id: `slot-${slot.id}`, name: slot.id };
        out.push({ ...LAYER, id: id(stub), name: slot.id, type: 'frame', parentId: root.id, sourceId: undefined, isInstance: false, component: false, overrides: {}, w: 16, h: 16, layout: 'none', fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug', behavior: { version: BEHAVIOR_DATA_VERSION, slot: slot.id } });
    }
    return out;
}
