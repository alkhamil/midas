// The Input's affix texts through the Behavior panel: Create Input, Has Prefix and Has Suffix switched on with real clicks, the texts typed
// in the panel. Each text is checked on the screen: its box on the canvas and the ink its screenshot shows inside that box. A switch off hides
// its text and gives its space back; a switch on again restores the text it had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, inkIn, openImportedFile, shotNode, launchBrowser } from './harness.mjs';
import { PAD, canvasTree, createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

/** A layer's rectangle in device pixels of the instance's shot (zoom 1, device scale 2, the crop starts PAD css px outside the root). */
const onShot = layer => ({ x: (PAD + layer.box.x) * 2, y: (PAD + layer.box.y) * 2, w: layer.box.w * 2, h: layer.box.h * 2 });

/** For each named layer: whether it is shown on the canvas, its box, and the ink its screenshot shows in that box. */
async function layersOn(page, browser, id, shot, names) {
    const file = await shotNode(page, id, shot, PAD, 1);
    const all = await canvasTree(page, id);
    const out = {};
    for (const name of names) {
        const layer = all.find(n => n.name === name);
        const shown = !!layer && layer.shown;
        out[name] = { shown, box: layer?.box, ink: shown ? await inkIn(browser, file.file, onShot(layer)) : 0 };
    }
    return out;
}

/** The text a text layer holds in the document (what the panel wrote). */
const textOf = (page, id, name) => page.evaluate(([id, name]) => window.midas.doc.children(id).find(c => c.name === name)?.text ?? null, [id, name]);

test('Has Prefix and Has Suffix in the Behavior panel show their texts on the canvas; a switch off gives the space back, and its text comes back on', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'affix-stage.midas' }));
    const id = await createFromPanel(page, 'input');
    await setProp(page, 'placeholder', 'Search');

    // The Input has a prefix and a suffix, each with its switch, and no icon switch; a side's kind and content show only while it is on.
    await page.locator('#inspector-tab-behavior').click();
    assert.equal(await page.locator('[data-bp-prop="hasPrefix"]').count(), 1, 'the Has Prefix row is in the panel');
    assert.equal(await page.locator('[data-bp-prop="hasSuffix"]').count(), 1, 'the Has Suffix row is in the panel');
    assert.equal(await page.locator('[data-bp-prop="hasIcon"]').count(), 0, 'the Input has no Has Icon row');
    assert.equal(await page.locator('[data-bp-prop="prefixKind"]').count(), 0, 'the prefix kind is hidden while the prefix is off');

    // Both switches on, with their texts: the prefix text sits before the value, the suffix text after it.
    await setProp(page, 'hasPrefix', true);
    await setProp(page, 'prefixText', 'Rp');
    await setProp(page, 'hasSuffix', true);
    await setProp(page, 'suffixText', '.com');
    let s = await layersOn(page, browser, id, 'affix-both', ['prefixText', 'placeholder', 'suffixText']);
    assert.ok(s.prefixText.shown && s.prefixText.ink > 0, 'the prefix text is drawn');
    assert.ok(s.placeholder.shown && s.placeholder.ink > 0, 'the placeholder is drawn between the affixes');
    assert.ok(s.suffixText.shown && s.suffixText.ink > 0, 'the suffix text is drawn');
    assert.ok(s.prefixText.box.x + s.prefixText.box.w <= s.placeholder.box.x, 'the prefix text ends before the value');
    assert.ok(s.placeholder.box.x + s.placeholder.box.w <= s.suffixText.box.x, 'the suffix text starts after the value');
    await page.screenshot({ path: `${ARTIFACTS}/affix-panel-both.png` });

    // Has Prefix off: the prefix text is gone from the canvas and takes no space; the value moves to the left edge.
    const beforeOff = s.placeholder.box.x;
    await setProp(page, 'hasPrefix', false);
    s = await layersOn(page, browser, id, 'affix-prefix-off', ['prefixText', 'placeholder', 'suffixText']);
    assert.equal(s.prefixText.shown, false, 'the prefix text is gone');
    assert.ok(s.placeholder.box.x < beforeOff, 'the value moves left into the space the prefix had');
    assert.ok(s.suffixText.shown && s.suffixText.ink > 0, 'the suffix is unchanged by the prefix switch');
    assert.equal(await page.locator('[data-bp-prop="prefixText"]').count(), 0, 'the prefix text row is hidden while the switch is off');

    // Has Prefix on again: the text comes back as it was.
    await setProp(page, 'hasPrefix', true);
    assert.equal(await textOf(page, id, 'prefixText'), 'Rp', 'the prefix text is remembered');
    s = await layersOn(page, browser, id, 'affix-prefix-back', ['prefixText', 'placeholder']);
    assert.ok(s.prefixText.shown && s.prefixText.ink > 0, 'the prefix text is back');
    assert.deepEqual(errors, [], 'console errors');
});
