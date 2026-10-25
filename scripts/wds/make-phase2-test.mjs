// A file for checking Phase 2 by hand: Login (invalid input, wrong credentials x5, account disabled, success), Home (App vs Page
// state, On page load) and Cart (list operations, derived total shown through a text template, visible-when, Look).
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const V = ref => ({ op: 'var', ref }), L = value => ({ op: 'value', value });
const nodes = [];
const add = (...n) => nodes.push(...n);

// ---- components ----
add(frame('inMaster', null, 'Input Field', { component: true, x: -600, y: 0, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }),
    text('inMasterT', 'inMaster', 'Value', 'Email', { fill: '#777777' }));
add(frame('btnMaster', null, 'Button', { component: true, x: -600, y: 100, w: 140, h: 40, layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vFill' } }),
    text('btnMasterT', 'btnMaster', 'Label', 'Button', { fill: '#ffffff', fontWeight: 600 }));
const field = (id, parentId, label, inputType) => [
    frame(id, parentId, 'Input Field', { isInstance: true, sourceId: 'inMaster', typeable: true, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', overrides: { layoutSizingH: true }, inputBehavior: { typeable: { frameId: id + 'T', inputType }, validation: { required: true, trigger: 'submit' } } }),
    text(id + 'T', id, 'Value', label, { sourceId: 'inMasterT', fill: '#777777', overrides: { text: true } }),
];
const button = (id, parentId, label, extra = {}) => [
    frame(id, parentId, 'Button', { isInstance: true, sourceId: 'btnMaster', layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vFill' }, varModes: { cStates: 'mDefault' }, ...extra }),
    text(id + 'T', id, 'Label', label, { sourceId: 'btnMasterT', fill: '#ffffff', fontWeight: 600, overrides: { text: true } }),
];

// ---- Login ----
add(frame('login', null, 'Login', { w: 420, h: 560, fill: '#ffffff', layout: 'vertical', gap: 12, padding: 24, clip: true,
    stateBind: { layers: { attemptsText: { text: 'template' }, draftText: { text: 'template' } } } }),
    text('title', 'login', 'Title', 'Sign in', { fontSize: 24, fontWeight: 700 }),
    ...field('fEmail', 'login', 'Email', 'email'),
    ...field('fPass', 'login', 'Password', 'password'),
    ...button('btnLogin', 'login', 'Log in', {
        interactions: [
            { id: 'ia', trigger: 'onClick',
              if: { op: 'and', args: [{ op: 'valid', field: 'fEmail' }, { op: 'valid', field: 'fPass' }, { op: 'compare', cmp: 'lt', a: V('attempts'), b: L(5) }] },
              actions: [{ type: 'request', delay: 600 }],
              rules: { items: [
                  { id: 'r1', name: 'Account disabled', if: { op: 'equals', a: V('$response'), b: L('Account disabled') }, actions: [{ type: 'show-feedback', kind: 'modal', level: 'warning', title: 'Account disabled', message: 'Your account is disabled. Contact the admin.', blocking: true }] },
                  { id: 'r2', name: 'Fifth wrong attempt', if: { op: 'and', args: [{ op: 'equals', a: V('$responseKind'), b: L('error') }, { op: 'compare', cmp: 'gte', a: V('attempts'), b: L(4) }] }, actions: [{ type: 'set-state', variableId: 'attempts', op: 'increment' }, { type: 'show-feedback', kind: 'modal', level: 'error', title: 'Locked', message: 'Too many attempts ({Attempts} of 5). Try again later.', blocking: true }] },
                  { id: 'r3', name: 'Wrong credentials', if: { op: 'equals', a: V('$responseKind'), b: L('error') }, actions: [{ type: 'set-state', variableId: 'attempts', op: 'increment' }, { type: 'show-feedback', kind: 'alert', level: 'error', message: 'Wrong email or password. Attempt {Attempts} of 5.', duration: 4000 }] },
                  { id: 'r4', name: 'Success', if: { op: 'equals', a: V('$responseKind'), b: L('success') }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'success', message: 'Welcome back!', duration: 2500 }, { type: 'navigate', targetFrameId: 'home' }] },
              ] } },
            { id: 'ib', trigger: 'onClick', actions: [], rules: { items: [
                  { id: 'r5', name: 'Invalid input', if: { op: 'or', args: [{ op: 'invalid', field: 'fEmail' }, { op: 'invalid', field: 'fPass' }] }, actions: [{ type: 'validate-field', fieldId: '' }, { type: 'show-feedback', kind: 'alert', level: 'error', message: 'Please fix the highlighted fields.', duration: 3000 }] },
                  { id: 'r6', name: 'AC-3 Lockout', if: { op: 'compare', cmp: 'gte', a: V('attempts'), b: L(5) }, actions: [{ type: 'show-feedback', kind: 'modal', level: 'error', title: 'Locked', message: 'This device is locked after {Attempts} attempts.', blocking: true }] },
              ] } },
        ] }),
    text('attemptsText', 'login', 'Attempts', 'Attempts: {Attempts} of 5', { fill: '#555555' }),
    text('draftText', 'login', 'Draft', 'Draft: {Draft}', { fill: '#555555' }),
);
// ---- Home ----
add(frame('home', null, 'Home', { x: 500, w: 420, h: 560, fill: '#F7F7FA', layout: 'vertical', gap: 12, padding: 24, clip: true, stateBind: { layers: { visitsText: { text: 'template' }, homeDraft: { text: 'template' } } },
    interactions: [{ id: 'il', trigger: 'onLoad', actions: [{ type: 'set-state', variableId: 'visits', op: 'increment' }] }] }),
    text('homeTitle', 'home', 'Title', 'Welcome', { fontSize: 24, fontWeight: 700 }),
    text('visitsText', 'home', 'Visits', 'Visits: {Visits}'),
    text('homeDraft', 'home', 'Draft', 'Draft: {Draft}'),
    ...button('btnToLogin', 'home', 'Back to login', { interactions: [{ id: 'n1', trigger: 'onClick', actions: [{ type: 'navigate', targetFrameId: 'login' }] }] }),
    ...button('btnToCart', 'home', 'Open cart', { interactions: [{ id: 'n2', trigger: 'onClick', actions: [{ type: 'navigate', targetFrameId: 'cart' }] }] }),
);
// ---- Cart ----
add(frame('cart', null, 'Cart', { x: 1000, w: 420, h: 560, fill: '#ffffff', layout: 'vertical', gap: 12, padding: 24, clip: true, stateBind: { layers: { totalText: { text: 'template' }, emptyText: { visible: 'isEmpty' } }, self: {} } }),
    text('cartTitle', 'cart', 'Title', 'Cart', { fontSize: 24, fontWeight: 700 }),
    text('totalText', 'cart', 'Total', 'Total: Rp {total} for {Item count} items', { fontWeight: 700 }),
    text('emptyText', 'cart', 'Empty', 'Your cart is empty', { fill: '#999999' }),
    frame('cartList', 'cart', 'Items', { layout: 'vertical', gap: 6, padding: 0, layoutSizingH: 'fill', layoutSizingV: 'hug', repeat: { variableId: 'cartItems', bind: { rowName: { text: 'name' }, rowPrice: { text: 'price' } } } }),
    frame('row', 'cartList', 'Row', { layout: 'horizontal', gap: 8, padding: 10, fill: '#F1F1F4', radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', primaryAlign: 'start' }),
    text('rowName', 'row', 'Name', 'Item'), text('rowPrice', 'row', 'Price', '0'),
    ...button('btnAdd', 'cart', 'Add Tea (10)', {
        stateBind: { self: { mode: 'btnLook' } },
        interactions: [{ id: 'c1', trigger: 'onClick', actions: [{ type: 'list-add', listId: 'cartItems', row: { name: L('Tea'), price: L(10), qty: L(1) } }] }] }),
    ...button('btnAddCake', 'cart', 'Add Cake (25)', { interactions: [{ id: 'c2', trigger: 'onClick', actions: [{ type: 'list-add', listId: 'cartItems', row: { name: L('Cake'), price: L(25), qty: L(1) } }] }] }),
    ...button('btnRemoveTea', 'cart', 'Remove Tea', { interactions: [{ id: 'c3', trigger: 'onClick', actions: [{ type: 'list-delete', listId: 'cartItems', where: { field: 'name', cmp: 'eq', value: L('Tea') } }] }] }),
    ...button('btnDouble', 'cart', 'Double prices', { interactions: [{ id: 'c4', trigger: 'onClick', actions: [{ type: 'list-update', listId: 'cartItems', set: { price: L(20) } }] }] }),
    ...button('btnClear', 'cart', 'Clear cart', { interactions: [{ id: 'c5', trigger: 'onClick', actions: [{ type: 'show-feedback', kind: 'popconfirm', level: 'warning', message: 'Remove all {Item count} items?', onConfirm: [{ type: 'list-clear', listId: 'cartItems' }, { type: 'show-feedback', kind: 'message', level: 'success', message: 'Cart cleared' }] }] }] }),
);

const state = {
    variables: [
        { id: 'attempts', name: 'Attempts', type: 'number', initial: 0, scope: 'page' },
        { id: 'draft', name: 'Draft', type: 'string', initial: '', scope: 'page' },
        { id: 'visits', name: 'Visits', type: 'number', initial: 0, scope: 'app' },
        { id: 'btnLook', name: 'Add button look', type: 'option', options: ['default', 'disabled'], initial: 'default', scope: 'page' },
        { id: 'cartItems', name: 'Cart', type: 'list', schema: [{ key: 'name', type: 'string' }, { key: 'price', type: 'number' }, { key: 'qty', type: 'number' }], initial: [{ name: 'Tea', price: 10, qty: 1 }], scope: 'page' },
    ],
    derived: [
        { id: 'total', name: 'total', expr: { op: 'sum', list: V('cartItems'), field: 'price' } },
        { id: 'itemCount', name: 'Item count', expr: { op: 'count', list: V('cartItems') } },
        { id: 'isEmpty', name: 'is cart empty', expr: { op: 'isEmpty', of: V('cartItems') } },
    ],
    scenarios: [{ id: 'ok', name: 'Success', kind: 'success' }, { id: 'wrong', name: 'Wrong credentials', kind: 'error' }, { id: 'dis', name: 'Account disabled', kind: 'error' }],
};
const doc = {
    format: 'midas', version: 1, behaviorVersion: 2, name: 'Phase 2 test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    state,
    variables: {
        collections: [{ id: 'cStates', name: 'Button states', modes: [{ id: 'mDefault', name: 'Default' }, { id: 'mDisabled', name: 'Disabled' }], groups: [] }],
        items: [{ id: 'vFill', collectionId: 'cStates', name: 'button/fill', type: 'color', description: '', hidden: false, values: { mDefault: '#0058CA', mDisabled: '#B5B5BF' } }],
    },
};
fs.writeFileSync(process.argv[2] || 'phase2-test.midas', JSON.stringify(doc));
