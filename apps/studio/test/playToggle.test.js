// A click on a toggle control in Play turns its state on or off. The step is builder-core's applyToggle (tested there over an element-like object); play.js
// only has to call it for a click inside the stage. Play needs a browser, so the wiring is read from its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';

const src = fs.readFileSync(new URL('../src/engine/play.js', import.meta.url), 'utf8');

test('builder-core exports the toggle step', () => {
    assert.equal(typeof core.applyToggle, 'function');
    assert.equal(typeof core.nextToggle, 'function');
});

test('play.js imports applyToggle and applies it to the toggle root a click lands in, inside the stage', () => {
    const line = src.split('\n').find(l => l.includes("from '@midas/builder-core'"));
    assert.ok(line.includes('applyToggle'));
    const handler = src.slice(src.indexOf("overlay.addEventListener('click'"), src.indexOf("overlay.addEventListener('input'"));
    assert.ok(handler.includes("closest?.('.play-stage [data-toggle]')"), 'only a toggle root of the stage');
    assert.ok(handler.includes('applyToggle(toggle)'));
});
