// Gap checks for Phase 2: On search, On open / close, Drawer and Message feedback, a long-lived toast, nested conditions.
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const V = ref => ({ op: 'var', ref }), L = value => ({ op: 'value', value });
const nodes = [];
const add = (...n) => nodes.push(...n);
add(frame('inMaster', null, 'Input Field', { component: true, x: -600, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }), text('inMasterT', 'inMaster', 'Value', 'Search', { fill: '#777777' }));
add(frame('btnMaster', null, 'Button', { component: true, x: -600, y: 100, layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug' }), text('btnMasterT', 'btnMaster', 'Label', 'Button', { fill: '#fff', fontWeight: 600 }));
add(frame('menuMaster', null, 'Menu', { component: true, x: -600, y: 200, w: 180, h: 90, layout: 'vertical', padding: 8, gap: 4, fill: '#fff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }), text('menuT1', 'menuMaster', 'Item', 'Profile'), text('menuT2', 'menuMaster', 'Item', 'Sign out'));
const btn = (id, parentId, label, extra = {}) => [frame(id, parentId, 'Button', { isInstance: true, sourceId: 'btnMaster', layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra }), text(id + 'T', id, 'Label', label, { sourceId: 'btnMasterT', fill: '#fff', fontWeight: 600, overrides: { text: true } })];
add(frame('g', null, 'Gaps', { w: 420, h: 640, fill: '#fff', layout: 'vertical', gap: 12, padding: 24, clip: true, stateBind: { layers: { counts: { text: 'template' } } } }),
    frame('fSearch', 'g', 'Input Field', { isInstance: true, sourceId: 'inMaster', typeable: true, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#fff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', overrides: { layoutSizingH: true },
        inputBehavior: { typeable: { frameId: 'fSearchT', inputType: 'search' }, validation: { trigger: 'blur' } },
        interactions: [{ id: 's1', trigger: 'onSearch', actions: [{ type: 'set-state', variableId: 'searches', op: 'increment' }, { type: 'show-feedback', kind: 'message', level: 'info', message: 'Searched {Searches} time(s)', duration: 6000 }] }] }),
    text('fSearchT', 'fSearch', 'Value', 'Search', { sourceId: 'inMasterT', fill: '#777', overrides: { text: true } }),
    ...btn('btnMenu', 'g', 'Open menu', { interactions: [
        { id: 'o1', trigger: 'onClick', actions: [{ type: 'open-dropdown', targetComponentId: 'menuMaster', position: 'bottom-start' }] },
        { id: 'o2', trigger: 'onOpenChange', actions: [{ type: 'set-state', variableId: 'toggles', op: 'increment' }] }] }),
    ...btn('btnDrawer', 'g', 'Show drawer', { interactions: [{ id: 'd1', trigger: 'onClick', actions: [{ type: 'show-feedback', kind: 'drawer', level: 'info', title: 'Details', message: 'Drawer opened {Toggles} toggles in.', blocking: false }] }] }),
    ...btn('btnMessage', 'g', 'Show message', { interactions: [{ id: 'm1', trigger: 'onClick', actions: [{ type: 'show-feedback', kind: 'message', level: 'success', message: 'Saved!', duration: 8000 }, { type: 'show-feedback', kind: 'alert', level: 'warning', title: 'Heads up', message: 'This toast stays 8 seconds.', duration: 8000 }] }] }),
    ...btn('btnCond', 'g', 'Nested rule', { interactions: [{ id: 'r1', trigger: 'onClick', actions: [], rules: { items: [{ id: 'a', name: 'Both true', if: { op: 'and', args: [{ op: 'or', args: [{ op: 'compare', cmp: 'gte', a: V('searches'), b: L(1) }, { op: 'compare', cmp: 'gte', a: V('toggles'), b: L(1) }] }, { op: 'not', arg: { op: 'isEmpty', of: V('searches') } }] }, actions: [{ type: 'show-feedback', message: 'ok' }] }] } }] }),
    text('counts', 'g', 'Counts', 'Searches: {Searches} · Toggles: {Toggles}'));
const doc = { format: 'midas', version: 1, behaviorVersion: 2, name: 'Gaps test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    state: { variables: [{ id: 'searches', name: 'Searches', type: 'number', initial: 0, scope: 'page' }, { id: 'toggles', name: 'Toggles', type: 'number', initial: 0, scope: 'page' }], derived: [] },
    variables: { collections: [], items: [] } };
fs.writeFileSync(process.argv[2] || 'gaps-test.midas', JSON.stringify(doc));
