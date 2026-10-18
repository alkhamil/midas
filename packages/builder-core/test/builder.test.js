import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoAction, buildTrees, cleanNodeCfg, fieldBinding, findTreeNode, generateProject, makeContext, parseRules, relationOf, relationSampleOptions, resolveLayout, ruleError, screenPath, screenTree, tableModel, withRule, zipFiles } from '../src/index.js';

const variables = { items: [] };
const comp = (key, name) => ({ id: `${key}-set`, name, type: 'frame', componentSet: true, libRef: `lib:${key}`, cprops: [{ id: `${key}-label`, name: 'Label', type: 'text', def: name }] });
const nodes = [
    comp('btn', 'Button'), { id: 'btn-v', parentId: 'btn-set', name: 'Variant=Primary', type: 'frame', component: true, variant: { Variant: 'Primary' }, libRef: 'lib:btn-v' },
    comp('tbl', 'Table'), { id: 'tbl-v', parentId: 'tbl-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:tbl-v' },
    comp('fld', 'TextField'), { id: 'fld-v', parentId: 'fld-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:fld-v' },
    { id: 'list', name: 'User List', type: 'frame', w: 1184, h: 600, layout: 'vertical', gap: 16 },
    { id: 'add', parentId: 'list', type: 'frame', isInstance: true, sourceId: 'btn-v', w: 120, h: 40, name: 'Add', propValues: { 'btn-label': 'Tambah user' } },
    { id: 'table', parentId: 'list', type: 'frame', isInstance: true, sourceId: 'tbl-v', w: 1100, h: 300, layoutSizingH: 'fill', name: 'Table' },
    { id: 'title', parentId: 'list', type: 'text', text: 'Daftar', fontSize: 18, autoW: true, w: 80, h: 24 },
    { id: 'form', name: 'User Form', type: 'frame', w: 1184, h: 600, layout: 'vertical', gap: 16 },
    { id: 'f-name', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'fld-v', w: 400, h: 60, name: 'Name', propValues: { 'fld-label': 'Full name' } },
    { id: 'f-save', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'btn-v', w: 120, h: 40, name: 'Save', propValues: { 'btn-label': 'Simpan' } },
];
const mappings = ['btn:Button', 'tbl:Table', 'fld:TextField'].map(s => {
    const [key, exportName] = s.split(':');
    const props = key === 'btn' ? [{ source: 'variant', key: 'Variant', name: 'variant', type: 'enum', values: { Primary: 'primary' } }, { source: 'text', key: 'btn-label', name: 'children', type: 'string' }]
        : key === 'fld' ? [{ source: 'text', key: 'fld-label', name: 'label', type: 'string' }] : [];
    return { componentKey: key, exportName, propsMap: { props } };
});
const ctx = makeContext({ nodes, variables, mappings, libraryId: 'lib', fileId: 'app' });
const entity = { fields: [
    { name: 'fullName', label: 'Full name', type: 'string', required: true },
    { name: 'email', type: 'string' },
    { name: 'password', type: 'password' },
    { name: 'active', type: 'boolean' },
    { name: 'role', type: 'enum', options: ['admin', 'viewer'] },
] };
const mod = (extra = {}) => ({
    id: 'm1', name: 'user', label: 'User', parentId: null, pageId: 'p', entity,
    screens: [
        { id: 's-list', frameId: 'list', pageId: 'p', name: 'User List', role: 'list', nodes: {} },
        { id: 's-create', frameId: 'form', pageId: 'p', name: 'User Form', role: 'create', nodes: {} },
    ], ...extra,
});
const project = (m = mod(), layout) => ({ name: 'Demo', config: { modules: [m], ...(layout ? { layout } : {}) } });

test('node config overrides props, text and hides nodes', () => {
    const cfg = { add: { props: { children: 'Buat user' } }, title: { text: 'Semua user' }, table: { hidden: true } };
    const { tree } = screenTree(ctx, 'list', cfg);
    const add = findTreeNode(tree, 'add');
    assert.equal(add.props.children, 'Buat user');
    assert.equal(add.baseProps.children, 'Tambah user');
    assert.equal(findTreeNode(tree, 'title').text, 'Semua user');
    assert.equal(findTreeNode(tree, 'title').designText, 'Daftar');
    assert.equal(findTreeNode(tree, 'table'), null);
    // root tidak bisa disembunyikan
    assert.ok(screenTree(ctx, 'list', { list: { hidden: true } }).tree);
});

test('cleanNodeCfg drops empty values but keeps arrays', () => {
    assert.deepEqual(cleanNodeCfg({ hidden: false, props: {}, table: { columns: ['a'], pageSize: undefined }, text: '' }), { table: { columns: ['a'] } });
});

test('layout resolves menu order, hidden and dashboard home path', () => {
    const modules = [
        { id: 'a', name: 'user', label: 'User', parentId: null, screens: [{ id: 'l', role: 'list', name: 'List' }] },
        { id: 'b', name: 'dashboard', label: 'Dashboard', parentId: null, screens: [{ id: 'd', role: 'custom', name: 'Dashboard' }] },
        { id: 'c', name: 'child', label: 'Child', parentId: 'a', screens: [] },
    ];
    const l = resolveLayout({ modules, layout: { appName: 'App', items: [{ moduleId: 'b', icon: 'widget' }, { moduleId: 'a', label: 'Pengguna', hidden: true }] } });
    assert.deepEqual(l.items.map(i => [i.moduleId, i.label, i.path, i.hidden]), [['b', 'Dashboard', '/', false], ['a', 'Pengguna', '/user', true]]);
    assert.equal(l.appName, 'App');
    assert.equal(screenPath(modules, modules[2], { id: 'x', role: 'create', name: 'x' }), '/user/child/create');
    assert.equal(screenPath(modules, modules[0], { id: 'x', role: 'edit', name: 'x' }), '/user/:id/edit');
});

test('table model and form binding follow the entity', () => {
    assert.deepEqual(tableModel(entity).columns.map(c => c.key), ['fullName', 'email', 'active', 'role']);
    assert.deepEqual(tableModel(entity, { table: { columns: ['email'], rowActions: ['view'] } }).rowActions, ['view']);
    assert.equal(fieldBinding(entity, { props: { label: 'Full name' } }).name, 'fullName');
    assert.equal(fieldBinding(entity, { props: { label: 'x' }, cfg: { field: 'email' } }).name, 'email');
    assert.equal(fieldBinding(entity, { props: { label: 'unknown' } }), null);
    assert.equal(autoAction(mod(), { role: 'create' }, 'Simpan').type, 'submit');
    assert.deepEqual(autoAction(mod(), { role: 'list' }, 'Tambah user'), { type: 'navigate', screenId: 's-create' });
    assert.equal(autoAction(mod(), { role: 'list' }, 'Simpan').type, 'none');
});

test('generator writes module, routes, navigation and locales', () => {
    const p = project();
    const { files, warnings } = generateProject(p, buildTrees(p.config, ctx));
    assert.deepEqual(warnings, []);
    for (const f of ['src/modules/user/types/index.ts', 'src/modules/user/api/mock.ts', 'src/modules/user/api/service.ts', 'src/modules/user/api/resolver.ts', 'src/modules/user/api/queries.ts',
        'src/modules/user/pages/UserListPage.tsx', 'src/modules/user/pages/UserCreatePage.tsx', 'src/modules/user/index.ts', 'src/modules/user/i18n/en.json',
        'src/app/generated/routes.tsx', 'src/app/generated/navigation.tsx', 'src/app/generated/locales.ts', 'src/app/generated/layout.ts'])
        assert.ok(f in files, f);
    assert.match(files['src/modules/user/types/index.ts'], /role\?: 'admin' \| 'viewer';/);
    assert.match(files['src/modules/user/types/index.ts'], /fullName: string;/);
    const list = files['src/modules/user/pages/UserListPage.tsx'];
    assert.match(list, /<Table/);
    assert.match(list, /columns=\{columns\}/);
    assert.match(list, /navigate\('\/user\/create'\)/); // "Tambah user" → screen create
    assert.doesNotMatch(list, /width: '1100px'/); // lebar tabel dari desain jadi fluid
    const create = files['src/modules/user/pages/UserCreatePage.tsx'];
    assert.match(create, /value=\{String\(values\.fullName \?\? ''\)\}/);
    assert.match(create, /type="submit"/);
    assert.match(files['src/app/generated/routes.tsx'], /path: 'user\/create'/);
    assert.match(files['src/app/generated/routes.tsx'], /index: true, element: <DashboardPage \/>/); // beranda bawaan
    assert.match(files['src/app/generated/navigation.tsx'], /path: '\/user'/);
    assert.match(files['src/app/generated/locales.ts'], /modules\/user\/i18n\/en\.json/);
});

test('generator honours node config and layout', () => {
    const m = mod();
    m.screens[0].nodes = { add: { props: { children: 'Buat user' }, action: { type: 'none' } }, table: { table: { columns: ['email'], rowActions: ['view'], pageSize: 25 } }, title: { hidden: true } };
    const p = project(m, { appName: 'Acme', items: [{ moduleId: 'm1', label: 'Pengguna', icon: 'user', hidden: true }] });
    const { files } = generateProject(p, buildTrees(p.config, ctx));
    const list = files['src/modules/user/pages/UserListPage.tsx'];
    assert.match(list, /PAGE_SIZE = 25/);
    assert.match(list, /key: 'email'/);
    assert.doesNotMatch(list, /key: 'fullName'/);
    assert.doesNotMatch(list, /action="delete"/);
    assert.doesNotMatch(list, /navigate\('\/user\/create'\)/);
    assert.match(files['src/modules/user/i18n/en.json'], /Buat user/);
    assert.doesNotMatch(files['src/modules/user/i18n/en.json'], /Daftar/); // node disembunyikan
    assert.match(files['src/app/generated/layout.ts'], /Acme/);
    assert.doesNotMatch(files['src/app/generated/navigation.tsx'], /Pengguna/); // menu disembunyikan
});

test('generator skips incomplete modules with a warning', () => {
    const p = project(mod({ entity: { fields: [] } }));
    const { files, warnings } = generateProject(p, buildTrees(p.config, ctx));
    assert.ok(!Object.keys(files).some(f => f.startsWith('src/modules/user/')));
    assert.match(warnings[0], /CRUD tanpa field entity/);
});

test('zipFiles writes a readable stored archive', () => {
    const zip = zipFiles({ 'src/a.ts': 'const a = 1;\n', 'b.json': '{"é":1}' });
    const view = new DataView(zip.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint16(zip.length - 12, true), 2); // jumlah entri di end-of-central-directory
});

test('rules helpers round-trip the base-code rule format', () => {
    const f = withRule(withRule({ name: 'n', type: 'string' }, 'min', '3'), 'email', true);
    assert.deepEqual(f.rules, ['min:3', 'email']);
    assert.deepEqual(parseRules(f), { required: false, min: '3', max: '', email: true, pattern: '', noEmoticon: false });
    assert.equal(withRule(withRule(f, 'min', ''), 'email', false).rules, undefined);
    assert.equal(ruleError('min:3'), null);
    assert.match(ruleError('pattern:('), /regex/);
    assert.match(ruleError('bogus'), /tidak dikenal/);
});

test('relationOf resolves object and legacy string relations', () => {
    const modules = [{ id: 'r', name: 'role', entity: { fields: [{ name: 'code', type: 'string' }, { name: 'name', type: 'string' }] } }];
    assert.equal(relationOf({ type: 'relation', relation: { moduleId: 'r', labelField: 'code' } }, modules).labelField, 'code');
    assert.equal(relationOf({ type: 'relation', relation: 'role' }, modules).labelField, 'name');
    assert.equal(relationOf({ type: 'relation', relation: { moduleId: 'zzz' } }, modules), null);
    assert.deepEqual(relationSampleOptions({ type: 'relation', relation: 'role' }, modules)[0], { label: 'Role 1', value: '1' });
});

test('generator emits validation and relation options from the target module', () => {
    const role = { id: 'm2', name: 'role', label: 'Role', parentId: null, pageId: 'p', entity: { fields: [{ name: 'name', type: 'string' }] }, screens: [{ id: 'r-list', frameId: 'list', pageId: 'p', name: 'List', role: 'list', nodes: {} }] };
    const user = mod({ entity: { fields: [
        { name: 'fullName', label: 'Full name', type: 'string', required: true, rules: ['min:3', 'email', 'pattern:^[A-Z]'] },
        { name: 'role', label: 'Role', type: 'relation', relation: { moduleId: 'm2', labelField: 'name' } },
    ] } });
    // form: label "Role" mengikat select relasi
    nodes.push({ id: 'f-role', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'sel-v', w: 400, h: 60, name: 'Role', propValues: { 'sel-label': 'Role' } });
    const p = { name: 'Demo', config: { modules: [user, role] } };
    const sel = comp('sel', 'SelectField');
    const ctx2 = makeContext({ nodes: [...nodes, sel, { id: 'sel-v', parentId: 'sel-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:sel-v' }], variables, mappings: [...mappings, { componentKey: 'sel', exportName: 'SelectField', propsMap: { props: [{ source: 'text', key: 'sel-label', name: 'label', type: 'string' }] } }], libraryId: 'lib', fileId: 'app' });
    const { files } = generateProject(p, buildTrees(p.config, ctx2));
    const v = files['src/modules/user/validation/userValidation.ts'];
    assert.match(v, /validation\.required/);
    assert.match(v, /validation\.minLength/);
    assert.match(v, /validation\.email/);
    assert.match(v, /new RegExp\('\^\[A-Z\]'\)/);
    const create = files['src/modules/user/pages/UserCreatePage.tsx'];
    assert.match(create, /validateUser\(values, 'create'\)/);
    assert.match(create, /error=\{errors\.fullName\}/);
    assert.match(create, /import \{ useRoleList \} from '\.\.\/\.\.\/role\/api\/queries'/);
    assert.match(create, /options=\{roleOptions\}/);
    assert.match(create, /label: String\(r\.name \?\? ''\)/);
});
