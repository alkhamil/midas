import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cssVarOf, makeContext, projectIssues, screenTree } from '../src/screen.js';

const variables = { items: [{ id: 'v-primary', name: 'color/primary', type: 'color' }, { id: 'v-bg', name: 'color/background', type: 'color' }] };
// Library "lib": Button (set, variant Variant=Primary|Secondary, cprop Label) disalin ke file app dengan libRef.
const libNodes = [
    { id: 'set', name: 'Button', type: 'frame', componentSet: true, libRef: 'lib:btn', cprops: [{ id: 'cp-label', name: 'Label', type: 'text', def: 'Button' }] },
    { id: 'v1', parentId: 'set', name: 'Variant=Primary', type: 'frame', component: true, variant: { Variant: 'Primary' }, libRef: 'lib:btn-p' },
    { id: 'local', name: 'Card lokal', type: 'frame', component: true },
];
const mappings = [{ componentKey: 'btn', exportName: 'Button', propsMap: { props: [
    { source: 'variant', key: 'Variant', name: 'variant', type: 'enum', values: { Primary: 'primary' } },
    { source: 'text', key: 'cp-label', name: 'children', type: 'string' },
] } }];
const screen = [
    { id: 'f', name: 'User List', type: 'frame', w: 1440, h: 900, layout: 'vertical', gap: 16, padT: 24, padR: 24, padB: 24, padL: 24, fill: '#FFFFFF', vars: { fill: 'v-bg' } },
    { id: 'title', parentId: 'f', type: 'text', text: 'Daftar User', fontSize: 18, fontWeight: 600, fill: '#0F172A', autoW: true, w: 100, h: 28 },
    { id: 'btn', parentId: 'f', type: 'frame', isInstance: true, sourceId: 'v1', w: 120, h: 42, propValues: { 'cp-label': 'Add user' } },
    { id: 'card', parentId: 'f', type: 'frame', isInstance: true, sourceId: 'local', w: 200, h: 100 },
    { id: 'shape', parentId: 'f', type: 'rect', w: 10, h: 10, fill: '#FF0000' },
    { id: 'free', parentId: 'f', type: 'frame', w: 300, h: 100, layoutSizingH: 'fill' },
    { id: 'a', parentId: 'free', type: 'text', text: 'A', x: 0, y: 0, w: 10, h: 20 },
    { id: 'b', parentId: 'free', type: 'text', text: 'B', x: 50, y: 0, w: 10, h: 20 },
];
const ctx = () => makeContext({ nodes: [...libNodes, ...screen], variables, mappings, libraryId: 'lib', fileId: 'app' });

test('cssVarOf follows Library Kit token names', () => {
    assert.equal(cssVarOf({ name: 'color/primary-foreground', type: 'color' }), '--theme-primary-foreground');
    assert.equal(cssVarOf({ name: 'radius/md', type: 'number' }), '--theme-radius-md');
    assert.equal(cssVarOf({ name: 'page-padding', type: 'number' }), '--theme-page-padding');
});

test('screenTree maps instances to library components with code props', () => {
    const { tree } = screenTree(ctx(), 'f');
    assert.equal(tree.kind, 'box');
    assert.equal(tree.style.display, 'flex');
    assert.equal(tree.style.flexDirection, 'column');
    assert.equal(tree.style.background, 'var(--theme-background, #FFFFFF)');
    const btn = tree.children.find(c => c.nodeId === 'btn');
    assert.deepEqual(btn, { ...btn, kind: 'component', exportName: 'Button', props: { variant: 'primary', children: 'Add user' } });
    assert.equal(tree.children.find(c => c.nodeId === 'free').style.alignSelf, 'stretch');
});

test('screenTree reports issues: raw hex, local component, free shape, frame without auto layout', () => {
    const { issues } = screenTree(ctx(), 'f');
    const by = id => issues.filter(i => i.nodeId === id).map(i => i.message).join(' | ');
    assert.match(by('title'), /Text color #0F172A does not use a Variable/);
    assert.match(by('card'), /Local component Card lokal/);
    assert.match(by('shape'), /free Rectangle/);
    assert.match(by('free'), /without auto layout/);
    assert.equal(by('btn'), '');
    assert.match(screenTree(ctx(), 'missing').issues[0].message, /not found/);
});

test('projectIssues checks library, empty modules, entity fields and missing frames', () => {
    const project = {
        library: { packageName: '@midas/ui-cms', version: '1.1.1', bundleUrl: null, codeStatus: 'ready' },
        config: { modules: [
            { id: 'm1', name: 'user', pageId: 'p1', screens: [{ id: 's1', frameId: 'f', name: 'User List', role: 'list' }], entity: { fields: [] } },
            { id: 'm2', name: 'report', pageId: 'gone', screens: [{ id: 's2', frameId: 'nope', name: 'Report', role: 'custom' }] },
            { id: 'm3', name: 'empty', pageId: 'p1', screens: [] },
        ] },
    };
    const msgs = projectIssues(project, { byId: ctx().byId, pages: [{ id: 'p1' }] }).map(i => i.message).join('\n');
    assert.match(msgs, /Bundle @midas\/ui-cms@1\.1\.1 has not been uploaded/);
    assert.match(msgs, /user \(CRUD\) has no entity fields yet/);
    assert.match(msgs, /Source page of module report was deleted/);
    assert.match(msgs, /Screen frame Report \(custom\) was deleted/);
    assert.match(msgs, /Module empty has no screens yet/);
    assert.match(projectIssues({ library: null, config: { modules: [] } }, { byId: new Map(), pages: [] })[0].message, /Choose a library/);
});
