// A slot that starts to show takes the icon of its role. midas.js needs a browser, so the wiring is read from its source: the one default-icon function
// hands builder-core the resolver of the document's pages, and every call that fills a new slot goes through it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const body = name => {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return src.slice(at, src.indexOf('\n}\n', at));
};

test('defaultIconId is the resolver of the document\'s icons', () => {
    assert.ok(body('defaultIconId').includes('iconResolverOf(doc.data.pages)'));
});

test('an edit, an instance creation and the demo instance fill new slots through it', () => {
    assert.ok(body('setInstanceValueTo').includes('defaultIconId()'));
    assert.ok(body('placeDemoInstance').includes('createdIconDefaults(template, {}, defaultIconId())'));
    assert.ok(/createdIconDefaults\(tpl, [^)]*defaultIconId\(\)\)/.test(src), 'instance creation');
});
