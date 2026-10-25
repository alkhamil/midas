// The State tab of the Variables window: state variables (typed, with an initial value and a scope) and derived values built
// from dropdown sentences. All rules live in @midas/builder-core (state.js, expr.js); this file only draws and wires them.
//   api = { state(), tx(label, fn(state)), render(), esc }      ui = { open: Set(variable ids), menu: boolean }
import { DEFAULT_SCHEMA, STATE_FIELD_TYPES, LIST_ITEM_TYPES, STATE_SCOPES, STATE_TYPES, SCENARIO_KINDS, DEFAULT_SCENARIOS, createEvalCtx, defaultExpr, fieldDefault, fitRows, formatValue, parseSchema, schemaOf, schemaText, uniqueStateName, scenariosOf } from './behavior.js';

import { exprHtml, exprTarget, editExpr, editArgs } from './exprUi.js';

const GLYPH = { string: 'T', number: '#', boolean: '◐', option: '≡', list: '☰', object: '{}', date: 'D', file: 'F' };
const TYPE_LABEL = Object.fromEntries(STATE_TYPES.map(t => [t.id, t.label]));
const uid = () => `st${Math.random().toString(36).slice(2, 10)}`;

function valueText(v) {
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'row' : 'rows'}`;
    if (v && typeof v === 'object') return `{${Object.keys(v).length} fields}`;
    return formatValue(v);
}

export function stateTabHtml(api, ui) {
    const { esc } = api, state = api.state();
    const ev = createEvalCtx(state);
    const refs = [...state.variables.map(v => [v.id, v.name]), ...state.derived.map(d => [d.id, `${d.name} (derived)`])];
    const opt = (items, cur, blank) => `${blank ? `<option value="">${esc(blank)}</option>` : ''}${items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;

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
        <div class="st-expr">${exprHtml({ esc, state, refs, selfId: d.id, allow: id => id !== 'valid' && id !== 'invalid' }, `d:${d.id}`, d.expr)}</div></div>`;
    };

    const scen = scenariosOf(state), custom = !!state.scenarios?.length;
    const scenarios = `<div class="st-section">Scenarios <small>what a Simulated request can end with, picked from the Preview toolbar</small></div>
        ${scen.map(sc => `<div class="st-row"><div class="st-scen"><input data-st-sc="name" data-st-id="${esc(sc.id)}" value="${esc(sc.name)}" spellcheck="false" aria-label="Scenario name"><select data-st-sc="kind" data-st-id="${esc(sc.id)}" aria-label="Kind">${SCENARIO_KINDS.map(k => `<option value="${k}" ${k === sc.kind ? 'selected' : ''}>${k}</option>`).join('')}</select><button class="vw-mini" data-st-act="del-scenario" data-st-id="${esc(sc.id)}" title="Delete" aria-label="Delete scenario">×</button></div></div>`).join('')}
        <button class="vw-btn ghost" data-st-act="add-scenario">+ Add scenario</button>${custom ? '' : '<span class="st-note">Default outcomes. Change one to make your own.</span>'}`;
    const menu = ui.menu ? `<div class="vw-menu">${STATE_TYPES.map(t => `<button data-st-act="add" data-st-type="${t.id}"><i class="vc-glyph">${GLYPH[t.id]}</i>${esc(t.label)}</button>`).join('')}</div>` : '';
    return `<div class="st-wrap">
        <div class="st-tools"><div class="vw-create"><button class="vw-btn" data-st-act="menu">+ Create state ▾</button>${menu}</div><button class="vw-btn ghost" data-st-act="add-derived">+ Derived value</button>
            <span class="st-note">State is what changes while a page runs. Preview starts from these initial values.</span></div>
        <div class="st-table">
            ${state.variables.length ? state.variables.map(varRow).join('') : '<div class="vw-empty">No state yet. Create a String, Number, Option, List… and bind it to a layer from the Behavior tab.</div>'}
            ${scenarios}
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
        else if (act === 'add-scenario') api.tx('Add scenario', st => { st.scenarios = [...scenariosOf(st).map(x => ({ ...x })), { id: uid(), name: `Outcome ${scenariosOf(st).length + 1}`, kind: 'error' }]; });
        else if (act === 'del-scenario') api.tx('Delete scenario', st => { const list = scenariosOf(st).filter(x => x.id !== id); st.scenarios = list.length ? list.map(x => ({ ...x })) : undefined; if (!st.scenarios) delete st.scenarios; });
        api.render();
    });
    win.addEventListener('click', e => {
        const b = e.target.closest('[data-ex-act]');
        if (!b || !win.contains(b)) return;
        const at = b.dataset.exAt, i = at.indexOf('|'), owner = at.slice(0, i), path = at.slice(i + 1);
        if (!owner.startsWith('d:')) return;
        api.tx('Edit derived value', st => { const dv = st.derived.find(x => x.id === owner.slice(2)); if (dv) dv.expr = editArgs(dv.expr, path, b.dataset.exAct, Number(b.dataset.exI), st.variables[0]?.id || ''); });
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
        else if (d.stSc) api.tx('Edit scenario', st => { const list = scenariosOf(st).map(x => ({ ...x })); const sc = list.find(x => x.id === d.stId); if (sc) { sc[d.stSc] = d.stSc === 'name' ? (t.value.trim() || sc.name) : t.value; st.scenarios = list; } });
        else { const tgt = exprTarget(d); if (tgt?.owner.startsWith('d:')) api.tx('Edit derived value', st => { const dv = st.derived.find(x => x.id === tgt.owner.slice(2)); if (dv) dv.expr = editExpr(dv.expr, tgt, t.value, st.variables[0]?.id || ''); }); }
        api.render();
    });
}
