// The studio's wiring of the Input family (Password, TextArea, InputNumber). midas.js and play.js need a browser, so these tests read the source the way the other
// studio tests do (what is called, in which order) and replay the pure sequence the glue runs with the same builder-core functions. NOT verified here, because it needs
// a browser: the canvas drawing of the eye and arrow outlines, the textarea wrapping, a real click in Play, the Behavior panel rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';

const midas = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const play = fs.readFileSync(new URL('../src/engine/play.js', import.meta.url), 'utf8');
const body = name => {
    const at = midas.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return midas.slice(at, midas.indexOf('\n}\n', at));
};

test('applyLiteralFields gives the text layers of a multiline control their min and max height from their own line height, after the bindings', () => {
    const fields = body('applyLiteralFields');
    assert.ok(fields.includes('rowsBounds(template, props,'), 'the rows bounds are written');
    assert.ok(fields.includes('template.control?.multiline'), 'only for a template with a multiline control');
    assert.ok(fields.includes('layer.minH = minH') && fields.includes('layer.maxH = maxH'), 'min and max height of the value and placeholder layers');
    assert.ok(fields.includes('bounds?.minH'), 'a kind without rows clears them');
    const sync = body('syncInstance');
    assert.ok(sync.indexOf('applyManagedTextBindings(') < sync.indexOf('applyLiteralFields('), 'the layers are bound (their line height is a px) before the box is measured from them');
});

test('Play acts on a pressed glyph and keeps the count of a textarea in step with the typing', () => {
    assert.ok(/import \{[^}]*\bapplyPress\b[^}]*\} from '@midas\/builder-core'/.test(play), 'applyPress is imported');
    assert.ok(play.includes('applyPress(e.target)'), 'a click runs it');
    assert.ok(play.includes('input[data-role="value"],textarea[data-role="value"]'), 'typing in a textarea updates the counter');
});

test('every name midas.js and play.js import from builder-core is exported by it', () => {
    for (const [name, src] of [['midas', midas], ['play', play]]) {
        const line = src.split('\n').find(l => l.includes("from '@midas/builder-core'") && l.includes('{'));
        const names = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}')).split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        assert.deepEqual(names.filter(n => !(n in core)), [], name);
    }
});

test('replay: the rows bounds the glue writes follow the layer the engine built (its line height, in px), and are none for a kind without rows', () => {
    const template = core.TEMPLATES.get('input');
    const props = core.resolveProps(template, { kind: 'textarea', rows: 4 });
    // The glue passes the bound text layer's line height (a ratio is multiplied by the font size).
    const layer = { lineHeight: 1.5, fontSize: 14 };
    const lineHeight = layer.lineHeight < 4 ? layer.lineHeight * layer.fontSize : layer.lineHeight;
    assert.deepEqual(core.rowsBounds(template, props, { lineHeight }), { minH: 4 * 21, maxH: null });
    assert.equal(core.rowsBounds(template, core.resolveProps(template, { rows: 4 }), { lineHeight }), null, 'a text input has no rows');
});

test('Play wires the click-to-focus, the number commit on blur and the resize grip drag', () => {
    const importLine = play.split('\n').find(l => l.includes("from '@midas/builder-core'") && l.includes('{'));
    for (const name of ['blurNumber', 'forwardFocus', 'startResizeDrag']) assert.ok(importLine.includes(` ${name}`), `${name} is imported`);
    assert.ok(play.includes('forwardFocus(e.target)'), 'a click on the padding focuses the field');
    assert.ok(play.includes("overlay.addEventListener('focusout'") && play.includes("matches?.('input[data-committed]')"), 'a blur commits the number');
    assert.ok(play.includes("closest?.('[data-press=\"resize\"]')") && play.includes("overlay.addEventListener('pointerdown'"), 'the grip starts a drag');
    assert.ok(play.includes('getComputedStyle(el)'), 'the field limits are the computed min and max height (the tokens)');
});

test('the editor places the layers pinned to a box, on a master and an instance, from the box and their tokens (pinnedFrame), after the bindings', () => {
    const fields = body('applyLiteralFields');
    assert.ok(fields.includes('placePinned(inst, template, binding, props)'), 'an instance');
    assert.ok(body('bindMasterTokens').includes('placePinned(master, template, binding,'), 'and a master');
    const place = body('placePinned');
    assert.ok(place.includes('pinnedFrame(template, slot, host, vars)') && place.includes('Object.assign(layer, at)'), 'x, y, w and h come from the tokens, not from the layer');
    assert.ok(midas.includes('const walk = id => { for (const c of doc.children(id)) { out.push(c); if (isContainer(c)) walk(c.id); } };'), 'the managed layers are found through nested containers');
});
