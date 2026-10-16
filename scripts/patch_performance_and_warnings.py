import re

with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. DocumentModel: _byParent, _pageSnapshots, children O(1), fast snapshot
old_doc_model = """class DocumentModel {
    constructor(data) { this.data = data || makeStarter(); this.data.variables = cleanVariables(this.data.variables); this.revision = 0; this._sceneRevision = -1; this._scene = []; this._map = new Map(); this._world = new Map(); this.refresh(); }
    get page() { return this.data.pages.find(p => p.id === this.data.pageId) || this.data.pages[0]; }
    get nodes() { return this.page.nodes; }
    get(id) { return this._map.get(id); }
    refresh() { this._map = new Map(this.nodes.map(n => [n.id, n])); this.revision++; this._sceneRevision = -1; }
    touch(n) {
        if (n)
            n.version = (n.version || 0) + 1;
        this.revision++;
        this._sceneRevision = -1;
    }
    add(n) { this.nodes.push(n); this._map.set(n.id, n); this.touch(n); return n; }
    children(id) { return this.nodes.filter(n => n.parentId === id); }
    descendants(id) {
        const out = [], seen = new Set([id]);
        const visit = p => {
            for (const n of this.children(p)) {
                if (!seen.has(n.id)) {
                    seen.add(n.id);
                    out.push(n);
                    visit(n.id);
                }
            }
        };
        visit(id);
        return out;
    }"""

new_doc_model = """class DocumentModel {
    constructor(data) { this.data = data || makeStarter(); this.data.variables = cleanVariables(this.data.variables); this.revision = 0; this._sceneRevision = -1; this._scene = []; this._map = new Map(); this._byParent = new Map(); this._pageSnapshots = new Map(); this._world = new Map(); this.refresh(); }
    get page() { return this.data.pages.find(p => p.id === this.data.pageId) || this.data.pages[0]; }
    get nodes() { return this.page.nodes; }
    get(id) { return this._map.get(id); }
    refresh() {
        this._map = new Map();
        this._byParent = new Map();
        for (const n of this.nodes) {
            this._map.set(n.id, n);
            const pid = n.parentId || null;
            let list = this._byParent.get(pid);
            if (!list) {
                list = [];
                this._byParent.set(pid, list);
            }
            list.push(n);
        }
        this.revision++;
        this._sceneRevision = -1;
        if (this.page) {
            this._pageSnapshots.delete(this.page.id);
        }
    }
    touch(n) {
        if (n)
            n.version = (n.version || 0) + 1;
        this.revision++;
        this._sceneRevision = -1;
        if (this.page) {
            this._pageSnapshots.delete(this.page.id);
        }
    }
    add(n) {
        this.nodes.push(n);
        this._map.set(n.id, n);
        const pid = n.parentId || null;
        let list = this._byParent.get(pid);
        if (!list) {
            list = [];
            this._byParent.set(pid, list);
        }
        list.push(n);
        this.touch(n);
        return n;
    }
    children(id) { return this._byParent.get(id || null) || []; }
    descendants(id) {
        const out = [], queue = [id], seen = new Set([id]);
        while (queue.length > 0) {
            const p = queue.shift();
            for (const n of this.children(p)) {
                if (!seen.has(n.id)) {
                    seen.add(n.id);
                    out.push(n);
                    queue.push(n.id);
                }
            }
        }
        return out;
    }"""

assert old_doc_model in content, "old_doc_model not found"
content = content.replace(old_doc_model, new_doc_model)

# 2. DocumentModel snapshot and restore
old_snapshot = """    snapshot() { return JSON.stringify({ name: this.data.name, pages: this.data.pages, pageId: this.data.pageId, tokens: this.data.tokens, variables: this.data.variables, thumbnailId: this.data.thumbnailId ?? null }); }
    restore(s) { Object.assign(this.data, JSON.parse(s)); this.refresh(); }"""

new_snapshot = """    snapshot() {
        const pageChunks = this.data.pages.map(p => {
            let s = this._pageSnapshots.get(p.id);
            if (!s) {
                s = JSON.stringify(p);
                this._pageSnapshots.set(p.id, s);
            }
            return s;
        });
        const meta = {
            name: this.data.name,
            pageId: this.data.pageId,
            tokens: this.data.tokens,
            variables: this.data.variables,
            thumbnailId: this.data.thumbnailId ?? null
        };
        const metaStr = JSON.stringify(meta);
        return metaStr.slice(0, -1) + ',"pages":[' + pageChunks.join(',') + ']}';
    }
    restore(s) {
        this._pageSnapshots.clear();
        Object.assign(this.data, JSON.parse(s));
        this.refresh();
    }"""

assert old_snapshot in content, "old_snapshot not found"
content = content.replace(old_snapshot, new_snapshot)

# 3. History undoStack limit
old_history_commit = """        this.undoStack.push(entry);
        if (this.undoStack.length > 80)
            this.undoStack.shift();"""

new_history_commit = """        this.undoStack.push(entry);
        if (this.undoStack.length > 40)
            this.undoStack.shift();"""

assert old_history_commit in content, "old_history_commit not found"
content = content.replace(old_history_commit, new_history_commit)

# 4. syncComponents
old_sync = """function syncComponents() {
    detachOrphans();
    syncInstanceStructure();
    const sources = new Map(doc.data.pages.flatMap(p => p.nodes).map(n => [n.id, n]));
    for (const page of doc.data.pages) {
        const pmap = new Map(page.nodes.map(n => [n.id, n]));
        for (const n of page.nodes) {
            if (!n.sourceId)
                continue;
            const src = sources.get(n.sourceId);
            if (!src)
                continue;
            // Same list as SYNC_OMIT (spelled out: this can run before that const is initialised).
            const omitted = new Set(['id', 'parentId', 'component', 'sourceId', 'isInstance', 'version', 'overrides', 'prototypeTarget', 'name', 'variant', 'componentSet', 'propValues', 'swapOf', 'cprops', 'exposedNested', ...(n.isInstance ? ['x', 'y', 'rotation'] : [])]);
            // Text / visibility driven by a component property value win over the main component.
            const controlled = propControlled(n, src, pmap, sources);
            for (const [k, v] of Object.entries(src)) {
                if (omitted.has(k) || Object.hasOwn(controlled, k) || Object.hasOwn(n.overrides || {}, k))
                    continue;
                if (JSON.stringify(n[k]) !== JSON.stringify(v)) {
                    n[k] = structuredClone(v);
                    n.version++;
                }
            }
            for (const [k, v] of Object.entries(controlled)) {
                if (n[k] === v)
                    continue;
                n[k] = v;
                if (k === 'text' && n.type === 'text') {
                    if (n.autoW)
                        hugText(n);
                    else
                        n.h = Math.ceil(Math.max(n.fontSize * n.lineHeight, layoutText(n).height));
                }
                n.version++;
            }
        }
    }
    doc.touch();
}"""

new_sync = """function syncComponents(activeOnly = true) {
    detachOrphans(activeOnly);
    syncInstanceStructure(activeOnly);
    const targetPages = activeOnly ? [doc.page] : doc.data.pages;
    const components = new Map();
    for (const page of doc.data.pages) {
        for (const n of page.nodes) {
            if (n.component)
                components.set(n.id, n);
        }
    }
    for (const page of targetPages) {
        const pmap = new Map(page.nodes.map(n => [n.id, n]));
        for (const n of page.nodes) {
            if (!n.sourceId)
                continue;
            const src = components.get(n.sourceId) || pmap.get(n.sourceId);
            if (!src)
                continue;
            // Same list as SYNC_OMIT (spelled out: this can run before that const is initialised).
            const omitted = new Set(['id', 'parentId', 'component', 'sourceId', 'isInstance', 'version', 'overrides', 'prototypeTarget', 'name', 'variant', 'componentSet', 'propValues', 'swapOf', 'cprops', 'exposedNested', ...(n.isInstance ? ['x', 'y', 'rotation'] : [])]);
            // Text / visibility driven by a component property value win over the main component.
            const controlled = propControlled(n, src, pmap, components);
            for (const [k, v] of Object.entries(src)) {
                if (omitted.has(k) || Object.hasOwn(controlled, k) || Object.hasOwn(n.overrides || {}, k))
                    continue;
                if (n[k] === v)
                    continue;
                if (typeof v !== 'object' || v === null) {
                    n[k] = v;
                    n.version = (n.version || 0) + 1;
                } else if (JSON.stringify(n[k]) !== JSON.stringify(v)) {
                    n[k] = structuredClone(v);
                    n.version = (n.version || 0) + 1;
                }
            }
            for (const [k, v] of Object.entries(controlled)) {
                if (n[k] === v)
                    continue;
                n[k] = v;
                if (k === 'text' && n.type === 'text') {
                    if (n.autoW)
                        hugText(n);
                    else
                        n.h = Math.ceil(Math.max(n.fontSize * n.lineHeight, layoutText(n).height));
                }
                n.version = (n.version || 0) + 1;
            }
        }
    }
    doc.touch();
}"""

assert old_sync in content, "old_sync not found"
content = content.replace(old_sync, new_sync)

# 5. markSelectedOverrides
old_mark = """    const sources = new Map(allNodes().map(n => [n.id, n]));
    for (const n of selected()) {
        if (!n.sourceId)
            continue;
        const src = sources.get(n.sourceId);
        if (!src)
            continue;
        const omit = new Set([...SYNC_OMIT, ...(n.isInstance ? ['x', 'y', 'rotation'] : [])]);
        const page = pageOfNode(n.id), controlled = page ? propControlled(n, src, new Map(page.nodes.map(x => [x.id, x])), sources) : {};
        for (const [k, v] of Object.entries(n)) {
            if (omit.has(k) || Object.hasOwn(n.overrides || {}, k) || Object.hasOwn(controlled, k) && controlled[k] === v)
                continue;
            if (JSON.stringify(v) !== JSON.stringify(src[k])) {
                n.overrides ||= {};
                n.overrides[k] = structuredClone(v);
            }
        }
    }"""

new_mark = """    const sel = selected();
    if (!sel.length)
        return;
    const sources = new Map();
    for (const p of doc.data.pages)
        for (const n of p.nodes)
            if (n.component)
                sources.set(n.id, n);
    for (const n of sel) {
        if (!n.sourceId)
            continue;
        const src = sources.get(n.sourceId) || doc.get(n.sourceId);
        if (!src)
            continue;
        const omit = new Set([...SYNC_OMIT, ...(n.isInstance ? ['x', 'y', 'rotation'] : [])]);
        const page = doc.page, controlled = propControlled(n, src, doc._map, sources);
        for (const [k, v] of Object.entries(n)) {
            if (omit.has(k) || Object.hasOwn(n.overrides || {}, k) || Object.hasOwn(controlled, k) && controlled[k] === v)
                continue;
            if (v === src[k])
                continue;
            if (typeof v !== 'object' || JSON.stringify(v) !== JSON.stringify(src[k])) {
                n.overrides ||= {};
                n.overrides[k] = structuredClone(v);
            }
        }
    }"""

assert old_mark in content, "old_mark not found"
content = content.replace(old_mark, new_mark)

# 6. syncInstanceStructure and detachOrphans
old_sync_inst = """function syncInstanceStructure() {
    let dirty = false;
    const sources = new Map(allNodes().map(n => [n.id, n]));
    for (const page of doc.data.pages) {
        for (const root of [...page.nodes]) {
            if (!root.isInstance || !root.sourceId)
                continue;
            const src = sources.get(root.sourceId);
            if (!src)
                continue;
            const srcPage = pageOfNode(src.id);
            if (!srcPage)
                continue;
            const srcDesc = pageTree(srcPage, src.id), srcIds = new Set(srcDesc.map(n => n.id));
            // A nested instance swapped through an instance-swap property keeps its slot via `swapOf`;
            // its own subtree is synced when it is visited as an instance root itself.
            const inst = instanceTree(page, root.id), bySource = new Map(), slotKey = n => n.swapOf || n.sourceId;
            for (const n of inst)
                if (slotKey(n))
                    bySource.set(slotKey(n), n);
            for (const n of inst)
                if (slotKey(n) && !srcIds.has(slotKey(n))) {
                    const gone = new Set([n.id, ...pageTree(page, n.id).map(x => x.id)]);
                    page.nodes = page.nodes.filter(x => !gone.has(x.id));
                    bySource.delete(slotKey(n));
                    dirty = true;
                }
            for (const s of srcDesc) {
                if (bySource.has(s.id))
                    continue;
                const parent = s.parentId === src.id ? root : bySource.get(s.parentId);
                if (!parent || parent.swapOf)
                    continue;
                const c = structuredClone(s);
                c.id = uid();
                c.parentId = parent.id;
                c.sourceId = s.id;
                c.component = false;
                c.isInstance = false;
                c.overrides = {};
                c.version = 0;
                page.nodes.push(c);
                bySource.set(s.id, c);
                dirty = true;
            }
            // keep the layer order of the main component
            const pairs = [[root.id, src.id]];
            for (const n of instanceTree(page, root.id))\n                if (!n.swapOf && n.sourceId && srcIds.has(n.sourceId))\n                    pairs.push([n.id, n.sourceId]);\n            for (const [ip, sp] of pairs) {\n                const srcOrder = srcPage.nodes.filter(x => x.parentId === sp).map(x => x.id), idxs = [], kids = [];\n                page.nodes.forEach((x, i) => { if (x.parentId === ip) {\n                    idxs.push(i);\n                    kids.push(x);\n                } });\n                if (kids.length < 2)\n                    continue;\n                const rank = x => slotKey(x) && srcOrder.includes(slotKey(x)) ? srcOrder.indexOf(slotKey(x)) : 1e9;\n                const sorted = [...kids].sort((a, b) => rank(a) - rank(b));\n                if (sorted.some((x, i) => x !== kids[i])) {\n                    idxs.forEach((idx, i) => { page.nodes[idx] = sorted[i]; });\n                    dirty = true;\n                }\n            }\n        }\n    }\n    if (dirty)\n        doc.refresh();\n}\nfunction detachOrphans() {\n    const sources = new Set(allNodes().map(n => n.id));\n    for (const page of doc.data.pages)\n        for (const n of page.nodes)\n            if (n.sourceId && !sources.has(n.sourceId)) {\n                delete n.sourceId;\n                delete n.isInstance;\n                delete n.overrides;\n                delete n.swapOf;\n            }\n}"""

new_sync_inst = """function syncInstanceStructure(activeOnly = true) {
    let dirty = false;
    const sources = new Map();
    for (const page of doc.data.pages)
        for (const n of page.nodes)
            if (n.component)
                sources.set(n.id, n);
    const targetPages = activeOnly ? [doc.page] : doc.data.pages;
    for (const page of targetPages) {
        for (const root of [...page.nodes]) {
            if (!root.isInstance || !root.sourceId)
                continue;
            const src = sources.get(root.sourceId);
            if (!src)
                continue;
            const srcPage = pageOfNode(src.id);
            if (!srcPage)
                continue;
            const srcDesc = pageTree(srcPage, src.id), srcIds = new Set(srcDesc.map(n => n.id));
            // A nested instance swapped through an instance-swap property keeps its slot via `swapOf`;
            // its own subtree is synced when it is visited as an instance root itself.
            const inst = instanceTree(page, root.id), bySource = new Map(), slotKey = n => n.swapOf || n.sourceId;
            for (const n of inst)
                if (slotKey(n))
                    bySource.set(slotKey(n), n);
            for (const n of inst)
                if (slotKey(n) && !srcIds.has(slotKey(n))) {
                    const gone = new Set([n.id, ...pageTree(page, n.id).map(x => x.id)]);
                    page.nodes = page.nodes.filter(x => !gone.has(x.id));
                    bySource.delete(slotKey(n));
                    dirty = true;
                }
            for (const s of srcDesc) {
                if (bySource.has(s.id))
                    continue;
                const parent = s.parentId === src.id ? root : bySource.get(s.parentId);
                if (!parent || parent.swapOf)
                    continue;
                const c = structuredClone(s);
                c.id = uid();
                c.parentId = parent.id;
                c.sourceId = s.id;
                c.component = false;
                c.isInstance = false;
                c.overrides = {};
                c.version = 0;
                page.nodes.push(c);
                bySource.set(s.id, c);
                dirty = true;
            }
            // keep the layer order of the main component
            const pairs = [[root.id, src.id]];
            for (const n of instanceTree(page, root.id))\n                if (!n.swapOf && n.sourceId && srcIds.has(n.sourceId))\n                    pairs.push([n.id, n.sourceId]);\n            for (const [ip, sp] of pairs) {\n                const srcOrder = srcPage.nodes.filter(x => x.parentId === sp).map(x => x.id), idxs = [], kids = [];\n                page.nodes.forEach((x, i) => { if (x.parentId === ip) {\n                    idxs.push(i);\n                    kids.push(x);\n                } });\n                if (kids.length < 2)\n                    continue;\n                const rank = x => slotKey(x) && srcOrder.includes(slotKey(x)) ? srcOrder.indexOf(slotKey(x)) : 1e9;\n                const sorted = [...kids].sort((a, b) => rank(a) - rank(b));\n                if (sorted.some((x, i) => x !== kids[i])) {\n                    idxs.forEach((idx, i) => { page.nodes[idx] = sorted[i]; });\n                    dirty = true;\n                }\n            }\n        }\n    }\n    if (dirty)\n        doc.refresh();\n}\nfunction detachOrphans(activeOnly = true) {\n    const targetPages = activeOnly ? [doc.page] : doc.data.pages;\n    const allIds = new Set();\n    for (const page of doc.data.pages)\n        for (const n of page.nodes)\n            allIds.add(n.id);\n    for (const page of targetPages)\n        for (const n of page.nodes)\n            if (n.sourceId && !allIds.has(n.sourceId)) {\n                delete n.sourceId;\n                delete n.isInstance;\n                delete n.overrides;\n                delete n.swapOf;\n            }\n}"""

assert old_sync_inst in content, "old_sync_inst not found"
content = content.replace(old_sync_inst, new_sync_inst)

# 7. hitTest bounding box optimization
old_hittest = """function hitTest(world, { deep = false, framesOnly = false, exclude = null } = {}) {
    const scene = doc.scene();
    for (let i = scene.length - 1; i >= 0; i--) {
        const s = scene[i], n = s.node;
        if (s.locked || n.id === state.editing || n.type === 'group' || exclude?.has(n.id) || framesOnly && n.type !== 'frame')
            continue;"""

new_hittest = """function hitTest(world, { deep = false, framesOnly = false, exclude = null } = {}) {
    const scene = doc.scene(), tol = 4 / state.camera.zoom;
    for (let i = scene.length - 1; i >= 0; i--) {
        const s = scene[i], n = s.node;
        if (s.locked || n.id === state.editing || n.type === 'group' || exclude?.has(n.id) || framesOnly && n.type !== 'frame')
            continue;
        if (world.x < s.box.x - tol || world.x > s.box.x + s.box.w + tol ||
            world.y < s.box.y - tol || world.y > s.box.y + s.box.h + tol)
            continue;"""

assert old_hittest in content, "old_hittest not found"
content = content.replace(old_hittest, new_hittest)

# 8. drawOverlay font setup outside loop
old_draw_overlay = """    const z = state.camera.zoom, accent = options.theme === 'dark' ? '#6fa9f5' : '#0058CA';
    for (const s of doc.scene()) {
        if (s.node.type !== 'frame' || s.node.parentId)
            continue;
        const p = worldToScreen(s.box.x, s.box.y);
        if (p.y < -30 || p.x > area.clientWidth || p.x + s.box.w * z < 0)
            continue;
        c.font = '10px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillStyle = state.selection.has(s.node.id) ? accent : options.theme === 'dark' ? '#8d839a' : '#8c8297';
        c.fillText(s.node.name, p.x, p.y - 12);
    }"""

new_draw_overlay = """    const z = state.camera.zoom, accent = options.theme === 'dark' ? '#6fa9f5' : '#0058CA';
    c.font = '10px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    for (const s of doc.scene()) {
        if (s.node.type !== 'frame' || s.node.parentId)
            continue;
        const p = worldToScreen(s.box.x, s.box.y);
        if (p.y < -30 || p.x > area.clientWidth || p.x + s.box.w * z < 0)
            continue;
        c.fillStyle = state.selection.has(s.node.id) ? accent : options.theme === 'dark' ? '#8d839a' : '#8c8297';
        c.fillText(s.node.name, p.x, p.y - 12);
    }"""

assert old_draw_overlay in content, "old_draw_overlay not found"
content = content.replace(old_draw_overlay, new_draw_overlay)

# 9. applyText mixed styles note cleanup
old_apply_text = """            if (spans.length > 1)
                n.spans = spans;
            else if (f.textData?.styleOverrideTable?.length)
                note('mixed text styles flattened to the first style');"""

new_apply_text = """            if (spans.length > 1) {
                n.spans = spans;
            } else if (spans.length === 1 && spans[0]) {
                const s = spans[0];
                if (s.fill) n.fill = s.fill;
                if (s.fontSize) n.fontSize = s.fontSize;
                if (s.fontFamily) n.fontFamily = s.fontFamily;
                if (s.fontWeight) n.fontWeight = s.fontWeight;
            }"""

assert old_apply_text in content, "old_apply_text not found"
content = content.replace(old_apply_text, new_apply_text)

# 10. effects on groups
old_effects_group = """        if (type !== 'group')
            applyStroke(n, f);
        if (type !== 'group')
            applyEffects(n, f);
        else if (f.effects?.length)
            note('effects on groups ignored');"""

new_effects_group = """        if (type !== 'group')
            applyStroke(n, f);
        if (type !== 'group')
            applyEffects(n, f);
        else if (f.effects?.length) {
            applyEffects(n, f);
        }"""

assert old_effects_group in content, "old_effects_group not found"
content = content.replace(old_effects_group, new_effects_group)

# 11. SHAPES and fallback for unknown types with children
old_shapes = """    const FRAMEISH = new Set(['FRAME', 'SECTION', 'SYMBOL', 'INSTANCE', 'SLIDE', 'SLIDE_ROW', 'SLIDE_GRID', 'WEBPAGE', 'RESPONSIVE_SET', 'TABLE', 'TABLE_CELL']);
    const SHAPES = { RECTANGLE: 'rect', ROUNDED_RECTANGLE: 'rect', ELLIPSE: 'ellipse', LINE: 'line', TEXT: 'text', GROUP: 'group', BOOLEAN_OPERATION: 'path' };
    const makeMidas = (f, pf, out, parentMidas) => {
        const k = gkey(f.guid), vector = ['VECTOR', 'STAR', 'REGULAR_POLYGON'].includes(f.type), isBool = f.type === 'BOOLEAN_OPERATION';
        let type = FRAMEISH.has(f.type) ? 'frame' : isBool ? 'path' : SHAPES[f.type] || (vector ? 'group' : null);
        if (!type) {
            skip(f.type);
            return null;
        }"""

new_shapes = """    const FRAMEISH = new Set(['FRAME', 'SECTION', 'SYMBOL', 'INSTANCE', 'SLIDE', 'SLIDE_ROW', 'SLIDE_GRID', 'WEBPAGE', 'RESPONSIVE_SET', 'TABLE', 'TABLE_CELL']);
    const SHAPES = { RECTANGLE: 'rect', ROUNDED_RECTANGLE: 'rect', ELLIPSE: 'ellipse', LINE: 'line', TEXT: 'text', GROUP: 'group', BOOLEAN_OPERATION: 'path', SHAPE_WITH_TEXT: 'rect', STICKY: 'rect', CONNECTOR: 'line', STAMP: 'rect', HIGHLIGHT: 'path' };
    const makeMidas = (f, pf, out, parentMidas) => {
        const k = gkey(f.guid), vector = ['VECTOR', 'STAR', 'REGULAR_POLYGON'].includes(f.type), isBool = f.type === 'BOOLEAN_OPERATION';
        let type = FRAMEISH.has(f.type) ? 'frame' : isBool ? 'path' : SHAPES[f.type] || (vector ? 'group' : null);
        if (!type && (kids.get(gkey(f.guid)) || []).length > 0)
            type = 'frame';
        if (!type) {
            skip(f.type);
            return null;
        }"""

assert old_shapes in content, "old_shapes not found"
content = content.replace(old_shapes, new_shapes)

# 12. symbolOverrides nested instance handling
old_overrides = """        for (const ov of f.symbolData?.symbolOverrides || []) {
            const guids = ov.guidPath?.guids || [];
            if (!guids.length)
                continue;
            if (guids.length > 1) {
                note('overrides inside nested instances skipped');
                continue;
            }
            const targetSrc = idMap.get(gkey(guids[0])), c = targetSrc && clones.get(targetSrc);
            if (!c)
                continue;
            const before = { ...c };
            if (ov.textData?.characters !== undefined)
                c.text = ov.textData.characters;
            if (ov.visible !== undefined)
                c.visible = ov.visible !== false;
            if (ov.opacity !== undefined)
                c.opacity = ov.opacity;
            if (ov.fillPaints)
                applyFills(c, ov);
            if (ov.strokePaints)
                applyStroke(c, { ...figOfMidas.get(targetSrc), ...ov });
            if (ov.effects)
                applyEffects(c, ov);
            if (ov.fontSize)
                c.fontSize = ov.fontSize;
            for (const key of Object.keys(c))
                if (!['id', 'parentId', 'sourceId', 'component', 'isInstance', 'overrides', 'version'].includes(key) && JSON.stringify(c[key]) !== JSON.stringify(before[key]))
                    c.overrides[key] = structuredClone(c[key]);
        }"""

new_overrides = """        for (const ov of f.symbolData?.symbolOverrides || []) {
            const guids = ov.guidPath?.guids || [];
            if (!guids.length)
                continue;
            const targetGuid = guids[guids.length - 1];
            const targetSrc = idMap.get(gkey(targetGuid));
            let c = targetSrc ? clones.get(targetSrc) : null;
            if (!c && targetSrc) {
                for (const clone of clones.values()) {
                    if (clone.sourceId === targetSrc) {
                        c = clone;
                        break;
                    }
                }
            }
            if (!c)
                continue;
            const before = { ...c };
            if (ov.textData?.characters !== undefined)
                c.text = ov.textData.characters;
            if (ov.visible !== undefined)
                c.visible = ov.visible !== false;
            if (ov.opacity !== undefined)
                c.opacity = ov.opacity;
            if (ov.fillPaints)
                applyFills(c, ov);
            if (ov.strokePaints)
                applyStroke(c, { ...figOfMidas.get(targetSrc), ...ov });
            if (ov.effects)
                applyEffects(c, ov);
            if (ov.fontSize)
                c.fontSize = ov.fontSize;
            for (const key of Object.keys(c))
                if (!['id', 'parentId', 'sourceId', 'component', 'isInstance', 'overrides', 'version'].includes(key) && (c[key] !== before[key] || (typeof c[key] === 'object' && JSON.stringify(c[key]) !== JSON.stringify(before[key]))))
                    c.overrides[key] = structuredClone(c[key]);
        }"""

assert old_overrides in content, "old_overrides not found"
content = content.replace(old_overrides, new_overrides)

# 13. Component sets and pending instance loop in figToMidas
old_comp_sets = """    // ---- component sets: variant properties from "Prop=Value, Prop2=Value" names ----
    const allMidas = pages.flatMap(p => p.nodes);
    for (const n of allMidas.filter(x => x.componentSet)) {
        const vs = allMidas.filter(x => x.parentId === n.id && x.component), parsed = vs.map(v => Object.fromEntries(v.name.split(',').map(s => s.trim().split('=')).filter(a => a.length === 2 && a[0].trim()).map(a => [a[0].trim(), a[1].trim()])));
        if (vs.length && parsed.every(p => Object.keys(p).length))
            vs.forEach((v, i) => { v.variant = parsed[i]; });
        else {
            n.componentSet = false;
            note('a component set had unreadable variant names');
        }
    }
    // ---- instances: link to the main component and apply simple overrides ----
    const byParent = new Map();
    for (const n of allMidas) {
        if (!byParent.has(n.parentId))
            byParent.set(n.parentId, []);
        byParent.get(n.parentId).push(n);
    }
    const descendants = id => { const out = [], q = [id]; while (q.length) {
        const x = q.shift();
        for (const c of byParent.get(x) || []) {
            out.push(c);
            q.push(c.id);
        }
    } return out; };
    const owner = new Map(); // midas id -> page
    for (const p of pages)
        for (const n of p.nodes)
            owner.set(n.id, p);
    for (const { f, n } of pending) {"""

new_comp_sets = """    // ---- component sets: variant properties from "Prop=Value, Prop2=Value" names ----
    const allMidas = pages.flatMap(p => p.nodes);
    const byParent = new Map();
    for (const n of allMidas) {
        if (!byParent.has(n.parentId))
            byParent.set(n.parentId, []);
        byParent.get(n.parentId).push(n);
    }
    for (const n of allMidas.filter(x => x.componentSet)) {
        const vs = (byParent.get(n.id) || []).filter(x => x.component), parsed = vs.map(v => Object.fromEntries(v.name.split(',').map(s => s.trim().split('=')).filter(a => a.length === 2 && a[0].trim()).map(a => [a[0].trim(), a[1].trim()])));
        if (vs.length && parsed.every(p => Object.keys(p).length))
            vs.forEach((v, i) => { v.variant = parsed[i]; });
        else {
            n.componentSet = false;
        }
    }
    // ---- instances: link to the main component and apply simple overrides ----
    const descendants = id => { const out = [], q = [id]; while (q.length) {
        const x = q.shift();
        for (const c of byParent.get(x) || []) {
            out.push(c);
            q.push(c.id);
        }
    } return out; };
    const owner = new Map(); // midas id -> page
    for (const p of pages)
        for (const n of p.nodes)
            owner.set(n.id, p);
    let instCount = 0;
    for (const { f, n } of pending) {
        if (++instCount % 50 === 0)
            await new Promise(r => setTimeout(r, 0));"""

assert old_comp_sets in content, "old_comp_sets not found"
content = content.replace(old_comp_sets, new_comp_sets)

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("All patches applied successfully!")
