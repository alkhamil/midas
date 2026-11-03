// The Custom template box of the Behavior panel: a schema textarea and Apply, on a plain frame and on a master that is bound to no template or to a Custom
// one, with the problems of the last Apply listed under it as label rows. A master bound to a built-in template has no box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { masterPanel, createBinding, TEMPLATES, activateDocumentTemplates } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const frame = custom => behaviorPanelHtml({ kind: 'frame', esc, templates: [{ id: 'button', name: 'Button' }], custom });
const master = (node, custom) => behaviorPanelHtml({ kind: 'master', panel: masterPanel(node, []), esc, custom });

test('a plain frame offers the Custom box: a schema textarea and Apply', () => {
    const html = frame({ text: '', problems: [] });
    assert.match(html, /<textarea[^>]*data-bp="custom-schema"[^>]*><\/textarea>/);
    assert.match(html, /<button class="wide-button full-width" data-bp-action="custom-apply">Apply<\/button>/);
    assert.match(html, /Custom template/);
});

test('the text of the last attempt stays in the box, escaped, and each problem is a row under it', () => {
    const html = frame({ text: '{ "id": "<x>" }', problems: ['id "<x>" must be custom-', 'tokens must be an object'] });
    assert.match(html, /\{ &quot;id&quot;: &quot;&lt;x&gt;&quot; \}<\/textarea>/);
    assert.match(html, /<div class="small-label">id &quot;&lt;x&gt;&quot; must be custom-<\/div>/);
    assert.match(html, /<div class="small-label">tokens must be an object<\/div>/);
    assert.doesNotMatch(frame({ text: '', problems: [] }), /small-label">[^<]*must/);
});

test('an unbound master has the box beside its Template dropdown; a master bound to Button has none', () => {
    const unbound = master({ id: 'm', name: 'M', component: true }, { text: '', problems: [] });
    assert.match(unbound, /data-bp="template"/);
    assert.match(unbound, /data-bp="custom-schema"/);
    const bound = master({ id: 'b', name: 'Button', component: true, behavior: createBinding(TEMPLATES.get('button'), []) }, { text: '', problems: [] });
    assert.doesNotMatch(bound, /custom-schema/);
});

test('without the custom state (no Custom box asked for) the panels are as they were', () => {
    assert.doesNotMatch(frame(undefined), /custom-schema/);
});

test('a master bound to a Custom template has the box, to edit its schema', () => {
    const behavior = { version: 2, templates: { 'custom-card': { ...structuredClone(TEMPLATES.get('formitem')), id: 'custom-card', name: 'Card' } } };
    activateDocumentTemplates(behavior);
    try {
        const node = { id: 'c', name: 'Card', component: true, behavior: { version: 2, templateId: 'custom-card', variables: {} } };
        const html = master(node, { text: '{}', problems: [] });
        assert.match(html, /data-bp="custom-schema"/);
        assert.match(html, /<option value="custom-card" selected>Card<\/option>/);
    } finally { activateDocumentTemplates(undefined); }
});
