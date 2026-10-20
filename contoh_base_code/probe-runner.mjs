/* Node+jsdom runner for the bundled upload probe (deleted after run). */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.File = dom.window.File;
globalThis.DataTransfer = dom.window.DataTransfer;
globalThis.Event = dom.window.Event;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;

globalThis.URL.createObjectURL = () => 'blob:http://localhost/fake';
globalThis.URL.revokeObjectURL = () => {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await import('/tmp/probe-dist/probe.js');
await sleep(500);
const results = await globalThis.window.__scenario();
for (const line of results) console.log(line);
const failed = results.some((l) => l.startsWith('MISS'));
console.log(failed ? 'UPLOAD PROBE FAIL' : 'UPLOAD PROBE PASS');
process.exit(failed ? 1 : 0);
