// The State tab of the Variables window: state variables (typed, with an initial value and a scope) and derived values built
// from dropdown sentences. All rules live in @midas/builder-core (state.js, expr.js); this file only draws and wires them.
//   api = { state(), tx(label, fn(state)), render(), esc }      ui = { open: Set(variable ids), menu: boolean }
import { COMPARATORS, DEFAULT_SCHEMA, STATE_FIELD_TYPES, LIST_ITEM_TYPES, OPERATIONS, STATE_SCOPES, STATE_TYPES, createEvalCtx, defaultExpr, defaultValue, fieldDefault, fitRows, formatValue, getAt, parseSchema, schemaOf, schemaText, setAt, uniqueStateName } from './behavior.js';

const GLYPH = { string: 'T', number: '#', boolean: '◐', option: '≡', list: '☰', object: '{}', date: 'D', file: 'F' };
const TYPE_LABEL = Object.fromEntries(STATE_TYPES.map(t => [t.id, t.label]));
const uid = () => `st${Math.random().toString(36).slice(2, 10)}`;

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
    if (v) return schemaOf(v);
    const d = state.derived.find(x => x.id === e.ref);
    return d ? fieldsOfExpr(d.expr, state, depth + 1) : [];
}

function valueText(v) {
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'row' : 'rows'}`;
    if (v && typeof v === 'object') return `{${Object.keys(v).length} fields}`;
    return formatValue(v);
}

export function stateTabHtml(api, ui) {
    const { esc } = api, state = api.state();
    const ev = createEvalCtx(state);
    const refs = state.variables.map(v => [v.id, v.name]);
    const opt = (items, cur, blank) => `${blank ? `<option value="">${esc(blank)}</option>` : ''}${items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;

    // ---- one expression, as a sentence of dropdowns ----
    const node = (did, e, path) => {
        const at = `${esc(did)}|${path}`, self = state.derived.find(d => d.id === did);
        const pick = `<select class="st-op" data-st-op="${at}" aria-label="Operation">${OPERATIONS.map(o => `<option value="${o.id}" ${o.id === e?.op ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        const cmp = key => `<select data-st-cmp="${at}" data-st-key="${key}" aria-label="Comparison">${COMPARATORS.map(c => `<option value="${c.id}" ${c.id === e[key] ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>`;
        const child = key => `<div class="st-child">${node(did, e[key], path ? `${path}.${key}` : key)}</div>`;
        const field = (key, listExpr) => {
            const fs = fieldsOfExpr(listExpr, state);
            return fs.length
                ? `<select data-st-field="${at}" aria-label="Field">${opt(fs.map(f => [f.key, f.key]), e[key] || '', 'the value itself')}</select>`
                : `<input data-st-field="${at}" value="${esc(e[key] || '')}" placeholder="field" spellcheck="false" aria-label="Field">`;
        };
        let body = '';
        switch (e?.op) {
            case 'var': {
                const derivedRefs = state.derived.filter(d => d.id !== self?.id).map(d => [d.id, `${d.name} (derived)`]);
                body = `<select data-st-ref="${at}" class="${e.ref ? '' : 'st-warn'}" aria-label="Variable">${opt([...refs, ...derivedRefs], e.ref, 'Choose a variable…')}</select>`;
                break;
            }
            case 'value': body = `<input data-st-lit="${at}" value="${esc(e.value ?? '')}" placeholder="value" spellcheck="false" title="true, false and numbers keep their type" aria-label="Fixed value">`; break;
            case 'count': body = child('list'); break;
            case 'sum': body = `${field('field', e.list)}<span class="st-word">in</span>${child('list')}`; break;
            case 'filter': body = `${child('list')}<span class="st-word">where</span>${field('field', e.list)}${cmp('cmp')}${child('value')}`; break;
            case 'length': case 'isEmpty': body = child('of'); break;
            case 'equals': body = `${child('a')}<span class="st-word">equals</span>${child('b')}`; break;
            case 'compare': body = `${child('a')}${cmp('cmp')}${child('b')}`; break;
            case 'and': case 'or': body = `${(e.args || []).map((_, i) => `<div class="st-child st-arg">${node(did, e.args[i], `${path ? path + '.' : ''}args.${i}`)}<button class="icon-button small" data-st-act="del-arg" data-st-at="${at}" data-st-i="${i}" title="Remove" aria-label="Remove item ${i + 1}">×</button></div>`).join('')}<button class="vw-btn ghost" data-st-act="add-arg" data-st-at="${at}">+ Add</button>`; break;
            case 'not': body = child('arg'); break;
            default: break;
        }
        return `<div class="st-node">${pick}${body}</div>`;
    };

    // ---- state variables ----
    const initialEditor = v => {
        const f = `data-st-init="${esc(v.id)}"`;
        switch (v.type) {
            case 'number': return `<input type="number" step="any" ${f} value="${esc(v.initial)}" aria-label="Initial value">`;
            case 'boolean': return `<select ${f} aria-label="Initial value"><option value="false" ${!v.initial ? 'selected' : ''}>false</option><option value="true" ${v.initial ? 'selected' : ''}>true</option></select>`;
            case 'option': return `<select ${f} aria-label="Initial value">${opt((v.options || []).map(o => [o, o]), v.initial)}</select>`;
            case 'date': return `<input type="date" ${f} value="${esc(v.initial)}" aria-label="Initial value">`;
            case 'file': return '<span class="st-muted">No file · picked in Preview</span>';
            case 'list': return `<button class="vw-fx" data-st-act="expand" data-st-id="${esc(v.id)}">${esc(valueText(v.initial))}${v.itemType === 'object' || !v.itemType ? ` · ${esc(schemaOf(v).map(x => x.key).join(', '))}` : ` of ${esc(v.itemType)}`}</button>`;
            case 'object': return `<button class="vw-fx" data-st-act="expand" data-st-id="${esc(v.id)}">${esc(schemaOf(v).map(x => x.key).join(', '))}</button>`;
            default: return `<input type="text" ${f} value="${esc(v.initial)}" spellcheck="false" aria-label="Initial value">`;
        }
    };
    const cellEditor = (v, f, value, at) => {
        const a = `data-st-cell="${esc(v.id)}|${at}|${esc(f.key)}" data-st-t="${f.type}"`;
        if (f.type === 'boolean') return `<select ${a}><option value="false" ${!value ? 'selected' : ''}>false</option><option value="true" ${value ? 'selected' : ''}>true</option></select>`;
        if (f.type === 'number') return `<input type="number" step="any" ${a} value="${esc(value ?? 0)}">`;
        if (f.type === 'date') return `<input type="date" ${a} value="${esc(value ?? '')}">`;
        if (f.type === 'color') return `<input type="color" ${a} value="${esc(String(value || '#d9d9d9').slice(0, 7))}">`;
        return `<input type="text" ${a} value="${esc(value ?? '')}" spellcheck="false">`;
    };
    const details = v => {
        const row = (label, body) => `<label class="st-drow"><span>${label}</span>${body}</label>`;
        let h = row('Description', `<input data-st-f="description" data-st-id="${esc(v.id)}" value="${esc(v.description || '')}" placeholder="What this is for" spellcheck="false">`);
        if (v.type === 'option') h += row('Options', `<input data-st-f="options" data-st-id="${esc(v.id)}" value="${esc((v.options || []).join(', '))}" placeholder="draft, sent, paid" spellcheck="false">`);
        if (v.type === 'list') h += row('Items are', `<select data-st-f="itemType" data-st-id="${esc(v.id)}">${opt(LIST_ITEM_TYPES.map(t => [t, t === 'object' ? 'objects (rows with fields)' : t]), v.itemType)}</select>`);
        const fields = schemaOf(v);
        if (fields.length) h += row('Fields', `<input data-st-f="schema" data-st-id="${esc(v.id)}" value="${esc(schemaText(fields))}" placeholder="name:string, price:number" spellcheck="false" title="type is one of ${STATE_FIELD_TYPES.join(', ')}">`);
        if (v.type === 'list') {
            const kind = v.itemType || 'object', rows = Array.isArray(v.initial) ? v.initial : [];
            const head = kind === 'object' ? fields.map(f => `<th title="${esc(f.type)}">${esc(f.key)}</th>`).join('') : '<th>value</th>';
            const body = rows.map((r, i) => `<tr><td class="st-n">${i + 1}</td>${kind === 'object' ? fields.map(f => `<td>${cellEditor(v, f, r?.[f.key], i)}</td>`).join('') : `<td>${cellEditor(v, { key: '', type: kind }, r, i)}</td>`}<td><button class="icon-button small" data-st-act="del-row" data-st-id="${esc(v.id)}" data-st-i="${i}" title="Remove row" aria-label="Remove row ${i + 1}">×</button></td></tr>`).join('');
            h += `<div class="st-rows"><table><thead><tr><th>#</th>${head}<th></th></tr></thead><tbody>${body || `<tr><td colspan="${(kind === 'object' ? fields.length : 1) + 2}" class="st-muted">No rows yet.</td></tr>`}</tbody></table><button class="vw-btn ghost" data-st-act="add-row" data-st-id="${esc(v.id)}">+ Add row</button></div>`;
        }
        if (v.type === 'object') h += `<div class="st-rows"><table><thead><tr>${fields.map(f => `<th>${esc(f.key)}</th>`).join('')}</tr></thead><tbody><tr>${fields.map(f => `<td>${cellEditor(v, f, v.initial?.[f.key], 'o')}</td>`).join('')}</tr></tbody></table></div>`;
        return `<div class="st-details">${h}</div>`;
    };
    const varRow = v => `<div class="st-row" data-st-row="${esc(v.id)}">
        <div class="st-main">
            <i class="vc-glyph" title="${esc(TYPE_LABEL[v.type])}">${GLYPH[v.type]}</i>
            <input class="st-name" data-st-f="name" data-st-id="${esc(v.id)}" value="${esc(v.name)}" spellcheck="false" aria-label="Name">
            <span class="st-type">${esc(TYPE_LABEL[v.type])}</span>
            <div class="st-initial">${initialEditor(v)}</div>
            <select class="st-scope" data-st-f="scope" data-st-id="${esc(v.id)}" aria-label="Scope" title="Page: starts again on every page. App: kept across pages.">${opt(STATE_SCOPES.map(s => [s.id, s.label]), v.scope)}</select>
            <span class="st-acts"><button class="vw-mini" data-st-act="expand" data-st-id="${esc(v.id)}" title="Details" aria-label="Details">${ui.open.has(v.id) ? '▾' : '▸'}</button><button class="vw-mini" data-st-act="dup" data-st-id="${esc(v.id)}" title="Duplicate" aria-label="Duplicate">⧉</button><button class="vw-mini" data-st-act="del" data-st-id="${esc(v.id)}" title="Delete" aria-label="Delete">×</button></span>
        </div>${ui.open.has(v.id) ? details(v) : ''}</div>`;

    // ---- derived values ----
    const derivedRow = d => {
        const err = ev.error(d.id), val = ev.get(d.id);
        return `<div class="st-row st-derived" data-st-row="${esc(d.id)}">
        <div class="st-main"><i class="vc-glyph" title="Derived">ƒ</i>
            <input class="st-name" data-st-f="dname" data-st-id="${esc(d.id)}" value="${esc(d.name)}" spellcheck="false" aria-label="Name">
            <span class="st-type">Derived</span>
            <div class="st-initial ${err ? 'st-error' : ''}" title="Value from the initial state">${err ? esc(err) : `= ${esc(valueText(val))}`}</div>
            <span class="st-acts"><button class="vw-mini" data-st-act="del-derived" data-st-id="${esc(d.id)}" title="Delete" aria-label="Delete">×</button></span>
        </div>
        <div class="st-expr">${node(d.id, d.expr, '')}</div></div>`;
    };

    const menu = ui.menu ? `<div class="vw-menu">${STATE_TYPES.map(t => `<button data-st-act="add" data-st-type="${t.id}"><i class="vc-glyph">${GLYPH[t.id]}</i>${esc(t.label)}</button>`).join('')}</div>` : '';
    return `<div class="st-wrap">
        <div class="st-tools"><div class="vw-create"><button class="vw-btn" data-st-act="menu">+ Create state ▾</button>${menu}</div><button class="vw-btn ghost" data-st-act="add-derived">+ Derived value</button>
            <span class="st-note">State is what changes while a page runs. Preview starts from these initial values.</span></div>
        <div class="st-table">
            ${state.variables.length ? state.variables.map(varRow).join('') : '<div class="vw-empty">No state yet. Create a String, Number, Option, List… and bind it to a layer from the Behavior tab.</div>'}
            ${state.derived.length ? `<div class="st-section">Derived values <small>read-only · computed from the state</small></div>${state.derived.map(derivedRow).join('')}` : ''}
        </div></div>`;
}

export function wireStateTab(win, api, ui) {
    const find = id => api.state().variables.find(v => v.id === id);
    const findD = id => api.state().derived.find(d => d.id === id);
    const setInitial = (v, value) => { v.initial = value; };
    win.addEventListener('click', e => {
        const b = e.target.closest('[data-st-act]');
        if (!b || !win.contains(b)) return;
        const act = b.dataset.stAct, id = b.dataset.stId, i = Number(b.dataset.stI);
        if (act === 'menu') { ui.menu = !ui.menu; api.render(); return; }
        if (act === 'expand') { ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); api.render(); return; }
        ui.menu = false;
        if (act === 'add') {
            const type = b.dataset.stType, raw = { id: uid(), name: TYPE_LABEL[type], type, scope: 'page' };
            if (type === 'option') raw.options = ['option-1', 'option-2'];
            if (type === 'list') { raw.itemType = 'object'; raw.schema = DEFAULT_SCHEMA.map(f => ({ ...f })); raw.initial = [{ label: 'Item 1', value: 'one' }, { label: 'Item 2', value: 'two' }, { label: 'Item 3', value: 'three' }]; }
            api.tx('Create state', st => { raw.name = uniqueStateName(st, raw.name); st.variables.push(raw); });
            ui.open.add(raw.id);
            api.render();
        }
        else if (act === 'dup') api.tx('Duplicate state', st => { const v = st.variables.find(x => x.id === id); if (v) st.variables.push({ ...structuredClone(v), id: uid(), name: uniqueStateName(st, v.name) }); });
        else if (act === 'del') api.tx('Delete state', st => { st.variables = st.variables.filter(x => x.id !== id); });
        else if (act === 'add-derived') api.tx('Create derived value', st => { const first = st.variables[0]?.id || ''; st.derived.push({ id: uid(), name: uniqueStateName(st, 'Derived'), expr: defaultExpr('count', first) }); });
        else if (act === 'del-derived') api.tx('Delete derived value', st => { st.derived = st.derived.filter(x => x.id !== id); });
        else if (act === 'add-row') api.tx('Add row', st => { const v = st.variables.find(x => x.id === id); if (!v) return; const kind = v.itemType || 'object'; v.initial = [...(v.initial || []), kind === 'object' ? Object.fromEntries(schemaOf(v).map(f => [f.key, fieldDefault(f.type)])) : fieldDefault(kind)]; });
        else if (act === 'del-row') api.tx('Remove row', st => { const v = st.variables.find(x => x.id === id); if (v) v.initial = v.initial.filter((_, k) => k !== i); });
        else if (act === 'add-arg' || act === 'del-arg') {
            const [did, path] = b.dataset.stAt.split('|');
            api.tx(act === 'add-arg' ? 'Add condition' : 'Remove condition', st => {
                const d = st.derived.find(x => x.id === did);
                if (!d) return;
                const list = [...(getAt(d.expr, path ? `${path}.args` : 'args') || [])];
                if (act === 'add-arg') list.push(defaultExpr('compare', st.variables[0]?.id || ''));
                else list.splice(i, 1);
                d.expr = setAt(d.expr, path ? `${path}.args` : 'args', list);
            });
        }
        api.render();
    });
    win.addEventListener('change', e => {
        const t = e.target;
        if (!win.contains(t)) return;
        const d = t.dataset;
        if (d.stF) {
            api.tx('Edit state', st => {
                const v = st.variables.find(x => x.id === d.stId);
                if (d.stF === 'dname') { const dv = st.derived.find(x => x.id === d.stId); if (dv && t.value.trim()) dv.name = uniqueStateName(st, t.value.trim(), dv.id); return; }
                if (!v) return;
                if (d.stF === 'name') { if (t.value.trim()) v.name = uniqueStateName(st, t.value.trim(), v.id); }
                else if (d.stF === 'scope') v.scope = t.value;
                else if (d.stF === 'description') v.description = t.value;
                else if (d.stF === 'options') { v.options = [...new Set(t.value.split(',').map(x => x.trim()).filter(Boolean))]; if (!v.options.includes(v.initial)) v.initial = v.options[0] ?? ''; }
                else if (d.stF === 'itemType') { v.itemType = t.value; v.initial = fitRows({ ...v, itemType: t.value }, v.initial); }
                else if (d.stF === 'schema') { const sc = parseSchema(t.value); if (sc.length) { v.schema = sc; v.initial = v.type === 'list' ? fitRows(v, v.initial) : Object.fromEntries(sc.map(f => [f.key, v.initial?.[f.key] ?? fieldDefault(f.type)])); } }
            });
        }
        else if (d.stInit) api.tx('Initial value', st => { const v = st.variables.find(x => x.id === d.stInit); if (!v) return; setInitial(v, v.type === 'number' ? (Number.isFinite(t.valueAsNumber) ? t.valueAsNumber : 0) : v.type === 'boolean' ? t.value === 'true' : t.value); });
        else if (d.stCell) {
            const [vid, at, key] = d.stCell.split('|');
            const val = d.stT === 'number' ? (Number.isFinite(t.valueAsNumber) ? t.valueAsNumber : 0) : d.stT === 'boolean' ? t.value === 'true' : t.value;
            api.tx('Edit row', st => {
                const v = st.variables.find(x => x.id === vid);
                if (!v) return;
                if (v.type === 'object') v.initial = { ...v.initial, [key]: val };
                else v.initial = v.initial.map((r, k) => (k === Number(at) ? ((v.itemType || 'object') === 'object' ? { ...r, [key]: val } : val) : r));
            });
        }
        else if (d.stOp || d.stRef || d.stLit || d.stCmp || d.stField) {
            const [did, path] = (d.stOp || d.stRef || d.stLit || d.stCmp || d.stField).split('|');
            api.tx('Edit derived value', st => {
                const dv = st.derived.find(x => x.id === did);
                if (!dv) return;
                const cur = getAt(dv.expr, path);
                const first = st.variables[0]?.id || '';
                let next = cur;
                if (d.stOp) next = defaultExpr(t.value, cur?.op === 'var' && cur.ref ? cur.ref : first);
                else if (d.stRef) next = { ...cur, ref: t.value };
                else if (d.stLit) next = { ...cur, value: parseLiteral(t.value) };
                else if (d.stCmp) next = { ...cur, [d.stKey || 'cmp']: t.value };
                else if (d.stField) next = { ...cur, field: t.value };
                dv.expr = setAt(dv.expr, path, next);
            });
        }
        api.render();
    });
}
