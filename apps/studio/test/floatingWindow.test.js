// The floating window's placement: docked beside the right panel (right edge = panel's left edge minus 8px), top on the opening row, always whole inside the viewport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampWindow, placeWindow, WINDOW_GAP } from '../src/engine/floatingWindow.js';

const viewport = { w: 1440, h: 900 };

test('a window docks beside the right panel: its right edge is the panel\'s left edge minus 8, its top the opening row\'s', () => {
    const size = { w: 300, h: 400 };
    const pos = placeWindow({ anchorTop: 220, panelLeft: 1100, size, viewport });
    assert.equal(pos.left + size.w, 1100 - WINDOW_GAP);
    assert.equal(pos.top, 220);
});

test('a window that would leave the bottom of the viewport slides up to stay whole', () => {
    const size = { w: 300, h: 400 };
    const pos = placeWindow({ anchorTop: 800, panelLeft: 1100, size, viewport });
    assert.equal(pos.top + size.h, viewport.h - WINDOW_GAP);
    assert.equal(pos.left + size.w, 1100 - WINDOW_GAP);
});

test('a row above the viewport and a panel too near the left edge are clamped to the margin', () => {
    assert.deepEqual(placeWindow({ anchorTop: -50, panelLeft: 200, size: { w: 300, h: 100 }, viewport }), { left: WINDOW_GAP, top: WINDOW_GAP });
});

test('a window larger than the viewport sits at the margin and overflows on its far side', () => {
    assert.deepEqual(clampWindow({ left: 500, top: 500 }, { w: 2000, h: 1200 }, viewport), { left: WINDOW_GAP, top: WINDOW_GAP });
});

test('dragging clamps every edge: left, right, top and bottom', () => {
    const size = { w: 300, h: 400 };
    assert.deepEqual(clampWindow({ left: -100, top: -100 }, size, viewport), { left: WINDOW_GAP, top: WINDOW_GAP });
    assert.deepEqual(clampWindow({ left: 5000, top: 5000 }, size, viewport), { left: viewport.w - size.w - WINDOW_GAP, top: viewport.h - size.h - WINDOW_GAP });
    assert.deepEqual(clampWindow({ left: 400, top: 300 }, size, viewport), { left: 400, top: 300 });
});

test('the position is a pure function of the anchor and the panel: opening again gives the same place', () => {
    const input = { anchorTop: 310, panelLeft: 1080, size: { w: 280, h: 360 }, viewport };
    assert.deepEqual(placeWindow(input), placeWindow({ ...input }));
});

import { readFileSync } from 'node:fs';

// Every window the Design, Behavior and Prototype tabs open is on the one primitive: its opener mounts it and places nothing by hand. (Menus and tooltips are not windows.)
const WINDOWS = {
    'instance picker': 'openAddInstances', 'icon and instance swap picker': 'openSwapPicker', 'variable picker': 'openVarPicker', 'variable details': 'openVarDetails',
    'fill picker (colour, gradient, image)': 'openFillPicker', 'effects window': 'openFxWindow', 'effect variable editor': 'openEffectVarEditor', 'typography editor': 'openTypographyEditor',
    'font picker': 'openFontPicker', 'stroke options': 'openStrokePop', 'text options': 'openTextPop', 'auto layout settings': 'openLayoutSettings', 'layout guide windows': 'lgPlace',
    'variant property window': 'openPropPop', 'component property window': 'openFloatingPop',
};
const source = readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bodyOf = name => {
    const at = source.indexOf(`function ${name}(`);
    return at < 0 ? '' : source.slice(at, source.indexOf('\n}\n', at));
};

for (const [label, fn] of Object.entries(WINDOWS)) {
    test(`the ${label} (${fn}) is a floating window: mounted on the primitive, no position of its own`, () => {
        const body = bodyOf(fn);
        assert.ok(body.length > 0, `${fn} exists`);
        assert.match(body, /mountFloatingWindow\(/, `${fn} mounts the window`);
        // The stroke options' side picker is a dropdown menu under its button: that branch is a menu, not a window.
        const lines = body.split('\n').filter(line => !/a\.(right|bottom)/.test(line)).join('\n');
        assert.doesNotMatch(lines, /\bel\.style\.(left|top)\s*=\s*Math/, `${fn} places nothing by hand`);
    });
}
