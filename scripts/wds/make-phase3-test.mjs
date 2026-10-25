// Phase 3 by hand: a form with an Input (email rules), a multiple Select that opens a Dropdown Menu with search, a Button that checks
// the form, a Button that runs a request (loading mode), feedback drawn by the file's own Alert and Modal, and the things that must warn
// (a Select with nothing mapped, a feedback kind with no component).  node scripts/wds/make-phase3-test.mjs <out.midas>
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const V = ref => ({ op: 'var', ref }), L = value => ({ op: 'value', value });
const nodes = [];
const add = (...n) => nodes.push(...n);
const ov = { overrides: { text: true } };

// ---------------- masters ----------------
// Input: one text layer (the placeholder, which is also where the typing goes), an error look from "Input states"
add(frame('inM', null, 'Input', { component: true, x: -900, y: 0, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug', vars: { stroke: 'vStroke' }, varModes: { cInput: 'mInDefault' } }), text('inMT', 'inM', 'Placeholder', 'Email', { fill: '#888888' }));
// Button: a loading look from "Button states"
add(frame('btnM', null, 'Button', { component: true, x: -900, y: 100, layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' } }), text('btnMT', 'btnM', 'Label', 'Button', { fill: '#ffffff', fontWeight: 600 }));
// Menu Item: default / hover / selected / disabled
add(frame('itemM', null, 'Menu Item', { component: true, x: -900, y: 200, layout: 'horizontal', padT: 8, padB: 8, padL: 12, padR: 12, fill: '#ffffff', radius: 6, layoutSizingH: 'fill', layoutSizingV: 'hug', vars: { fill: 'vItemFill' }, varModes: { cItem: 'mItemDefault' } }), text('itemMT', 'itemM', 'Label', 'Option', { fill: '#111111' }));
// Dropdown Menu: Search, one Item (repeated per option), Empty
add(frame('ddM', null, 'Dropdown Menu', { component: true, x: -900, y: 300, w: 300, layout: 'vertical', gap: 2, padding: 6, fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug',
    behaviors: [{ id: 'bdd', kind: 'shows-items', enabled: true, slots: { item: 'ddItem', label: 'ddItemT', search: 'ddSearch', empty: 'ddEmpty' }, config: {} }] }),
    frame('ddSearch', 'ddM', 'Search', { layout: 'horizontal', padding: 8, fill: '#F4F4F7', radius: 6, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 280 }), text('ddSearchT', 'ddSearch', 'Hint', 'Search…', { fill: '#999999' }),
    frame('ddItem', 'ddM', 'Menu Item', { isInstance: true, sourceId: 'itemM', layout: 'horizontal', padT: 8, padB: 8, padL: 12, padR: 12, fill: '#ffffff', radius: 6, layoutSizingH: 'fill', layoutSizingV: 'hug', vars: { fill: 'vItemFill' }, varModes: { cItem: 'mItemDefault' } }), text('ddItemT', 'ddItem', 'Label', 'Option', { sourceId: 'itemMT', fill: '#111111', ...ov }),
    text('ddEmpty', 'ddM', 'Empty', 'No results', { fill: '#999999', x: 0 }));
// Select (multiple): chips, a placeholder, an arrow
const selMaster = (id, name, extra, withSlots) => [
    frame(id, null, name, { component: true, x: -900, y: 500, w: 300, layout: 'horizontal', gap: 6, padding: 8, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug', vars: { stroke: 'vStroke' }, varModes: { cInput: 'mInDefault' }, ...extra }),
    frame(id + 'Chips', id, 'Chips', { layout: 'horizontal', gap: 4, padding: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' }),
    frame(id + 'Chip', id + 'Chips', 'Chip', { layout: 'horizontal', gap: 4, padT: 2, padB: 2, padL: 8, padR: 6, fill: '#E6F0FF', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', counterAlign: 'center' }),
    text(id + 'ChipT', id + 'Chip', 'Tag', 'Tag', { fontSize: 12, fill: '#0058CA' }), frame(id + 'Rm', id + 'Chip', 'Remove', { w: 12, h: 12, fill: '#9BB6E0', radius: 6 }),
    text(id + 'Ph', id, 'Placeholder', 'Choose fruits', { fill: '#888888' }), text(id + 'Ar', id, 'Arrow', '⌄', { fill: '#888888' }),
];
add(...selMaster('selM', 'Select', {
    inputBehavior: { validation: { rules: { required: true, min: 2 }, trigger: 'change' } },
    behaviors: [
        { id: 'bo', kind: 'has-options', enabled: true, slots: { placeholder: 'selMPh', chip: 'selMChip', remove: 'selMRm' }, config: { mode: 'multiple', showSearch: true, bindTo: 'fruits', options: [{ value: 'apple', label: 'Apple' }, { value: 'banana', label: 'Banana' }, { value: 'cherry', label: 'Cherry' }, { value: 'durian', label: 'Durian', disabled: true }, { value: 'elderberry', label: 'Elderberry' }] } },
        { id: 'bp', kind: 'opens-popup', enabled: true, slots: { popup: 'ddM' }, config: { placement: 'bottom-start', matchWidth: true } },
    ] }));
// A Select with nothing mapped (must warn, not guess)
add(...selMaster('sel2M', 'Select (unmapped)', { y: 600, behaviors: [{ id: 'bo2', kind: 'has-options', enabled: true, slots: {}, config: { mode: 'single', options: ['a', 'b'] } }, { id: 'bp2', kind: 'opens-popup', enabled: true, slots: {}, config: {} }] }));
// Alert (type = a mode of "Alert type") and Modal (confirm / cancel buttons)
add(frame('alM', null, 'Alert', { component: true, x: -900, y: 700, w: 340, layout: 'horizontal', gap: 8, padding: 12, counterAlign: 'center', fill: '#E6F0FF', stroke: '#0058CA', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug', vars: { fill: 'vAlFill', stroke: 'vAlStroke' }, varModes: { cAl: 'mInfo' },
    behaviors: [{ id: 'bal', kind: 'show-feedback', enabled: true, slots: { message: 'alMT', title: 'alMTitle' }, config: { kind: 'alert' } }] }),
    text('alMTitle', 'alM', 'Title', 'Title', { fontWeight: 700 }), text('alMT', 'alM', 'Message', 'Message'));
add(frame('mdM', null, 'Modal', { component: true, x: -900, y: 800, w: 380, layout: 'vertical', gap: 12, padding: 20, fill: '#ffffff', radius: 12, layoutSizingH: 'fixed', layoutSizingV: 'hug',
    behaviors: [{ id: 'bmd', kind: 'show-feedback', enabled: true, slots: { message: 'mdMsg', title: 'mdTitle', confirm: 'mdOk', cancel: 'mdNo' }, config: { kind: 'modal' } }] }),
    text('mdTitle', 'mdM', 'Title', 'Title', { fontSize: 18, fontWeight: 700 }), text('mdMsg', 'mdM', 'Body', 'Body'),
    frame('mdRow', 'mdM', 'Footer', { layout: 'horizontal', gap: 8, padding: 0, primaryAlign: 'end', layoutSizingH: 'fill', layoutSizingV: 'hug' }),
    frame('mdNo', 'mdRow', 'Cancel', { layout: 'horizontal', padT: 8, padB: 8, padL: 14, padR: 14, fill: '#F1F1F4', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug' }), text('mdNoT', 'mdNo', 'Label', 'Cancel'),
    frame('mdOk', 'mdRow', 'OK', { layout: 'horizontal', padT: 8, padB: 8, padL: 14, padR: 14, fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug' }), text('mdOkT', 'mdOk', 'Label', 'OK', { fill: '#fff', fontWeight: 600 }));

// ---------------- the form ----------------
const input = (id, parentId, label, extra) => [
    frame(id, parentId, 'Input', { isInstance: true, sourceId: 'inM', typeable: true, w: 300, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', vars: { stroke: 'vStroke' }, varModes: { cInput: 'mInDefault' }, overrides: { layoutSizingH: true }, ...extra }),
    text(id + 'T', id, 'Placeholder', label, { sourceId: 'inMT', fill: '#888888', ...ov }),
];
const button = (id, parentId, label, extra = {}) => [
    frame(id, parentId, 'Button', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 10, padB: 10, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' }, ...extra }),
    text(id + 'T', id, 'Label', label, { sourceId: 'btnMT', fill: '#ffffff', fontWeight: 600, ...ov }),
];
const select = (id, parentId, master, extra = {}) => [
    frame(id, parentId, 'Select', { isInstance: true, sourceId: master, w: 300, layout: 'horizontal', gap: 6, padding: 8, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', vars: { stroke: 'vStroke' }, varModes: { cInput: 'mInDefault' }, overrides: { layoutSizingH: true }, ...extra }),
    frame(id + 'Chips', id, 'Chips', { sourceId: master + 'Chips', layout: 'horizontal', gap: 4, padding: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' }),
    frame(id + 'Chip', id + 'Chips', 'Chip', { sourceId: master + 'Chip', layout: 'horizontal', gap: 4, padT: 2, padB: 2, padL: 8, padR: 6, fill: '#E6F0FF', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', counterAlign: 'center' }),
    text(id + 'ChipT', id + 'Chip', 'Tag', 'Tag', { sourceId: master + 'ChipT', fontSize: 12, fill: '#0058CA' }), frame(id + 'Rm', id + 'Chip', 'Remove', { sourceId: master + 'Rm', w: 12, h: 12, fill: '#9BB6E0', radius: 6 }),
    text(id + 'Ph', id, 'Placeholder', 'Choose fruits', { sourceId: master + 'Ph', fill: '#888888', ...ov }), text(id + 'Ar', id, 'Arrow', '⌄', { sourceId: master + 'Ar', fill: '#888888' }),
];
add(frame('form', null, 'Form', { w: 420, h: 640, fill: '#ffffff', layout: 'vertical', gap: 12, padding: 24, clip: true, stateBind: { layers: { picked: { text: 'template' } } } }),
    text('formTitle', 'form', 'Title', 'Sign up', { fontSize: 24, fontWeight: 700 }),
    ...input('email', 'form', 'Email', { inputBehavior: { typeable: { frameId: 'emailT', inputType: 'email' }, validation: { rules: { required: true, type: 'email' }, trigger: 'blur' } } }),
    ...select('fruit', 'form', 'selM'),
    ...select('fruit2', 'form', 'sel2M'),
    text('picked', 'form', 'Picked', 'Picked: {fruits} fruit(s)', { fill: '#555555' }),
    ...button('submit', 'form', 'Submit', { interactions: [{ id: 'is', trigger: 'onClick', actions: [{ type: 'validate-field', fieldId: '' }], rules: { items: [
        { id: 'r1', name: 'Invalid', if: { op: 'or', args: [{ op: 'invalid', field: 'email' }, { op: 'invalid', field: 'fruit' }] }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'error', title: 'Check the form', message: 'Please fix the highlighted fields.', duration: 60000 }] },
        { id: 'r2', name: 'Valid', actions: [{ type: 'show-feedback', kind: 'modal', level: 'success', title: 'Saved', message: 'You picked {fruits} fruit(s). Thank you!', onConfirm: [{ type: 'set-state', variableId: 'fruits', op: 'reset' }] }, { type: 'show-feedback', kind: 'message', level: 'success', message: 'Saved', duration: 60000 }] },
    ] } }] }),
    ...button('send', 'form', 'Send (slow)', { interactions: [{ id: 'ib', trigger: 'onClick', actions: [{ type: 'request', delay: 1500 }], rules: { items: [{ id: 'r3', name: 'Done', actions: [{ type: 'show-feedback', kind: 'alert', level: 'success', message: 'Sent.', duration: 60000 }] }] } }] }));

const doc = {
    format: 'midas', version: 1, behaviorVersion: 2, name: 'Phase 3 test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    state: { variables: [{ id: 'fruits', name: 'fruits', type: 'list', itemType: 'string', initial: [], scope: 'page' }], derived: [] },
    convention: { slots: {}, states: {}, feedback: { alert: 'alM', modal: 'mdM', message: '', notification: '', drawer: '', popconfirm: '' } },
    variables: {
        collections: [
            { id: 'cInput', name: 'Input states', modes: [{ id: 'mInDefault', name: 'Default' }, { id: 'mInError', name: 'Error' }], groups: [] },
            { id: 'cBtn', name: 'Button states', modes: [{ id: 'mBtnDefault', name: 'Default' }, { id: 'mBtnLoading', name: 'Loading' }], groups: [] },
            { id: 'cItem', name: 'Menu item states', modes: [{ id: 'mItemDefault', name: 'Default' }, { id: 'mItemHover', name: 'Hover' }, { id: 'mItemSelected', name: 'Selected' }, { id: 'mItemDisabled', name: 'Disabled' }], groups: [] },
            { id: 'cAl', name: 'Alert type', modes: [{ id: 'mInfo', name: 'Info' }, { id: 'mSuccess', name: 'Success' }, { id: 'mWarning', name: 'Warning' }, { id: 'mError', name: 'Error' }], groups: [] },
        ],
        items: [
            { id: 'vStroke', collectionId: 'cInput', name: 'input/stroke', type: 'color', description: '', hidden: false, values: { mInDefault: '#C9C9D1', mInError: '#E5484D' } },
            { id: 'vBtnFill', collectionId: 'cBtn', name: 'button/fill', type: 'color', description: '', hidden: false, values: { mBtnDefault: '#0058CA', mBtnLoading: '#9BB6E0' } },
            { id: 'vItemFill', collectionId: 'cItem', name: 'item/fill', type: 'color', description: '', hidden: false, values: { mItemDefault: '#FFFFFF', mItemHover: '#F1F1F4', mItemSelected: '#E6F0FF', mItemDisabled: '#FAFAFA' } },
            { id: 'vAlFill', collectionId: 'cAl', name: 'alert/fill', type: 'color', description: '', hidden: false, values: { mInfo: '#E6F0FF', mSuccess: '#E6F6EC', mWarning: '#FFF4DB', mError: '#FDE7E9' } },
            { id: 'vAlStroke', collectionId: 'cAl', name: 'alert/stroke', type: 'color', description: '', hidden: false, values: { mInfo: '#0058CA', mSuccess: '#30A46C', mWarning: '#F5A524', mError: '#E5484D' } },
        ],
    },
};
fs.writeFileSync(process.argv[2] || 'phase3-test.midas', JSON.stringify(doc));
