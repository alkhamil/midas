// Convention: the names a file treats as standard for the roles of a component (value, label, message…) and for its states
// (default, hover, error, loading…). Stored per file in `doc.data.convention`. It only SUGGESTS: nothing is mapped until the
// designer accepts. Pure.

export const DEFAULT_CONVENTION = {
    slots: {
        value: ['value', 'input', 'text', 'content', 'selected'],
        placeholder: ['placeholder', 'hint'],
        label: ['label', 'title', 'name'],
        message: ['message', 'description', 'content', 'contents', 'body', 'text', 'error'],
        title: ['title', 'heading', 'header'],
        chip: ['chip', 'tag', 'token', 'selected item'],
        remove: ['remove', 'close', 'delete', 'clear'],
        popup: ['popup', 'dropdown', 'menu', 'overlay', 'panel', 'list'],
        item: ['item', 'option', 'row', 'entry'],
        search: ['search', 'filter', 'query'],
        empty: ['empty', 'no data', 'no results', 'not found'],
        icon: ['icon', 'prefix', 'suffix', 'arrow', 'spinner'],
        close: ['close', 'dismiss', 'x'],
        // tables
        row: ['row', 'table row', 'body row', 'data row', 'record'],
        header: ['header', 'header row', 'table header', 'thead', 'columns'],
        loading: ['loading', 'skeleton', 'spinner'],
        emptySearch: ['no results', 'no match', 'nothing found', 'empty search'],
        tab: ['tab', 'tabs', 'tab bar', 'tab list'],
        panel: ['panel', 'tab panel', 'tab content', 'pane'],
        prev: ['prev', 'previous', 'back'],
        next: ['next', 'forward'],
        pageLabel: ['page label', 'page info', 'pagination label', 'page'],
        pageItem: ['page item', 'page number', 'page button'],
        selectAll: ['select all', 'header checkbox', 'check all'],
        selectRow: ['select row', 'row checkbox', 'checkbox', 'check'],
        rowDelete: ['delete', 'remove', 'trash'],
        rowEdit: ['edit', 'pencil'],
        addButton: ['add', 'new', 'create', 'add button'],
        bulkDelete: ['delete selected', 'bulk delete', 'remove selected'],
        reload: ['reload', 'refresh'],
    },
    states: {
        default: ['default', 'rest', 'normal', 'enabled', 'idle'],
        hover: ['hover', 'hovered'],
        pressed: ['pressed', 'active', 'down'],
        focused: ['focused', 'focus'],
        disabled: ['disabled'],
        error: ['error', 'invalid', 'danger'],
        loading: ['loading', 'busy', 'pending', 'processing'],
        selected: ['selected', 'checked', 'current'],
    },
    // Which component draws each kind of feedback ('' = Preview's built-in one, shown with a badge).
    feedback: { alert: '', message: '', notification: '', modal: '', drawer: '', popconfirm: '' },
};

const words = s => String(s ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const normalizeName = words;
const uniqueWords = list => [...new Set((Array.isArray(list) ? list : []).map(words).filter(Boolean))];

/** The file's convention: what it set, completed by the defaults. Idempotent. */
export function cleanConvention(raw) {
    const out = { slots: {}, states: {}, feedback: {} };
    for (const [k, d] of Object.entries(DEFAULT_CONVENTION.slots)) { const own = uniqueWords(raw?.slots?.[k]); out.slots[k] = own.length ? own : [...d]; }
    for (const [k, d] of Object.entries(DEFAULT_CONVENTION.states)) { const own = uniqueWords(raw?.states?.[k]); out.states[k] = own.length ? own : [...d]; }
    for (const k of Object.keys(DEFAULT_CONVENTION.feedback)) out.feedback[k] = typeof raw?.feedback?.[k] === 'string' ? raw.feedback[k] : '';
    return out;
}

/** 3 = the name is one of the conventional names, 2 = starts / ends with one, 1 = contains one as a word, 0 = no match. */
export function matchScore(layerName, names) {
    const w = words(layerName);
    if (!w) return 0;
    let best = 0;
    for (const n of names) {
        if (w === n) return 3;
        if (w.startsWith(n + ' ') || w.endsWith(' ' + n)) best = Math.max(best, 2);
        else if ((' ' + w + ' ').includes(' ' + n + ' ')) best = Math.max(best, 1);
    }
    return best;
}

// A field with one text layer (the placeholder) shows the value in it too: value and placeholder may be the same layer.
const SHARE = { value: 'placeholder', placeholder: 'value' };
const KIND_OK = { text: l => l.type === 'text', frame: l => l.type === 'frame' || l.type === 'group' || !!l.isInstance, any: () => true };

/**
 * Which layer to propose for each role. `roles` = [{ role, kind: 'text' | 'frame' | 'any' }] (component slots are not layers);
 * `layers` = [{ id, name, type, isInstance? }] inside the component; `taken` = { role: layerId } already mapped (left alone).
 * A layer is proposed for one role only, the best match first. → [{ role, layerId, name, score }]
 */
export function suggestSlots(roles, layers, convention, taken = {}) {
    const conv = cleanConvention(convention), used = new Set(Object.values(taken));
    const cands = [];
    for (const r of roles) {
        if (taken[r.role] || r.kind === 'component') continue;
        const ok = KIND_OK[r.kind] || KIND_OK.any;
        for (const l of layers) {
            if (used.has(l.id) || !ok(l)) continue;
            const score = matchScore(l.name, conv.slots[r.role] || []);
            if (score) cands.push({ role: r.role, layerId: l.id, name: l.name, score });
        }
    }
    cands.sort((a, b) => b.score - a.score);
    const out = [], gotRole = new Set(), gotLayer = new Set();
    for (const c of cands) {
        if (gotRole.has(c.role) || gotLayer.has(c.layerId)) continue;
        gotRole.add(c.role); gotLayer.add(c.layerId); out.push(c);
    }
    // A role with no layer of its own may share the layer of its partner (value ↔ placeholder): the best layer named like the partner.
    for (const r of roles) {
        const partner = SHARE[r.role];
        if (!partner || gotRole.has(r.role) || taken[r.role] || r.kind === 'component') continue;
        const ok = KIND_OK[r.kind] || KIND_OK.any;
        const best = layers.filter(l => ok(l) && !Object.values(taken).includes(l.id) || ok(l) && taken[partner] === l.id)
            .map(l => ({ l, score: matchScore(l.name, conv.slots[partner] || []) })).filter(x => x.score).sort((a, b) => b.score - a.score)[0];
        if (best) { gotRole.add(r.role); out.push({ role: r.role, layerId: best.l.id, name: best.l.name, score: best.score, shared: true }); }
    }
    // A required text role nothing named: when the component has only ONE text layer and nobody else took it, that one is it.
    const texts = layers.filter(l => l.type === 'text');
    if (texts.length === 1) for (const r of roles) {
        if (!r.required || r.kind !== 'text' || gotRole.has(r.role) || taken[r.role] || out.some(x => x.layerId === texts[0].id) || Object.values(taken).includes(texts[0].id)) continue;
        gotRole.add(r.role); out.push({ role: r.role, layerId: texts[0].id, name: texts[0].name, score: 0.5, only: true });
    }
    return out;
}

/** Which mode of a `* states` collection stands for each state of the convention: { state: modeId }. */
export function suggestStates(modes, convention) {
    const conv = cleanConvention(convention), out = {};
    for (const [state, names] of Object.entries(conv.states)) {
        let best = null;
        for (const m of modes || []) { const s = matchScore(m.name, names); if (s && (!best || s > best.s)) best = { s, id: m.id }; }
        if (best) out[state] = best.id;
    }
    return out;
}

/** The preset whose name best fits a component name ("Button / Primary" → button). `presets` = [{ id, match: [words] }]. */
export function suggestPreset(name, presets) {
    const w = words(name);
    let best = null;
    for (const p of presets) {
        const s = matchScore(w, (p.match || []).map(words));
        if (s && (!best || s > best.s)) best = { s, id: p.id };
    }
    return best?.id ?? null;
}

/**
 * The layer of the row template (or of the header row) for each column of a table, by name: a layer named like the column's key or header
 * text ("email", "E-mail", "Email cell"). One layer per column, best match first. `columns` = [{ key, label }]; `layers` = [{ id, name, type }].
 * → [{ key, layerId, name, score }]
 */
export function suggestColumnSlots(columns, layers, taken = new Set()) {
    const cands = [];
    for (const c of columns) {
        const names = [...new Set([normalizeName(c.key), normalizeName(c.label || c.key)].filter(Boolean))];
        for (const l of layers) {
            if (taken.has(l.id) || (l.type !== 'text' && l.type !== 'frame' && !l.isInstance)) continue;
            const score = matchScore(l.name, names);
            if (score) cands.push({ key: c.key, layerId: l.id, name: l.name, score: score + (l.type === 'text' ? 0.5 : 0) });
        }
    }
    cands.sort((a, b) => b.score - a.score);
    const out = [], gotKey = new Set(), gotLayer = new Set();
    for (const c of cands) {
        if (gotKey.has(c.key) || gotLayer.has(c.layerId)) continue;
        gotKey.add(c.key); gotLayer.add(c.layerId); out.push(c);
    }
    return out;
}
