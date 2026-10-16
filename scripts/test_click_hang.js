import fs from 'fs';

// Mock DOM elements and browser environment
globalThis.window = globalThis;
globalThis.document = {
    createElement: (tag) => ({
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
            strokeRect: () => {}
        }),
        style: {},
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
        setAttribute: () => {},
        querySelectorAll: () => [],
        querySelector: () => null,
        appendChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
    }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
};

console.log("Mock environment ready.");
