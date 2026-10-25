// A login frame the way a Figma import stores it: every auto-layout frame has layoutFlip + layoutReverseZ and its children are
// stored back-to-front. Used to compare the canvas with Preview (children order, direction, alignment).
//   node scripts/wds/make-login-test.mjs <out.midas> [--plain]      --plain = same frame stored front-to-back, no flip / reverseZ
import fs from 'fs';
const plain = process.argv.includes('--plain');
const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, name, extra) => ({ ...base, id, type: 'frame', name, w: 100, h: 40, fill: 'none', clip: false, ...extra });
const text = (id, name, t, extra = {}) => ({ ...base, id, type: 'text', name, w: 80, h: 20, text: t, fill: '#111111', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });
const flip = plain ? {} : { layoutFlip: true, layoutReverseZ: true };
const nodes = [];
// A tree is [node, ...child trees] in VISUAL order; an imported frame stores its children reversed.
const put = (tree, parentId) => {
    const [n, ...kids] = tree;
    nodes.push({ ...n, parentId, ...(n.layout && n.layout !== 'none' ? flip : {}) });
    for (const k of (plain ? kids : [...kids].reverse())) put(k, n.id);
};
const ov = { overrides: { text: true } };

// Input master: placeholder on the left, eye icon on the right (space between)
put([frame('inM', 'Input', { component: true, x: -900, w: 320, h: 44, layout: 'horizontal', padding: 12, gapAuto: true, gapMode: 'between', counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug' }),
    [text('inMT', 'Placeholder', 'Placeholder', { fill: '#888888' })],
    [frame('inMEye', 'Eye', { w: 16, h: 16, fill: '#9AA0AA', radius: 8 })]], null);

const input = (id, label, pass) => [
    frame(id, 'Input', { isInstance: true, sourceId: 'inM', typeable: true, layout: 'horizontal', padding: 12, gapAuto: true, gapMode: 'between', counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 312, overrides: { layoutSizingH: true },
        inputBehavior: { typeable: { frameId: id + 'T', inputType: pass ? 'password' : 'email' } } }),
    [text(id + 'T', 'Placeholder', label, { sourceId: 'inMT', fill: '#888888', ...ov })],
    [frame(id + 'Eye', 'Eye', { sourceId: 'inMEye', w: 16, h: 16, fill: '#9AA0AA', radius: 8 })],
];
const emailInput = input('email', 'you@example.com', false).slice(0, 2), passInput = input('pass', 'Password', true);
const label = (id, t) => [frame(id, 'Label row', { layout: 'horizontal', gap: 2, padding: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' }),
    [text(id + 'T', 'Label', t, { fontWeight: 600 })], [text(id + 'S', 'Required', '*', { fill: '#E5484D' })]];
const group = (id, name, ...kids) => [frame(id, name, { layout: 'vertical', gap: 6, padding: 0, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 312 }), ...kids];

put([frame('login', 'Login', { w: 360, h: 640, fill: '#ffffff', layout: 'vertical', gap: 16, padding: 24, counterAlign: 'start', layoutSizingH: 'fixed', layoutSizingV: 'fixed' }),
    [frame('logo', 'Logo', { w: 40, h: 40, fill: '#0058CA', radius: 10 })],
    [text('title', 'Title', 'Welcome back', { fontSize: 24, fontWeight: 700 })],
    [text('sub', 'Subtitle', 'Sign in to continue', { fill: '#666666' })],
    group('gEmail', 'Email field', label('lEmail', 'Email'), emailInput),
    group('gPass', 'Password field', label('lPass', 'Password'), passInput),
    [frame('forgot', 'Forgot row', { layout: 'horizontal', padding: 0, primaryAlign: 'end', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 312 }), [text('forgotT', 'Link', 'Forgot password?', { fill: '#0058CA' })]],
    [frame('cta', 'Button', { layout: 'horizontal', padding: 12, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 312 }), [text('ctaT', 'Label', 'Sign in', { fill: '#ffffff', fontWeight: 600 })]],
], null);

const doc = { format: 'midas', version: 1, behaviorVersion: 2, name: plain ? 'Login (plain)' : 'Login (imported)', pageId: 'p1', pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {}, variables: { collections: [], items: [] } };
fs.writeFileSync(process.argv[2] || 'login-test.midas', JSON.stringify(doc));
