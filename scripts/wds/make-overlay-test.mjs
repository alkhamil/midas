// A form whose Email input opens a dropdown (an overlay instance placed on the page), plus the leftovers deleting an interaction used to
// leave behind. node scripts/wds/make-overlay-test.mjs <out.midas> [--legacy]
//   default  : "Email" (open-dropdown, overlay placed and owned) and "Name" (no interaction)
//   --legacy : the same, but the interaction was deleted and the instance stayed (what an older file looks like)
import fs from 'fs';
const legacy = process.argv.includes('--legacy');
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const nodes = [];
// the dropdown component
nodes.push(frame('ddM', null, 'Dropdown / Menu', { component: true, x: -600, y: 0, w: 320, layout: 'vertical', gap: 2, padding: 8, fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }), text('ddT', 'ddM', 'Item', 'Option'));
// an input component and the form
nodes.push(frame('inM', null, 'Input', { component: true, x: -600, y: 300, w: 320, h: 44, layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }), text('inMT', 'inM', 'Placeholder', 'Input', { fill: '#888888' }));
const input = (id, label, extra = {}) => [frame(id, 'form', 'Input', { isInstance: true, sourceId: 'inM', layout: 'horizontal', padding: 12, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 320, overrides: { layoutSizingH: true }, ...extra }), text(id + 'T', id, 'Placeholder', label, { sourceId: 'inMT', fill: '#888888', overrides: { text: true } })];
const email = { id: 'ix', trigger: 'onClick', actions: [{ type: 'open-dropdown', targetComponentId: 'ddM', position: 'bottom-start', overlayInstanceId: 'ovEmail' }] };
nodes.push(frame('form', null, 'Form', { w: 360, h: 360, fill: '#ffffff', layout: 'vertical', gap: 12, padding: 20, layoutSizingH: 'fixed', layoutSizingV: 'fixed' }),
    text('title', 'form', 'Title', 'Sign up', { fontSize: 22, fontWeight: 700 }),
    ...input('email', 'Email', legacy ? {} : { interactions: [email] }),
    ...input('name', 'Name'));
// the instance the "Place on canvas" button put under the Email field (page level, overlapping the Name field)
nodes.push({ ...frame('ovEmail', null, 'Dropdown / Menu', { isInstance: true, isOverlay: true, overlayTrigger: 'email', sourceId: 'ddM', x: 20, y: 120, w: 320, layout: 'vertical', gap: 2, padding: 8, fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug', ...(legacy ? {} : { autoCreated: true, ownerId: 'ix' }) }) }, text('ovEmailT', 'ovEmail', 'Item', 'Option', { sourceId: 'ddT' }));
// something the user drew themselves, which no cleanup may touch
nodes.push(frame('mine', null, 'My note', { x: 420, y: 0, w: 120, h: 60, fill: '#FFF4DB' }));
const doc = { format: 'midas', version: 1, behaviorVersion: 2, name: legacy ? 'Overlay (leftover)' : 'Overlay (owned)', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {}, variables: { collections: [], items: [] } };
fs.writeFileSync(process.argv[2] || 'overlay-test.midas', JSON.stringify(doc));
