// Overlay layers: the instances Midas puts on a page ("Place on canvas") for an Open dropdown / overlay / popover action.
// A placed overlay is a page-level instance with `isOverlay` and `overlayTrigger` (the layer whose interaction opens it). Midas
// marks the ones it creates with `autoCreated: true` and `ownerId` (the id of the interaction that asked for it). Layers the user
// drew or placed themselves never carry these marks and are never removed by anything here.
// Pure: it works on a flat list of nodes; how a trigger's actions are found (inherited ones included) is passed in.

export const OVERLAY_ACTION_TYPES = ['open-dropdown', 'open-overlay', 'open-popover', 'show-feedback'];

/** A page-level instance placed for an action (not a layer the user drew). */
export const isOverlayLayer = n => !!n && !n.parentId && !!n.isOverlay;
export const isAutoOverlay = n => isOverlayLayer(n) && !!n.autoCreated;

/** Every action an interaction can run: its own, those of its rules and "otherwise", and what a confirmation runs. */
export function allActions(interactions) {
    const out = [];
    const walk = list => {
        for (const a of Array.isArray(list) ? list : []) {
            if (!a || typeof a !== 'object') continue;
            out.push(a);
            walk(a.onConfirm);
        }
    };
    for (const it of Array.isArray(interactions) ? interactions : []) {
        if (!it) continue;
        walk(it.actions);
        for (const r of it.rules?.items || []) walk(r.actions);
        walk(it.rules?.otherwise?.actions);
    }
    return out;
}

/** [{ interactionId, action }] of the overlay-opening actions of a list of interactions. */
export function overlayActionsOf(interactions) {
    const out = [];
    for (const it of Array.isArray(interactions) ? interactions : []) {
        for (const a of allActions([it])) if (OVERLAY_ACTION_TYPES.includes(a.type)) out.push({ interactionId: it.id, action: a });
    }
    return out;
}

/**
 * Who still asks for each overlay. `helpers.interactionsOf(node)` = the interactions that apply to a trigger (its own, or the main
 * component's for an instance); `helpers.targetOf(action)` = the id of the component the action opens.
 * → Map overlay id → [{ triggerId, interactionId, action }]
 */
export function overlayRefs(nodes, helpers) {
    const refs = new Map();
    const byId = new Map(nodes.map(n => [n.id, n]));
    const overlays = nodes.filter(isOverlayLayer);
    for (const o of overlays) refs.set(o.id, []);
    for (const trig of nodes) {
        if (!trig.interactions?.length && !trig.isInstance) continue;
        for (const { interactionId, action } of overlayActionsOf(helpers.interactionsOf(trig))) {
            for (const o of overlays) {
                const mine = action.overlayInstanceId ? action.overlayInstanceId === o.id : (o.overlayTrigger === trig.id && helpers.targetOf(action) === o.sourceId);
                if (mine && byId.has(trig.id)) refs.get(o.id).push({ triggerId: trig.id, interactionId, action });
            }
        }
    }
    return refs;
}

/** The overlays nobody asks for any more. `auto` = only the ones Midas created (they are removed on their own); the rest is offered to the user. */
export function unusedOverlays(nodes, helpers) {
    const refs = overlayRefs(nodes, helpers), byId = new Map(nodes.map(n => [n.id, n]));
    const out = [];
    for (const o of nodes.filter(isOverlayLayer)) {
        if ((refs.get(o.id) || []).length) continue;
        out.push({ id: o.id, auto: !!o.autoCreated, name: o.name || 'Overlay', trigger: byId.get(o.overlayTrigger)?.name || '' });
    }
    return out;
}

/** The ids Midas removes by itself after an edit: auto-created overlays no interaction asks for. */
export const overlaysToPrune = (nodes, helpers) => unusedOverlays(nodes, helpers).filter(o => o.auto).map(o => o.id);

/** The overlays that were not removed but whose owner interaction is gone: a remaining one takes over. → [{ id, ownerId }] */
export function reowned(nodes, helpers) {
    const refs = overlayRefs(nodes, helpers), out = [];
    for (const o of nodes.filter(isAutoOverlay)) {
        const r = refs.get(o.id) || [];
        if (r.length && !r.some(x => x.interactionId === o.ownerId)) out.push({ id: o.id, ownerId: r[0].interactionId });
    }
    return out;
}

/** The auto-created overlays that go with the layers in `ids` (a trigger deleted, or the frame it is in). */
export function overlaysOfTriggers(nodes, ids) {
    const set = ids instanceof Set ? ids : new Set(ids);
    return nodes.filter(n => isAutoOverlay(n) && set.has(n.overlayTrigger)).map(n => n.id);
}

/** The interaction (of `interactions`) that asks for what `action` describes: the very action, or one opening the same component. */
export function ownerOfAction(interactions, action) {
    const list = Array.isArray(interactions) ? interactions : [];
    return list.find(it => allActions([it]).includes(action))?.id
        ?? overlayActionsOf(list).find(x => (!action.type || x.action.type === action.type) && x.action.targetComponentId === action.targetComponentId)?.interactionId ?? '';
}

/**
 * On load: an overlay Midas created whose trigger no longer exists can only be a leftover, so it goes (with what is inside it).
 * Overlays without the mark are never touched here. Changes `data` in place. → how many were removed
 */
export function dropDanglingOverlays(data) {
    let removed = 0;
    const pages = data?.pages || [];
    const ids = new Set(pages.flatMap(p => (p.nodes || []).map(n => n.id)));
    for (const p of pages) {
        const kill = new Set((p.nodes || []).filter(n => isAutoOverlay(n) && n.overlayTrigger && !ids.has(n.overlayTrigger)).map(n => n.id));
        if (!kill.size) continue;
        removed += kill.size;
        let grew = true;
        while (grew) { grew = false; for (const n of p.nodes) if (!kill.has(n.id) && kill.has(n.parentId)) { kill.add(n.id); grew = true; } }
        p.nodes = p.nodes.filter(n => !kill.has(n.id));
    }
    return removed;
}
