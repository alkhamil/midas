with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. DocumentModel ancestors guard
old_ancestors = """    ancestors(n) {
        const a = [], seen = new Set([n.id]);
        let p = this.get(n.parentId);
        while (p && !seen.has(p.id)) {
            seen.add(p.id);
            a.push(p);
            p = this.get(p.parentId);
        }
        return a;
    }"""

new_ancestors = """    ancestors(n) {
        if (!n)
            return [];
        const a = [], seen = new Set([n.id]);
        let p = this.get(n.parentId);
        while (p && !seen.has(p.id)) {
            seen.add(p.id);
            a.push(p);
            p = this.get(p.parentId);
        }
        return a;
    }"""

assert old_ancestors in content, "old_ancestors not found"
content = content.replace(old_ancestors, new_ancestors)

# 2. DocumentModel.scene and world fallback for unparented/cyclic nodes
old_scene_world = """        walk(null, identity(), 1, [], false, false, 0);
        this._world = world;
        this._scene = out;
        this._sceneRevision = this.revision;
        return out;
    }
    world(id) { this.scene(); return this._world.get(id); }"""

new_scene_world = """        walk(null, identity(), 1, [], false, false, 0);
        if (world.size < this.nodes.length) {
            for (const n of this.nodes) {
                if (!world.has(n.id)) {
                    const mat = localMatrix(n), box = boxOf(mat, n.w, n.h);
                    const item = { node: n, matrix: mat, inverse: inverse(mat), box, opacity: n.opacity ?? 1, clips: [], hidden: !n.visible, locked: !!n.locked, boolChild: false };
                    world.set(n.id, item);
                    if (n.visible)
                        out.push(item);
                }
            }
        }
        this._world = world;
        this._scene = out;
        this._sceneRevision = this.revision;
        return out;
    }
    world(id) {
        this.scene();
        let w = this._world.get(id);
        if (!w) {
            const n = this.get(id);
            const mat = n ? localMatrix(n) : identity();
            const box = n ? boxOf(mat, n.w, n.h) : { x: 0, y: 0, w: 0, h: 0 };
            w = { node: n || null, matrix: mat, inverse: inverse(mat), box, opacity: n?.opacity ?? 1, clips: [], hidden: !n?.visible, locked: !!n?.locked, boolChild: false };
            this._world.set(id, w);
        }
        return w;
    }"""

assert old_scene_world in content, "old_scene_world not found"
content = content.replace(old_scene_world, new_scene_world)

# 3. selectionGeometry guard
old_sel_geo = """function selectionGeometry() {
    const roots = selectedRoots();
    if (!roots.length)
        return null;
    if (roots.length === 1) {
        const n = roots[0], s = doc.world(n.id);
        return { matrix: s.matrix, w: n.w, h: n.h, node: n };
    }
    const b = getSelectionBounds();
    return { matrix: [1, 0, 0, 1, b.x, b.y], w: b.w, h: b.h, node: null };
}"""

new_sel_geo = """function selectionGeometry() {
    const roots = selectedRoots();
    if (!roots.length)
        return null;
    if (roots.length === 1) {
        const n = roots[0], s = doc.world(n.id);
        if (!s || !s.matrix)
            return null;
        return { matrix: s.matrix, w: n.w, h: n.h, node: n };
    }
    const b = getSelectionBounds();
    if (!b)
        return null;
    return { matrix: [1, 0, 0, 1, b.x, b.y], w: b.w, h: b.h, node: null };
}"""

assert old_sel_geo in content, "old_sel_geo not found"
content = content.replace(old_sel_geo, new_sel_geo)

# 4. saveOriginals lightweight (no recursive structuredClone on whole frame tree)
old_save_orig = """function saveOriginals(roots) {
    const all = new Map();
    for (const n of roots) {
        all.set(n.id, structuredClone(n));
        for (const c of doc.descendants(n.id))
            all.set(c.id, structuredClone(c));
    }
    return all;
}"""

new_save_orig = """function saveOriginals(roots) {
    const all = new Map();
    for (const n of roots) {
        if (!n)
            continue;
        all.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h, rotation: n.rotation, fontSize: n.fontSize });
    }
    return all;
}"""

assert old_save_orig in content, "old_save_orig not found"
content = content.replace(old_save_orig, new_save_orig)

# 5. pointerDown roots filter and parentMatrices
old_pdown_roots = """        const roots = selectedRoots().filter(n => !doc.world(n.id).locked);
        state.gesture = { kind: 'move', start: w, originals: saveOriginals(roots), roots: roots.map(n => n.id), bounds: doc.bounds(roots.map(n => n.id)), parentMatrices: new Map(roots.map(n => [n.id, n.parentId ? doc.world(n.parentId).inverse : identity()])), moved: false };"""

new_pdown_roots = """        const roots = selectedRoots().filter(n => !doc.world(n.id)?.locked);
        state.gesture = { kind: 'move', start: w, originals: saveOriginals(roots), roots: roots.map(n => n.id), bounds: doc.bounds(roots.map(n => n.id)), parentMatrices: new Map(roots.map(n => [n.id, n.parentId ? (doc.world(n.parentId)?.inverse || identity()) : identity()])), moved: false };"""

assert old_pdown_roots in content, "old_pdown_roots not found"
content = content.replace(old_pdown_roots, new_pdown_roots)

# 6. renderLayers row limit and cycle/depth protection to prevent DOM bloat crash
old_render_layers = """    let html = '';
    const walk = (parent, depth) => {
        for (const n of [...doc.children(parent)].reverse()) {
            const matches = !q || n.name.toLowerCase().includes(q) || n.text?.toLowerCase().includes(q);
            if (q && !matches && !doc.descendants(n.id).some(c => c.name.toLowerCase().includes(q) || c.text?.toLowerCase().includes(q)))
                continue;
            const children = doc.children(n.id), hasChildren = children.length > 0, open = state.expanded.has(n.id) || !!q;
            if (depth === 0)
                html += '<div class="layer-group">';
            html += `<div class="layer-row ${stickyRoots.has(n.id) ? 'sticky-root' : ''} ${state.selection.has(n.id) ? 'selected' : ''} ${!n.visible ? 'dim' : ''} ${n.component || n.isInstance || n.componentSet ? 'component' : ''} ${doc.data.thumbnailId === n.id ? 'is-thumb' : ''}" data-layer="${n.id}" style="--depth:${depth}" role="treeitem" aria-selected="${state.selection.has(n.id)}" ${hasChildren ? `aria-expanded="${open}"` : ''} draggable="true"><button class="expand" data-expand="${n.id}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(n.name)}">${hasChildren ? (open ? icon('chevronDown', 10) : icon('chevronRight', 10)) : ''}</button><span class="layer-icon">${n.booleanOp ? MENU_ICONS[n.booleanOp] : icon(n.isMask ? 'mask' : n.type === 'rect' && isImageLike(n) ? 'image' : n.component ? (doc.get(n.parentId)?.componentSet ? 'variant' : 'component') : n.componentSet ? 'component' : n.isInstance ? 'instance' : n.type, 13)}</span><span class="layer-name" title="${esc(n.name)}">${esc(n.name)}</span><button class="lock ${n.locked ? 'is-locked' : ''}" data-lock="${n.id}" title="${n.locked ? 'Unlock' : 'Lock'}">${icon(n.locked ? 'lock' : 'unlock', 12)}</button><button class="visibility ${!n.visible ? 'is-hidden' : ''}" data-visibility="${n.id}" title="${n.visible ? 'Hide' : 'Show'}">${icon(n.visible ? 'eye' : 'eyeOff', 12)}</button></div>`;
            if (hasChildren && open)
                walk(n.id, depth + 1);
            if (depth === 0)
                html += '</div>';
        }
    };
    walk(null, 0);"""

new_render_layers = """    let html = '', rowCount = 0;
    const MAX_ROWS = 250, visited = new Set();
    const walk = (parent, depth) => {
        if (depth > 50 || visited.has(parent) || rowCount >= MAX_ROWS)
            return;
        visited.add(parent);
        for (const n of [...doc.children(parent)].reverse()) {
            if (rowCount >= MAX_ROWS) {
                html += '<div class="layer-group"><div class="layer-row dim" style="padding:6px 14px;font-size:11px;opacity:0.65;font-style:italic">…remaining layers hidden (use search to filter)</div></div>';
                return;
            }
            const matches = !q || n.name.toLowerCase().includes(q) || n.text?.toLowerCase().includes(q);
            if (q && !matches && !doc.descendants(n.id).some(c => c.name.toLowerCase().includes(q) || c.text?.toLowerCase().includes(q)))
                continue;
            rowCount++;
            const children = doc.children(n.id), hasChildren = children.length > 0, open = state.expanded.has(n.id) || !!q;
            if (depth === 0)
                html += '<div class="layer-group">';
            html += `<div class="layer-row ${stickyRoots.has(n.id) ? 'sticky-root' : ''} ${state.selection.has(n.id) ? 'selected' : ''} ${!n.visible ? 'dim' : ''} ${n.component || n.isInstance || n.componentSet ? 'component' : ''} ${doc.data.thumbnailId === n.id ? 'is-thumb' : ''}" data-layer="${n.id}" style="--depth:${depth}" role="treeitem" aria-selected="${state.selection.has(n.id)}" ${hasChildren ? `aria-expanded="${open}"` : ''} draggable="true"><button class="expand" data-expand="${n.id}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(n.name)}">${hasChildren ? (open ? icon('chevronDown', 10) : icon('chevronRight', 10)) : ''}</button><span class="layer-icon">${n.booleanOp ? MENU_ICONS[n.booleanOp] : icon(n.isMask ? 'mask' : n.type === 'rect' && isImageLike(n) ? 'image' : n.component ? (doc.get(n.parentId)?.componentSet ? 'variant' : 'component') : n.componentSet ? 'component' : n.isInstance ? 'instance' : n.type, 13)}</span><span class="layer-name" title="${esc(n.name)}">${esc(n.name)}</span><button class="lock ${n.locked ? 'is-locked' : ''}" data-lock="${n.id}" title="${n.locked ? 'Unlock' : 'Lock'}">${icon(n.locked ? 'lock' : 'unlock', 12)}</button><button class="visibility ${!n.visible ? 'is-hidden' : ''}" data-visibility="${n.id}" title="${n.visible ? 'Hide' : 'Show'}">${icon(n.visible ? 'eye' : 'eyeOff', 12)}</button></div>`;
            if (hasChildren && open)
                walk(n.id, depth + 1);
            if (depth === 0)
                html += '</div>';
        }
    };
    walk(null, 0);"""

assert old_render_layers in content, "old_render_layers not found"
content = content.replace(old_render_layers, new_render_layers)

# 7. Helper functions: instancesOf, pageOfNode, componentById, chainComponent, swappableComponents
old_helpers = """function allNodes() { return doc.data.pages.flatMap(p => p.nodes); }
function componentById(id) { return allNodes().find(n => n.id === id && n.component) || null; }
function instancesOf(id) { return allNodes().filter(n => n.isInstance && n.sourceId === id); }
function pageOfNode(id) { return doc.data.pages.find(p => p.nodes.some(n => n.id === id)); }"""

new_helpers = """function allNodes() { return doc.data.pages.flatMap(p => p.nodes); }
function componentById(id) {
    if (!id) return null;
    const direct = doc.get(id);
    if (direct && direct.component) return direct;
    for (const p of doc.data.pages) {
        for (const n of p.nodes) {
            if (n.id === id && n.component) return n;
        }
    }
    return null;
}
function instancesOf(id) {
    if (!id) return [];
    const out = [];
    for (const p of doc.data.pages) {
        for (const n of p.nodes) {
            if (n.isInstance && n.sourceId === id)
                out.push(n);
        }
    }
    return out;
}
function pageOfNode(id) {
    if (!id) return null;
    if (doc.get(id)) return doc.page;
    for (const p of doc.data.pages) {
        for (const n of p.nodes) {
            if (n.id === id) return p;
        }
    }
    return null;
}"""

assert old_helpers in content, "old_helpers not found"
content = content.replace(old_helpers, new_helpers)

# 8. chainComponent default argument optimization
old_chain = """function chainComponent(x, idx = nodeIndex()) {
    const seen = new Set();
    let s = x;
    while (s && !s.component && !seen.has(s.id)) {
        seen.add(s.id);
        s = s.sourceId ? idx.get(s.sourceId) : null;
    }
    return s?.component ? s : null;
}"""

new_chain = """function chainComponent(x, idx = null) {
    const seen = new Set();
    let s = x;
    while (s && !s.component && !seen.has(s.id)) {
        seen.add(s.id);
        if (!s.sourceId)
            break;
        s = idx ? idx.get(s.sourceId) : (doc.get(s.sourceId) || componentById(s.sourceId));
    }
    return s?.component ? s : null;
}"""

assert old_chain in content, "old_chain not found"
content = content.replace(old_chain, new_chain)

# 9. swappableComponents optimization
old_swap_comp = """function swappableComponents() {
    return allNodes().filter(n => n.component).map(c => { const set = parentSetOf(c); return { id: c.id, label: set ? `${set.name} / ${c.name}` : c.name }; });
}"""

new_swap_comp = """function swappableComponents() {
    const out = [];
    for (const p of doc.data.pages) {
        for (const c of p.nodes) {
            if (c.component) {
                const set = parentSetOf(c);
                out.push({ id: c.id, label: set ? `${set.name} / ${c.name}` : c.name });
            }
        }
    }
    return out;
}"""

assert old_swap_comp in content, "old_swap_comp not found"
content = content.replace(old_swap_comp, new_swap_comp)

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Crash fix patch applied successfully!")
