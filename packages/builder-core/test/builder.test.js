import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryFiles, activeNavPath, assembleProject, suggestScreens, autoAction, breadcrumbsOf, filterFields, formItemOf, pageTitle, validateField, validateValues, buildTrees, cleanNodeCfg, fieldBinding, findTreeNode, generateProject, makeContext, parseRules, relationOf, relationSampleOptions, resolveLayout, ruleError, screenPath, screenTree, tableModel, withRule, zipFiles } from '../src/index.js';

const variables = { items: [] };
const comp = (key, name) => ({ id: `${key}-set`, name, type: 'frame', componentSet: true, libRef: `lib:${key}`, cprops: [{ id: `${key}-label`, name: 'Label', type: 'text', def: name }] });
const nodes = [
    comp('btn', 'Button'), { id: 'btn-v', parentId: 'btn-set', name: 'Variant=Primary', type: 'frame', component: true, variant: { Variant: 'Primary' }, libRef: 'lib:btn-v' },
    comp('tbl', 'Table'), { id: 'tbl-v', parentId: 'tbl-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:tbl-v' },
    comp('fld', 'TextField'), { id: 'fld-v', parentId: 'fld-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:fld-v' },
    { id: 'list', name: 'User List', type: 'frame', w: 1184, h: 600, layout: 'vertical', gap: 16 },
    { id: 'add', parentId: 'list', type: 'frame', isInstance: true, sourceId: 'btn-v', w: 120, h: 40, name: 'Add', propValues: { 'btn-label': 'Add user' } },
    { id: 'table', parentId: 'list', type: 'frame', isInstance: true, sourceId: 'tbl-v', w: 1100, h: 300, layoutSizingH: 'fill', name: 'Table' },
    { id: 'title', parentId: 'list', type: 'text', text: 'Daftar', fontSize: 18, autoW: true, w: 80, h: 24 },
    { id: 'form', name: 'User Form', type: 'frame', w: 1184, h: 600, layout: 'vertical', gap: 16 },
    { id: 'f-name', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'fld-v', w: 400, h: 60, name: 'Name', propValues: { 'fld-label': 'Full name' } },
    { id: 'f-save', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'btn-v', w: 120, h: 40, name: 'Save', propValues: { 'btn-label': 'Save' } },
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
    const cfg = { add: { props: { children: 'Create user' } }, title: { text: 'Semua user' }, table: { hidden: true } };
    const { tree } = screenTree(ctx, 'list', cfg);
    const add = findTreeNode(tree, 'add');
    assert.equal(add.props.children, 'Create user');
    assert.equal(add.baseProps.children, 'Add user');
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

test('layout nests child modules under a group parent: /parent/child', () => {
    const modules = [
        { id: 'm', name: 'master-data', label: 'Master Data', parentId: null, screens: [] },
        { id: 'r', name: 'region', label: 'Region', parentId: 'm', screens: [{ id: 'l', role: 'list', name: 'List' }] },
        { id: 'c', name: 'country', label: 'Country', parentId: 'm', screens: [{ id: 'l2', role: 'list', name: 'List' }] },
    ];
    const l = resolveLayout({ modules, layout: { items: [{ moduleId: 'm', icon: 'database' }, { moduleId: 'c' }, { moduleId: 'r' }] } });
    assert.equal(l.items.length, 1);
    assert.equal(l.items[0].path, undefined);
    assert.deepEqual(l.items[0].children.map(c => [c.label, c.path]), [['Country', '/master-data/country'], ['Region', '/master-data/region']]);
    assert.equal(activeNavPath(l, modules, modules[1]), '/master-data/region');
    assert.deepEqual(breadcrumbsOf(modules, modules[1], modules[1].screens[0]).map(c => c.label), ['Home', 'Master Data', 'Region']);
    const nav = generateProject({ name: 'P', config: { modules, layout: {} } }, new Map()).files['src/app/generated/navigation.tsx'];
    assert.match(nav, /label: 'Master Data'[\s\S]*children: \[[\s\S]*path: '\/master-data\/region'/);
});

test('table model and form binding follow the entity', () => {
    assert.deepEqual(tableModel(entity).columns.map(c => c.key), ['fullName', 'email', 'active', 'role']);
    assert.deepEqual(tableModel(entity, { table: { columns: ['email'], rowActions: ['view'] } }).rowActions, ['view']);
    assert.equal(fieldBinding(entity, { props: { label: 'Full name' } }).name, 'fullName');
    assert.equal(fieldBinding(entity, { props: { label: 'x' }, cfg: { field: 'email' } }).name, 'email');
    assert.equal(fieldBinding(entity, { props: { label: 'unknown' } }), null);
    assert.equal(autoAction(mod(), { role: 'create' }, 'Save').type, 'submit');
    assert.deepEqual(autoAction(mod(), { role: 'list' }, 'Add user'), { type: 'navigate', screenId: 's-create' });
    assert.equal(autoAction(mod(), { role: 'list' }, 'Save').type, 'none');
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
    assert.match(list, /navigate\('\/user\/create'\)/); // "Add user" → screen create
    assert.doesNotMatch(list, /width: '1100px'/); // lebar tabel dari desain jadi fluid
    const create = files['src/modules/user/pages/UserCreatePage.tsx'];
    assert.match(create, /<FormGroup<UserInput>/);
    assert.match(create, /<FormItem name='fullName' label=\{t\('user\.create\.t\d+'\)\}/);
    assert.match(create, /required: t\('validation\.required'/);
    assert.match(create, /<LeaveGuard bypass=\{bypassGuard\}/); // unsaved-changes guard
    assert.match(create, /type="submit"/);
    assert.match(create, /gridColumn: 'span 12 \/ span 12'/); // 12-column grid
    assert.match(files['src/app/generated/routes.tsx'], /path: 'user\/create'/);
    assert.match(files['src/app/generated/routes.tsx'], /index: true, element: <DashboardPage \/>/); // beranda bawaan
    assert.match(files['src/app/generated/navigation.tsx'], /path: '\/user'/);
    assert.match(files['src/app/generated/locales.ts'], /modules\/user\/i18n\/en\.json/);
});

test('generator honours node config and layout', () => {
    const m = mod();
    m.screens[0].nodes = { add: { props: { children: 'Create user' }, action: { type: 'none' } }, table: { table: { columns: ['email'], rowActions: ['view'], pageSize: 25 } }, title: { hidden: true } };
    const p = project(m, { appName: 'Acme', items: [{ moduleId: 'm1', label: 'Pengguna', icon: 'user', hidden: true }] });
    const { files } = generateProject(p, buildTrees(p.config, ctx));
    const list = files['src/modules/user/pages/UserListPage.tsx'];
    assert.match(list, /PAGE_SIZE = 25/);
    assert.match(list, /key: 'email'/);
    assert.doesNotMatch(list, /key: 'fullName'/);
    assert.doesNotMatch(list, /action="delete"/);
    assert.doesNotMatch(list, /navigate\('\/user\/create'\)/);
    assert.match(files['src/modules/user/i18n/en.json'], /Create user/);
    assert.doesNotMatch(files['src/modules/user/i18n/en.json'], /Daftar/); // node disembunyikan
    assert.match(files['src/app/generated/layout.ts'], /Acme/);
    assert.doesNotMatch(files['src/app/generated/navigation.tsx'], /Pengguna/); // menu disembunyikan
});

test('generator skips incomplete modules with a warning', () => {
    const p = project(mod({ entity: { fields: [] } }));
    const { files, warnings } = generateProject(p, buildTrees(p.config, ctx));
    assert.ok(!Object.keys(files).some(f => f.startsWith('src/modules/user/')));
    assert.match(warnings[0], /CRUD without entity fields/);
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
    assert.match(ruleError('bogus'), /Unknown validation rule/);
});

test('relationOf resolves object and legacy string relations', () => {
    const modules = [{ id: 'r', name: 'role', entity: { fields: [{ name: 'code', type: 'string' }, { name: 'name', type: 'string' }] } }];
    assert.equal(relationOf({ type: 'relation', relation: { moduleId: 'r', labelField: 'code' } }, modules).labelField, 'code');
    assert.equal(relationOf({ type: 'relation', relation: 'role' }, modules).labelField, 'name');
    assert.equal(relationOf({ type: 'relation', relation: { moduleId: 'zzz' } }, modules), null);
    assert.deepEqual(relationSampleOptions({ type: 'relation', relation: 'role' }, modules)[0], { label: 'Role 1', value: '1' });
});

test('generator emits react-hook-form rules and relation options from the target module', () => {
    const role = { id: 'm2', name: 'role', label: 'Role', parentId: null, pageId: 'p', entity: { fields: [{ name: 'name', type: 'string' }] }, screens: [{ id: 'r-list', frameId: 'list', pageId: 'p', name: 'List', role: 'list', nodes: {} }] };
    const user = mod({ entity: { fields: [
        { name: 'fullName', label: 'Full name', type: 'string', required: true, rules: ['min:3', 'email', 'pattern:^[A-Z]'] },
        { name: 'role', label: 'Role', type: 'relation', relation: { moduleId: 'm2', labelField: 'name' } },
    ] } });
    nodes.push({ id: 'f-role', parentId: 'form', type: 'frame', isInstance: true, sourceId: 'sel-v', w: 400, h: 60, name: 'Role', propValues: { 'sel-label': 'Role' } });
    const p = { name: 'Demo', config: { modules: [user, role] } };
    const sel = comp('sel', 'SelectField');
    const ctx2 = makeContext({ nodes: [...nodes, sel, { id: 'sel-v', parentId: 'sel-set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:sel-v' }], variables, mappings: [...mappings, { componentKey: 'sel', exportName: 'SelectField', propsMap: { props: [{ source: 'text', key: 'sel-label', name: 'label', type: 'string' }] } }], libraryId: 'lib', fileId: 'app' });
    const { files } = generateProject(p, buildTrees(p.config, ctx2));
    const create = files['src/modules/user/pages/UserCreatePage.tsx'];
    assert.match(create, /minLength: \{ value: 3, message: t\('validation\.minLength'/);
    assert.match(create, /pattern: \{ value: \/\^\[\^\\s@\]\+@/); // email pattern
    assert.match(create, /validate: \{ pattern: /); // custom regex
    assert.match(create, /import \{ useRoleList \} from '\.\.\/\.\.\/role\/api\/queries'/);
    assert.match(create, /options=\{roleOptions\}/);
    assert.match(create, /label: String\(r\.name \?\? ''\)/);
});

test('page title and breadcrumbs follow module and screen role', () => {
    const modules = [
        { id: 'a', name: 'user', label: 'User', parentId: null, screens: [{ id: 'l', role: 'list', name: 'List' }, { id: 'c', role: 'create', name: 'Form' }, { id: 'x', role: 'custom', name: 'Import' }] },
        { id: 'd', name: 'dashboard', label: 'Dashboard', parentId: null, screens: [{ id: 'dd', role: 'custom', name: 'Dashboard' }] },
    ];
    assert.equal(pageTitle(modules[0], modules[0].screens[0]), 'User');
    assert.equal(pageTitle(modules[0], modules[0].screens[1]), 'Add User');
    assert.equal(pageTitle(modules[0], { ...modules[0].screens[0], title: 'All users' }), 'All users');
    assert.deepEqual(breadcrumbsOf(modules, modules[0], modules[0].screens[0]), [{ label: 'Home', path: '/' }, { label: 'User' }]);
    assert.deepEqual(breadcrumbsOf(modules, modules[0], modules[0].screens[1]), [{ label: 'Home', path: '/' }, { label: 'User', path: '/user' }, { label: 'Add' }]);
    assert.deepEqual(breadcrumbsOf(modules, modules[0], modules[0].screens[2]).at(-1), { label: 'Import' });
    assert.deepEqual(breadcrumbsOf(modules, modules[1], modules[1].screens[0]), [{ label: 'Dashboard' }]);
});

test('form fields are grouped on a 12-column grid with spans from rows or node config', () => {
    const { tree } = screenTree(ctx, 'form', { 'f-name': { form: { span: 8, layout: 'horizontal', labelWidth: 200 } } });
    const grid = tree.children.find(c => c.kind === 'formgrid');
    assert.ok(grid, 'fields become a formgrid');
    assert.equal(grid.spans['f-name'], 8);
    assert.deepEqual(formItemOf(findTreeNode(tree, 'f-name')), { span: 8, layout: 'horizontal', labelWidth: 200, align: 'start', tooltip: '' });
    assert.equal(formItemOf({ cfg: {} }).layout, 'vertical');
});

test('validateValues follows the react-hook-form rule order and base-project messages', () => {
    const fields = [
        { name: 'name', label: 'Full name', type: 'string', required: true, rules: ['min:3', 'max:5'] },
        { name: 'email', type: 'string', rules: ['email'] },
        { name: 'age', type: 'number', rules: ['min:18'] },
        { name: 'password', label: 'Password', type: 'password', required: true },
    ];
    assert.deepEqual(validateValues(fields, { name: '', email: '', age: 20, password: '' }), { name: 'Full name is required.', password: 'Password is required.' });
    assert.equal(validateField(fields[0], 'Jo'), 'Full name must be at least 3 characters.');
    assert.equal(validateField(fields[0], 'Jonathan'), 'Full name cannot be greater than 5 characters.');
    assert.equal(validateField(fields[1], 'nope'), 'Email format is invalid.');
    assert.equal(validateField(fields[2], 10), 'Age must be at least 18.');
    assert.equal(validateField(fields[3], '', 'edit'), undefined); // password is only required when creating
});

test('table model, filter fields and soft delete', () => {
    const e = { softDelete: true, fields: [{ name: 'a', type: 'string', filterable: true }, { name: 'b', type: 'string' }] };
    const t = tableModel(e, { table: { headers: { a: 'Alpha' }, widths: { a: 120 }, emptyText: 'Nothing', skipConfirm: true } });
    assert.deepEqual(t.columns[0], { key: 'a', header: 'Alpha', type: 'string', options: undefined, width: 120 });
    assert.deepEqual(t.rowActions, ['view', 'edit', 'delete', 'restore']);
    assert.equal(t.confirm, false);
    assert.equal(t.emptyText, 'Nothing');
    assert.deepEqual(filterFields(e).map(f => f.name), ['a']);
    assert.deepEqual(tableModel({ fields: [] }).rowActions, ['view', 'edit', 'delete']);
});

test('generator emits delete/restore confirm dialogs, filters and soft delete from the design', () => {
    const dlgFrame = [
        { id: 'dset', name: 'Dialog', type: 'frame', componentSet: true, libRef: 'lib:dlg', cprops: [{ id: 'dlg-title', name: 'Title', type: 'text', def: 'Dialog' }, { id: 'dlg-msg', name: 'Message', type: 'text', def: '' }] },
        { id: 'dv', parentId: 'dset', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:dlg-v' },
        { id: 'dframe', name: 'Delete confirm', type: 'frame', w: 560, h: 300, layout: 'vertical' },
        { id: 'dinst', parentId: 'dframe', type: 'frame', isInstance: true, sourceId: 'dv', w: 400, h: 200, name: 'Dialog', propValues: { 'dlg-title': 'Remove this user?', 'dlg-msg': 'You can restore them later.' } },
    ];
    const ctx3 = makeContext({ nodes: [...nodes, ...dlgFrame], variables, mappings: [...mappings, { componentKey: 'dlg', exportName: 'Dialog', propsMap: { props: [{ source: 'text', key: 'dlg-title', name: 'title', type: 'string' }, { source: 'text', key: 'dlg-msg', name: 'message', type: 'string' }] } }], libraryId: 'lib', fileId: 'app' });
    const m = mod({ entity: { ...entity, softDelete: true }, screens: [...mod().screens, { id: 's-dlg', frameId: 'dframe', pageId: 'p', name: 'Delete confirm', role: 'dialog', purpose: 'delete', nodes: {} }] });
    const p = { name: 'Demo', config: { modules: [m] } };
    const { files, warnings } = generateProject(p, buildTrees(p.config, ctx3));
    assert.deepEqual(warnings, []);
    const list = files['src/modules/user/pages/UserListPage.tsx'];
    assert.match(list, /<Dialog/);
    assert.match(list, /pending\?\.kind === 'delete'/);
    assert.match(list, /pending\?\.kind === 'restore'/);
    assert.match(list, /action="restore"/);
    assert.match(list, /deletedAt/);
    assert.match(files['src/modules/user/i18n/en.json'], /Remove this user\?/); // text from the dialog design
    assert.match(files['src/modules/user/api/mock.ts'], /mockRestore/);
    assert.ok(!Object.keys(files).some(f => /pages\/.*Delete/.test(f)), 'dialog screens do not become pages');
});

test('assembleProject makes a standalone project with the vendored library', () => {
    const files = assembleProject({ 'package.json': '{"name":"x","dependencies":{"@midas/ui-cms":"2.3.0","react":"1"}}', '.npmrc': '@midas:registry=x', 'src/a.ts': 'a' }, { 'src/b.ts': 'b' }, { appName: 'CMS Demo', libraryName: '@midas/ui-cms', tarballName: 'midas-ui-cms-2.3.0.tgz', tarball: new Uint8Array([1, 2, 3]) });
    const pkg = JSON.parse(files['package.json']);
    assert.equal(pkg.name, 'cms-demo');
    assert.equal(pkg.dependencies['@midas/ui-cms'], 'file:vendor/midas-ui-cms-2.3.0.tgz');
    assert.equal(pkg.dependencies.react, '1');
    assert.ok(!('.npmrc' in files));
    assert.deepEqual([...files['vendor/midas-ui-cms-2.3.0.tgz']], [1, 2, 3]);
    assert.ok(files['src/a.ts'] && files['src/b.ts']);
    const zip = zipFiles(files);
    assert.equal(new DataView(zip.buffer).getUint16(zip.length - 12, true), Object.keys(files).length);
});

test('suggestScreens guesses roles from frame names', () => {
    const roles = n => suggestScreens(n).map(s => s.purpose ? `${s.role}:${s.purpose}` : s.role).join('+');
    assert.equal(roles('Region — List'), 'list');
    assert.equal(roles('Page · User — List'), 'list');
    assert.equal(roles('Region — Form'), 'create+edit');
    assert.equal(roles('Add user'), 'create');
    assert.equal(roles('Edit user'), 'edit');
    assert.equal(roles('Region — Detail'), 'view');
    assert.equal(roles('Confirm · Delete region'), 'dialog:delete');
    assert.equal(roles('Confirm · Restore user'), 'dialog:restore');
    assert.equal(roles('Confirm · Discard changes (user)'), 'dialog:discard');
    assert.equal(roles('Drawer · Filters'), '');
    assert.equal(roles('Dashboard'), 'custom');
});

test('the UI library package is named in one place: generated pages import it from shared/ui', () => {
    assert.match(libraryFiles('@acme/ui')['src/shared/ui/index.ts'], /export \* from '@acme\/ui';/);
    assert.match(libraryFiles('@acme/ui')['src/shared/ui/library.css'], /@import '@acme\/ui\/tailwind\.css';/);
    assert.match(libraryFiles()['src/shared/ui/index.ts'], /export \* from '@midas\/ui-cms';/);
    const modules = [{ id: 'm', name: 'user', label: 'User', parentId: null, screens: [] }];
    const out = generateProject({ name: 'P', library: { packageName: '@acme/ui' }, config: { modules, layout: {} } }, new Map());
    assert.match(out.files['src/shared/ui/index.ts'], /@acme\/ui/);
    assert.ok(!Object.values(out.files).some(t => typeof t === 'string' && /from '@midas\/ui-cms'/.test(t)), 'no hardcoded package import');
    assert.match(out.files['src/app/generated/navigation.tsx'] ?? '', /(?:from '\.\.\/\.\.\/shared\/ui'|generatedNavItems)/);
    // The assembled project swaps the template's default library for the project's.
    const files = assembleProject({ 'package.json': JSON.stringify({ dependencies: { '@midas/ui-cms': '1.0.0', react: '19' } }) }, out.files, { appName: 'App', libraryName: '@acme/ui', tarballName: 'acme-ui-1.0.0.tgz', tarball: new Uint8Array() });
    const deps = JSON.parse(files['package.json']).dependencies;
    assert.deepEqual(Object.keys(deps).sort(), ['@acme/ui', 'react']);
    assert.equal(deps['@acme/ui'], 'file:vendor/acme-ui-1.0.0.tgz');
});
