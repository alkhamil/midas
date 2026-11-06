// The Behavior tab of an instance is drawn for every registered template, whatever it holds. It used to build a text-colour variable name from the template's
// primary text part, which a template with no text (Icon Button, Switch) does not have: the build threw and the whole tab was empty. midas.js needs a browser,
// so the source is read, and the pure steps it runs are replayed for every template of the registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';

const { TEMPLATES, instancePanel, previewOf, previewStateOf } = core;
const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const at = src.indexOf('function behaviorTabHtml(');
const tab = src.slice(at, src.indexOf('\n}\n', at));

test('the instance tab does not name a text-colour variable: a template may have no text', () => {
    assert.ok(!tab.includes('textColorTokenOf'), 'no text token is read');
    assert.ok(!tab.includes('textVar'), 'and none is built');
});

test('a preview state the template does not have is shown as Default instead of throwing', () => {
    assert.ok(tab.includes('previewStateOf(template, behaviorPreview)'));
    const canvas = src.slice(src.indexOf('function canvasPreviewOf('), src.indexOf('function behaviorTabHtml('));
    assert.ok(canvas.includes('previewStateOf(template, behaviorPreview)'), 'the canvas colours follow the same guard');
    assert.ok(tab.includes('available: Object.keys(template.previewStates)'), 'the selector lists the states the template declares');
    assert.equal(previewStateOf(TEMPLATES.get('switch'), 'hover'), TEMPLATES.get('switch').previewStates.hover ? 'hover' : 'default');
    assert.equal(previewStateOf(TEMPLATES.get('button'), 'hover'), 'hover');
    assert.equal(previewStateOf({ previewStates: {} }, 'hover'), 'default');
    assert.equal(previewStateOf({ previewStates: {} }, 'default'), 'default');
});

test('every registered template gives its instance a panel with rows and a preview in every state it declares', () => {
    for (const template of TEMPLATES.values()) {
        const master = { id: 'm', component: true, behavior: { version: 2, templateId: template.id, variables: Object.fromEntries(Object.entries(template.props).filter(([, d]) => d.source === 'variable').map(([p]) => [p, `c-${p}`])) } };
        const collections = Object.entries(master.behavior.variables).map(([p, id]) => ({ id, name: p, modes: [{ id: 'm1', name: 'm1' }] }));
        const panel = instancePanel({ id: 'i', behavior: { props: {} } }, master, collections, {});
        assert.ok(panel.rows.length > 0, `${template.id} has rows`);
        for (const state of ['default', ...Object.keys(template.previewStates)]) {
            assert.doesNotThrow(() => previewOf(template, master.behavior, {}, { collections, items: [] }, {}, state), `${template.id} ${state}`);
        }
    }
});
