with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Atlas ring buffer: do NOT throw ATLAS_FULL and permanently crash WebGPU
old_atlas = """        if (shelf.y + h + 2 > this.size) {
            if (this.shelves.length === this.layers)
                throw new Error('ATLAS_FULL');
            page++;
            shelf = { x: 1, y: 1, h: 0 };
            this.shelves.push(shelf);
        }"""

new_atlas = """        if (shelf.y + h + 2 > this.size) {
            if (this.shelves.length >= this.layers) {
                // Ring buffer: recycle atlas pages when full rather than crashing WebGPU
                this.entries.clear();
                this.shelves = [{ x: 1, y: 1, h: 0 }];
                page = 0;
                shelf = this.shelves[0];
            } else {
                page++;
                shelf = { x: 1, y: 1, h: 0 };
                this.shelves.push(shelf);
            }
        }"""

assert old_atlas in content, "old_atlas not found"
content = content.replace(old_atlas, new_atlas)

# 2. In Renderer.render: limit fxRoute to reasonable scene sizes (< 250) so huge scenes stay on GPU
old_fx_route = """        // The GPU clip buffer only knows rounded rectangles, so masked layers go through the 2D painter.
        const fxRoute = this.backend === 'WebGPU' && scene.some(s => hasComplexFx(s.node) || s.clips.some(c => c.mask));"""

new_fx_route = """        // The GPU clip buffer only knows rounded rectangles, so masked layers go through the 2D painter.
        // For large scenes (>250 visible layers), stay on WebGPU to keep UI at 60 FPS without main thread freeze.
        const fxRoute = this.backend === 'WebGPU' && scene.length <= 250 && scene.some(s => hasComplexFx(s.node) || s.clips.some(c => c.mask));"""

assert old_fx_route in content, "old_fx_route not found"
content = content.replace(old_fx_route, new_fx_route)

# 3. In fallback(): ensure canvas is visible and not hidden
old_fallback = """        this.ctx = this.canvas.getContext('2d');
        this.backend = 'Canvas 2D';
        this.onStatus(this.backend);
        this.resize(this.width, this.height, this.dpr);
    }"""

new_fallback = """        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.visibility = 'visible';
        this.canvas.style.display = 'block';
        if (this.fxCanvas)
            this.fxCanvas.style.display = 'none';
        this.backend = 'Canvas 2D';
        this.onStatus(this.backend);
        this.resize(this.width, this.height, this.dpr);
    }"""

assert old_fallback in content, "old_fallback not found"
content = content.replace(old_fallback, new_fallback)

# 4. In paintScene: sub-pixel culling for large scenes and safe clipping
old_paint_clips = """            ctx.save();
            for (const c of s.clips) {
                ctx.save();
                ctx.transform(...c.matrix);
                let path = new Path2D();
                if (c.mask)
                    path = pathFor(c.mask);
                else
                    path.roundRect(0, 0, c.w, c.h, c.radii || Math.min(c.radius || 0, c.w / 2, c.h / 2)); // Transform the clip path rather than discarding its clip state.
                ctx.restore();
                const transformed = new Path2D();
                transformed.addPath(path, new DOMMatrix(c.matrix));
                ctx.clip(transformed);
            }"""

new_paint_clips = """            // Sub-pixel culling for massive scenes
            if (scene.length > 500 && s.node.parentId && Math.max(s.box.w, s.box.h) * (this.dpr || 1) < 0.75)
                continue;
            ctx.save();
            for (const c of s.clips) {
                try {
                    let path = new Path2D();
                    const cw = Math.max(0.1, c.w || 0), ch = Math.max(0.1, c.h || 0);
                    if (c.mask)
                        path = pathFor(c.mask);
                    else {
                        const cr = c.radii || [Math.min(c.radius || 0, cw / 2, ch / 2)];
                        path.roundRect(0, 0, cw, ch, cr);
                    }
                    const transformed = new Path2D();
                    transformed.addPath(path, new DOMMatrix(c.matrix));
                    ctx.clip(transformed);
                } catch {}
            }"""

assert old_paint_clips in content, "old_paint_clips not found"
content = content.replace(old_paint_clips, new_paint_clips)

# 5. Global fast indexes for componentById, instancesOf, pageOfNode
old_lookups = """function componentById(id) {
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

new_lookups = """let _compMap = null, _instMap = null, _pageMap = null, _globalRev = -1;
function ensureGlobalIndexes() {
    if (_compMap && _globalRev === doc.revision)
        return;
    _compMap = new Map();
    _instMap = new Map();
    _pageMap = new Map();
    for (const p of doc.data.pages) {
        for (const n of p.nodes) {
            _pageMap.set(n.id, p);
            if (n.component)
                _compMap.set(n.id, n);
            if (n.isInstance && n.sourceId) {
                let arr = _instMap.get(n.sourceId);
                if (!arr) { arr = []; _instMap.set(n.sourceId, arr); }
                arr.push(n);
            }
        }
    }
    _globalRev = doc.revision;
}

function componentById(id) {
    if (!id) return null;
    const direct = doc.get(id);
    if (direct && direct.component) return direct;
    ensureGlobalIndexes();
    return _compMap.get(id) || null;
}
function instancesOf(id) {
    if (!id) return [];
    ensureGlobalIndexes();
    return _instMap.get(id) || [];
}
function pageOfNode(id) {
    if (!id) return null;
    if (doc.get(id)) return doc.page;
    ensureGlobalIndexes();
    return _pageMap.get(id) || null;
}"""

assert old_lookups in content, "old_lookups not found"
content = content.replace(old_lookups, new_lookups)

# 6. Cycle protection in holderLayers
old_holder_layers = """function holderLayers(holder) {
    const page = holder && pageOfNode(holder.id);
    if (!page)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [];
    const walk = pid => { for (const c of kids.get(pid) || []) {
        if (!(holder.componentSet && pid === holder.id))
            out.push(c);
        if (!c.isInstance)
            walk(c.id);
    } };
    walk(holder.id);
    return out;
}"""

new_holder_layers = """function holderLayers(holder) {
    const page = holder && pageOfNode(holder.id);
    if (!page)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], seen = new Set([holder.id]);
    const walk = pid => {
        for (const c of kids.get(pid) || []) {
            if (seen.has(c.id))
                continue;
            seen.add(c.id);
            if (!(holder.componentSet && pid === holder.id))
                out.push(c);
            if (!c.isInstance)
                walk(c.id);
        }
    };
    walk(holder.id);
    return out;
}"""

assert old_holder_layers in content, "old_holder_layers not found"
content = content.replace(old_holder_layers, new_holder_layers)

# 7. Do not trigger full snapshot on click in pointerDown, only when moving
old_pdown_hist = """        else if (!state.selection.has(hit.id))
            select([hit.id]);
        history.begin(e.altKey ? 'Duplicate and move' : 'Move layers');
        if (e.altKey) {
            const clones = cloneNodes(selectedRoots(), 0);
            select(clones.map(n => n.id));
        }"""

new_pdown_hist = """        else if (!state.selection.has(hit.id))
            select([hit.id]);
        if (e.altKey) {
            history.begin('Duplicate and move');
            const clones = cloneNodes(selectedRoots(), 0);
            select(clones.map(n => n.id));
        }"""

assert old_pdown_hist in content, "old_pdown_hist not found"
content = content.replace(old_pdown_hist, new_pdown_hist)

# In pointerMove, begin move history when g.moved becomes true
old_pmove_moved = """        g.moved ||= Math.hypot(dx, dy) * state.camera.zoom > 2;"""
new_pmove_moved = """        if (!g.moved && Math.hypot(dx, dy) * state.camera.zoom > 2) {
            g.moved = true;
            if (!history.pending)
                history.begin('Move layers');
        }"""

assert old_pmove_moved in content, "old_pmove_moved not found"
content = content.replace(old_pmove_moved, new_pmove_moved)

# In pointerUp, cancel any pending move history if not moved
old_pup_clean = """        if (g.moved)
            changed({ commit: true });
        else
            refreshUI();"""

new_pup_clean = """        if (g.moved)
            changed({ commit: true });
        else {
            if (history.pending && history.pending.label === 'Move layers')
                history.cancel();
            refreshUI();
        }"""

assert old_pup_clean in content, "old_pup_clean not found"
content = content.replace(old_pup_clean, new_pup_clean)

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Deep fix applied successfully!")
