with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Optimize pageTree to reuse doc._byParent when inspecting doc.page
old_pagetree = """function pageTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId], seen = new Set([rootId]);"""

new_pagetree = """function pageTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = (page === doc.page && doc._byParent?.size) ? doc._byParent : (() => {
        const k = new Map();
        for (const n of page.nodes)
            (k.get(n.parentId) || k.set(n.parentId, []).get(n.parentId)).push(n);
        return k;
    })();
    const out = [], queue = [rootId], seen = new Set([rootId]);"""

assert old_pagetree in content, "old_pagetree not found"
content = content.replace(old_pagetree, new_pagetree)

# 2. Optimize instanceTree to reuse doc._byParent when inspecting doc.page
old_insttree = """function instanceTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = new Map();
    for (const n of page.nodes)
        (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], queue = [rootId], seen = new Set([rootId]);"""

new_insttree = """function instanceTree(page, rootId) {
    if (!page || !rootId)
        return [];
    const kids = (page === doc.page && doc._byParent?.size) ? doc._byParent : (() => {
        const k = new Map();
        for (const n of page.nodes)
            (k.get(n.parentId) || k.set(n.parentId, []).get(n.parentId)).push(n);
        return k;
    })();
    const out = [], queue = [rootId], seen = new Set([rootId]);"""

assert old_insttree in content, "old_insttree not found"
content = content.replace(old_insttree, new_insttree)

# 3. In instancePropsHtml, compute instanceTree once before exposedNested loop
old_inst_loop = """    let html = cpropsOf(holder).map(p => row(owner, p)).join('');
    const page = pageOfNode(owner.id);
    for (const nid of holder.exposedNested || []) {
        const x = page && instanceTree(page, owner.id).find(y => (y.swapOf || y.sourceId) === nid);"""

new_inst_loop = """    let html = cpropsOf(holder).map(p => row(owner, p)).join('');
    const page = pageOfNode(owner.id), tree = page ? instanceTree(page, owner.id) : [];
    for (const nid of holder.exposedNested || []) {
        const x = tree.find(y => (y.swapOf || y.sourceId) === nid);"""

assert old_inst_loop in content, "old_inst_loop not found"
content = content.replace(old_inst_loop, new_inst_loop)

# 4. Prewarm ensureGlobalIndexes after initialization
old_init_end = """showHome({ thumb: false });"""
new_init_end = """showHome({ thumb: false });
setTimeout(() => ensureGlobalIndexes(), 50);"""

assert old_init_end in content, "old_init_end not found"
content = content.replace(old_init_end, new_init_end)

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("PageTree, InstanceTree, and pre-warm patch applied successfully!")
