// Bind-tokens wiring: binding a component to a template binds every layer the
// template lists (the Input's placeholder and count included), not just root+label.
// Both the bind path and Create bind the same layers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');

test('bindMasterTokens binds the layers the template lists', () => {
    const helper = src.indexOf('function pageMasterLayers(master, template)');
    assert.ok(helper >= 0, 'one shared layer helper exists');
    const helperBody = src.slice(helper, src.indexOf('\n}\n', helper));
    assert.ok(helperBody.includes('masterLayersByKey(template, master'), 'the helper reads the template layer list');
    const at = src.indexOf('function bindMasterTokens(master');
    assert.ok(at >= 0, 'bindMasterTokens exists');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    assert.ok(body.includes('pageMasterLayers(master, template)'), 'the binder shares the helper');
    assert.ok(!body.includes('masterLayersOf('), 'no root+label-only enumeration remains');
});

test('the Auto Fix count plans against the same layer list the binder writes', () => {
    assert.ok(src.includes('masterLayersByKey'), 'the generator layer list is imported');
    for (const name of ['fixableAutoFix', 'autoFixMaster']) {
        const at = src.indexOf(`function ${name}(`);
        assert.ok(at >= 0, `${name} exists`);
        const body = src.slice(at, src.indexOf('\n}\n', at));
        assert.ok(body.includes('pageMasterLayers(master, template)'), `${name} shares the layer helper, so the count matches what bind writes`);
    }
});
