// Behavior settings window (per file): three tabs. Slots and States are tables of a role / state and the layer or mode names it
// accepts, as small tokens; Feedback maps each kind of "Show feedback" to the user's own component. Only draws, plus the pure edit
// of a Convention (so it can be tested).
import { DEFAULT_CONVENTION, cleanConvention, normalizeName, expectsType, mappingWarns } from './behavior.js';

export const SETTINGS_TABS = [['slots', 'Slots'], ['states', 'States'], ['feedback', 'Feedback']];
const SHOWN = 3;
const HELP = {
    slots: 'Layers named like these are suggested for the role. Nothing is mapped until you accept.',
    states: 'Modes of a “… states” collection named like these stand for the state.',
    feedback: 'The component that draws each kind of “Show feedback”. None = Preview’s built-in one.',
};

/** One edit of a Convention: { op: 'add' | 'remove', group: 'slots' | 'states', key, word } → a new, complete Convention. */
export function editConvention(conv, { op, group, key, word }) {
    const next = cleanConvention(conv);
    if (!next[group] || !(key in next[group])) return next;
    const w = normalizeName(word);
    const list = next[group][key].filter(x => x !== w);
    if (op === 'add' && w) list.push(w);
    // A role with no name at all falls back to the default ones, so it never stops being suggested by accident.
    next[group][key] = list;
    return cleanConvention(next);
}
/** Reset one part of a Convention to the defaults; the feedback mapping is yours and is reset only with its own tab. */
export function resetConvention(conv, tab) {
    const next = cleanConvention(conv);
    if (tab === 'slots') next.slots = structuredClone(DEFAULT_CONVENTION.slots);
    else if (tab === 'states') next.states = structuredClone(DEFAULT_CONVENTION.states);
    else if (tab === 'feedback') next.feedback = structuredClone(DEFAULT_CONVENTION.feedback);
    return cleanConvention(next);
}
const isDefault = (group, key, list) => JSON.stringify(list) === JSON.stringify(DEFAULT_CONVENTION[group][key]);

/** Rows of the Slots / States table that match the search (a role, or one of its names). */
export function tokenRows(conv, group, q = '') {
    const s = normalizeName(q);
    return Object.keys(conv[group]).filter(k => !s || normalizeName(k).includes(s) || conv[group][k].some(w => w.includes(s)));
}

function rowsHtml(c, ui, group) {
    const { esc } = c, conv = c.convention, keys = tokenRows(conv, group, ui.q);
    if (!keys.length) return `<p class="bhs-none">Nothing matches “${esc(ui.q)}”.</p>`;
    return keys.map(k => {
        const id = `${group}.${k}`, list = conv[group][k], open = ui.expanded.has(id), shown = open ? list : list.slice(0, SHOWN), more = list.length - shown.length;
        const tok = shown.map(w => `<button type="button" class="bhs-tok" data-bhs-rm="${esc(id)}|${esc(w)}" title="${esc(w)}: click to remove" aria-label="Remove ${esc(w)}"><span>${esc(w)}</span><i>×</i></button>`).join('');
        const add = ui.adding === id
            ? `<input class="bhs-new" data-bhs-new="${esc(id)}" placeholder="name" spellcheck="false" aria-label="New name for ${esc(k)}">`
            : `<button type="button" class="bhs-tok add" data-bhs-add="${esc(id)}" title="Add a name" aria-label="Add a name for ${esc(k)}">+</button>`;
        const moreBtn = more > 0 ? `<button type="button" class="bhs-tok more" data-bhs-more="${esc(id)}" title="${esc(list.slice(SHOWN).join(', '))}">+${more}</button>` : open && list.length > SHOWN ? `<button type="button" class="bhs-tok more" data-bhs-more="${esc(id)}">less</button>` : '';
        return `<div class="bhs-row ${isDefault(group, k, list) ? '' : 'custom'}"><span class="bhs-role" title="${esc(k)}">${esc(k)}</span><span class="bhs-toks">${tok}${moreBtn}${add}</span></div>`;
    }).join('');
}

/** The rows of the Slots / States table (redrawn alone while typing in the search box). */
export const tokenTableHtml = (c, ui) => rowsHtml(c, ui, ui.tab);

/**
 * Type mapping of one feedback component (of kind `kind`): each level, its value (explicit, by name, or a pick). A component with no
 * type dimension has no block at all. Only Alert / Message / Notification warn about it; Modal, Drawer and Popconfirm keep it optional.
 */
function typeMapHtml(c, id, kind) {
    const { esc } = c, info = c.feedbackTypes?.(id);
    if (!info) return '<p class="small-label bh-warn">The component of this kind is missing from the file.</p>';
    if (!info.hasBehavior) return `<p class="small-label bh-warn">“${esc(info.name)}” has no Show feedback behavior yet: add it in its Behavior tab, then map the types here.</p>`;
    if (!info.hasType) return '<p class="small-label">No type: it always draws its own look.</p>';
    const LEVELS = ['success', 'error', 'warning', 'info'], opts = [['', 'Auto (by name)'], ...info.values.map(v => [v, v])], warn = mappingWarns(kind, info.levels);
    const rows = LEVELS.map(l => {
        const s = info.levels[l], resolved = s.source === 'explicit' || s.source === 'name', mark = warn && !resolved ? '⚠ ' : '';
        const status = s.source === 'explicit' ? 'mapped' : s.source === 'name' ? `by name: ${esc(s.value)}` : s.source === 'ambiguous' ? `${mark}ambiguous: ${esc(s.options.join(', '))} — pick one` : s.source === 'missing' ? `${mark}the mapped value is gone — pick one` : `${mark}no match — pick a value`;
        const sel = `<select aria-label="${esc(l)} type" data-bh-act="type-map" data-type-comp="${esc(id)}" data-type-level="${l}">${opts.map(([v, lab]) => `<option value="${esc(v)}" ${(info.explicit[l] || '') === v ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
        return `<div class="bhs-type-row ${warn && !resolved ? 'bh-warn' : ''}"><b>${l}</b> ${sel}<small>${status}</small></div>`;
    }).join('');
    const body = `${rows}<button type="button" class="vw-btn ghost" data-bh-act="type-map-accept" data-type-comp="${esc(id)}">Accept all</button>`;
    return expectsType(kind) ? `<div class="bhs-typemap"><div class="small-label">Type mapping</div>${body}</div>`
        : `<details class="bhs-typemap"><summary class="small-label">Type (optional)</summary>${body}</details>`;
}
function feedbackHtml(c) {
    const { esc } = c, conv = c.convention;
    return Object.keys(conv.feedback).map(k => {
        const label = k[0].toUpperCase() + k.slice(1), mapped = conv.feedback[k];
        return `<div class="bhs-fb"><div class="bhs-fb-head"><b>${esc(label)}</b>${mapped ? '' : '<span class="bhs-badge" title="No component is mapped: Preview draws its built-in one">built-in</span>'}</div>${c.componentButton(`convention.feedback.${k}`, mapped, 'Component')}${mapped ? typeMapHtml(c, mapped, k) : ''}</div>`;
    }).join('');
}

/** The whole window body. `ui` = { tab, q, adding, expanded }. c needs { esc, convention, componentButton }. */
export function settingsWindowHtml(c, ui) {
    const { esc } = c, tab = ui.tab;
    const tabs = `<div class="bhs-tabs" role="tablist">${SETTINGS_TABS.map(([id, l]) => `<button type="button" role="tab" class="${id === tab ? 'on' : ''}" aria-selected="${id === tab}" data-bhs-tab="${id}">${l}</button>`).join('')}</div>`;
    const search = tab === 'feedback' ? '' : `<input class="bhs-search" type="search" data-bhs-q placeholder="Search ${tab}" value="${esc(ui.q)}" spellcheck="false" aria-label="Search ${tab}">`;
    const body = tab === 'feedback' ? feedbackHtml(c) : `<div class="bhs-rows" data-bhs-rows>${rowsHtml(c, ui, tab)}</div>`;
    return `<div class="bhs">${tabs}<p class="bhs-help">${esc(HELP[tab])}</p>${search}${body}<div class="bhs-foot"><button type="button" class="vw-btn ghost" data-bh-act="reset-convention" data-bh-scope="${tab}">Reset ${tab} to defaults</button></div></div>`;
}
