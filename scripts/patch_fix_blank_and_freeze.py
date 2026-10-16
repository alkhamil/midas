with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Clean scene() - do NOT push unparented/unvisited nodes into `out`
old_scene = """        walk(null, identity(), 1, [], false, false, 0);
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
        return out;"""

new_scene = """        walk(null, identity(), 1, [], false, false, 0);
        this._world = world;
        this._scene = out;
        this._sceneRevision = this.revision;
        return out;"""

assert old_scene in content, "old_scene not found"
content = content.replace(old_scene, new_scene)

# 2. Clean world(id) - return safe fallback without touching _world or mutating scene
old_world = """    world(id) {
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

new_world = """    world(id) {
        this.scene();
        return this._world.get(id) || {
            node: this.get(id) || null,
            matrix: identity(),
            inverse: identity(),
            box: { x: 0, y: 0, w: 0, h: 0 },
            opacity: 1,
            clips: [],
            hidden: true,
            locked: false,
            boolChild: false
        };
    }"""

assert old_world in content, "old_world not found"
content = content.replace(old_world, new_world)

# 3. pageTree cycle protection
old_pagetree = """function pageTree(page, rootId) {
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId];
    while (queue.length) {
        const id = queue.shift();
        for (const c of kids.get(id) || []) {
            out.push(c);
            queue.push(c.id);
        }
    }
    return out;
}"""

new_pagetree = """function pageTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId], seen = new Set([rootId]);
    while (queue.length) {
        const id = queue.shift();
        for (const c of kids.get(id) || []) {
            if (!seen.has(c.id)) {
                seen.add(c.id);
                out.push(c);
                queue.push(c.id);
            }
        }
    }
    return out;
}"""

assert old_pagetree in content, "old_pagetree not found"
content = content.replace(old_pagetree, new_pagetree)

# 4. instanceTree cycle protection
old_insttree = """function instanceTree(page, rootId) {
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId];
    while (queue.length) {
        for (const c of kids.get(queue.shift()) || []) {
            out.push(c);
            if (!c.swapOf)
                queue.push(c.id);
        }
    }
    return out;
}"""

new_insttree = """function instanceTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId], seen = new Set([rootId]);
    while (queue.length) {
        const id = queue.shift();
        for (const c of kids.get(id) || []) {
            if (!seen.has(c.id)) {
                seen.add(c.id);
                out.push(c);
                if (!c.swapOf)
                    queue.push(c.id);
            }
        }
    }
    return out;
}"""

assert old_insttree in content, "old_insttree not found"
content = content.replace(old_insttree, new_insttree)

# 5. propValueFor cycle protection
old_propval = """function propValueFor(n, pid, pmap, idx) {
    for (let a = pmap.get(n.parentId); a; a = pmap.get(a.parentId))
        for (let s = a, i = 0; s && i < 64; s = s.sourceId ? idx.get(s.sourceId) : null, i++)
            if (s.propValues && Object.hasOwn(s.propValues, pid))
                return { found: true, value: s.propValues[pid] };
    return { found: false };
}"""

new_propval = """function propValueFor(n, pid, pmap, idx) {
    const seen = new Set();
    for (let a = pmap.get(n.parentId); a && !seen.has(a.id); a = pmap.get(a.parentId)) {
        seen.add(a.id);
        for (let s = a, i = 0; s && i < 64; s = s.sourceId ? idx.get(s.sourceId) : null, i++)
            if (s.propValues && Object.hasOwn(s.propValues, pid))
                return { found: true, value: s.propValues[pid] };
    }
    return { found: false };
}"""

assert old_propval in content, "old_propval not found"
content = content.replace(old_propval, new_propval)

# 6. pointerUp: only commit transaction if user actually moved something
old_pup_move = """        if (g.kind === 'move') {
            for (const id of g.roots) {
                const m = doc.get(id);
                if (m)
                    delete m._drag;
            }
            applyDrop(g);
            doc.touch();
            doc.scene();
        }
        changed({ commit: true });"""

new_pup_move = """        if (g.kind === 'move') {
            for (const id of g.roots) {
                const m = doc.get(id);
                if (m)
                    delete m._drag;
            }
            if (g.moved) {
                applyDrop(g);
                doc.touch();
                doc.scene();
            }
        }
        if (g.moved)
            changed({ commit: true });
        else
            refreshUI();"""

assert old_pup_move in content, "old_pup_move not found"
content = content.replace(old_pup_move, new_pup_move)

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Blank and freeze patch applied successfully!")
