// SVG export clip check for text that hugs its width: renders the same <text> with the old clip (box width only) and the new
// clip (margin of one font size on each side) and reports which glyph pixels the old clip cuts off.
// The clip strings mirror the export in engine/midas.js (search for "clipPad"). Usage: node test/layout/clipcheck.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const outDir = resolve(process.argv[2] || 'test/layout/out');
mkdirSync(outDir, { recursive: true });

const CASES = [
    { name: 'italic-hug', text: 'Confirm order', fontStyle: 'italic', fontSize: 16, fontWeight: 400, letterSpacing: 0 },
    { name: 'italic-overhang-f', text: 'Ifffff fff', fontStyle: 'italic', fontSize: 24, fontWeight: 400, letterSpacing: 0 },
    { name: 'letter-spacing-hug', text: 'SALE 50%', fontStyle: 'normal', fontSize: 18, fontWeight: 700, letterSpacing: 2 },
];

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 400, height: 80 }, deviceScaleFactor: 2 });
    for (const c of CASES) {
        // Exact measured width, as hugText now sets it (no +1, no ceil).
        const w = await page.evaluate(({ text, fontStyle, fontSize, fontWeight, letterSpacing }) => {
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "Arial", sans-serif`;
            ctx.letterSpacing = `${letterSpacing}px`;
            return Math.max(1, ctx.measureText(text).width);
        }, c);
        const h = Math.ceil(c.fontSize * 1.35);
        const clipPad = Math.ceil(c.fontSize);
        const svg = (clip) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80" viewBox="0 0 400 80" style="background:#fff">
  <defs><clipPath id="t">${clip}</clipPath></defs>
  <rect width="400" height="80" fill="#fff"/>
  <rect x="20" y="20" width="${w}" height="${h}" fill="none" stroke="#ccc" stroke-width="0.5"/>
  <g transform="translate(20 20)"><text clip-path="url(#t)" x="0" y="${c.fontSize}" font-family="Arial, sans-serif" font-style="${c.fontStyle}" font-size="${c.fontSize}" font-weight="${c.fontWeight}" letter-spacing="${c.letterSpacing}" fill="#000">${c.text}</text></g>
</svg>`;
        // Old clip: the box only, shifted by the text origin. New clip: the same box with a margin on both sides.
        const oldClip = `<rect x="0" y="0" width="${w}" height="${h}"/>`;
        const newClip = `<rect x="${-clipPad}" y="0" width="${w + 2 * clipPad}" height="${h}"/>`;
        const shots = {};
        for (const [label, clip] of [['old', oldClip], ['new', newClip]]) {
            await page.setContent(`<html><body style="margin:0">${svg(clip)}</body></html>`);
            shots[label] = await page.screenshot({ type: 'png' });
        }
        // Compare: the glyph pixels only the new clip shows.
        const diff = await page.evaluate(async ([a, b]) => {
            const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
            const [ia, ib] = await Promise.all([load(a), load(b)]);
            const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
            const ctx = cv.getContext('2d');
            ctx.drawImage(ia, 0, 0); const pa = ctx.getImageData(0, 0, cv.width, cv.height);
            ctx.drawImage(ib, 0, 0); const pb = ctx.getImageData(0, 0, cv.width, cv.height);
            let only = 0, minX = Infinity, maxX = -1;
            for (let i = 0; i < pa.data.length; i += 4) {
                const dark = v => (255 - v) > 40;
                const inkNew = dark(pb.data[i]) || dark(pb.data[i + 1]) || dark(pb.data[i + 2]);
                const inkOld = dark(pa.data[i]) || dark(pa.data[i + 1]) || dark(pa.data[i + 2]);
                if (inkNew && !inkOld) {
                    only++;
                    const x = (i / 4) % cv.width;
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                }
            }
            return { only, minX, maxX, url: cv.toDataURL('image/png') };
        }, [`data:image/png;base64,${shots.old.toString('base64')}`, `data:image/png;base64,${shots.new.toString('base64')}`]);
        writeFileSync(resolve(outDir, `clip-${c.name}-old.png`), shots.old);
        writeFileSync(resolve(outDir, `clip-${c.name}-new.png`), shots.new);
        console.log(`${c.name}: width ${w.toFixed(2)}px, ink only the new clip shows: ${diff.only} px${diff.only ? ` (x ${diff.minX / 2}–${diff.maxX / 2} css px)` : ''}`);
    }
} finally {
    await browser.close();
}
