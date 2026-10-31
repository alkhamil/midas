// Auto Fix wiring: the Diagnostics button renders only while fixable findings exist, and the studio handler confirms
// once, applies in one transaction, then reports what was made.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { masterPanel, instancePanel, createBinding, TEMPLATES } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'solid', name: 'Solid' }, { id: 'outlined', name: 'Outlined' }] };
const master = (collections = [variant]) => ({ id: 'btn', name: 'Button', component: true, behavior: createBinding(button, collections) });
const instance = (behavior = { version: 2, props: {} }) => ({ id: 'i1', name: 'Save', isInstance: true, sourceId: 'btn', behavior });
const missing = [{ severity: 'error', code: 'variable-missing', nodeId: 'btn', message: 'Button: variable "button/bg" is missing from collection "Variant".' }];

test('the master Diagnostics show Auto Fix only while fixable findings exist', () => {
    const withFix = behaviorPanelHtml({ kind: 'master', panel: masterPanel(master(), [variant]), esc, findings: missing, autoFix: { fixable: true, count: 3 } });
    assert.ok(withFix.includes('data-bp-action="auto-fix"') && withFix.includes('Auto Fix (3)'));
    const without = behaviorPanelHtml({ kind: 'master', panel: masterPanel(master(), [variant]), esc, findings: missing });
    assert.ok(!without.includes('data-bp-action="auto-fix"'));
    const calm = behaviorPanelHtml({ kind: 'master', panel: masterPanel(master(), [variant]), esc, findings: [], autoFix: { fixable: false, count: 0 } });
    assert.ok(!calm.includes('data-bp-action="auto-fix"'));
});

test('instance Diagnostics never show Auto Fix', () => {
    const html = behaviorPanelHtml({ kind: 'instance', panel: instancePanel(instance(), master([variant]), [variant], { variant: 'solid' }), esc, findings: missing });
    assert.ok(!html.includes('data-bp-action="auto-fix"'));
});

test('midas.js confirms once, applies in one transaction, then reports', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    assert.equal(src.split('data-bp-action="auto-fix"').length - 1, 1); // the click handler (the button lives in behaviorPanel.js)
    assert.equal(src.split("transaction('Auto Fix'").length - 1, 1); // a single transaction is a single undo step
    assert.ok(src.includes('planAutoFix({ template, binding, variables: varStore()'), 'plans from the live store');
    assert.ok(src.includes('applyAutoFix(varStore(), binding, plan, uid)'), 'applies the plan');
    assert.ok(src.includes('bindMasterTokens(master)'), 'reuses the existing bind pipeline');
    assert.ok(src.includes("confirmLabel: 'Auto Fix'"), 'confirms before applying');
    assert.ok(src.includes("choiceDialog({ title: 'Auto Fix done'"), 'reports the result in the UI');
    for (const name of ['planAutoFix', 'applyAutoFix']) assert.ok(src.includes(name), `${name} is imported`);
});
