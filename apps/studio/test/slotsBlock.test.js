// The Behavior tab's Slots block for Alert and Card: the toggles (Closable, Action, Extra, Actions, ...) are Props, the parts they add are the slots, in the order of the
// layers and with the names of the component's slot properties (one list, slotListOf). A free-content slot (Card Body) is named and left to the Design tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { instancePanel, createBinding, slotListOf, resolveProps, TEMPLATES } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlOf(templateId, props) {
    const template = TEMPLATES.get(templateId);
    const collections = Object.entries(template.props).filter(([, d]) => d.source === 'variable').map(([name, d]) => ({ id: `c-${name}`, name: `${template.name} ${d.collection}`, modes: d.modes.map(m => ({ id: m, name: m })) }));
    const master = { id: 'm', name: template.name, component: true, behavior: createBinding(template, collections) };
    const modes = Object.fromEntries(Object.entries(template.props).filter(([, d]) => d.source === 'variable').map(([name, d]) => [name, d.defaultMode]));
    const instance = { id: 'i1', name: template.name, isInstance: true, sourceId: 'm', behavior: { version: 2, props } };
    const markup = behaviorPanelHtml({ kind: 'instance', panel: instancePanel(instance, master, collections, modes), esc });
    const at = markup.indexOf('<span>Slots</span>');
    return { props: markup.slice(markup.indexOf('<span>Props</span>'), at), slots: markup.slice(at), template, values: resolveProps(template, props) };
}
const names = slots => [...slots.matchAll(/class="cmp-prop2"><span[^>]*>([^<]*)</g)].map(m => m[1]);

test('Alert: the toggles are Props, the parts they add are the slots: Icon, Title, Description, Action, Icon close', () => {
    const { props, slots } = htmlOf('antd-alert', { description: true, action: true, closable: true });
    for (const toggle of ['showIcon', 'description', 'action', 'closable']) assert.ok(props.includes(`data-bp-prop="${toggle}"`), `${toggle} is a Prop`);
    for (const toggle of ['showIcon', 'description', 'action', 'closable']) assert.ok(!slots.includes(`data-bp-prop="${toggle}"`), `${toggle} is not under Slots`);
    assert.deepEqual(names(slots), ['Icon', 'Title', 'Description', 'Action', 'Icon close']);
});

test('Alert: a slot is listed only while its toggle is on', () => {
    assert.deepEqual(names(htmlOf('antd-alert', {}).slots), ['Icon', 'Title']);
});

test('Card: Title, Extra, Body, Cover and the three actions are the slots; Body is named and left to the Design tab', () => {
    const { slots, template, values } = htmlOf('antd-card', { extra: true, cover: true, actions: true });
    assert.deepEqual(names(slots), slotListOf(template, values).map(e => e.name));
    assert.deepEqual(names(slots), ['Title', 'Extra', 'Cover', 'Body', 'Action 1', 'Action 2', 'Action 3']);
    assert.match(slots, /Edit in the Design tab/);
    assert.doesNotMatch(slots, /bodyLine|Card content/, 'the body content is not in the Behavior tab');
    assert.equal((slots.match(/data-bp-action="slot-fill"/g) ?? []).length, 4, 'Extra and the three actions take an instance from the Behavior tab');
});

import { imageSlotRowHtml } from '../src/engine/slotRow.js';

test('the Cover row in the component\'s slot properties names the slot and selects its layer, with no editing control; the Behavior tab\'s Cover row keeps its thumbnail and Replace', () => {
    const row = imageSlotRowHtml({ name: 'Cover', layerId: 'layer-1', esc, icon: '<svg></svg>' });
    assert.doesNotMatch(row, /<button|<input|<select|<img|data-bp-action/, 'no control, no thumbnail');
    assert.match(row, /data-select-layer="layer-1"/);
    assert.match(row, />Image</);
    const { slots, template, values } = htmlOf('antd-card', { cover: true, coverImage: 'asset-1' });
    assert.match(slots, /data-bp-action="image-pick" data-bp-prop="coverImage"/, 'Replace');
    assert.match(slots, /data-img-asset="asset-1"/, 'the thumbnail');
    // Both lists name the same slots: the row above is the entry of the one list.
    assert.ok(slotListOf(template, values).some(e => e.kind === 'image' && e.name === 'Cover'));
    assert.deepEqual(names(slots), slotListOf(template, values).map(e => e.name));
});
