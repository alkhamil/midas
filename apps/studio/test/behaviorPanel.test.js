// Behavior tab renderer (stage 5): the markup for a master and for an instance, built from the builder-core panel models.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { masterPanel, instancePanel, createBinding, TEMPLATES } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'solid', name: 'Solid' }, { id: 'outlined', name: 'Outlined' }] };
const master = (collections = [variant]) => ({ id: 'btn', name: 'Button', component: true, behavior: createBinding(button, collections) });
const instance = (behavior = { version: 2, props: {} }) => ({ id: 'i1', name: 'Save', isInstance: true, sourceId: 'btn', behavior });
const masterHtml = (node, collections) => behaviorPanelHtml({ kind: 'master', panel: masterPanel(node, collections), esc });
const instanceHtml = (node, mast, collections, modes = { variant: 'solid', size: null }) => behaviorPanelHtml({ kind: 'instance', panel: instancePanel(node, mast, collections, modes), esc });

test('a master bound to Button shows the template and each variable prop with its collection', () => {
    const html = masterHtml(master([variant]), [variant]);
    assert.match(html, /data-bp="template"/);
    assert.match(html, /<option value="button" selected>Button<\/option>/);
    assert.match(html, /data-bp="collection" data-bp-prop="variant"/);
    assert.match(html, /<option value="c-variant" selected>Variant<\/option>/);
    assert.match(html, /Auto-matched/);
});

test('the component panel lists the icon needs first, with the same binding slots', () => {
    const html = masterHtml(master([variant]), [variant]);
    assert.match(html, /<span title="size">Icon size<\/span>/);
    assert.match(html, /<span title="variant">Icon colour<\/span>/);
    assert.equal(html.indexOf('Icon size') < html.indexOf('data-bp-prop="size"'), true);
    assert.equal(html.split('data-bp-prop="size"').length - 1, 2);
    assert.match(html, /data-bp="collection" data-bp-prop="size"/);
});

test('an unbound icon need shows the miss like an unbound dimension', () => {
    const html = masterHtml(master([variant]), [variant]);
    assert.match(html, /No "Size" collection matched/);
});

test('a variable prop with no matching collection shows the miss and offers the picker', () => {
    const html = masterHtml(master([variant]), [variant]);
    assert.match(html, /data-bp-prop="size"/);
    assert.match(html, /No "Size" collection matched/);
});

test('the master shows the contract read-only, and no icon control', () => {
    const html = masterHtml(master([variant]), [variant]);
    assert.match(html, /<span title="label">Label<\/span>/);
    assert.match(html, /string · default Button/);
    assert.match(html, /onClick \(trigger\), onHover \(trigger\), onFocus, onBlur/);
    assert.doesNotMatch(html, /data-bp-prop="icon"|data-bp-prop="hasIcon"|data-bp-prop="iconPlacement"/);
});

test('an unbound master shows the template picker and no collection rows', () => {
    const html = masterHtml({ id: 'btn', component: true }, [variant]);
    assert.match(html, /data-bp="template"/);
    assert.match(html, /<option value="">None<\/option>/);
    assert.doesNotMatch(html, /data-bp="collection"/);
    assert.match(html, /Choose a template/);
});

test('an instance shows its variable props with the bound modes and its literal props', () => {
    const html = instanceHtml(instance(), master([variant]), [variant]);
    assert.match(html, /data-bp="value" data-bp-kind="variable" data-bp-prop="variant"/);
    assert.match(html, /<option value="outlined"\s*>Outlined<\/option>/);
    assert.match(html, /data-bp-kind="literal" data-bp-type="string" data-bp-prop="label" value="Button"/);
    assert.match(html, /data-bp-type="boolean" data-bp-prop="loading"/);
});

test('visibleIf: the icon placement is rendered only while hasIcon is on', () => {
    const off = instanceHtml(instance(), master([variant]), [variant]);
    assert.doesNotMatch(off, /data-bp-prop="iconPlacement"/);
    const on = instanceHtml(instance({ version: 2, props: { hasIcon: true } }), master([variant]), [variant]);
    assert.match(on, /data-bp-type="enum" data-bp-prop="iconPlacement"/);
});

test('hasIcon is disabled while Size is unbound, naming the collection', () => {
    const html = instanceHtml(instance(), master([variant]), [variant]);
    assert.match(html, /data-bp-type="boolean" data-bp-prop="hasIcon"[^>]*disabled/);
    assert.match(html, /Bind a &quot;Size&quot; collection to the component to use Has Icon/);
});

test('a variable prop whose collection is not bound is disabled, with a hint', () => {
    const html = instanceHtml(instance(), master([]), []);
    assert.match(html, /data-bp-prop="variant" aria-label="variant" disabled/);
    assert.match(html, /Bind a &quot;Variant&quot; collection/);
});

test('Diagnostics lists at most 5 findings, errors first, with View all (N)', () => {
    const findings = [
        { severity: 'warning', message: 'w1' }, { severity: 'error', message: 'e1' },
        { severity: 'info', message: 'n1' }, { severity: 'error', message: 'e2' },
        { severity: 'warning', message: 'w2' }, { severity: 'error', message: 'e3' },
        { severity: 'warning', message: 'w3' },
    ];
    const html = behaviorPanelHtml({ kind: 'master', panel: masterPanel(master([variant]), [variant]), esc, findings });
    assert.match(html, /View all \(7\)/);
    assert.doesNotMatch(html, /Show less/);
    assert.doesNotMatch(html, /w3/);
    assert.doesNotMatch(html, /n1/);
    const at = m => html.indexOf(`>${m}<`);
    assert.ok(at('e1') < at('e2') && at('e2') < at('e3') && at('e3') < at('w1') && at('w1') < at('w2'), 'errors list before warnings');
});

test('expanded Diagnostics lists every finding with Show less', () => {
    const findings = [
        { severity: 'warning', message: 'w1' }, { severity: 'error', message: 'e1' },
        { severity: 'info', message: 'n1' }, { severity: 'error', message: 'e2' },
        { severity: 'warning', message: 'w2' }, { severity: 'error', message: 'e3' },
        { severity: 'warning', message: 'w3' },
    ];
    const html = behaviorPanelHtml({ kind: 'master', panel: masterPanel(master([variant]), [variant]), esc, findings, expanded: true });
    for (const m of ['w1', 'e1', 'n1', 'e2', 'w2', 'e3', 'w3']) assert.match(html, new RegExp(`>${m}<`));
    assert.match(html, /Show less/);
    assert.doesNotMatch(html, /View all/);
});

test('Auto Fix sits in the Diagnostics title row while fixable findings exist', () => {
    const panel = masterPanel(master([variant]), [variant]);
    const findings = [{ severity: 'error', code: 'variable-missing', message: 'Button: variable "button/bg" is missing from collection "Variant".' }];
    const withFix = behaviorPanelHtml({ kind: 'master', panel, esc, findings, autoFix: { fixable: true, count: 3 } });
    assert.match(withFix, /section-heading"><span>Diagnostics<\/span><button[^>]*data-bp-action="auto-fix">Auto Fix \(3\)/);
    const without = behaviorPanelHtml({ kind: 'master', panel, esc, findings });
    assert.doesNotMatch(without, /data-bp-action="auto-fix"/);
});

test('a node with no behavior gets a plain message', () => {
    assert.match(behaviorPanelHtml({ kind: 'none', esc }), /Select a component/);
});
