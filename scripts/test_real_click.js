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
    focus: () => {}, scrollIntoView: () => {},
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
            appendChild: () => {}, append: () => {}, remove: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            innerHTML: '',
            textContent: '',
            value: '',
            focus: () => {}, scrollIntoView: () => {},
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
    documentElement: { dataset: {} },
    activeElement: null
};

globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) { this.init = init; }
};
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} }; globalThis.Path2D = class Path2D {
    addPath() {}
    roundRect() {}
    rect() {} moveTo() {} lineTo() {} bezierCurveTo() {} closePath() {}
    arc() {}
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

console.log("Loading WDS Test Midas.midas data...");
const t0 = performance.now();
const data = JSON.parse(fs.readFileSync("/Users/nazmudinalkhamil/Downloads/WDS Test Midas.midas", "utf-8"));
console.log(`Data loaded in ${(performance.now() - t0).toFixed(1)}ms. Total nodes: ${data.pages.reduce((acc, p) => acc + p.nodes.length, 0)}`);

// Setup localStore mock
globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

let midasCode = fs.readFileSync("src/engine/midas.js", "utf-8");
midasCode = midasCode.replace(/^import\s.*?;/m, 
    "const kv = { get: async () => null, set: async () => {}, del: async () => {} }; const localStore = { getItem: () => null, setItem: () => {} }; const projectStorage = { saveActivePage: async () => {} };");

midasCode = midasCode.replace("const doc = new DocumentModel(initial)", "const doc = new DocumentModel(globalThis.__TEST_DATA__)");
globalThis.__TEST_DATA__ = data;

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

console.log("Initializing midas.js engine with 181,430 nodes...");
const tEngine = performance.now();
try {
    await new AsyncFunction(midasCode)();
    console.log(`Engine initialized in ${(performance.now() - tEngine).toFixed(1)}ms!`);
} catch (e) {
    console.error("Error initializing midas.js:", e);
    process.exit(1);
}

const midas = window.midas;
const doc = midas.doc;
console.log("Active page:", doc.page.name, "with", doc.page.nodes.length, "nodes.");

// Let's test selecting nodes on the active page
console.log("\nTesting node selections on active page...");
const testNodes = doc.page.nodes.slice(0, 50);
let slowCount = 0;
for (const n of testNodes) {
    const tStart = performance.now();
    midas.select([n.id]);
    const duration = performance.now() - tStart;
    if (duration > 30) {
        console.warn(`Slow select on node ${n.id} (${n.name}, type=${n.type}, isInstance=${n.isInstance}, component=${n.component}): ${duration.toFixed(2)}ms`);
        slowCount++;
    }
}
console.log(`Finished selecting 50 nodes. Slow selections (>30ms): ${slowCount}`);

// Let's test hitTest and click on actual nodes in scene()!
console.log("\nTesting hitTest on scene nodes...");
const scene = doc.scene();
console.log(`Scene has ${scene.length} items.`);
for (let i = 0; i < Math.min(20, scene.length); i++) {
    const s = scene[i];
    const tH = performance.now();
    midas.select([s.node.id]);
    const dH = performance.now() - tH;
    console.log(`Select scene item ${s.node.name} (${s.node.type}) took ${dH.toFixed(2)}ms`);
}

