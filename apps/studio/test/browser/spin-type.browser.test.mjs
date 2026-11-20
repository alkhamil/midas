// Spin's Type: switching between dots and arc, and back, leaves exactly the layers of the type shown: no hidden layer and no second copy of a column.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDevServers, openImportedFile, launchBrowser } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

test('Spin switches Type between dots and arc and back with no hidden or duplicate layer', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'spin-type.midas' }));
    const id = await createFromPanel(page, 'antd-spin');
    // Each layer of the instance, with its slot or part name and whether it is visible: the tree under the root.
    const layersOf = () => page.evaluate(id => {
        const d = window.midas.doc;
        const out = [];
        const walk = (nid, depth) => { for (const c of d.children(nid)) { out.push({ depth, name: c.name, key: c.behavior?.slot ?? c.behavior?.part ?? null, visible: c.visible !== false }); walk(c.id, depth + 1); } };
        walk(id, 0);
        return out;
    }, id);
    const keys = layers => layers.map(l => l.key ?? l.name);
    const hidden = layers => layers.filter(l => !l.visible).map(l => l.name);

    const dots = await layersOf();
    assert.deepEqual(keys(dots), ['dotBox', 'dotCol1', 'dot1', 'dot2', 'dotCol2', 'dot3', 'dot4'], 'dots: two columns of two');
    await setProp(page, 'type', 'arc');
    const arc = await layersOf();
    assert.deepEqual(keys(arc), ['spinner'], 'arc: the spinner only');
    assert.deepEqual(hidden(arc), [], 'arc: nothing is left hidden');
    await setProp(page, 'type', 'dots');
    const back = await layersOf();
    assert.deepEqual(keys(back), ['dotBox', 'dotCol1', 'dot1', 'dot2', 'dotCol2', 'dot3', 'dot4'], 'back to dots: the same two columns, no second copy');
    assert.deepEqual(hidden(back), []);
    assert.deepEqual(errors, [], 'console errors');
});
