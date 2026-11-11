// A Link in Play draws its href, and a click on it must not navigate the Play host away. play.js needs a browser, so the wiring is read from its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/play.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the Play overlay cancels the default of a click on a link inside the stage', () => {
    const click = src.slice(src.indexOf("overlay.addEventListener('click'"));
    assert.ok(click.includes("e.target.closest?.('.play-stage a[href]')") && click.slice(0, click.indexOf('applyPress')).includes('e.preventDefault()'));
});
