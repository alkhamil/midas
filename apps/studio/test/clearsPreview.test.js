// Loading preview wiring: turning on a prop whose look replaces the interaction
// states clears the hover, active or focus panel preview. The Behavior panel reads
// the schema (`clearsPreview`), never prop names.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');

test('the change handler clears the preview through the schema, not through prop names', () => {
    const at = src.indexOf('function onBehaviorChange(e)');
    assert.ok(at >= 0, 'onBehaviorChange exists');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    assert.ok(body.includes('clearsPreview('), 'the handler reads the schema flag');
    assert.ok(!body.includes("bpProp === 'disabled'"), 'no hardcoded prop name remains');
    assert.ok(!body.includes("bpProp === 'loading'"), 'no hardcoded prop name remains');
});
