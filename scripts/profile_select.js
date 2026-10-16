import fs from 'fs';

// Mock DOM environment
const canvasMock = () => ({
    width: 1920,
    height: 1080,
    style: {},
    getContext: () => ({
        setTransform: () => {},
        clearRect: () => {},
        beginPath: () => {},
        stroke: () => {},
        fill: () => {},
        measureText: () => ({ width: 10 }),
        fillText: () => {},
        scale: () => {},
        rect: () => {},
        clip: () => {},
        drawImage: () => {},
        roundRect: () => {},
        save: () => {},
        restore: () => {},
        transform: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        arc: () => {},
        fillRect: () => {},
        strokeRect: () => {}, setLineDash: () => {},
        isPointInPath: () => true,
        isPointInStroke: () => true,
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
    }),
    setAttribute: () => {},
    after: () => {},
    focus: () => {},
    setPointerCapture: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
});

const elements = new Map();
const getEl = (id) => {
    if (!elements.has(id)) {
        elements.set(id, {
            id,
            style: {},
            classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
            setAttribute: () => {},
            querySelectorAll: () => [],
            querySelector: () => null,
            appendChild: () => {},
            append: () => {},
            remove: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            innerHTML: '',
            textContent: '',
            value: '',
            focus: () => {},
            scrollIntoView: () => {},
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
            clientWidth: 1920,
            clientHeight: 1080,
            dataset: {},
            getContext: canvasMock().getContext
        });
    }
    return elements.get(id);
};

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

globalThis.document = {
    createElement: (tag) => tag === 'canvas' ? canvasMock() : getEl(tag),
    getElementById: (id) => getEl(id),
    querySelector: (sel) => getEl(sel),
    querySelectorAll: (sel) => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: getEl('body'),
    head: getEl('head'),
    documentElement: { dataset: {} },
    activeElement: null
};

globalThis.DOMMatrix = class DOMMatrix { constructor(init) { this.init = init; } };
globalThis.Path2D = class Path2D { addPath() {} roundRect() {} rect() {} arc() {} moveTo() {} lineTo() {} bezierCurveTo() {} closePath() {} };
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const data = JSON.parse(fs.readFileSync("/Users/nazmudinalkhamil/Downloads/WDS Test Midas.midas", "utf-8"));

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

let midasCode = fs.readFileSync("src/engine/midas.js", "utf-8");
midasCode = midasCode.replace(/^import\s.*?;/m, 
    "const kv = { get: async () => null, set: async () => {}, del: async () => {} }; const localStore = { getItem: () => null, setItem: () => {} }; const projectStorage = { saveActivePage: async () => {} };");

midasCode = midasCode.replace("const doc = new DocumentModel(initial)", "const doc = new DocumentModel(globalThis.__TEST_DATA__)");
globalThis.__TEST_DATA__ = data;

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
await new AsyncFunction(midasCode)();

const midas = window.midas;
const doc = midas.doc;

const slowId = 'd3f5c8a5-7720-4069-8f49-007e7a150b0b';
const n = doc.get(slowId);
console.log("Analyzing slow node:", n.name, n.type, "component:", n.component, "isInstance:", n.isInstance);

// Profile select steps:
// Step 1: ancestors
console.time("ancestors");
const anc = doc.ancestors(n);
console.timeEnd("ancestors");
console.log("ancestor count:", anc.length);

// Step 2: renderLayers
console.time("renderLayers");
// How is renderLayers implemented? Let's check time

console.time("select node");
midas.select([slowId]);
console.timeEnd("select node");

// Now profile the other slow one: Icon-Wrapper
const iconId = '8c8da845-90e8-4523-96b5-4246c45b6463';
console.time("select icon");
midas.select([iconId]);
console.timeEnd("select icon");

