// Behavior tab, Phase 2: conditions ("If …"), the editors of the State / list / feedback / request actions, and the Rules of an
// interaction. Only draws. What a condition means, how rules are picked and what the actions do is in @midas/builder-core.
import { exprHtml } from './exprUi.js';
import { BUILTINS, FEEDBACK_KINDS, FEEDBACK_LEVELS, FEEDBACK_POSITIONS, PLACEMENTS, FEEDBACK_EFFECTS, FEEDBACK_SOURCES, MOTION_EASINGS, SET_OPS, describeExpr, ignoredTypeNote, normalizeFeedbackMotion, ruleSummary, schemaOf, showsTypeField } from './behavior.js';

const lit = value => ({ op: 'value', value });

/** What the condition builder offers to read: Preview's own values, then State and derived values. */
// Row references ($row.<field>, $rowIndex, $isSelected) are offered only while the layer sits inside a table's row template.
// The Behavior tab sets them for the layer it draws (setRowRefs) and clears them afterwards.
let ROW_REFS = [];
/** [[ref, label]] of the row references in scope (empty outside a row template). */
export function setRowRefs(list) { ROW_REFS = Array.isArray(list) ? list : []; }
export function rowRefs() { return ROW_REFS; }
export function conditionRefs(state) {
    return [...BUILTINS.map(b => [b.id, b.name]), ...state.variables.map(v => [v.id, v.name]), ...state.derived.map(d => [d.id, `${d.name} (derived)`]), ...ROW_REFS];
}
const nameFinder = state => id => BUILTINS.find(b => b.id === id)?.name || state.variables.find(v => v.id === id)?.name || state.derived.find(d => d.id === id)?.name || ROW_REFS.find(r => r[0] === id)?.[1] || '';
/** A condition in words, for one-line summaries. `fields` = [[layer id, name]]. */
export const conditionWords = (state, fields, expr) => describeExpr(expr, nameFinder(state), id => fields.find(f => f[0] === id)?.[1] || '');

/**
 * "If [dropdown sentence]": a builder when there is a condition, a + button when there is not. `owner` is the path of the
 * condition on the layer (interactions.0.if, interactions.0.rules.items.1.if, stateBind.self.when…).
 */
export function conditionHtml({ esc, state, fields, owner, expr, label = 'If', addLabel = 'Add a condition' }) {
    if (!expr) return `<button type="button" class="vw-btn ghost bh-addcond" data-bh-act="add-cond" data-bh-path="${esc(owner)}">+ ${esc(addLabel)}</button>`;
    return `<div class="bh-cond"><div class="bh-cond-head"><b>${esc(label)}</b><button type="button" class="icon-button small" data-bh-act="del-cond" data-bh-path="${esc(owner)}" title="Remove the condition" aria-label="Remove the condition">×</button></div>${exprHtml({ esc, state, refs: conditionRefs(state), layers: fields }, owner, expr)}</div>`;
}

const valueEditor = (ctx, owner, expr) => exprHtml({ esc: ctx.esc, state: ctx.state, refs: [...ctx.state.variables.map(v => [v.id, v.name]), ...ctx.state.derived.map(d => [d.id, `${d.name} (derived)`]), ...ROW_REFS], allow: id => id === 'value' || id === 'var' }, owner, expr || lit(''));

/** Editors of the actions Phase 2 adds. ctx = { esc, state, fields, bhSelect, renderAction, addActionAt } */
export function stateActionFields(ctx, p, a, it) {
    const { esc, state, bhSelect } = ctx;
    const lists = state.variables.filter(v => v.type === 'list'), vars = state.variables;
    const listPick = () => `<label class="field"><span>List</span>${bhSelect(`${p}.listId`, 'plain', a.listId || '', [['', lists.length ? '— choose a List —' : 'No List state yet'], ...lists.map(v => [v.id, v.name])])}</label>`;
    const list = lists.find(v => v.id === a.listId);
    const objects = !list || (list.itemType || 'object') === 'object';
    const fieldsOfList = list ? (objects ? schemaOf(list) : [{ key: 'value', type: list.itemType }]) : [];
    const whereRow = () => {
        if (!list) return '';
        if (!a.where) return `<button type="button" class="vw-btn ghost" data-bh-act="add-where" data-bh-path="${esc(p)}.where" data-bh-first="${esc(fieldsOfList[0]?.key ?? '')}">+ Only some rows…</button>`;
        const w = a.where;
        const fieldSel = objects ? bhSelect(`${p}.where.field`, 'plain', w.field || '', fieldsOfList.map(f => [f.key, f.key])) : '';
        const cmp = bhSelect(`${p}.where.cmp`, 'plain', w.cmp || 'eq', [['eq', 'is'], ['ne', 'is not'], ['gt', 'is greater than'], ['gte', 'is at least'], ['lt', 'is less than'], ['lte', 'is at most'], ['contains', 'contains'], ['startsWith', 'starts with'], ['endsWith', 'ends with'], ['in', 'is one of']]);
        return `<div class="bh-cond"><div class="bh-cond-head"><b>Only rows where</b><button type="button" class="icon-button small" data-bh-act="del-where" data-bh-path="${esc(p)}.where" title="All rows" aria-label="Apply to all rows">×</button></div><div class="bh-inline">${fieldSel}${cmp}</div>${valueEditor(ctx, `${p}.where.value`, w.value)}</div>`;
    };
    const fieldValues = (key, title) => (!list ? '' : `<div class="bh-fields"><div class="small-label">${esc(title)}</div>${fieldsOfList.map(f => `<div class="bh-fieldrow"><small>${esc(f.key)}</small>${valueEditor(ctx, `${p}.${key}.${f.key}`, a[key]?.[f.key])}</div>`).join('')}</div>`);
    switch (a.type) {
        case 'set-state': {
            const v = vars.find(x => x.id === a.variableId);
            const ops = SET_OPS.filter(o => !v || (o.id === 'toggle' ? v.type === 'boolean' : (o.id === 'increment' || o.id === 'decrement') ? v.type === 'number' : true));
            return `<label class="field"><span>State</span>${bhSelect(`${p}.variableId`, 'plain', a.variableId || '', [['', vars.length ? '— choose a State —' : 'No State yet'], ...vars.map(x => [x.id, `${x.name}${x.scope === 'app' ? ' (app)' : ''}`])])}</label>`
                + `<label class="field"><span>Do</span>${bhSelect(`${p}.op`, 'plain', a.op || 'set', ops.map(o => [o.id, o.label]))}</label>`
                + (a.value ? valueEditor(ctx, `${p}.value`, a.value) : '');
        }
        case 'list-add': return listPick() + fieldValues('row', 'New row');
        case 'list-update': return listPick() + whereRow() + fieldValues('set', 'Set');
        case 'list-delete': return listPick() + whereRow();
        case 'list-clear': return listPick();
        case 'validate-field': return `<label class="field"><span>Field</span>${bhSelect(`${p}.fieldId`, 'plain', a.fieldId || '', [['', 'All fields on this screen'], ...ctx.fields])}</label><p class="small-label">An invalid field shows its error state. Use “Field is invalid” in a rule to react.</p>`;
        case 'request': return `<label class="field"><span>Wait</span><input type="number" min="0" max="10000" data-bh-path="${esc(p)}.delay" data-bh-kind="plain" value="${a.delay ?? 800}" aria-label="Wait in ms"><i class="unit">ms</i></label><p class="small-label">Shows a loading state, then ends with the scenario picked in the Preview toolbar. React to it with a rule on “Last response” (or “Last response type”).</p>`;
        case 'show-feedback': {
            const nested = (a.kind === 'modal' || a.kind === 'popconfirm')
                ? `<div class="bh-fields"><div class="small-label">When confirmed</div>${(a.onConfirm || []).map((x, j) => ctx.renderAction(`${p}.onConfirm.${j}`, x, it, `${p}.onConfirm`, j)).join('')}${ctx.addActionAt(`${p}.onConfirm`)}</div>` : '';
            // The component's type dimension decides whether Type applies; a stale Type on a component without one is kept, not used.
            const info = ctx.feedbackTypes?.(a.componentId || ctx.convention?.feedback?.[a.kind]) || null, hasType = !!info?.hasType;
            const typeRow = showsTypeField(a.kind, hasType) ? `<label class="field"><span>Type</span>${bhSelect(`${p}.level`, 'plain', a.level, FEEDBACK_LEVELS.map(k => [k, k]))}</label>` : '';
            const ignored = info && ignoredTypeNote(info.name, hasType, a.level);
            return `<label class="field"><span>Show</span>${bhSelect(`${p}.kind`, 'plain', a.kind, FEEDBACK_KINDS.map(k => [k.id, k.label]))}</label>`
                + typeRow + (ignored ? `<p class="small-label bh-warn">⚠ ${esc(ignored)}</p>` : '')
                + `<label class="field"><span>Title</span><input data-bh-path="${esc(p)}.title" data-bh-kind="plain" value="${esc(a.title || '')}" placeholder="Optional" spellcheck="false"></label>`
                + `<label class="field"><span>Message</span><input data-bh-path="${esc(p)}.message" data-bh-kind="plain" value="${esc(a.message || '')}" placeholder="Total: {total}" spellcheck="false" title="Put a State name in {braces} to show its value"></label>`
                + `<label class="field"><span>Position</span>${bhSelect(`${p}.position`, 'plain', a.position, PLACEMENTS.map(k => [k, k]))}</label>`
                // Offset from the edge of the frame for this position; the copy on the canvas moves with it.
                + `<div class="bh-fields"><label class="field"><span>Offset X</span><input type="number" data-bh-path="${esc(p)}.offset.x" data-bh-kind="plain" value="${a.offset?.x ?? 0}" aria-label="Offset X"><i class="unit">px</i></label><label class="field"><span>Offset Y</span><input type="number" data-bh-path="${esc(p)}.offset.y" data-bh-kind="plain" value="${a.offset?.y ?? 0}" aria-label="Offset Y"><i class="unit">px</i></label></div>`
                + `<label class="field"><span>Hide after</span><input type="number" min="0" max="60000" data-bh-path="${esc(p)}.duration" data-bh-kind="plain" value="${a.duration ?? 0}" aria-label="Hide after in ms" title="0 = stays until closed"><i class="unit">ms</i></label>`
                + `<label class="checkbox-row"><input type="checkbox" data-bh-path="${esc(p)}.blocking" data-bh-kind="bool" ${a.blocking ? 'checked' : ''}> Blocking (nothing behind it can be used)</label>`
                + feedbackComponentRows(ctx, p, a)
                + appearanceRows(ctx, p, a, a.componentId || ctx.convention?.feedback?.[a.kind], { feedback: true })
                + feedbackMotionRows(ctx, p, a)
                + nested + '<p class="small-label">Use {name} to show a State value, e.g. “{Attempts} of 5”.</p>';
        }
        default: return '';
    }
}

/** The Rules part of an interaction card. `open` = Set of the open section keys. */
export function rulesHtml(ctx, it, i, open) {
    const { esc, state, fields } = ctx, rules = it.rules || { items: [] }, key = `rules:${it.id}`, isOpen = open.has(key);
    const n = rules.items.length + (rules.otherwise ? 1 : 0);
    const head = `<div class="bh-rules-head"><button type="button" class="sc-toggle" data-bh-section="${esc(key)}" aria-expanded="${isOpen}"><span class="bh-caret">${isOpen ? '▾' : '▸'}</span><b>Rules</b></button><small>${n ? `${n} · first match wins` : 'none yet'}</small></div>`;
    if (!isOpen) return `<div class="bh-rules">${head}</div>`;
    const base = `interactions.${i}.rules`;
    const ruleCard = (r, ri) => {
        const rk = `rule:${it.id}:${r.id}`, ro = open.has(rk), p = `${base}.items.${ri}`;
        const summary = ruleSummary(r, c => conditionWords(state, fields, c));
        return `<div class="bh-rule ${r.enabled ? '' : 'off'}"><div class="bh-rule-head">
            <input type="checkbox" data-bh-path="${p}.enabled" data-bh-kind="bool" ${r.enabled ? 'checked' : ''} aria-label="Rule on" title="Turn this rule on or off">
            <button type="button" class="bh-rule-title" data-bh-section="${esc(rk)}" aria-expanded="${ro}"><b>${esc(r.name)}</b><small>${esc(summary)}</small></button>
            <span class="bh-rule-acts"><button type="button" class="icon-button small" data-bh-act="move-rule" data-bh-index="${i}" data-bh-rule="${ri}" data-bh-dir="-1" ${ri === 0 ? 'disabled' : ''} title="Move up" aria-label="Move rule up">↑</button><button type="button" class="icon-button small" data-bh-act="move-rule" data-bh-index="${i}" data-bh-rule="${ri}" data-bh-dir="1" ${ri === rules.items.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move rule down">↓</button><button type="button" class="icon-button small" data-bh-act="del-rule" data-bh-index="${i}" data-bh-rule="${ri}" title="Delete rule" aria-label="Delete rule">×</button></span></div>
            ${ro ? `<div class="bh-rule-body"><label class="field"><span>Name</span><input data-bh-path="${p}.name" data-bh-kind="plain" value="${esc(r.name)}" spellcheck="false"></label>${conditionHtml({ esc, state, fields, owner: `${p}.if`, expr: r.if, label: 'When', addLabel: 'Add a condition (otherwise always)' })}<div class="small-label">Then</div>${r.actions.map((a, j) => ctx.renderAction(`${p}.actions.${j}`, a, it, `${p}.actions`, j)).join('')}${ctx.addActionAt(`${p}.actions`)}</div>` : ''}</div>`;
    };
    const other = rules.otherwise;
    const otherCard = other ? (() => {
        const ok = `rule:${it.id}:otherwise`, oo = open.has(ok), p = `${base}.otherwise`;
        return `<div class="bh-rule"><div class="bh-rule-head"><span></span><button type="button" class="bh-rule-title" data-bh-section="${esc(ok)}" aria-expanded="${oo}"><b>Otherwise</b><small>${other.actions.length} ${other.actions.length === 1 ? 'action' : 'actions'}</small></button><span class="bh-rule-acts"><button type="button" class="icon-button small" data-bh-act="del-otherwise" data-bh-index="${i}" title="Remove" aria-label="Remove otherwise">×</button></span></div>${oo ? `<div class="bh-rule-body">${other.actions.map((a, j) => ctx.renderAction(`${p}.actions.${j}`, a, it, `${p}.actions`, j)).join('')}${ctx.addActionAt(`${p}.actions`)}</div>` : ''}</div>`;
    })() : '';
    return `<div class="bh-rules">${head}<div class="bh-rules-body">${rules.items.map(ruleCard).join('')}${otherCard}<div class="bh-rules-add"><button type="button" class="vw-btn ghost" data-bh-act="add-rule" data-bh-index="${i}">+ Add rule</button>${other ? '' : `<button type="button" class="vw-btn ghost" data-bh-act="add-otherwise" data-bh-index="${i}">+ Otherwise</button>`}</div></div></div>`;
}

/**
 * Motion of a feedback: enter and exit (effect, duration, delay, easing), slide distance, the Hide-after pause on hover, whose motion
 * plays, the backdrop, and Play (one enter and exit in the live Preview). The numbers are read by feedbackMotion.js.
 */
function feedbackMotionRows(ctx, p, a) {
    const { esc, bhSelect } = ctx, mp = `${p}.motion`, m = normalizeFeedbackMotion(a.motion, a.kind);
    const mapped = ctx.convention?.feedback?.[a.kind] || a.componentId || '';
    const effects = FEEDBACK_EFFECTS.map(x => [x.id, x.label]), easings = MOTION_EASINGS.map(x => [x.id, x.label]);
    const num = (path, v, lo, hi, label, unit, stepBy = 1) => `<label class="field"><span>${label}</span><input type="number" min="${lo}" max="${hi}" step="${stepBy}" data-bh-path="${esc(path)}" data-bh-kind="plain" value="${v}" aria-label="${esc(label)}"><i class="unit">${unit}</i></label>`;
    const step = (phase, s) => `<div class="bh-motion-step"><div class="small-label">${phase === 'enter' ? 'Enter' : 'Exit (defaults to the reverse of enter)'}</div>`
        + `<label class="field"><span>Effect</span>${bhSelect(`${mp}.${phase}.effect`, 'plain', s.effect, effects)}</label>`
        + num(`${mp}.${phase}.duration`, s.duration, 0, 2000, 'Duration', 'ms')
        + num(`${mp}.${phase}.delay`, s.delay, 0, 2000, 'Delay', 'ms')
        + `<label class="field"><span>Easing</span>${bhSelect(`${mp}.${phase}.easing`, 'plain', s.easing, easings)}</label></div>`;
    const note = ctx.componentHasMotion?.(mapped)
        ? `<p class="small-label bh-warn">This component already defines motion (Smart animate or Change variant). Pick “Component's own” to keep only its motion, or “Midas animation” to add Midas's on top.</p>`
        : '';
    const payload = { feedback: { kind: a.kind, level: a.level, position: a.position, title: a.title || '', message: a.message || '', motion: m }, componentId: mapped };
    return `<div class="bh-motion"><div class="small-label">Motion</div>${step('enter', m.enter)}${step('exit', m.exit)}`
        + `<label class="field"><span>Slide distance</span>${num(`${mp}.distance`, m.distance, 0, 200, 'Slide distance', 'px')}</label>`
        + `<label class="checkbox-row"><input type="checkbox" data-bh-path="${mp}.hoverPause" data-bh-kind="bool" ${m.hoverPause ? 'checked' : ''}> Pause Hide after while hovered</label>`
        + `<label class="field"><span>Animation</span>${bhSelect(`${mp}.source`, 'plain', m.source, FEEDBACK_SOURCES.map(x => [x.id, x.label]))}</label>${note}`
        + `<div class="small-label">Backdrop</div>${num(`${mp}.backdrop.opacity`, m.backdrop.opacity, 0, 1, 'Backdrop opacity', '', 0.05)}`
        + `<label class="field"><span>Backdrop colour</span><input data-bh-path="${mp}.backdrop.color" data-bh-kind="plain" value="${esc(m.backdrop.color)}" spellcheck="false" aria-label="Backdrop colour"></label>`
        + `<button type="button" class="vw-btn ghost" data-bh-act="play-feedback" data-feedback-json="${esc(JSON.stringify(payload))}">▶ Play enter and exit</button></div>`;
}

/**
 * Appearance: the modes and variants this one action pins on the component it draws. One row per type dimension (its first option is
 * "Follows type", so Type mapping keeps driving it) and per other variant property ("Default (as designed)"). Stored on the action.
 */
export function appearanceRows(ctx, p, a, componentId, { feedback = false } = {}) {
    const { esc, bhSelect } = ctx;
    const rows = ctx.appearanceOptions?.(componentId) || [];
    if (!rows.length) return '';
    const pin = a.appearance || {};
    // A pinned type row overrides Type mapping: say so on the row, so it is clear why the level no longer drives it.
    const pinnedOf = r => (r.kind === 'mode' ? pin.modes?.[r.key] : pin.variants?.[r.key]);
    const overridesType = feedback && rows.some(r => r.type && typeof pinnedOf(r) === 'string' && pinnedOf(r) !== '');
    return `<div class="bh-motion"><div class="small-label">Appearance</div>`
        + rows.map(r => {
            const cur = r.kind === 'mode' ? pin.modes?.[r.key] : pin.variants?.[r.key];
            const pinned = typeof cur === 'string' && cur !== '';
            const note = r.type && pinned && feedback ? ' · pinned, overrides Type' : '';
            return `<label class="field${pinned ? ' bh-pinned' : ''}"><span title="${esc(r.label)}">${esc(r.label)}${esc(note)}</span>${bhSelect(`${p}.appearance.${r.kind === 'mode' ? 'modes' : 'variants'}.${r.key}`, 'plain', typeof cur === 'string' ? cur : '', [['', r.type && feedback ? 'Follows type' : 'As designed'], ...r.options])}</label>`;
        }).join('')
        + `<p class="small-label">${overridesType ? 'Type is overridden by the pinned value above. ' : ''}Pinned here applies to this action only. As designed restores the look from the file.</p></div>`;
}
/** Which component draws this kind of feedback: the file's Convention, or just this action. No component = Preview's built-in one (badged). */
function feedbackComponentRows(ctx, p, a) {
    const { esc } = ctx, kind = a.kind, label = FEEDBACK_KINDS.find(k => k.id === kind)?.label || kind;
    const mapped = ctx.convention?.feedback?.[kind] || a.componentId;
    return (ctx.componentButton ? ctx.componentButton(`convention.feedback.${kind}`, ctx.convention?.feedback?.[kind] || '', `${label} component`) + ctx.componentButton(`${p}.componentId`, a.componentId || '', 'Only this action') : '')
        + (mapped ? '' : `<p class="small-label bh-warn">⚠ No component is set for ${esc(label)}: Preview draws its built-in one, marked “built-in”. Pick your own above (it needs the Show feedback behavior).</p>`);
}
