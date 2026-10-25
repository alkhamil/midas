// Behavior tab, Phase 3: "Add Behavior" (presets and capabilities), the collapsed section of each capability, the slot pickers,
// the suggestions of the Convention and the Convention panel. Only draws: the rules (what a capability needs, what a preset is,
// what is suggested) are in @midas/builder-core (capabilities.js, convention.js).
import { BEHAVIOR_KINDS, CAPABILITIES, CAPABILITY_GROUPS, FEEDBACK_KINDS, INPUT_TYPES, PRESETS, PRESET_FAMILIES, RULE_TYPES, SLOT_ROLES, VALIDATION_TRIGGERS, inputSummary, optionsText, patternProblem, slotIssues, summaryOf, normalizeFieldRules, schemaOf, columnLabel } from './behavior.js';

const PLACEMENT_CHOICES = [['bottom-start', 'Below, aligned left'], ['bottom', 'Below, centered'], ['bottom-end', 'Below, aligned right'], ['top-start', 'Above, aligned left'], ['top', 'Above, centered'], ['top-end', 'Above, aligned right']];
const layerOk = { text: l => l.type === 'text', frame: l => l.type === 'frame' || l.type === 'group' || !!l.isInstance, any: () => true };

const field = (esc, label, body, hint) => `<label class="field bh-wide"><span${hint ? ` title="${esc(hint)}"` : ''}>${esc(label)}</span>${body}</label>`;
const check = (esc, path, on, label, attrs = '') => `<label class="checkbox-row"><input type="checkbox" data-bh-path="${esc(path)}" data-bh-kind="bool" ${attrs} ${on ? 'checked' : ''}> ${esc(label)}</label>`;

/** One role slot: a dropdown of the layers it can be, a click-on-canvas button, and the warning when it is required and empty. */
function slotRow(c, path, role, current, required) {
    const { esc } = c, def = SLOT_ROLES[role];
    if (def.kind === 'component') return `${c.componentButton(path, current, def.label)}${required && !current ? `<p class="small-label bh-warn">${esc(def.label)} is not set: it does not open until you pick a component.</p>` : ''}`;
    const list = c.layers.filter(layerOk[def.kind] || layerOk.any);
    const armed = c.pick === path;
    return `<div class="bh-slot ${required && !current ? 'is-missing' : ''}"><span class="bh-slot-name" title="${esc(def.hint)}">${esc(def.label)}${required ? ' <i>required</i>' : ''}</span>
        ${c.bhSelect(path, 'plain', current || '', [['', required ? '— choose a layer —' : '— not set —'], ...list.map(l => [l.id, l.name || l.type]), ['__convention__', 'Edit convention…']])}
        <button type="button" class="icon-button small bh-pick ${armed ? 'on' : ''}" data-bh-act="pick-slot" data-bh-path="${esc(path)}" title="${armed ? 'Click a layer on the canvas (Esc cancels)' : 'Pick the layer on the canvas'}" aria-label="Pick ${esc(def.label)} on the canvas" aria-pressed="${armed}">⌖</button>
        ${required && !current ? `<small class="bh-warn">Not set: this does not run until you pick a layer.</small>` : ''}</div>`;
}

// ---------------------------------------------------------------------------------------------------- bodies
function bodyCanType(c, s) {
    const { esc } = c, ib = s.ib || {}, t = ib.typeable || {};
    return slotRow(c, 'input.typeable.frameId', 'value', t.frameId, true)
        + field(esc, 'Input type', c.bhSelect('input.typeable.inputType', 'plain', t.inputType || 'text', INPUT_TYPES.map(x => [x.id, x.label])))
        + (t.inputType === 'password' ? `<p class="small-label">Clicking the icon in the field swaps it between these two components.</p>${c.componentButton('input.typeable.showIconId', t.showIconId, 'Icon while hidden')}${c.componentButton('input.typeable.hideIconId', t.hideIconId, 'Icon while shown')}` : '')
        + field(esc, 'Keep in State', c.bhSelect('input.typeable.bindTo', 'plain', t.bindTo || '', [['', '— nowhere —'], ...(c.state?.variables || []).filter(v => v.type === 'string' || v.type === 'number').map(v => [v.id, `${v.name} (${v.type})`])]), 'The typed text is written to this State. Save and Edit read it from there.')
        + `<p class="small-label">${esc(t.inputType === 'search' ? 'Enter fires On search.' : 'Typing fires On change; Enter fires On submit.')} The text of the value layer is the placeholder.</p>`;
}
function bodyValidation(c, s) {
    const { esc } = c, v = s.ib?.validation || {}, r = { ...(v.required ? { required: true } : {}), ...(v.rules || {}) };
    const num = k => `<input type="number" data-bh-path="input.validation.rules.${k}" data-bh-kind="plain" value="${esc(r[k] ?? '')}" placeholder="—" aria-label="${k}">`;
    const problem = patternProblem(r.pattern);
    return check(esc, 'input.validation.rules.required', !!r.required, 'Required')
        + field(esc, 'Type', c.bhSelect('input.validation.rules.type', 'plain', r.type || 'string', RULE_TYPES.map(x => [x, x === 'string' ? 'any text' : x])))
        + `<div class="bh-inline3"><label class="field"><span>Min</span>${num('min')}</label><label class="field"><span>Max</span>${num('max')}</label><label class="field"><span>Length</span>${num('len')}</label></div>`
        + field(esc, 'Pattern', `<input data-bh-path="input.validation.rules.pattern" data-bh-kind="plain" value="${esc(r.pattern || '')}" placeholder="^[A-Z]+$" spellcheck="false">`, 'A regular expression the value must match')
        + (problem ? `<p class="small-label bh-warn">This pattern is not valid: ${esc(problem)}. It is ignored until you fix it.</p>` : '')
        + field(esc, 'Check', c.bhSelect('input.validation.trigger', 'plain', v.trigger || 'blur', VALIDATION_TRIGGERS.map(x => [x.id, x.label])), 'validateTrigger')
        + c.advanced('validation', field(esc, 'Message', `<input data-bh-path="input.validation.rules.message" data-bh-kind="plain" value="${esc(r.message || '')}" placeholder="Your own wording" spellcheck="false">`, 'Replaces the standard message') + '<p class="small-label">Use “Field is valid / invalid” in a condition to react, and On finish / On finish failed as events.</p>');
}
function bodyOptions(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const stateVars = c.state.variables.filter(v => v.type === 'string' || v.type === 'option' || v.type === 'list');
    return field(esc, 'Options', `<input data-bh-path="${p}.config.options" data-bh-kind="options" value="${esc(optionsText(cf.options))}" placeholder="a, b=Bee, c" spellcheck="false">`, 'value, or value=Label, separated by commas')
        + field(esc, 'Mode', c.bhSelect(`${p}.config.mode`, 'plain', cf.mode, [['single', 'Single'], ['multiple', 'Multiple']]))
        + check(esc, `${p}.config.showSearch`, cf.showSearch, 'Search (showSearch)')
        + slotRow(c, `${p}.slots.value`, 'value', b.slots.value, true)
        + slotRow(c, `${p}.slots.placeholder`, 'placeholder', b.slots.placeholder, false)
        + (cf.mode === 'multiple' ? slotRow(c, `${p}.slots.chip`, 'chip', b.slots.chip, false) + slotRow(c, `${p}.slots.remove`, 'remove', b.slots.remove, false) : '')
        + c.advanced(b.id, check(esc, `${p}.config.allowClear`, cf.allowClear, 'Allow clear')
            + field(esc, 'Keep value in State', c.bhSelect(`${p}.config.bindTo`, 'plain', cf.bindTo || '', [['', '— nowhere —'], ...stateVars.map(v => [v.id, `${v.name} (${v.type})`])]), 'The value is written to this State and read from it'));
}
function bodyPopup(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    return slotRow(c, `${p}.slots.popup`, 'popup', b.slots.popup, true)
        + field(esc, 'Opens', c.bhSelect(`${p}.config.placement`, 'plain', cf.placement, PLACEMENT_CHOICES))
        + check(esc, `${p}.config.matchWidth`, cf.matchWidth, 'Same width as this component')
        + c.advanced(b.id, field(esc, 'Opens on', c.bhSelect(`${p}.config.trigger`, 'plain', cf.trigger, [['click', 'Click'], ['hover', 'Hover']])) + '<p class="small-label">It closes on a click outside, on Escape, or after a single pick.</p>');
}
function bodyItems(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    return slotRow(c, `${p}.slots.item`, 'item', b.slots.item, true)
        + slotRow(c, `${p}.slots.label`, 'label', b.slots.label, true)
        + slotRow(c, `${p}.slots.search`, 'search', b.slots.search, false)
        + slotRow(c, `${p}.slots.empty`, 'empty', b.slots.empty, false)
        + '<p class="small-label">Each item can look default, hover, selected or disabled through its own states collection. Inside a Select, the Select’s options are shown.</p>'
        + c.advanced(b.id, field(esc, 'Own items', `<input data-bh-path="${p}.config.options" data-bh-kind="options" value="${esc(optionsText(cf.options))}" placeholder="Edit, Duplicate, Delete" spellcheck="false">`, 'Only for a menu used on its own (not inside a Select)'));
}
function bodyLoading(c, s) {
    const b = s.b, p = s.path;
    return slotRow(c, `${p}.slots.icon`, 'icon', b.slots.icon, false) + '<p class="small-label">While a Simulated request runs this component switches to its “loading” mode and ignores clicks; it goes back afterwards. A component without a loading mode just ignores clicks.</p>';
}
function bodyFeedback(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const LV = ['success', 'error', 'warning', 'info'];
    return field(esc, 'Draws', c.bhSelect(`${p}.config.kind`, 'plain', cf.kind, FEEDBACK_KINDS.map(k => [k.id, k.label])), 'Which kind of “Show feedback” this component draws (set it as the file default in Convention)')
        + slotRow(c, `${p}.slots.message`, 'message', b.slots.message, true)
        + slotRow(c, `${p}.slots.title`, 'title', b.slots.title, false)
        + slotRow(c, `${p}.slots.icon`, 'icon', b.slots.icon, false)
        + slotRow(c, `${p}.slots.close`, 'close', b.slots.close, false)
        + (['modal', 'popconfirm', 'drawer'].includes(cf.kind) ? slotRow(c, `${p}.slots.confirm`, 'confirm', b.slots.confirm, false) + slotRow(c, `${p}.slots.cancel`, 'cancel', b.slots.cancel, false) : '')
        + `<p class="small-label">Its type (success / error / warning / info) comes from the variant property or mode whose values are named like them. ${s.typeNote || ''}</p>`
        + c.advanced(b.id, LV.map(l => field(esc, `${l[0].toUpperCase()}${l.slice(1)} is`, `<input data-bh-path="${p}.config.types.${l}" data-bh-kind="plain" value="${esc(cf.types?.[l] || '')}" placeholder="auto" spellcheck="false">`, 'The exact name of the variant value or mode for this level')).join(''));
}
// ----- tables
const colSlot = (c, path, label, current, layers, hint) => {
    const { esc } = c, armed = c.pick === path;
    return `<div class="bh-slot"><span class="bh-slot-name" title="${esc(hint)}">${esc(label)}</span>${c.bhSelect(path, 'plain', current || '', [['', '— not set —'], ...layers.map(l => [l.id, l.name || l.type]), ['__convention__', 'Edit convention…']])}<button type="button" class="icon-button small bh-pick ${armed ? 'on' : ''}" data-bh-act="pick-slot" data-bh-path="${esc(path)}" title="Pick the layer on the canvas" aria-label="Pick ${esc(label)} on the canvas" aria-pressed="${armed}">⌖</button></div>`;
};
function bodyRows(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const lists = c.state.variables.filter(v => v.type === 'list' && (v.itemType || 'object') === 'object'), list = lists.find(v => v.id === cf.source), cols = list ? schemaOf(list) : [];
    let h = field(esc, 'List', c.bhSelect(`${p}.config.source`, 'plain', cf.source || '', [['', lists.length ? '— choose a List —' : 'No List State yet'], ...lists.map(v => [v.id, v.name])]), 'The List State that holds the rows (its columns are the table’s columns)');
    if (list) h += field(esc, 'ID column', c.bhSelect(`${p}.config.idField`, 'plain', cf.idField, cols.map(f => [f.key, columnLabel(f)])), 'Tells rows apart (selection, delete, edit)') + field(esc, 'Rows per page', `<input type="number" min="1" max="200" data-bh-path="${p}.config.pageSize" data-bh-kind="plain" value="${esc(cf.pageSize)}">`);
    if (list && !cf.vars.visible) h += `<p class="small-label bh-warn">⚠ The table has no State yet.</p><button type="button" class="vw-btn" data-bh-act="table-setup">Set up table State</button><p class="small-label">Creates search, sort, page, pageSize, selectedIds and the derived visibleRows, total, pageCount, selectedCount. You can read them in conditions and texts.</p>`;
    else if (list) h += `<p class="small-label">State: ${['search', 'sort', 'page', 'pageSize', 'selected', 'visible', 'total', 'pages', 'selectedCount'].filter(k => cf.vars[k]).map(k => esc(c.nameOf(cf.vars[k]))).join(', ')}</p>`;
    h += slotRow(c, `${p}.slots.row`, 'row', b.slots.row, true) + slotRow(c, `${p}.slots.header`, 'header', b.slots.header, false);
    if (list) {
        const rowL = c.subLayers(b.slots.row), headL = c.subLayers(b.slots.header);
        h += `<div class="bh-set-title">Columns</div><p class="small-label">Map a layer of the row template to each column (or write “{row.name}” in its text). The header cell is what a click sorts.</p>`
            + cols.map(f => `<div class="bh-col"><b title="${esc(f.key)}">${esc(columnLabel(f))} <small>${esc(f.type)}</small></b>${colSlot(c, `${p}.slots.cell:${f.key}`, 'Cell', b.slots[`cell:${f.key}`], rowL, 'The layer of the row template that shows this column')}${colSlot(c, `${p}.slots.head:${f.key}`, 'Header', b.slots[`head:${f.key}`], headL, 'The layer of the header row for this column')}</div>`).join('');
    }
    return h;
}
function bodySort(c) {
    const rows = c.behaviors.find(b => b.kind === 'has-rows'), heads = rows ? Object.keys(rows.slots).filter(k => k.startsWith('head:')).length : 0;
    return `<p class="small-label">Clicking a mapped header cell cycles ascending → descending → none, by the type of the column (numbers as numbers, dates as dates, options in their order). ${heads ? `${heads} header cell${heads === 1 ? ' is' : 's are'} mapped in Has rows.` : ''}</p>${heads ? '' : '<p class="small-label bh-warn">⚠ No header cell is mapped yet: map them under Columns in Has rows.</p>'}`;
}
function bodySearch(c, s) {
    const { esc } = c, b = s.b, p = s.path, rows = c.behaviors.find(x => x.kind === 'has-rows'), list = rows && c.state.variables.find(v => v.id === rows.config.source);
    return slotRow(c, `${p}.slots.search`, 'search', b.slots.search, true)
        + (rows ? field(esc, 'Search in', `<input data-bh-path="${esc(c.behaviors.indexOf(rows) >= 0 ? `behaviors.${c.behaviors.indexOf(rows)}` : '')}.config.searchColumns" data-bh-kind="searchcols" value="${esc((rows.config.searchColumns || []).join(', '))}" placeholder="all columns" spellcheck="false">`, `Column names separated by commas${list ? ` (${schemaOf(list).map(f => f.key).join(', ')})` : ''}; empty = every column`) : '')
        + '<p class="small-label">Typing in the search box filters the rows (the text can be anywhere in the cell) and goes back to page 1. The box is an Input with Can type.</p>';
}
const plain = (...roles) => (c, s) => roles.map(([r, req]) => slotRow(c, `${s.path}.slots.${r}`, r, s.b.slots[r], !!req)).join('');
const bodyPagination = (c, s) => plain(['prev'], ['next'], ['pageLabel'], ['pageItem'])(c, s) + '<p class="small-label">Page label shows “Page 2 of 5”, or your own text with {page} and {pageCount}. Page number repeats once per page.</p>';
function bodyTabs(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const vars = c.state.variables.filter(v => v.type === 'option' || v.type === 'string');
    return field(esc, 'Active tab State', c.bhSelect(`${p}.config.state`, 'plain', cf.state || '', [['', '— not set up —'], ...vars.map(v => [v.id, `${v.name} (${v.type})`])]), 'The State that holds the active tab. Its options are the tab names.')
        + `<button type="button" class="vw-btn" data-bh-act="tabs-setup">Set up tab State</button>`
        + slotRow(c, `${p}.slots.tab`, 'tab', b.slots.tab, true)
        + slotRow(c, `${p}.slots.label`, 'label', b.slots.label, false)
        + slotRow(c, `${p}.slots.panel`, 'panel', b.slots.panel, true)
        + '<p class="small-label">The tab bar holds one layer per tab, named like the tab. The panel holds one layer per tab with the same name; only the active tab’s panel is shown.</p>';
}
function bodyPager(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const nums = c.state.variables.filter(v => v.type === 'number');
    const pick = (k, label) => field(esc, label, c.bhSelect(`${p}.config.vars.${k}`, 'plain', cf.vars?.[k] || '', [['', '— not set —'], ...nums.map(v => [v.id, `${v.name} (${v.type})`])]));
    return pick('page', 'Page State') + pick('pageSize', 'Page size State') + pick('total', 'Total State')
        + `<button type="button" class="vw-btn" data-bh-act="pager-setup">Set up pager State</button>`
        + slotRow(c, `${p}.slots.prev`, 'prev', b.slots.prev, false)
        + slotRow(c, `${p}.slots.next`, 'next', b.slots.next, false)
        + slotRow(c, `${p}.slots.pageLabel`, 'pageLabel', b.slots.pageLabel, false)
        + slotRow(c, `${p}.slots.pageItem`, 'pageItem', b.slots.pageItem, false)
        + slotRow(c, `${p}.slots.pageSize`, 'pageSize', b.slots.pageSize, false)
        + slotRow(c, `${p}.slots.total`, 'total', b.slots.total, false)
        + '<p class="small-label">The page item repeats once per page (“…” for a gap). Prev and Next are drawn disabled at the edges. The page size button goes 10 → 20 → 50 and back to page 1. To pager a table, pick the table’s own States.</p>';
}
function bodySteps(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const nums = c.state.variables.filter(v => v.type === 'number'), bools = c.state.variables.filter(v => v.type === 'boolean');
    return field(esc, 'Current step State', c.bhSelect(`${p}.config.state`, 'plain', cf.state || '', [['', '— not set up —'], ...nums.map(v => [v.id, `${v.name} (${v.type})`])]), 'The number State with the current step (0 = the first)')
        + `<button type="button" class="vw-btn" data-bh-act="steps-setup">Set up steps State</button>`
        + field(esc, 'Can leave a step when', c.bhSelect(`${p}.config.gate`, 'plain', cf.gate || '', [['', '— always —'], ...bools.map(v => [v.id, `${v.name} (${v.type})`])]), 'A true/false State: while it is false, Next is refused and the current step shows its error look')
        + slotRow(c, `${p}.slots.step`, 'step', b.slots.step, true)
        + slotRow(c, `${p}.slots.prev`, 'prev', b.slots.prev, false)
        + slotRow(c, `${p}.slots.next`, 'next', b.slots.next, false)
        + '<p class="small-label">Each layer of the step row is one step, in order. Its look comes from the states named Upcoming, Active, Completed and Error. Title, description and icon are not connected yet: a step shows its own layers.</p>';
}
function bodyCollapse(c, s) {
    const { esc } = c, b = s.b, p = s.path, cf = b.config;
    const texts = c.state.variables.filter(v => v.type === 'string' || v.type === 'option');
    return field(esc, 'Open section State', c.bhSelect(`${p}.config.state`, 'plain', cf.state || '', [['', '— not set up —'], ...texts.map(v => [v.id, `${v.name} (${v.type})`])]), 'The State that holds the open section (its name, or several names separated by commas)')
        + `<button type="button" class="vw-btn" data-bh-act="collapse-setup">Set up collapse State</button>`
        + field(esc, 'Open', c.bhSelect(`${p}.config.mode`, 'plain', cf.mode || 'accordion', [['accordion', 'One at a time (accordion)'], ['multiple', 'Several at a time']]))
        + slotRow(c, `${p}.slots.section`, 'section', b.slots.section, true)
        + slotRow(c, `${p}.slots.panel`, 'panel', b.slots.panel, true)
        + '<p class="small-label">Each layer of the section row is one section, named like its panel. Clicking a section header opens it; an open section is drawn selected.</p>';
}
const bodySelection = (c, s) => plain(['selectRow', true], ['selectAll'])(c, s) + '<p class="small-label">The header checkbox selects the rows of the current page only. The picks are kept in selectedIds across pages.</p>';
const bodyRowActions = (c, s) => plain(['rowDelete'], ['rowEdit'], ['addButton'], ['bulkDelete'], ['reload'])(c, s);
const bodyDataStates = (c, s) => plain(['empty'], ['emptySearch'], ['loading'])(c, s) + '<p class="small-label">Empty shows when the List has no rows at all, No results when a search finds nothing (Empty is used for both when No results is not mapped).</p>';

function bodyClick(c, s) {
    return `<p class="small-label">${c.esc(s.clickSummary || 'Nothing happens on click yet.')}</p><p class="small-label">Edit what it does in <b>Interaction</b> below.</p>`;
}

const TITLES = { 'has-collapse': bodyCollapse, 'has-steps': bodySteps, 'has-tabs': bodyTabs, 'has-pager': bodyPager, 'has-rows': bodyRows, 'can-sort': bodySort, 'can-search': bodySearch, 'has-pagination': bodyPagination, 'has-selection': bodySelection, 'has-row-actions': bodyRowActions, 'has-data-states': bodyDataStates, 'can-type': bodyCanType, 'has-validation': bodyValidation, 'has-options': bodyOptions, 'opens-popup': bodyPopup, 'shows-items': bodyItems, 'has-loading': bodyLoading, 'show-feedback': bodyFeedback, 'on-click': bodyClick };

// ---------------------------------------------------------------------------------------------------- the whole block
/** The ordered sections: Can type, Has validation, then the stored behaviors in their order, then On click. */
export function capabilitySections(c) {
    const out = [];
    if (c.typeable || c.ib?.typeable) out.push({ kind: 'can-type', id: 'can-type', title: CAPABILITIES['can-type'].label, enabled: !!c.typeable, ib: c.ib, summary: inputSummary('can-type', c.ib), issues: c.ib?.typeable?.frameId ? [] : [{ why: c.guess ? `Using “${c.guess}” as a guess: pick the layer to make it explicit.` : 'Value is not set.' }], toggle: { kind: 'proto', key: 'typeable' }, fixed: true });
    if (c.ib?.validation && (c.ib.validation.required || c.ib.validation.rules || c.ib.validation.trigger || c.hasValidation)) out.push({ kind: 'has-validation', id: 'has-validation', title: CAPABILITIES['has-validation'].label, enabled: !c.ib.validation.off, ib: c.ib, summary: inputSummary('has-validation', c.ib), issues: [], toggle: { kind: 'invert', path: 'input.validation.off' }, fixed: true, canDelete: 'validation' });
    c.behaviors.forEach((b, i) => {
        const issues = slotIssues(b, id => c.layers.some(l => l.id === id));
        out.push({ kind: b.kind, id: b.id, b, title: CAPABILITIES[b.kind].label, enabled: b.enabled, summary: summaryOf(b, c.nameOf), issues, index: i, path: c.isInstance ? `behaviorOverrides.${b.id}` : `behaviors.${i}`, count: c.behaviors.length, typeNote: b.kind === 'show-feedback' ? c.feedbackNote?.(b) : '' });
    });
    if (c.hasClick) out.push({ kind: 'on-click', id: 'on-click', title: CAPABILITIES['on-click'].label, enabled: true, summary: c.clickSummary || 'Does something when it is clicked', issues: [], clickSummary: c.clickSummary, fixed: true, noActions: true });
    return out;
}

/** What the window of a capability shows: why it does not run (when it does not), then its fields. */
export function capabilityBodyHtml(c, s) {
    const { esc } = c, f = TITLES[s.kind];
    withAdvanced(c);
    return `${s.issues.map(i => `<p class="small-label bh-warn">⚠ ${esc(i.why)}</p>`).join('')}${f ? f(c, s) : ''}`;
}
/** "Advanced": rarely used fields stay folded away. */
export function withAdvanced(c) {
    const { esc } = c;
    c.advanced = (key, html) => { const k = `adv:${key}`, on = c.open.has(k); return `<div class="bh-adv"><button type="button" class="bh-adv-btn" data-bh-section="${esc(k)}" aria-expanded="${on}">${on ? '▾' : '▸'} Advanced</button>${on ? `<div class="bh-adv-body">${html}</div>` : ''}</div>`; };
}

/** `only` = the title of one section: just its suggestions (the indexes stay those of the whole list). */
export function suggestionsHtml(c, only = '') {
    const { esc } = c;
    const list = c.suggestions.map((g, i) => ({ g, i })).filter(x => !only || x.g.section === only);
    if (!list.length) return '';
    return `<div class="bh-suggest"><div class="bh-suggest-head"><b>Suggestions</b><small>from this file’s Convention</small><button type="button" class="vw-btn ghost" data-bh-act="accept-all" data-bh-only="${esc(only)}">Accept all</button></div>${list.map(({ g, i }) => `<div class="bh-suggest-row"><span><b>${esc(g.label || SLOT_ROLES[g.role].label)}</b> → “${esc(g.name)}”<small>${esc(g.section)}</small></span><button type="button" class="vw-btn ghost" data-bh-act="accept-slot" data-bh-index="${i}">Accept</button></div>`).join('')}</div>`;
}

export function addPanelHtml(c) {
    const { esc } = c;
    const sug = c.suggestedPreset;
    const chips = PRESET_FAMILIES.map(f => `<div class="bh-preset-row"><small>${esc(f)}</small><div class="bh-chips">${PRESETS.filter(p => p.family === f).map(p => `<button type="button" class="bh-chip-btn ${p.id === sug ? 'suggested' : ''}" data-bh-act="add-preset" data-bh-preset="${p.id}" title="${esc(p.caps.map(x => CAPABILITIES[x.kind].label).join(' + '))}">${esc(p.label)}</button>`).join('')}</div></div>`).join('');
    const groups = CAPABILITY_GROUPS.map(g => {
        const items = Object.entries(CAPABILITIES).filter(([, d]) => d.group === g).map(([k]) => ({ k, a: c.applies(k) }));
        const ok = items.filter(i => i.a.ok);
        return ok.length ? `<div class="bh-preset-row"><small>${esc(g)}</small><div class="bh-chips">${ok.map(i => `<button type="button" class="bh-chip-btn" data-bh-act="add-cap" data-bh-kind="${i.k}" title="${esc(CAPABILITIES[i.k].blurb)}">${esc(CAPABILITIES[i.k].label)}</button>`).join('')}</div></div>` : '';
    }).join('');
    const hidden = Object.keys(CAPABILITIES).map(k => ({ k, a: c.applies(k) })).filter(i => !i.a.ok && i.a.reason !== 'Already added.');
    return `<div class="bh-add-panel"><div class="bh-add-title">Start from${sug ? ` <small>suggested for “${esc(c.node.name)}”</small>` : ''}</div>${chips}<div class="bh-add-title">Or add one capability</div>${groups || '<p class="small-label">Everything that fits is already added.</p>'}${hidden.length ? `<p class="small-label" title="${esc(hidden.map(i => `${CAPABILITIES[i.k].label}: ${i.a.reason}`).join('\n'))}">${hidden.length} more do not fit this component (hover to see why).</p>` : ''}</div>`;
}
