// Behavior tab, section "Bind to State": which layers read which state variable. Only draws; the rules (what a value looks
// like as text, what counts as "visible") are in @midas/builder-core (state.js).
import { STATE_ORDER } from './behavior.js';

const TEXT_TYPES = new Set(['string', 'number', 'boolean', 'option', 'date']);

/**
 * { n, state, layers, esc, bhSelect, canMode } → html. `bhSelect(path, kind, value, options)` is the Behavior tab's select;
 * its path is written to `n.stateBind` by bhWrite:  self.visible · self.mode · layers.<layer id>.text | visible
 */
export function stateBindHtml({ n, state, layers, esc, bhSelect, canMode }) {
    const vars = state.variables, derived = state.derived;
    if (!vars.length && !derived.length)
        return '<div class="bh-empty"><b>No State yet</b><span>Create State in Variables → State, then bind layers to it here.</span></div>';
    const bind = n.stateBind || {}, known = new Set([...vars, ...derived].map(v => v.id));
    const label = v => `${v.name}${v.scope === 'app' ? ' (app)' : ''}`;
    const all = [...vars.map(v => [v.id, label(v)]), ...derived.map(d => [d.id, `${d.name} (derived)`])];
    const textual = [...vars.filter(v => TEXT_TYPES.has(v.type)).map(v => [v.id, label(v)]), ...vars.filter(v => v.type === 'list').map(v => [v.id, `${v.name} (row count)`]), ...derived.map(d => [d.id, `${d.name} (derived)`])];
    const options = vars.filter(v => v.type === 'option').map(v => [v.id, label(v)]);
    const pick = (path, current, list, none = '— not bound —') => bhSelect(path, 'plain', current || '', [['', none], ...list]);
    const warn = id => (id && !known.has(id) ? '<small class="bh-warn">This State no longer exists.</small>' : '');
    let h = '';
    const self = bind.self || {};
    h += `<div class="bh-bind"><div class="bh-bind-name">This layer</div><div class="bh-bind-cells"><label class="bh-bind-cell"><small>Visible when</small>${pick('stateBind.self.visible', self.visible, all)}${warn(self.visible)}</label>`;
    if (canMode) {
        h += `<label class="bh-bind-cell"><small>Look (state mode)</small>${pick('stateBind.self.mode', self.mode, options, options.length ? '— not bound —' : 'No Option state yet')}${warn(self.mode)}</label>`;
    }
    h += '</div>';
    const modeVar = self.mode && vars.find(v => v.id === self.mode);
    if (modeVar) {
        const unknown = (modeVar.options || []).filter(o => !STATE_ORDER.includes(String(o).toLowerCase()));
        if (unknown.length) h += `<p class="small-label bh-warn">These values are not a state the component knows: ${esc(unknown.join(', '))}. Use names like ${esc(STATE_ORDER.slice(0, 6).join(', '))}.</p>`;
    }
    h += '</div>';
    const rows = layers.map(l => {
        const b = bind.layers?.[l.id] || {};
        const cells = (l.type === 'text' ? `<label class="bh-bind-cell"><small>Text</small>${pick(`stateBind.layers.${l.id}.text`, b.text, textual)}${warn(b.text)}</label>` : '')
            + `<label class="bh-bind-cell"><small>Visible when</small>${pick(`stateBind.layers.${l.id}.visible`, b.visible, all)}${warn(b.visible)}</label>`;
        return `<div class="bh-bind"><div class="bh-bind-name" title="${esc(l.name)}">${esc(l.name || l.type)}</div><div class="bh-bind-cells">${cells}</div></div>`;
    }).join('');
    h += rows ? `<div class="bh-binds">${rows}</div>` : '';
    return `<div class="bh-binds">${h}</div>`;
}
