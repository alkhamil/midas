// The part generator (pure). A template master is built from its schema: the root frame, one layer per anatomy slot (a text or
// control slot is a text layer, a managed icon slot is an empty frame), and one layer per canvas part (a text part, or the arc of a
// frame part). Applying a template to a frame that already has children matches them to the slots and parts they stand for, and
// creates only what is missing; user layers are never deleted or restyled. Bindings go through the existing planner (planBindTokens),
// so a generated master is bound the same way a hand-bound one is. An instance is a copy of its master's subtree with the part
// visibility and text its props say (partWrites, literalFields), which is what the canvas and Play draw.
import { glyphFields } from './glyphs.js';
import { canvasPartsOf, conditionHolds, literalFields, nodeFieldPatch, partWrites } from './display.js';
import { planBindTokens, applyBindTokens } from './bind-tokens.js';
import { resolveProps } from './instance-props.js';
import { controlOf, holderAllows, iconDefOn, indexAmongLaterSlots, managedBehavior, placementsOfDef, primarySlotOf, replacedSlotsOf, slotDefsOf } from './anatomy.js';
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { newSlotProp } from './slot-property.js';

/** Whether a managed icon slot is shown: one of its definitions is switched on, and its placement (if any) is the one picked. */
export function slotWanted(template, slotId, resolved) {
    // A managed text or control slot is wanted while its own condition holds; only an icon slot is shown by icon defs.
    const anatomy = template.anatomy.find(s => s.id === slotId);
    if (anatomy?.managed && anatomy.kind !== 'icon') return conditionHolds(anatomy.shownWhen, resolved) && holderAllows(template, anatomy, resolved);
    if (replacedSlotsOf(template, resolved).includes(slotId)) return false;
    return slotDefsOf(template, slotId).some(def => iconDefOn(def, resolved) && (!def.placement || placementsOfDef(template, def, slotId).includes(String(resolved[def.placement]))));
}

/** Whether a managed slot is drawn: wanted, and for a slot that hides while its value is empty, the value is not empty. */
export function slotShown(template, slotId, resolved) {
    const anatomy = template.anatomy.find(s => s.id === slotId);
    if (anatomy?.managed && anatomy.kind !== 'icon') return slotWanted(template, slotId, resolved);
    return slotWanted(template, slotId, resolved) && slotDefsOf(template, slotId).some(def => iconDefOn(def, resolved) && (def.hideWhenEmpty === undefined || String(resolved[def.hideWhenEmpty] ?? '') !== ''));
}

/** The vertical sizing of a root that binds a height token: fixed, so the Size height is the box; any other root hugs its content. */
const rootSizingV = template => (template.display.root && 'height' in template.display.root ? 'fixed' : 'hug');

/** A solid paint, as the document stores it. */
const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];

/** The fields every layer has, as the editor stores them. */
const LAYER = { x: 0, y: 0, rotation: 0, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0 };

/**
 * The layers a template is made of, in schema order: the root, then each anatomy slot, each canvas part, then each content slot (`slots`). Each spec says what the
 * layer is (`role`), its node type, and the marker it carries (`behavior`). The display key names what the token mapping calls it.
 * @param {any} template
 */
export function layerSpecsOf(template) {
    const specs = [{ key: 'root', role: 'root', type: 'frame' }];
    const control = controlOf(template);
    // Frame parts (the spinner) sit before the text layers, as the renderer draws them: the first text layer comes after them.
    const partSpec = part => ({ key: part.id, role: 'part', type: part.arc ? 'ellipse' : part.kind === 'text' ? 'text' : 'frame', part, behavior: { part: part.id }, ...(part.parent ? { parentKey: part.parent } : {}) });
    const framed = canvasPartsOf(template).filter(part => part.kind !== 'text' && !part.parent).map(partSpec);
    // A part with a parent lives inside its container: it is placed after the anatomy, once its holder is registered.
    const parented = canvasPartsOf(template).filter(part => part.kind !== 'text' && part.parent).map(partSpec);
    const texted = canvasPartsOf(template).filter(part => part.kind === 'text').map(partSpec);
    // The text parts follow the control (its value, placeholder, clear and count sit together), so the text after it (an affix) comes after them.
    let placed = false, textedPlaced = false;
    for (const slot of template.anatomy) {
        // A container is a frame of the master that holds the slots naming it as their parent; each of those carries its parent's key.
        if (slot.kind === 'frame') {
            specs.push({ key: slot.id, role: 'group', type: 'frame', behavior: { group: slot.id }, slot });
            continue;
        }
        if (!placed && slot.kind === 'text' || slot.kind === 'control') { specs.push(...framed); placed = true; }
        // A managed slot (an icon frame, or a text layer) is a layer of the instance only, made while its props ask for it (instanceOf); a master holds none.
        if (slot.kind === 'icon' || slot.managed) specs.push({ key: slot.id, role: 'slot', type: slot.kind === 'icon' ? 'frame' : slot.kind === 'glyph' ? 'path' : 'text', behavior: { slot: slot.id }, optional: true, ...(slot.parent ? { parentKey: slot.parent } : {}) });
        // An optional text slot (an affix) is marked, so it is not the label and does not claim an existing text layer when a master is built.
        else specs.push({ key: slot.id, role: control?.slot === slot.id ? 'control' : 'text', type: 'text', optional: !!slot.optional, ...(slot.parent ? { parentKey: slot.parent } : {}), ...(slot.optional ? { behavior: { text: slot.id } } : {}) });
        if (slot.kind === 'control' && !textedPlaced) { specs.push(...texted); textedPlaced = true; }
    }
    if (!placed) specs.push(...framed);
    if (!textedPlaced) specs.push(...texted);
    specs.push(...parented);
    // A content slot is a frame of the master that instances fill; it is the slot property's layer (propBind.slot), not a managed icon slot.
    for (const slot of template.slots ?? []) specs.push({ key: slot.id, role: 'content', type: 'frame', content: slot });
    return specs;
}

/** The node a spec makes, with its default sizing: text and frames hug, the arc of a frame part is fixed at its size. */
function nodeOf(spec, template, binding, idOf, parentId) {
    const id = idOf(spec.key);
    if (spec.role === 'group') {
        return { ...LAYER, id, name: spec.key, type: 'frame', parentId, w: 0, h: 0, layout: spec.slot.layout, gap: 0, padding: 0, fills: [], layoutSizingH: spec.slot.fill === true ? 'fill' : 'hug', layoutSizingV: spec.slot.fillV === true ? 'fill' : 'hug', ...(spec.slot.primaryAlign ? { primaryAlign: spec.slot.primaryAlign } : {}), ...(spec.slot.counterAlign ? { counterAlign: spec.slot.counterAlign } : {}), behavior: { version: BEHAVIOR_DATA_VERSION, group: spec.key } };
    }
    if (spec.role === 'content') {
        return { ...LAYER, id, name: spec.content.name, type: 'frame', parentId, w: 0, h: 0, layout: spec.content.layout, gap: 0, padding: 0, fills: [], layoutSizingH: spec.content.fill === true ? 'fill' : 'hug', layoutSizingV: 'hug', propBind: { slot: spec.key } };
    }
    if (spec.role === 'root') {
        return { ...LAYER, id, name: template.name, type: 'frame', parentId: null, component: true, x: 0, y: 0, w: 0, h: 0, layout: template.rootLayout ?? 'horizontal', gap: 0, padding: 0,
            layoutSizingH: 'hug', layoutSizingV: rootSizingV(template), counterAlign: template.rootAlign ?? 'start', fills: solid('#ffffff'), clip: false,
            behavior: { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables: { ...binding.variables } } };
    }
    if (spec.type === 'text') {
        // A text layer starts with the default of the prop it shows (a control shows the value prop); a text part starts with its text.
        const prop = spec.role === 'control' || controlOf(template)?.slot === spec.key ? controlOf(template).value : spec.key;
        const fallback = spec.role === 'part' ? (typeof spec.part?.text === 'string' ? spec.part.text : '') : String(template.props[prop]?.default ?? '');
        // A layer that fills (the Input's value and placeholder) takes the width the row leaves; the rest hug their text.
        const fills = (template.anatomy.find(slot => slot.id === spec.key) ?? spec.part ?? {}).fill === true;
        return { ...LAYER, id, name: spec.key, type: 'text', parentId, text: fallback,
            fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: (template.anatomy.find(slot => slot.id === spec.key) ?? {}).align ?? 'left', textDecoration: 'none',
            textCase: 'none', direction: 'auto', w: 0, h: 0, autoW: true, layoutSizingH: fills ? 'fill' : 'hug', layoutSizingV: 'hug', fills: solid('#18181b'),
            ...(spec.behavior ? { behavior: { version: BEHAVIOR_DATA_VERSION, ...spec.behavior } } : {}) };
    }
    if (spec.type === 'ellipse') {
        const arc = spec.part.arc;
        return { ...LAYER, id, name: spec.key, type: 'ellipse', parentId, w: arc.size, h: arc.size, arcStart: arc.start, arcSweep: arc.sweep, arcRatio: arc.ratio, fills: [],
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
    if (spec.role === 'content') return children.find(c => !claimed.has(c.id) && c.propBind?.slot === spec.key);
    if (spec.role === 'group') return children.find(c => !claimed.has(c.id) && c.behavior?.group === spec.key);
    const marked = children.find(c => !claimed.has(c.id) && (spec.behavior?.slot !== undefined ? c.behavior?.slot === spec.behavior.slot : c.behavior?.part !== undefined ? c.behavior.part === spec.key : false));
    if (marked) return marked;
    if (spec.role === 'text' || spec.role === 'control') return children.find(c => !claimed.has(c.id) && c.type === 'text' && !c.behavior?.part && !c.behavior?.slot);
    return undefined;
}

/**
 * The fixed width a template bind writes (`rootWidth`, set once: null when the frame is already bound to the template or the
 * template names no width, so a rebind, Auto Fix or a sync never resets the designer's own width).
 */
export function bindSizePatch(template, alreadyBound) {
    if (template.rootWidth === undefined || alreadyBound === template.id) return null;
    return { w: template.rootWidth, layoutSizingH: 'fixed' };
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
    const alreadyBound = frame.behavior?.templateId;
    frame.component = true;
    // A master lays its parts out as an auto layout frame, the way the canvas lays out a component; a frame that is already auto layout keeps its own.
    // The alignment is a default, written once with the layout: after that the node owns it, so a second run, Auto Fix or a sync leaves it be.
    if (!frame.layout || frame.layout === 'none') {
        Object.assign(frame, { layout: template.rootLayout ?? 'horizontal', gap: 0, padding: 0, counterAlign: template.rootAlign ?? 'start', layoutSizingH: 'hug' });
        if (template.rootPrimaryAlign !== undefined) frame.primaryAlign = template.rootPrimaryAlign;
    }
    // The fixed width is a bind-time default, not a layout one: binding a frame takes it even when the frame already lays out,
    // but a rebind, Auto Fix or a sync never resets the designer's own width (see bindSizePatch).
    Object.assign(frame, bindSizePatch(template, alreadyBound) ?? {});
    // A template root that binds a height is fixed vertically, whatever the frame was (the Size height is its box).
    frame.layoutSizingV = rootSizingV(template);
    frame.behavior = { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables: { ...binding.variables } };
    // The master is built as an instance of the sample props would be: a part's visibility and text follow them (see sampleProps).
    const defaults = resolveProps(template, template.sampleProps ?? {});
    const layer = new Map([['root', frame]]);
    // The node each key stands for, the root and each container: the parent of the slots that name a container, and where to look for them.
    const holders = new Map([['root', frame]]);
    for (const spec of specs.slice(1)) {
        const holder = holders.get(spec.parentKey ?? 'root');
        // A slot parented under a container the master does not hold (a conditional one, off at the sample) has nothing to match: it is an instance layer.
        if (holder === undefined) continue;
        // The layers to match are the holder's children (the frame's own, for a layer with no container).
        const pool = children.filter(c => (c.parentId ?? frame.id) === holder.id);
        const hit = spec.optional && spec.role === 'text' ? pool.find(c => !claimed.has(c.id) && c.behavior?.text === spec.key) : matchOf(spec, pool, claimed);
        if (hit) {
            claimed.add(hit.id);
            matched.push({ key: spec.key, nodeId: hit.id });
            if (spec.role === 'group') holders.set(spec.key, hit);
            else if (spec.role !== 'content') layer.set(spec.key, hit);
            continue;
        }
        // A managed icon slot is an instance layer only; an optional text slot is a master layer, shown by its condition (see instanceOf).
        if (spec.role === 'slot') continue;
        // A conditional container is an instance layer while its condition is off at the sample props: the master holds none.
        if (spec.role === 'group' && spec.slot?.shownWhen !== undefined && !conditionHolds(spec.slot.shownWhen, defaults)) continue;
        const node = nodeOf(spec, template, binding, idOf, holder.id);
        // A conditional part (the spinner, a shown placeholder, a required mark) is an instance layer while its condition is off
        // at the sample props: the master holds none, and an instance makes one while the condition holds. Anything else is built as before.
        if ((spec.role === 'part' || spec.role === 'text') && spec.part?.shownWhen !== undefined) {
            const wanted = partWrites(template, defaults).find(w => w.key === spec.key && w.field === 'visible');
            if (!wanted || wanted.value !== true) continue;
        }
        // An affix text a condition shows only for a prop that is off at its default starts hidden, as an instance of the master draws it (partWrites).
        if (spec.role === 'part' || spec.role === 'text') {
            const written = partWrites(template, defaults).find(w => w.key === spec.key && w.field === 'visible');
            if (written) node.visible = written.value === true;
            const text = literalFields(template, defaults).find(w => w.key === spec.key && w.field === 'text' && w.value !== '');
            if (text && 'text' in node) node.text = text.value;
        }
        if (spec.role === 'content') { created.push(node); claimed.add(node.id); continue; }
        if (spec.role === 'group') { created.push(node); claimed.add(node.id); holders.set(spec.key, node); layer.set(spec.key, node); continue; }
        created.push(node);
        claimed.add(node.id);
        layer.set(spec.key, node);
    }
    // The slot property of each content slot is written once, as Convert to slot writes it; one a designer has is left as it is.
    for (const slot of template.slots ?? []) {
        if (frame.cprops?.some(p => p.id === slot.id)) continue;
        const { id, name, layout, ...options } = slot;
        frame.cprops = [...(frame.cprops ?? []), { ...newSlotProp(id, name), ...(options.description === undefined ? {} : { desc: options.description }), ...Object.fromEntries(Object.entries(options).filter(([k]) => k !== 'description')) }];
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
    const out = [{ key: 'root', node: frame }];
    const holders = new Map([['root', frame]]);
    for (const spec of layerSpecsOf(template).slice(1)) {
        const holder = holders.get(spec.parentKey ?? 'root');
        if (!holder) continue;
        const children = nodes.filter(n => n.parentId === holder.id);
        // An affix text is found by its marker; the label and the control are the text layers that carry none (see labelEntryOf).
        const hit = spec.role === 'group' ? children.find(c => c.behavior?.group === spec.key)
            : spec.role === 'part' ? children.find(c => c.behavior?.part === spec.key)
            : spec.role === 'slot' ? children.find(c => c.behavior?.slot === spec.key)
            : spec.role === 'content' ? children.find(c => c.propBind?.slot === spec.key)
            : spec.optional ? children.find(c => c.behavior?.text === spec.key)
            : children.find(c => c.type === 'text' && !c.behavior?.part && !c.behavior?.slot && !c.behavior?.text);
        if (hit) {
            out.push({ key: spec.key, node: hit });
            if (spec.role === 'group') holders.set(spec.key, hit);
        }
    }
    return out;
}

/**
 * The layer an instance holds for a managed text or control slot: a text layer of the instance, not a copy of a master layer, carrying the
 * text its prop writes. The prop is the memory, so a layer made again shows what the designer typed.
 * @param {any} template
 * @param {string} slotId
 * @param {Record<string, unknown>} resolved the instance's resolved props
 * @param {{ id: string, parentId: string }} at
 */
export function managedTextLayer(template, slotId, resolved, { id, parentId }) {
    const spec = layerSpecsOf(template).find(sp => sp.key === slotId);
    const text = [...literalFields(template, resolved), ...partWrites(template, resolved)].find(w => w.key === slotId && w.field === 'text');
    // The node fields the props write to this layer (a text area's value fills the box in height) are its own from the start, as an instance's copy of a master layer gets them.
    const fields = literalFields(template, resolved).filter(w => w.key === slotId && !['visible', 'text'].includes(w.field)).reduce((patch, w) => Object.assign(patch, nodeFieldPatch(w.field, w.value, 'text')), {});
    return { ...nodeOf(spec, template, null, () => id, parentId), ...fields, ...(text ? { text: text.value } : {}), visible: slotShown(template, slotId, resolved), sourceId: undefined, isInstance: false, component: false, overrides: {} };
}

/**
 * The layer an instance holds for a managed glyph slot: a vector layer with the glyph's outline (not an instance of anything), bound afterwards to its colour and
 * size tokens. It exists while the slot's state holds; Play and the export draw the same outline from the definition.
 * @param {any} template
 * @param {string} slotId
 * @param {Record<string, unknown>} resolved the instance's resolved props
 * @param {{ id: string, parentId: string }} at
 */
export function managedGlyphLayer(template, slotId, resolved, { id, parentId }) {
    const slot = template.anatomy.find(s => s.id === slotId);
    return { ...LAYER, id, name: slotId, parentId, w: 16, h: 16, ...glyphFields(slot.glyph), fills: solid('#20202a'), layoutSizingH: 'fixed', layoutSizingV: 'fixed', visible: slotShown(template, slotId, resolved), sourceId: undefined, isInstance: false, component: false, overrides: {}, behavior: { version: BEHAVIOR_DATA_VERSION, slot: slotId } };
}

/**
 * The layer an instance holds for a conditional canvas part (the spinner while loading): a copy of the part spec's
 * node, not of a master layer (a master holds none while the condition is off). Existence is visibility.
 */
export function managedPartLayer(template, partId, resolved, { id, parentId }) {
    const spec = layerSpecsOf(template).find(sp => sp.key === partId && sp.part);
    const node = { ...nodeOf(spec, template, null, () => id, parentId), visible: true, sourceId: undefined, isInstance: false, component: false, overrides: {} };
    const text = partWrites(template, resolved).find(w => w.key === partId && w.field === 'text');
    if (text && 'text' in node) node.text = text.value;
    return node;
}

/** The layer an instance holds for a managed frame container: the group's frame, marked as the slot (a master holds none while the condition is off). */
export function managedContainerLayer(template, slotId, resolved, { id, parentId }) {
    const spec = layerSpecsOf(template).find(sp => sp.key === slotId);
    const node = nodeOf(spec, template, null, () => id, parentId);
    node.behavior = { version: BEHAVIOR_DATA_VERSION, slot: slotId };
    node.visible = slotShown(template, slotId, resolved);
    return { ...node, sourceId: undefined, isInstance: false, component: false, overrides: {} };
}

/** The layer an instance holds for a managed text, control, glyph or frame slot (see managedTextLayer, managedGlyphLayer and managedContainerLayer). */
export function managedSlotLayer(template, slotId, resolved, at) {
    const kind = template.anatomy.find(s => s.id === slotId)?.kind;
    if (kind === 'glyph') return managedGlyphLayer(template, slotId, resolved, at);
    if (kind === 'frame') return managedContainerLayer(template, slotId, resolved, at);
    return managedTextLayer(template, slotId, resolved, at);
}

/**
 * An instance of a master: a copy of its master's subtree with the instance\'s own props. Each part copy takes its visibility and text from the
 * template\'s writes for the props (partWrites) and each literal prop writes its node field (literalFields), so the copy draws what the
 * props say on the canvas and in Play. Returns the copied nodes, the instance root first.
 * @param {any} template
 * @param {any} master the master frame
 * @param {any[]} subtree the master\'s descendants
 * @param {Record<string, unknown>} props the instance\'s stored props
 * @param {{ id: (src: string) => string, varModes?: Record<string, string> }} opts
 */
export function instanceOf(template, master, subtree, props, { id, varModes = {}, variables } = {}) {
    const resolved = resolveProps(template, props);
    const writes = [...literalFields(template, resolved), ...partWrites(template, resolved)];
    const ids = new Map([[master.id, id(master.id)], ...subtree.map(n => [n.id, id(n.id)])]);
    const copy = (n, parentId) => ({ ...structuredClone(n), id: ids.get(n.id), parentId, sourceId: n.id, component: false, isInstance: n.id === master.id, overrides: {}, version: 0 });
    const root = { ...copy(master, null), behavior: { version: BEHAVIOR_DATA_VERSION, props: { ...props } }, varModes: { ...varModes } };
    // The fields a prop writes beyond visible and text (a layout, a gap, a width) are the instance's own from the start.
    const fieldWrites = writes.filter(w => !['visible', 'text'].includes(w.field));
    for (const w of fieldWrites.filter(w => w.key === 'root')) Object.assign(root, nodeFieldPatch(w.field, w.value, root.type));
    const out = [root];
    // A conditional container the props hide leaves no master copy on the instance (what it holds goes with it, so nothing dangles).
    const shownWhenOf = id => template.anatomy.find(s => s.id === id)?.shownWhen;
    const hiddenGroups = new Set(subtree.filter(n => n.behavior?.group !== undefined && shownWhenOf(n.behavior.group) !== undefined && !conditionHolds(shownWhenOf(n.behavior.group), resolved)).map(n => n.id));
    for (const n of subtree) {
        if (hiddenGroups.has(n.id) || hiddenGroups.has(n.parentId)) continue;
        // A part copy takes its visibility and text from the writes for its key; a text layer takes the text its prop writes.
        // A conditional part the props hide is not copied (parts are leaves): the instance makes it while they show it (see below).
        const skipped = n.behavior?.part !== undefined && (template.parts ?? []).some(p => p.id === n.behavior.part && p.shownWhen !== undefined) && !subtree.some(c => c.parentId === n.id) && writes.find(w => w.key === n.behavior.part && w.field === 'visible')?.value !== true;
        if (skipped) continue;
        const next = copy(n, ids.get(n.parentId ?? master.id));
        // A managed container the master holds (its condition holds at the sample props) is the instance's slot-marked frame, as one made on the instance is.
        if (n.behavior?.group !== undefined && template.anatomy.some(s => s.id === n.behavior.group && s.managed)) next.behavior = managedBehavior(n.behavior.group);
        const key = n.behavior?.part ?? n.name;
        const visible = writes.find(w => w.key === key && w.field === 'visible');
        if (visible) next.visible = visible.value;
        if (n.behavior?.slot !== undefined) next.visible = slotShown(template, n.behavior.slot, resolved);
        for (const w of fieldWrites.filter(w => w.key === key)) Object.assign(next, nodeFieldPatch(w.field, w.value, next.type));
        const text = writes.find(w => w.key === key && w.field === 'text');
        if (text && 'text' in next) next.text = text.value;
        out.push(next);
    }
    // A part on a side sits before the label on the start side and after it on the end side (the spinner, by iconPlacement).
    // A conditional part the props show (the spinner while loading) that no master layer copies is made on the instance;
    // a container part hangs under the instance's copy of its container. It is placed with the sided parts below.
    for (const part of canvasPartsOf(template)) {
        if (part.shownWhen === undefined || out.some(n => n.behavior?.part === part.id)) continue;
        if (partWrites(template, resolved).find(w => w.key === part.id && w.field === 'visible')?.value !== true) continue;
        const holder = part.parent === undefined ? root : out.find(n => n.behavior?.group === part.parent) ?? root;
        const node = managedPartLayer(template, part.id, resolved, { id: id(`part-${part.id}`), parentId: holder.id });
        out.push(node);
        if (variables !== undefined) {
            const plan = planBindTokens({ template, binding: { variables: master.behavior?.variables ?? {} }, layers: [{ key: part.id, node }], variables });
            applyBindTokens([{ key: part.id, node }], plan.ops);
        }
    }
    // A part on a side sits before the label on the start side and after it on the end side (the spinner, by iconPlacement).
    out.splice(1, out.length - 1, ...placeSidedParts(template, out.slice(1), resolved));
    // A managed slot the props show, that the subtree does not hold, is created on the instance (its frame is empty; the icon is content).
    const stubs = [];
    const stubBySlot = new Map();
    for (const slot of template.anatomy.filter(s => s.kind === 'icon' || s.managed)) {
        if (!slotWanted(template, slot.id, resolved) || subtree.some(n => n.behavior?.slot === slot.id || (slot.kind === 'frame' && n.behavior?.group === slot.id)))
            continue;
        const stub = { id: `slot-${slot.id}`, name: slot.id };
        // A slot inside a container of the anatomy hangs under the instance's copy of that container: the master's copy, or the stub made earlier in this loop.
        const holder = slot.parent === undefined ? root : out.find(n => n.behavior?.group === slot.parent || n.behavior?.slot === slot.parent) ?? stubBySlot.get(slot.parent) ?? root;
        if (slot.kind !== 'icon') {
            stubs.push({ anatomy: template.anatomy.indexOf(slot), node: managedSlotLayer(template, slot.id, resolved, { id: id(stub), parentId: holder.id }) });
            stubBySlot.set(slot.id, stubs[stubs.length - 1].node);
            continue;
        }
        stubs.push({ anatomy: template.anatomy.indexOf(slot), node: { ...LAYER, id: id(stub), name: slot.id, type: 'frame', parentId: holder.id, sourceId: undefined, isInstance: false, component: false, overrides: {}, visible: slotShown(template, slot.id, resolved), w: 16, h: 16, layout: 'none', fills: [], layoutSizingH: sizedSlot(template, slot.id), layoutSizingV: sizedSlot(template, slot.id), behavior: { version: BEHAVIOR_DATA_VERSION, slot: slot.id } } });
        stubBySlot.set(slot.id, stubs[stubs.length - 1].node);
    }
    // Each slot goes where the anatomy puts it: before the label (and so before the spinner) when it precedes the label; after it, before
    // the first layer the anatomy puts later (the clear icon before the suffix text), else last. Slots are placed in anatomy order.
    const labelIndex = template.anatomy.findIndex(s => s.id === primarySlotOf(template));
    // A slot in a container has no place among the root's layers: it follows them, under its container.
    const inContainer = stubs.filter(s => template.anatomy[s.anatomy].parent !== undefined);
    const rooted = stubs.filter(s => !inContainer.includes(s));
    const before = rooted.filter(s => s.anatomy < labelIndex).sort((a, b) => a.anatomy - b.anatomy).map(s => s.node);
    const layers = [...before, ...out.slice(1)];
    for (const stub of rooted.filter(s => s.anatomy >= labelIndex).sort((a, b) => a.anatomy - b.anatomy)) {
        layers.splice(indexAmongLaterSlots(template, stub.node.behavior.slot, layers), 0, stub.node);
    }
    return [root, ...layers, ...inContainer.map(s => s.node)];
}

/**
 * The children of a frame in the order the template puts them after a bind: each created layer goes before the layer the anatomy
 * puts next after it (the label, for the spinner), and every other layer keeps its place. Returns the child ids in that order.
 * @param {any} template
 * @param {any[]} children the frame's children now, in order
 * @param {any[]} created the layers the bind made
 * @returns {string[]}
 */
export function childOrderAfterBind(template, children, created) {
    const specs = layerSpecsOf(template).filter(spec => spec.role !== 'root' && !spec.parentKey);
    const claimed = new Set();
    const idOfSpec = new Map();
    for (const spec of specs) {
        const hit = matchOf(spec, children, claimed);
        if (hit) {
            claimed.add(hit.id);
            idOfSpec.set(spec.key, hit.id);
        }
    }
    for (const node of created) idOfSpec.set(node.propBind?.slot ?? node.name, node.id);
    let order = children.map(child => child.id);
    for (const node of created) {
        const at = specs.findIndex(spec => spec.key === (node.propBind?.slot ?? node.name));
        if (at < 0) continue;
        const next = specs.slice(at + 1).map(spec => idOfSpec.get(spec.key)).find(id => id !== undefined && order.includes(id));
        order = order.filter(id => id !== node.id);
        if (next !== undefined) order.splice(order.indexOf(next), 0, node.id);
        else order.push(node.id);
    }
    return order;
}

/** The sizing of a managed slot layer: fixed when a size token drives it (the slot is the variable's width and height), else it hugs its content. */
function sizedSlot(template, slotId) {
    return template.display?.[slotId]?.size !== undefined ? 'fixed' : 'hug';
}

/**
 * The order of an instance's layers once the parts that sit on a side are placed: such a part (the spinner, by iconPlacement) goes before the label for
 * `start` and after it for `end`; every other layer keeps its place. An instance made from a master is ordered this way (instanceOf), and the canvas reorders
 * an existing instance with it when its placement changes, so the three surfaces agree.
 * @param {any} template
 * @param {{ id: string, type?: string, behavior?: any }[]} children the instance's layers, in order
 * @param {Record<string, unknown>} resolved the instance's resolved props
 * @returns {string[]} the layer ids in the order they belong
 */
export function sidedPartOrder(template, children, resolved) {
    return placeSidedParts(template, children, resolved).map(c => c.id);
}

/**
 * The layers with every part that sits on a side placed: against the label when the template has one (before it for `start`, after it for
 * `end`), else against the root (a `start` part first, in part order; an `end` part last). Every other layer keeps its place. A template
 * with no sided part returns the layers as they are.
 * @param {any} template
 * @param {{ id: string, type?: string, behavior?: any }[]} layers the instance's layers, in order, without the root
 * @param {Record<string, unknown>} resolved the instance's resolved props
 */
function placeSidedParts(template, layers, resolved) {
    const out = [...layers];
    const label = out.find(c => c.type === 'text' && !c.behavior?.part && !c.behavior?.slot && !c.behavior?.text);
    let front = 0;
    for (const part of canvasPartsOf(template).filter(p => p.side)) {
        const copy = out.find(c => c.behavior?.part === part.id);
        if (!copy) continue;
        out.splice(out.indexOf(copy), 1);
        const end = resolved[part.side] === 'end';
        out.splice(label ? out.indexOf(label) + (end ? 1 : 0) : end ? out.length : front++, 0, copy);
    }
    return out;
}
