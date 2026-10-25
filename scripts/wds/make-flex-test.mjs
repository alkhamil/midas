// Test file for the flexbox Preview: a vertical screen with a hug Button (padding 8/16), a Fill Button and a space-between row.
import fs from 'fs';
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const label = (id, parentId, t, extra = {}) => ({ ...base, id, type: 'text', name: 'Label', parentId, w: 80, h: 20, text: t, fill: '#ffffff', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const button = (id, parentId, t, extra = {}) => [
    frame(id, parentId, 'Button', { layout: 'horizontal', gap: 8, padT: 8, padB: 8, padL: 16, padR: 16, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra }),
    label(id + 't', id, t),
];
const nodes = [
    frame('s', null, 'Screen', { x: 0, y: 0, w: 420, h: 360, fill: '#ffffff', layout: 'vertical', gap: 16, padding: 24, clip: true }),
    ...button('b1', 's', 'Save changes'),
    ...button('b2', 's', 'Fill width', { layoutSizingH: 'fill', fill: '#E5484D' }),
    frame('r', 's', 'Row', { layout: 'horizontal', gapAuto: true, gapMode: 'between', counterAlign: 'center', padding: 0, layoutSizingH: 'fill', layoutSizingV: 'hug', fill: '#F1F1F4', w: 300, h: 40 }),
    label('r1', 'r', 'Left', { fill: '#111111' }), label('r2', 'r', 'Right', { fill: '#111111' }),
];
const doc = { format: 'midas', version: 1, name: 'Flex test', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, variables: { collections: [], items: [] }, guideStyles: [], created: Date.now(), assets: {} };
fs.writeFileSync(process.argv[2] || 'flex-test.midas', JSON.stringify(doc));
