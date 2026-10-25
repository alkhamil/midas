// Phase 4 by hand. Step 1: a file with a List State "users" (id, name, email, role, status, createdAt) and nothing else, to try the Data window.
//   node scripts/wds/make-table-test.mjs <out.midas>
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const nodes = [frame('page', null, 'Users', { w: 900, h: 640, fill: '#ffffff', layout: 'vertical', gap: 16, padding: 24 })];
const schema = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string', label: 'Name' }, { key: 'email', type: 'string', label: 'E-mail' }, { key: 'role', type: 'option', options: ['Admin', 'Editor', 'Viewer'], label: 'Role' }, { key: 'status', type: 'option', options: ['Active', 'Pending', 'Disabled'], label: 'Status' }, { key: 'createdAt', type: 'date', label: 'Created' }];
const initial = [
    { id: 1, name: 'Ana Pratama', email: 'ana.pratama@akar.com', role: 'Admin', status: 'Active', createdAt: '2024-03-01' },
    { id: 2, name: 'Budi Santoso', email: 'budi.santoso@nusa.com', role: 'Editor', status: 'Pending', createdAt: '2024-05-12' },
];
const doc = {
    format: 'midas', version: 1, behaviorVersion: 2, name: 'Table test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    state: { variables: [{ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial, scope: 'page' }], derived: [] },
    variables: { collections: [], items: [] },
};
fs.writeFileSync(process.argv[2] || 'table-test.midas', JSON.stringify(doc));
