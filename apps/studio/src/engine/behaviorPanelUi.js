// Behavior tab, the panel: compact lists (a header with "+", then one row per item) and the shell of the floating window the items are
// edited in. Only draws. The editors that go inside the window are in capabilitiesUi.js, rulesUi.js, behaviorUi.js and midas.js.

/** The icon of each kind of row (names of the editor's icon set). */
export const ROW_ICON = {
    interaction: 'play', 'can-type': 'text', 'has-validation': 'checkSquare', 'has-options': 'layers', 'opens-popup': 'panel', 'shows-items': 'grid',
    'has-rows': 'grid', 'has-tabs': 'layers', 'has-collapse': 'layers', 'has-pager': 'arrowRight', 'can-sort': 'variant', 'can-search': 'search', 'has-pagination': 'arrowRight', 'has-selection': 'checkSquare', 'has-row-actions': 'trash', 'has-data-states': 'layers',
    'has-loading': 'rotate', 'show-feedback': 'sparkles', state: 'variant', repeat: 'grid', bind: 'link',
};

/**
 * One row of a list: icon, name, one-line summary, a warning mark, and (on hover) an enable toggle and a remove button.
 * `open` = "kind:key" of the window the row opens. `toggle` = { path } (a bool written with data-bh-path) or { proto }.
 * `remove` = html of the remove button (it carries its own data-bh-act).
 */
export function itemRow({ esc, icon, ic, name, summary, warn = '', open = '', on = true, toggle = null, remove = '', note = '', active = false }) {
    const tg = toggle
        ? (toggle.path
            ? `<input type="checkbox" data-bh-path="${esc(toggle.path)}" data-bh-kind="bool"${toggle.invert ? ' data-bh-invert="1"' : ''} ${on ? 'checked' : ''} aria-label="${esc(name)} on" title="Turn on or off">`
            : `<input type="checkbox" data-proto="${esc(toggle.proto)}" ${on ? 'checked' : ''} aria-label="${esc(name)} on" title="Turn on or off">`)
        : '';
    const acts = tg || remove ? `<span class="bh-item-acts">${tg}${remove}</span>` : '';
    const tag = open ? `role="button" tabindex="0" data-bhw-open="${esc(open)}"` : '';
    return `<div class="bh-item ${on ? '' : 'off'} ${open ? '' : 'static'} ${active ? 'active' : ''}" ${tag}><span class="bh-item-ic">${icon(ic, 14)}</span><span class="bh-item-txt"><b title="${esc(name)}">${esc(name)}</b><small title="${esc(summary)}">${esc(summary)}</small></span>${warn ? `<span class="bh-item-warn" title="${esc(warn)}" aria-label="${esc(warn)}">⚠</span>` : ''}${acts}</div>${note ? `<p class="bh-item-note">${esc(note)}</p>` : ''}`;
}

/** A section like the Design tab's: a header with its buttons (a "+" first on the right) and rows below. */
export function sectionBlock({ esc, icon, title, add = '', addTitle = '', extra = '', rows = [], empty = '' }) {
    const plus = add ? `<button type="button" class="icon-button small" data-bhw-open="${esc(add)}" title="${esc(addTitle || 'Add')}" aria-label="${esc(addTitle || 'Add')}">${icon('plus', 14)}</button>` : '';
    return `<section class="inspector-section bh-sec"><div class="section-heading"><span>${esc(title)}</span><span class="bh-sec-acts">${extra}${plus}</span></div>${rows.length ? `<div class="bh-items">${rows.join('')}</div>` : empty ? `<p class="bh-sec-empty">${esc(empty)}</p>` : ''}</section>`;
}

/** The floating window: a title bar (back arrow when drilled in, name, close) over a body that scrolls on its own. */
export function windowHtml({ esc, icon, title, back = false, body }) {
    return `<div class="vw-title bh-win-title" data-vw-drag><span>${back ? `<button type="button" class="vw-mini" data-bhw-back title="Back" aria-label="Back">${icon('arrowLeft', 14)}</button>` : ''}<b title="${esc(title)}">${esc(title)}</b></span><span class="vw-title-actions"><button type="button" class="vw-mini" data-bhw-close title="Close (Esc)" aria-label="Close">${icon('close', 12)}</button></span></div><div class="bh-win-body">${body}</div>`;
}

/** The window the item `kind:key` opens, split. */
export const splitOpen = s => { const i = String(s || '').indexOf(':'); return i < 0 ? { kind: String(s || ''), key: '' } : { kind: s.slice(0, i), key: s.slice(i + 1) }; };
