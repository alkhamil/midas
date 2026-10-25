// A file as it was saved BEFORE State existed: a List token (type 'array') and a Repeat bound to it. Opening it must migrate.
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const nodes = [
    frame('s', null, 'Screen', { w: 420, h: 360, fill: '#ffffff', layout: 'vertical', gap: 12, padding: 24, clip: true }),
    text('count', 's', 'Count', 'Active: 0', { fontSize: 18, fontWeight: 700 }),
    frame('list', 's', 'List', { layout: 'vertical', gap: 8, padding: 0, layoutSizingH: 'fill', layoutSizingV: 'hug', repeat: { variableId: 'arr1', bind: { rowName: { text: 'name' }, rowChip: { visible: 'active' } } } }),
    frame('row', 'list', 'Row', { layout: 'horizontal', gap: 8, padT: 8, padB: 8, padL: 12, padR: 12, fill: '#F1F1F4', radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', counterAlign: 'center' }),
    text('rowName', 'row', 'Name', 'Name'),
    frame('rowChip', 'row', 'Active chip', { w: 8, h: 8, fill: '#30A46C', radius: 4 }),
];
const rows = [{ name: 'Ann', status: 'active', active: true }, { name: 'Bob', status: 'off', active: false }, { name: 'Cy', status: 'active', active: true }];
const doc = {
    format: 'midas', version: 1, name: 'State test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    variables: {
        collections: [{ id: 'c1', name: 'Data', modes: [{ id: 'm1', name: 'Mode 1' }], groups: [] }],
        items: [{ id: 'arr1', collectionId: 'c1', name: 'People', type: 'array', description: '', hidden: false, schema: [{ key: 'name', type: 'string' }, { key: 'status', type: 'string' }, { key: 'active', type: 'boolean' }], values: { m1: rows } }],
    },
};
fs.writeFileSync(process.argv[2] || 'state-test.midas', JSON.stringify(doc));
