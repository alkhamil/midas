// Dumps the canvas autolayout result for every page of a .midas file: node id → [x, y, w, h].
// Usage: node test/layout/rects.mjs <file.midas> <out.json>   (from apps/studio)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const [, , input, output] = process.argv;
const server = await serve({ doc: resolve(input) });
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 2; });
    await page.goto(`http://127.0.0.1:${server.address().port}/test/layout/harness.html`);
    await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 15000 });
    const rects = await page.evaluate(() => window.layoutDocument('/doc.json'));
    writeFileSync(resolve(output), JSON.stringify(rects));
    console.log(`pages ${Object.keys(rects).length}, nodes ${Object.values(rects).reduce((s, p) => s + Object.keys(p).length, 0)} -> ${output}`);
} finally {
    await browser.close();
    server.close();
}
