import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../dist/index.js';

const render = el => renderToStaticMarkup(el);

test('exports every design component, the theme and the icons', () => {
    for (const name of ['Button', 'IconButton', 'Badge', 'Avatar', 'Alert', 'Card', 'StatCard', 'TextField', 'TextAreaField', 'PasswordField', 'SelectField', 'SwitchField', 'Dialog', 'Table', 'Sidebar', 'Topbar', 'SectionHeader', 'Drawer', 'FilterToolbar', 'AppShell', 'ThemeProvider', 'WidgetIcon', 'PenIcon', 'midasPreview'])
        assert.ok(ui[name], `${name} di-export`);
    assert.deepEqual(ui.themeNames, ['light', 'dark']);
    assert.equal(ui.themes.light.primary, '#4338CA');
});

test('no component is still a scaffold stub', () => {
    const stubs = Object.entries(ui).filter(([, v]) => v && (typeof v === 'function' || typeof v === 'object') && v.midasStub).map(([k]) => k);
    assert.deepEqual(stubs, []);
});

test('Button renders variant, size and icon from the design contract', () => {
    const html = render(h(ui.Button, { variant: 'danger', size: 'md', icon: h('i', { 'data-i': 1 }), testId: 'del' }, 'Delete'));
    assert.match(html, /data-testid="del"/);
    assert.match(html, /bg-danger/);
    assert.match(html, /h-10/);
    assert.match(html, /data-i="1"/);
    assert.match(html, />Delete</);
});

test('fields link label and error to the control', () => {
    const html = render(h(ui.TextField, { id: 'nm', label: 'Name', error: 'Required', placeholder: 'Full name' }));
    assert.match(html, /<label for="nm"[^>]*>Name<\/label>/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /aria-describedby="nm-error"/);
    assert.match(html, /id="nm-error"[^>]*>Required</);
    const select = render(h(ui.SelectField, { id: 'r', label: 'Role', value: 'a', options: [{ label: 'Admin', value: 'a' }], placeholder: 'Select' }));
    assert.match(select, /role="combobox"/);
    assert.match(select, />Admin</); // the selected option's label is shown in the trigger
});

test('Table shows rows, row actions, the empty state and the range', () => {
    const base = { columns: [{ key: 'name', header: 'Name' }], rowKey: r => r.id, renderAction: () => h('b', null, 'action') };
    const html = render(h(ui.Table, { ...base, data: [{ id: 1, name: 'Budi' }, { id: 2, name: 'Ani' }], totalRecords: 12, pageSize: 2 }));
    assert.match(html, />Budi</);
    assert.equal((html.match(/<b>action<\/b>/g) || []).length, 2);
    assert.match(html, /Showing 1–2 of 12/);
    assert.match(render(h(ui.Table, { ...base, data: [] })), /No data yet\./);
});

test('Sidebar marks the active item and collapses to icons only', () => {
    const items = [{ label: 'Dashboard', path: '/' }, { label: 'User', path: '/user' }];
    const open = render(h(ui.Sidebar, { items, activePath: '/user/12' }));
    assert.match(open, /aria-current="page"[^>]*>(?:(?!<\/a>).)*User/);
    assert.equal((open.match(/aria-current="page"/g) || []).length, 1);
    const closed = render(h(ui.Sidebar, { items, activePath: '/', collapsed: true }));
    assert.match(closed, /w-\[72px\]/);
    assert.doesNotMatch(closed, />Dashboard<\/span>/);
});

test('Dialog renders only when open', () => {
    assert.equal(render(h(ui.Dialog, { open: false, onClose() {}, title: 'Delete?' })), '');
    assert.match(render(h(ui.Dialog, { open: true, onClose() {}, title: 'Delete?', footer: 'buttons' }, 'Body')), /role="dialog"[\s\S]*Delete\?[\s\S]*buttons/);
});

test('every midasPreview entry renders without errors (Live DOM Renderer in Studio)', () => {
    assert.ok(Object.keys(ui.midasPreview).length >= 6);
    for (const [name, props] of Object.entries(ui.midasPreview))
        assert.doesNotThrow(() => render(h(ui[name], props)), `${name} failed to render with midasPreview`);
});

test('Dialog renders default Cancel / Confirm buttons when onConfirm is set', () => {
    const html = render(h(ui.Dialog, { open: true, onClose() {}, onConfirm() {}, title: 'Delete user?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }));
    assert.match(html, /This cannot be undone\./);
    assert.match(html, />Cancel</);
    assert.match(html, />Delete</);
});

test('IconButton supports the restore action', () => {
    assert.match(render(h(ui.IconButton, { action: 'restore' })), /aria-label="Restore"/);
});

test('Drawer renders title, content and the default footer buttons', () => {
    const html = render(h(ui.Drawer, { open: true, onClose() {}, onPrimary() {}, title: 'Filters' }, 'Fields'));
    assert.match(html, /role="dialog"/);
    assert.match(html, />Filters</);
    assert.match(html, />Reset</);
    assert.match(html, />Apply</);
    assert.equal(render(h(ui.Drawer, { open: false, onClose() {} })), '');
});
