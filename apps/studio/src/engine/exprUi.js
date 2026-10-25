// An expression as a sentence of dropdowns: "Number of rows in [Rows of [People] where [status] [is] [active]]". Used by the
// derived values of the State tab and by the conditions of the Behavior tab. Only draws and edits the JSON tree; what an
// expression means is in @midas/builder-core (expr.js).
//   opts  = { esc, state, refs: [[id, label]], layers: [[id, label]], allow?: (opId) => boolean, selfId? }
//   owner = a string that says where the expression is stored; the controls carry "<owner>|<path>" in a data attribute.
import { COMPARATORS, OPERATIONS, defaultExpr, getAt, schemaOf, setAt } from './behavior.js';

/** Text typed into a "fixed value" box as a value: true / false and numbers keep their type. */
export function parseLiteral(text) {
    const t = String(text).trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t !== '' && Number.isFinite(+t)) return +t;
    return String(text);
}

/** The fields of the list an expression stands for (a state list, a derived list, or a filter of one); [] when unknown. */
export function fieldsOfExpr(e, state, depth = 0) {
    if (!e || depth > 8) return [];
    if (e.op === 'filter') return fieldsOfExpr(e.list, state, depth + 1);
    if (e.op !== 'var') return [];
    const v = state.variables.find(x => x.id === e.ref);
    if (v) return (v.itemType || 'object') === 'object' ? schemaOf(v) : [];
    const d = state.derived.find(x => x.id === e.ref);
    return d ? fieldsOfExpr(d.expr, state, depth + 1) : [];
}

const optionsHtml = (esc, items, cur, blank) => `${blank ? `<option value="">${esc(blank)}</option>` : ''}${items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;

/** html of one expression (a node and everything inside it). */
export function exprHtml(opts, owner, expr) {
    const { esc, state } = opts, ops = OPERATIONS.filter(o => !opts.allow || opts.allow(o.id));
    const node = (e, path) => {
        const at = `${esc(owner)}|${path}`;
        const pick = `<select class="st-op" data-ex-op="${at}" aria-label="Operation">${ops.map(o => `<option value="${o.id}" ${o.id === e?.op ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        const cmp = key => `<select data-ex-cmp="${at}" data-ex-key="${key}" aria-label="Comparison">${COMPARATORS.map(c => `<option value="${c.id}" ${c.id === e[key] ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>`;
        const child = key => `<div class="st-child">${node(e[key], path ? `${path}.${key}` : key)}</div>`;
        const field = listExpr => {
            const fs = fieldsOfExpr(listExpr, state);
            return fs.length
                ? `<select data-ex-fname="${at}" aria-label="Field">${optionsHtml(esc, fs.map(f => [f.key, f.key]), e.field || '', 'the value itself')}</select>`
                : `<input data-ex-fname="${at}" value="${esc(e.field || '')}" placeholder="field" spellcheck="false" aria-label="Field">`;
        };
        let body = '';
        switch (e?.op) {
            case 'var': body = `<select data-ex-ref="${at}" class="${e.ref ? '' : 'st-warn'}" aria-label="Variable">${optionsHtml(esc, opts.refs.filter(r => r[0] !== opts.selfId), e.ref, 'Choose a variable…')}</select>`; break;
            case 'value': body = `<input data-ex-lit="${at}" value="${esc(e.value ?? '')}" placeholder="value" spellcheck="false" title="true, false and numbers keep their type" aria-label="Fixed value">`; break;
            case 'count': body = child('list'); break;
            case 'sum': body = `${field(e.list)}<span class="st-word">in</span>${child('list')}`; break;
            case 'filter': body = `${child('list')}<span class="st-word">where</span>${field(e.list)}${cmp('cmp')}${child('value')}`; break;
            case 'length': case 'isEmpty': body = child('of'); break;
            case 'equals': body = `${child('a')}<span class="st-word">equals</span>${child('b')}`; break;
            case 'compare': body = `${child('a')}${cmp('cmp')}${child('b')}`; break;
            case 'valid': case 'invalid': body = `<select data-ex-layer="${at}" class="${e.field ? '' : 'st-warn'}" aria-label="Field">${optionsHtml(esc, opts.layers || [], e.field, (opts.layers || []).length ? 'Choose a field…' : 'No input field on this screen')}</select>`; break;
            case 'and': case 'or': body = `${(e.args || []).map((_, i) => `<div class="st-child st-arg">${node(e.args[i], `${path ? path + '.' : ''}args.${i}`)}<button type="button" class="icon-button small" data-ex-act="del-arg" data-ex-at="${at}" data-ex-i="${i}" title="Remove" aria-label="Remove item ${i + 1}">×</button></div>`).join('')}<button type="button" class="vw-btn ghost" data-ex-act="add-arg" data-ex-at="${at}">+ Add</button>`; break;
            case 'not': body = child('arg'); break;
            default: break;
        }
        return `<div class="st-node${e?.op === 'var' || e?.op === 'value' ? ' st-leaf' : ''}">${pick}${body}</div>`;
    };
    return node(expr, '');
}

const KINDS = { exOp: 'op', exRef: 'ref', exLit: 'lit', exCmp: 'cmp', exFname: 'fname', exLayer: 'layer' };
/** Which control of an expression an element is, from its dataset: → { kind, owner, path, key } or null. */
export function exprTarget(ds) {
    for (const [attr, kind] of Object.entries(KINDS))
        if (ds[attr] !== undefined) { const i = ds[attr].indexOf('|'); return { kind, owner: ds[attr].slice(0, i), path: ds[attr].slice(i + 1), key: ds.exKey }; }
    return null;
}
/** The new expression after an edit (a change of a control). `first` = the variable a new operation starts from. */
export function editExpr(root, t, value, first = '') {
    const cur = getAt(root, t.path);
    let next = cur;
    if (t.kind === 'op') next = defaultExpr(value, cur?.op === 'var' && cur.ref ? cur.ref : first);
    else if (t.kind === 'ref') next = { ...cur, ref: value };
    else if (t.kind === 'lit') next = { ...cur, value: parseLiteral(value) };
    else if (t.kind === 'cmp') next = { ...cur, [t.key || 'cmp']: value };
    else if (t.kind === 'fname') next = { ...cur, field: value };
    else if (t.kind === 'layer') next = { ...cur, field: value };
    return setAt(root, t.path, next);
}
/** + Add / × on an and / or list. `at` = "<owner>|<path>" of the and / or node. */
export function editArgs(root, path, act, index, first = '') {
    const key = path ? `${path}.args` : 'args';
    const list = [...(getAt(root, key) || [])];
    if (act === 'add-arg') list.push(defaultExpr('compare', first)); else list.splice(index, 1);
    return setAt(root, key, list);
}
