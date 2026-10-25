// Tiny test file for Change variant + Smart animate: a Btn set (State = Default | Hover) and a screen with an instance that changes on hover / click.
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none' };
const label = (id, parentId, text, extra = {}) => ({ ...base, id, type: 'text', name: 'Label', parentId, x: 12, y: 10, w: 76, h: 20, text, fill: '#ffffff', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, ...extra });
const variant = (id, state, fill, w) => ({ ...base, id, type: 'frame', name: `Shape=${state}`, component: true, variant: { Shape: state }, parentId: 'set', x: state === 'Square' ? 0 : 160, y: 0, w, h: 40, fill, radius: state === 'Square' ? 8 : 20 });
const nodes = [
    { ...base, id: 'set', type: 'frame', name: 'Btn', componentSet: true, x: 0, y: 0, w: 340, h: 40, fill: 'none' },
    variant('v1', 'Square', '#0058CA', 100), label('l1', 'v1', 'Save'),
    variant('v2', 'Pill', '#E5484D', 160), label('l2', 'v2', 'Save', { x: 40 }),
    { ...base, id: 'f1', type: 'frame', name: 'Screen', x: 500, y: 0, w: 480, h: 300, fill: '#ffffff' },
    { ...base, id: 'i1', type: 'frame', name: 'Btn', isInstance: true, sourceId: 'v1', parentId: 'f1', x: 60, y: 60, w: 100, h: 40, fill: '#0058CA', radius: 8,
        interactions: [{ id: 'a1', trigger: 'onHover', actions: [{ type: 'change-variant', variants: { Shape: 'Pill' } }] }] },
    label('il1', 'i1', 'Save', { sourceId: 'l1' }),
];
const doc = { format: 'midas', version: 1, name: 'CV test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, variables: { collections: [], items: [] }, guideStyles: [], created: Date.now(), assets: {} };
fs.writeFileSync(process.argv[2] || 'cv-test.midas', JSON.stringify(doc));
