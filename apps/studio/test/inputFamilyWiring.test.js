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

test('applyLiteralFields gives a multiline control its min and max height from the bound layers, after the bindings', () => {
    const fields = body('applyLiteralFields');
    assert.ok(fields.includes('rowsBounds(template, props,'), 'the rows bounds are written');
    assert.ok(fields.includes('template.control?.multiline'), 'only for a multiline control');
    assert.ok(fields.includes('inst.minH = bounds.minH') && fields.includes('inst.maxH = bounds.maxH ?? undefined'), 'min and max height of the root');
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

test('replay: the rows bounds the glue writes follow the layers the engine built (line height and padding, in px)', () => {
    const template = core.TEMPLATES.get('textarea');
    const props = core.resolveProps(template, { rows: 4 });
    // The glue passes the bound text layer's line height (a ratio is multiplied by the font size) and the root's vertical padding.
    const layer = { lineHeight: 1.5, fontSize: 14 };
    const lineHeight = layer.lineHeight < 4 ? layer.lineHeight * layer.fontSize : layer.lineHeight;
    assert.deepEqual(core.rowsBounds(template, props, { lineHeight, paddingY: 4 }), { minH: 4 * 21 + 8, maxH: null });
});
