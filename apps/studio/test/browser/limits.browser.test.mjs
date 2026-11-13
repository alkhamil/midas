// The Input's limits through the Behavior panel and in Play: Min length 3 and Max length 5 are typed in the panel, and a Min above the Max is
// refused. In Play, two characters are too short, three are not, a sixth character is blocked by the native maxlength, and the counter reads
// "5 / 5". Real clicks and keys on the isolated stage. The geometry and export of the limits state are in the parity tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

/** The instance's stored value of a behavior prop. */
const storedProp = (page, id, name) => page.evaluate(([id, name]) => window.midas.doc.get(id).behavior.props[name] ?? null, [id, name]);

/** The text a part node of the instance holds (the counter's text on the canvas). */
const partText = (page, id, name) => page.evaluate(([id, name]) => window.midas.doc.children(id).find(c => c.name === name)?.text ?? null, [id, name]);

test('Min length and Max length from the panel: a Min above the Max is refused, Play marks a short value and blocks a sixth character, the counter reads n / max', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'limits-stage.midas' }));
    const id = await createFromPanel(page, 'input');

    await setProp(page, 'showCount', true);
    await setProp(page, 'minLength', '3');
    await setProp(page, 'maxLength', '5');
    await page.locator('#inspector-tab-behavior').click();
    assert.equal(await page.locator('[data-bp-prop="maxLength"]').getAttribute('type'), 'number', 'Max length is a number field');
    assert.equal(await page.locator('[data-bp-prop="minLength"]').getAttribute('type'), 'number', 'Min length is a number field');
    assert.equal(await storedProp(page, id, 'minLength'), 3);
    assert.equal(await storedProp(page, id, 'maxLength'), 5);
    assert.equal(await partText(page, id, 'count'), '0 / 5', 'the counter reads the empty value over the maximum');

    // A Min above the Max is refused: the stored Min stays, and the panel shows it again.
    await setProp(page, 'minLength', '6');
    assert.equal(await storedProp(page, id, 'minLength'), 3, 'a Min length above the Max length is refused');
    assert.equal(await page.locator('[data-bp-prop="minLength"]').inputValue(), '3', 'the panel shows the stored Min length');

    // Play: a real value typed with the keyboard.
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    const input = page.locator('.play-overlay input[data-role="value"]');
    const counter = page.locator('.play-overlay [data-role="count"]');
    await input.click();
    await page.keyboard.type('ab');
    assert.equal(await input.evaluate(el => el.validity.tooShort), true, 'two characters are too short');
    await page.keyboard.type('c');
    assert.equal(await input.evaluate(el => el.validity.tooShort), false, 'three characters are long enough');
    assert.equal(await input.inputValue(), 'abc');
    await page.keyboard.type('defg');
    assert.equal(await input.inputValue(), 'abcde', 'a sixth character is blocked by the Max length');
    assert.equal(await input.evaluate(el => el.validity.tooLong), false, 'the value is at the limit, not over it');
    assert.equal((await counter.textContent()).trim(), '5 / 5', 'the counter reads 5 / 5');
    await page.locator(`.play-overlay [data-node-id="${id}"]`).screenshot({ path: `${ARTIFACTS}/limits-play.png` });
    // The close button hides while the field has focus: Escape closes Play.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.play-overlay', { state: 'detached' });

    // Clearing a limit in the panel with the keys a user presses: an empty field is no limit, stored as null, and the counter drops its maximum.
    await page.locator('#inspector-tab-behavior').click();
    await setProp(page, 'maxLength', null);
    assert.equal(await storedProp(page, id, 'maxLength'), null, 'an empty Max length is no limit');
    assert.equal(await partText(page, id, 'count'), '0', 'the counter reads the length only');
    await setProp(page, 'minLength', null);
    assert.equal(await storedProp(page, id, 'minLength'), null, 'an empty Min length is no limit');
    assert.deepEqual(errors, [], 'console errors');
});
