// The Input's side controls in the Behavior tab markup: Has Prefix and Has Suffix switches, then for each side a Text|Icon segmented control
// and the content its kind picks (a text field, or an icon swap). The segmented control is the Design panel's own `ly-seg` primitive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { instancePanel, createBinding, TEMPLATES } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const input = TEMPLATES.get('input');
const collections = [
    { id: 'c-variant', name: 'Input Variant', modes: [{ id: 'outlined', name: 'outlined' }] },
    { id: 'c-status', name: 'Input Status', modes: [{ id: 'default', name: 'default' }] },
    { id: 'c-size', name: 'Input Size', modes: [{ id: 'md', name: 'md' }] },
];
const master = { id: 'in', name: 'Input', component: true, behavior: createBinding(input, collections) };
const html = props => behaviorPanelHtml({
    kind: 'instance',
    panel: instancePanel({ id: 'i1', name: 'Field', isInstance: true, sourceId: 'in', behavior: { version: 2, props } }, master, collections, { variant: 'outlined', status: 'default', size: 'md' }),
    esc,
});
const segmentOf = (markup, prop) => new RegExp(`<div class="ly-seg"[^>]*aria-label="${prop}">([\\s\\S]*?)</div>`).exec(markup)?.[1] ?? null;

test('a side that is off shows its switch and no kind, text or icon control', () => {
    const markup = html({});
    assert.match(markup, /data-bp-type="boolean" data-bp-prop="hasPrefix"/);
    assert.match(markup, /data-bp-type="boolean" data-bp-prop="hasSuffix"/);
    assert.doesNotMatch(markup, /prefixKind|suffixKind|data-bp-prop="prefixText"|data-bp-prop="suffixText"|data-bp-prop="prefixIcon"|data-bp-prop="suffixIcon"/);
});

test('a side that is on shows a Text|Icon segmented control, with the kind pressed', () => {
    const markup = html({ hasPrefix: true });
    const segment = segmentOf(markup, 'prefixKind');
    assert.ok(segment, 'the segmented control is drawn');
    assert.match(segment, /<button type="button" class="on" data-bp-action="segment" data-bp-prop="prefixKind" data-bp-value="text" aria-pressed="true">Text<\/button>/);
    assert.match(segment, /<button type="button" class="" data-bp-action="segment" data-bp-prop="prefixKind" data-bp-value="icon" aria-pressed="false">Icon<\/button>/);
    assert.doesNotMatch(markup, /<select[^>]*data-bp-prop="prefixKind"/, 'not a dropdown');
});

test('the Text kind shows the text field, and the Icon kind shows the icon swap', () => {
    const text = html({ hasPrefix: true, prefixKind: 'text', prefixText: 'Rp', prefixIcon: 'check' });
    assert.match(text, /type="text"[^>]*data-bp-prop="prefixText" value="Rp"/);
    assert.doesNotMatch(text, /data-bp-action="icon" data-bp-prop="prefixIcon"/);
    const icon = html({ hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check', prefixText: 'Rp' });
    assert.match(icon, /data-bp-action="icon" data-bp-prop="prefixIcon" data-bp-value="check"/);
    assert.doesNotMatch(icon, /data-bp-prop="prefixText"/);
    assert.match(segmentOf(icon, 'prefixKind'), /class="on" data-bp-action="segment" data-bp-prop="prefixKind" data-bp-value="icon"/);
});

test('the sides are independent: the switches and the kinds are Props, the text or icon of a side is its slot', () => {
    const markup = html({ hasPrefix: true, hasSuffix: true, suffixKind: 'icon' });
    assert.ok(segmentOf(markup, 'prefixKind') && segmentOf(markup, 'suffixKind'));
    const slots = markup.slice(markup.indexOf('<span>Slots</span>'));
    for (const prop of ['prefixText', 'suffixIcon']) assert.ok(slots.includes(`data-bp-prop="${prop}"`), `${prop} is under Slots`);
    const props = markup.slice(markup.indexOf('<span>Props</span>'), markup.indexOf('<span>Slots</span>'));
    for (const prop of ['hasPrefix', 'prefixKind', 'hasSuffix', 'suffixKind']) assert.ok(props.includes(`data-bp-prop="${prop}"`), `${prop} is under Props`);
    for (const prop of ['prefixText', 'suffixIcon']) assert.ok(!props.includes(`data-bp-prop="${prop}"`), `${prop} is not under Props`);
});

test('a prop that is not a segmented enum stays a dropdown', () => {
    const markup = behaviorPanelHtml({
        kind: 'instance',
        panel: instancePanel({ id: 'i1', name: 'Field', isInstance: true, sourceId: 'in', behavior: { version: 2, props: {} } }, master, collections, { variant: 'outlined', status: 'default', size: 'md' }),
        esc,
    });
    assert.match(markup, /<select data-bp="value" data-bp-kind="variable" data-bp-prop="variant"/);
});
