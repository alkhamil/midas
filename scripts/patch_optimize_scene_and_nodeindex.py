with open("src/engine/midas.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add cycle protection in scene() walk
old_walk = """        const walk = (pid, m, opacity, parentClips, hidden, locked, depth) => {
            if (depth > 10000) // cycle guard only
                return;
            // A visible mask layer clips every sibling stacked above it (Figma semantics); the mask itself is not painted.
            let clips = parentClips;
            for (const n of byParent.get(pid) || []) {"""

new_walk = """        const visited = new Set();
        const walk = (pid, m, opacity, parentClips, hidden, locked, depth) => {
            if (depth > 500) // cycle guard only
                return;
            // A visible mask layer clips every sibling stacked above it (Figma semantics); the mask itself is not painted.
            let clips = parentClips;
            for (const n of byParent.get(pid) || []) {
                if (visited.has(n.id))
                    continue;
                visited.add(n.id);"""

assert old_walk in content, "old_walk not found"
content = content.replace(old_walk, new_walk)

# 2. Cache allNodes() and nodeIndex() to avoid huge GC pauses on selection/inspector
old_node_idx = """function allNodes() { return doc.data.pages.flatMap(p => p.nodes); }
function componentById(id) {"""

new_node_idx = """let _cachedAllNodes = null, _cachedAllNodesRev = -1;
function allNodes() {
    if (_cachedAllNodes && _cachedAllNodesRev === doc.revision)
        return _cachedAllNodes;
    _cachedAllNodes = doc.data.pages.flatMap(p => p.nodes);
    _cachedAllNodesRev = doc.revision;
    return _cachedAllNodes;
}
let _cachedNodeIndex = null, _cachedNodeIndexRev = -1;
function nodeIndex() {
    if (_cachedNodeIndex && _cachedNodeIndexRev === doc.revision)
        return _cachedNodeIndex;
    _cachedNodeIndex = new Map(allNodes().map(n => [n.id, n]));
    _cachedNodeIndexRev = doc.revision;
    return _cachedNodeIndex;
}
function componentById(id) {"""

assert old_node_idx in content, "old_node_idx not found"
content = content.replace(old_node_idx, new_node_idx)

# Replace the old standalone nodeIndex() function definition with just returning the cached index
old_standalone_idx = """function nodeIndex() { return new Map(allNodes().map(n => [n.id, n])); }"""
assert old_standalone_idx in content, "old_standalone_idx not found"
# Notice that we already defined nodeIndex above, so we can replace this one with a comment or pass-through
content = content.replace(old_standalone_idx, "// nodeIndex is cached above")

with open("src/engine/midas.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Scene walk and nodeIndex optimizations applied successfully!")
