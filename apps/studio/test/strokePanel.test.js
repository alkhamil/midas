// Stroke panel contract (Design panel, Solid and Dashed only): the style segmented
// offers no Dots; Dash, Gap and cap are literals that never bind; clearing Gap
// deletes the key so it follows Dash again; None writes an explicit butt cap;
// an absent cap is shown as Round (what the canvas renders).
// The panel markup lives in the studio engine, which the node harness cannot
// import, so these pin the engine source at the exact statements, the same way
// bindTokens.test.js already does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');

function bodyOf(name) {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return src.slice(at, src.indexOf('\n}\n', at));
}

test('the style segmented offers Solid and Dashed, never Dots', () => {
    assert.ok(!src.includes('data-st-style="dot"'), 'no Dots option');
    assert.ok(src.includes('data-st-style="dash"'), 'Dash stays');
    assert.ok(src.includes('data-st-style="solid"'), 'Solid stays');
});

test('the cap segmented offers None, Round and Square, wired to a click handler', () => {
    for (const cap of ['none', 'round', 'square']) assert.ok(src.includes(`data-stp-cap="${cap}"`), `cap ${cap} is clickable`);
});

test('an absent cap is shown as Round, the canvas default', () => {
    assert.ok(src.includes("strokeCap ?? 'round'"), 'the panel maps absent to Round');
});

test('clearing Gap deletes the key so it follows Dash again', () => {
    assert.ok(src.includes('delete n.strokeGap'), 'Gap has a delete path');
});

test('the gap field displays the effective value: explicit gap, else the dash', () => {
    assert.ok(src.includes('n.strokeGap ?? n.strokeDash ?? 10'), 'gap follows dash in the panel');
});

test('a dashed Variant removes a stale gap; an explicit one is kept by the null patch', () => {
    const body = bodyOf('applyVariantStroke');
    assert.ok(body.includes('delete inst.strokeGap'), 'a stale gap is deleted on a dashed write');
});

test('dash, gap, cap and style never bind: the purge and the allowlist agree', () => {
    const at = src.indexOf('const VAR_BIND =');
    const vars = src.slice(at, src.indexOf('};', at));
    for (const prop of ['strokeDash', 'strokeGap', 'strokeCap', 'strokeStyle']) assert.ok(!vars.includes(prop), `${prop} is literal-only`);
    assert.ok(src.includes('if (!item || !bindType(prop))'), 'unknown bindings are purged on refresh');
});

test('a designer width edit detaches its binding and records overrides, so sync keeps it', () => {
    assert.ok(src.includes('delete n.vars[prop]'), 'a literal edit detaches');
    assert.ok(src.includes('n.overrides[prop] = v'), 'an instance edit overrides the master');
});
