// Layout conformance: the canvas autolayout engine and Preview's CSS mapping must put every rendered node in the same box.
// Headless Chromium only. Run with `npm run test:layout` (from apps/studio). Exit code 1 when any node is off by more than TOL px.
import { chromium } from 'playwright';
import { layoutFixtures } from '../fixtures/layoutFixtures.js';
import { serve } from './serve.mjs';

const TOL = 1;
const PROPS = ['x', 'y', 'w', 'h'];

const HARNESS = '/test/layout/harness.html';
// LAYOUT_ONLY=random-07 runs one case; LAYOUT_DUMP=1 prints every node box of the cases it runs.
const ONLY = process.env.LAYOUT_ONLY, DUMP = !!process.env.LAYOUT_DUMP;

async function main() {
    const server = await serve();
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    const failures = [];
    let cases = 0, nodes = 0;
    const byProp = Object.fromEntries(PROPS.map(p => [p, 0]));
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
        page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 2; });
        await page.goto(base + HARNESS);
        await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 15000 });
        const fixtures = layoutFixtures().filter(f => !ONLY || f.name === ONLY);
        for (const fixture of fixtures) {
            const result = await page.evaluate(f => window.measureFixture(f), fixture);
            const rows = [];
            if (DUMP) for (const [id, box] of Object.entries(result)) console.log(`   ${id.padEnd(8)} ${box.type.padEnd(6)} canvas ${box.canvas.x.toFixed(2)},${box.canvas.y.toFixed(2)} ${box.canvas.w.toFixed(2)}x${box.canvas.h.toFixed(2)}  dom ${box.dom.x.toFixed(2)},${box.dom.y.toFixed(2)} ${box.dom.w.toFixed(2)}x${box.dom.h.toFixed(2)}`);
            for (const [id, box] of Object.entries(result)) {
                nodes++;
                for (const p of PROPS) {
                    const delta = box.dom[p] - box.canvas[p];
                    if (Math.abs(delta) > TOL) {
                        byProp[p]++;
                        rows.push({ id, type: box.type, prop: p, canvas: box.canvas[p], dom: box.dom[p], delta });
                    }
                }
            }
            cases++;
            if (rows.length) failures.push({ fixture, rows });
            console.log(`${rows.length ? 'FAIL' : 'PASS'}  ${fixture.group}/${fixture.name}${rows.length ? `  (${rows.length} mismatches)` : ''}`);
        }
        for (const { fixture, rows } of failures) {
            console.log(`\n${fixture.group}/${fixture.name}`);
            for (const r of rows)
                console.log(`   ${r.id.padEnd(8)} ${r.type.padEnd(6)} ${r.prop}  canvas ${r.canvas.toFixed(2).padStart(8)}  dom ${r.dom.toFixed(2).padStart(8)}  delta ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}`);
        }
        const total = Object.values(byProp).reduce((s, v) => s + v, 0);
        console.log(`\n${cases} cases, ${nodes} nodes, ${failures.length} failing cases, ${total} mismatches (tolerance ${TOL}px)`);
        console.log(`by property: ${PROPS.map(p => `${p} ${byProp[p]}`).join(', ')}`);
        if (total > 0) process.exitCode = 1;
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch(e => { console.error(e); process.exitCode = 2; });
