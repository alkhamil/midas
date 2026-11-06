// The Switch's controls in the Behavior tab markup: a Loading switch, then per state an
// always-visible Text|Icon segmented control and the content its kind picks (a text
// field, or an icon swap). No has-switch: the state (checked) gates the slots. Turning
// loading on clears the hover/focus preview, as Button's loading does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';
import { instancePanel, createBinding, clearsPreview, previewOf, TEMPLATES } from '@midas/builder-core';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sw = TEMPLATES.get('switch');
const collections = [
    { id: 'c-color', name: 'Switch Color', modes: [{ id: 'default', name: 'default' }, { id: 'primary', name: 'primary' }] },
    { id: 'c-size', name: 'Switch Size', modes: [{ id: 'small', name: 'small' }, { id: 'default', name: 'default' }] },
];
const master = { id: 'sw', name: 'Switch', component: true, behavior: createBinding(sw, collections) };
const html = props => behaviorPanelHtml({
    kind: 'instance',
    panel: instancePanel({ id: 'i1', name: 'Toggle', isInstance: true, sourceId: 'sw', behavior: { version: 2, props } }, master, collections, { color: 'primary', size: 'default' }),
    esc,
});
const segmentOf = (markup, prop) => new RegExp(`<div class="ly-seg"[^>]*aria-label="${prop}">([\\s\\S]*?)</div>`).exec(markup)?.[1] ?? null;

test('Loading is a switch under Props', () => {
    const markup = html({});
    assert.match(markup, /data-bp-type="boolean" data-bp-prop="loading"/);
    const props = markup.slice(markup.indexOf('<span>Props</span>'), markup.indexOf('<span>Slots</span>'));
    assert.ok(props.includes('data-bp-prop="loading"'), 'loading is under Props');
});

test('both kinds always show a Text|Icon segmented control, with text pressed', () => {
    const markup = html({});
    for (const kind of ['checkedKind', 'uncheckedKind']) {
        const segment = segmentOf(markup, kind);
        assert.ok(segment, `${kind} draws a segmented control with no switch to turn first`);
        assert.match(segment, new RegExp(`<button type="button" class="on" data-bp-action="segment" data-bp-prop="${kind}" data-bp-value="text" aria-pressed="true">Text<\\/button>`));
        assert.match(segment, new RegExp(`<button type="button" class="" data-bp-action="segment" data-bp-prop="${kind}" data-bp-value="icon" aria-pressed="false">Icon<\\/button>`));
    }
});

test('the Text kind shows the text field, and the Icon kind shows the icon swap', () => {
    const text = html({ checkedChildren: 'on', uncheckedChildren: 'off' });
    assert.match(text, /type="text"[^>]*data-bp-prop="checkedChildren" value="on"/);
    assert.match(text, /type="text"[^>]*data-bp-prop="uncheckedChildren" value="off"/);
    assert.doesNotMatch(text, /data-bp-prop="checkedIcon"|data-bp-prop="uncheckedIcon"/);
    const icon = html({ checked: true, checkedKind: 'icon', checkedIcon: 'Icon/check', uncheckedChildren: 'off' });
    assert.match(icon, /data-bp-action="icon" data-bp-prop="checkedIcon" data-bp-value="Icon\/check"/);
    assert.ok(icon.includes('Checked icon'), 'the icon row carries its slot label');
    assert.doesNotMatch(icon, /data-bp-prop="checkedChildren"/);
    const iconOff = html({ uncheckedKind: 'icon', uncheckedIcon: 'Icon/close', checkedChildren: 'on' });
    assert.match(iconOff, /data-bp-action="icon" data-bp-prop="uncheckedIcon" data-bp-value="Icon\/close"/);
    assert.ok(iconOff.includes('Unchecked icon'), 'the icon row carries its slot label');
    assert.doesNotMatch(iconOff, /data-bp-prop="uncheckedChildren"/);
});

test('the state rows live under Slots, loading and disabled under Props', () => {
    const on = html({ checked: true, checkedKind: 'icon' }).slice(html({ checked: true, checkedKind: 'icon' }).indexOf('<span>Slots</span>'));
    for (const prop of ['checked', 'checkedKind', 'checkedIcon']) assert.ok(on.includes(`data-bp-prop="${prop}"`), `${prop} is under Slots`);
    const off = html({ uncheckedKind: 'icon' }).slice(html({ uncheckedKind: 'icon' }).indexOf('<span>Slots</span>'));
    for (const prop of ['uncheckedKind', 'uncheckedIcon']) assert.ok(off.includes(`data-bp-prop="${prop}"`), `${prop} is under Slots`);
    const markup = html({ checkedKind: 'icon', uncheckedKind: 'icon' });
    const props = markup.slice(markup.indexOf('<span>Props</span>'), markup.indexOf('<span>Slots</span>'));
    for (const prop of ['loading', 'disabled']) assert.ok(props.includes(`data-bp-prop="${prop}"`), `${prop} is under Props`);
});

test('loading clears the interaction preview, and the preview resolves with loading on', () => {
    assert.equal(clearsPreview(sw, 'loading'), true);
    for (const state of ['default', ...Object.keys(sw.previewStates)]) {
        assert.doesNotThrow(() => previewOf(sw, master.behavior, { color: 'primary', size: 'default' }, { collections, items: [] }, { loading: true }, state), `loading previews in ${state}`);
    }
});
