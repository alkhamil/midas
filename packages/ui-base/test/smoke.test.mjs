// Smoke test paket hasil build: komponen ter-render dengan ikon design system dan teks i18n bawaan.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as ui from '../dist/index.js';

await i18next.use(initReactI18next).init({ lng: 'id', resources: { id: { translation: { common: { save: 'Simpan (aplikasi)' } } } }, interpolation: { escapeValue: false } });
ui.registerUiLocales(i18next);

test('exports components, icons, theme and locales', () => {
    for (const name of ['Button', 'Badge', 'Alert', 'Card', 'Table', 'TextField', 'SelectField', 'Dialog', 'Sidebar', 'AppShell', 'ToastProvider', 'Icon', 'AltArrowDownIcon', 'ThemeProvider', 'applyTheme'])
        assert.ok(ui[name], `${name} di-export`);
    assert.ok(ui.iconNames.length >= 300);
    assert.deepEqual(ui.themeNames, ['light', 'dark']);
    assert.equal(ui.themes.light.primary, '#0058CA');
    assert.equal(ui.themes.dark.primary, '#5B9BF5');
    assert.equal(ui.themes.light.fontFamily, 'Inter');
});

test('registerUiLocales does not override app translations', () => {
    assert.equal(i18next.t('common.save'), 'Simpan (aplikasi)');
    assert.equal(i18next.t('common.cancel'), 'Batal');
});

test('components render with design system icons instead of lucide', () => {
    const btn = renderToStaticMarkup(h(ui.Button, { variant: 'danger', size: 'sm', icon: h(ui.TrashBinIcon), testId: 'del' }, 'Hapus'));
    assert.match(btn, /data-testid="del"/);
    assert.match(btn, /data-icon="trash-bin"/);
    assert.match(btn, /bg-danger/);
    const alert = renderToStaticMarkup(h(ui.Alert, { variant: 'warning', message: 'Periksa data' }));
    assert.match(alert, /Periksa data/);
    assert.match(alert, /data-icon="danger-triangle"/);
    const badge = renderToStaticMarkup(h(ui.Badge, { variant: 'success' }, 'Aktif'));
    assert.match(badge, /Aktif/);
    const row = renderToStaticMarkup(h(ui.RowActionButton, { action: 'edit' }));
    assert.match(row, /data-icon="pen"/);
});

test('Table renders headers, rows and translated pagination', () => {
    const html = renderToStaticMarkup(h(ui.Table, {
        columns: [{ key: 'name', header: 'Nama' }],
        data: [{ id: 1, name: 'Budi' }],
        totalRecords: 1, page: 1, pageSize: 10, onPageChange() {}, onPageSizeChange() {},
        rowKey: item => item.id, renderAction: () => h(ui.RowActionButton, { action: 'delete' }),
    }));
    assert.match(html, /Nama/);
    assert.match(html, /Budi/);
    assert.match(html, /data-icon="trash-bin"/);
    assert.doesNotMatch(html, /table\.(totalRecords|rowsPerPage|action)/, 'translation keys are resolved');
});
