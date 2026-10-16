// Let's test the functions that run when a node is clicked

// 1. Simulate DocumentModel with instances, components, and nested instances
const p0_nodes = [
    { id: 'frame_1', type: 'frame', name: 'Header', parentId: null, x: 0, y: 0, w: 1200, h: 80, visible: true },
    { id: 'inst_1', type: 'frame', name: 'Button Instance', parentId: 'frame_1', isInstance: true, sourceId: 'comp_btn', x: 20, y: 20, w: 120, h: 40, visible: true },
    { id: 'btn_label', type: 'text', name: 'Label', parentId: 'inst_1', text: 'Click me', x: 10, y: 10, w: 100, h: 20, visible: true },
    { id: 'comp_btn', type: 'frame', name: 'Button Component', parentId: null, component: true, x: 0, y: 200, w: 120, h: 40, visible: true },
    { id: 'comp_label', type: 'text', name: 'Label', parentId: 'comp_btn', text: 'Button', x: 10, y: 10, w: 100, h: 20, visible: true }
];

// Let's test pageTree & instanceTree
console.log("Testing pageTree and instanceTree on normal structure:");
function pageTreeOld(page, rootId) {
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
}

const tree = pageTreeOld({ nodes: p0_nodes }, 'frame_1');
console.log("pageTree normal nodes count:", tree.length);

// What if there is a circular parentId?
const cyclic_nodes = [
    { id: 'A', parentId: 'B' },
    { id: 'B', parentId: 'A' }
];

console.log("Testing pageTree on cyclic structure (with 100 iteration timeout guard):");
function pageTreeSafe(page, rootId) {
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
}

const safeTree = pageTreeSafe({ nodes: cyclic_nodes }, 'A');
console.log("Safe pageTree handled cycle successfully! Result count:", safeTree.length);

