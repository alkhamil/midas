// Export parity for the Input: the component the studio exports (JSX and CSS, from the live document) renders its input, its clear and
// its counter at the boxes Play draws, at every Size mode and in the value, placeholder and Show Count states. The export is compiled
// with esbuild, rendered with React in the browser, and measured the same way as Play: each box relative to the component's root, at 1:1.
// Writes .artifacts/export-parity.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile } from './harness.mjs';
import { FIXTURE, canvasTree, createFromPanel, isolatedStage, playTree, setProp } from './parity-helpers.mjs';
import { generateComponent } from '../../../../packages/builder-core/src/behavior-engine/codegen.js';
import { resolveProps } from '../../../../packages/builder-core/src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../../../../packages/builder-core/src/behavior-engine/registry.js';

const TOLERANCE_PX = 0.5;
const EXPORT_DIR = resolve(ARTIFACTS, 'export');

/** The states the export is checked in: the props each sets, and the node the control box is in Play (placeholder or value). */
const STATES = [
    { name: 'empty', props: { value: '', showCount: false } },
    { name: 'value', props: { value: 'Hello', showCount: false } },
    { name: 'showCount', props: { value: 'Hello', showCount: true } },
];

/** The document's master of the instance, its descendants and the variables, as plain data the generator reads. */
const masterData = (page, id) => page.evaluate(id => {
    const master = window.midas.doc.get(window.midas.doc.get(id).sourceId);
    const nodes = window.midas.doc.descendants(master.id);
    const instance = window.midas.doc.get(id);
    return { master, nodes, variables: window.midas.doc.data.variables, binding: master.behavior, instanceModes: instance.varModes, instanceProps: instance.behavior.props };
}, id);

/** Compiles the export's component and a small entry that renders it, into one browser script. */
async function bundleExport(jsx, name) {
    mkdirSync(EXPORT_DIR, { recursive: true });
    writeFileSync(resolve(EXPORT_DIR, `${name}.jsx`), jsx);
    writeFileSync(resolve(EXPORT_DIR, 'entry.jsx'), `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { ${name} } from './${name}.jsx';\nwindow.renderExport = (props, host) => { createRoot(host).render(React.createElement(${name}, props)); };\n`);
    const out = await build({
        entryPoints: [resolve(EXPORT_DIR, 'entry.jsx')],
        bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.jsx': 'jsx' },
        define: { 'process.env.NODE_ENV': '"production"' }, absWorkingDir: ROOT,
    });
    return out.outputFiles[0].text;
}

/** Renders the exported component with these props at the box `left, top` of the page, and measures its root and children (CSS px). */
const renderExport = (page, props) => page.evaluate(props => {
    document.getElementById('export-host')?.remove();
    const host = document.createElement('div');
    host.id = 'export-host';
    // Above the studio's layers, on white: the component is drawn as the page would draw it.
    Object.assign(host.style, { position: 'fixed', left: '40px', top: '40px', zIndex: '10000', background: '#ffffff', padding: '0' });
    document.body.append(host);
    window.renderExport(props, host);
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
        const root = host.querySelector('.input');
        const r0 = root.getBoundingClientRect();
        const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x - r0.x, y: r.y - r0.y, w: r.width, h: r.height }; };
        resolve({
            root: { w: r0.width, h: r0.height, bg: getComputedStyle(root).backgroundColor, varsHeight: getComputedStyle(root).height, variant: root.getAttribute('data-variant') },
            control: box(root.querySelector('input.input-label')),
            count: box(root.querySelector('.input-count')),
            clear: box(root.querySelector('.input-clear')),
        });
    })));
}, props);

test('the exported Input renders its input, clear and counter where Play draws them, at every Size mode and state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'input');
    const data = await masterData(page, id);
    const template = TEMPLATES.get('input');
    const exported = generateComponent(template, data.binding, data.variables, 'Input', data.master, parent => data.nodes.filter(n => n.parentId === parent));
    assert.equal(exported.problems.length, 0, 'the Input exports without problems');
    await page.addStyleTag({ content: exported.files['Input.css'] });
    await page.addScriptTag({ content: await bundleExport(exported.files['Input.jsx'], 'Input') });

    const sizeColl = data.binding.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
    const rows = [];
    const failures = [];
    for (const mode of modes) {
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        for (const state of STATES) {
            for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
            const canvas = await canvasTree(page, id);
            const play = await playTree(page, id, `export-${mode.name.toLowerCase()}-${state.name}`);
            const ids = Object.fromEntries(canvas.map(n => [n.name, n]));
            // Play draws the placeholder where the value is empty and the placeholder shows, and the value's box otherwise.
            const controlId = state.name === 'empty' ? ids.placeholder.id : ids.label.id;
            // The export's props: the variable props by mode id, the literal props as the state sets them.
            const props = {
                ...resolveProps(template, { ...data.instanceProps, ...state.props }),
                variant: data.instanceModes[data.binding.variables.variant], status: data.instanceModes[data.binding.variables.status], size: mode.id,
            };
            const got = await renderExport(page, props);
            await page.locator('#export-host').screenshot({ path: resolve(ARTIFACTS, `export-${mode.name.toLowerCase()}-${state.name}.png`) });
            const playRoot = { w: play.rootWidth, h: play.rootHeight };
            const playControl = play.boxes[controlId] && { x: play.boxes[controlId].dx, y: play.boxes[controlId].dy, w: play.boxes[controlId].w, h: play.boxes[controlId].h };
            const playCount = ids.count && play.boxes[ids.count.id] ? { x: play.boxes[ids.count.id].dx, y: play.boxes[ids.count.id].dy, w: play.boxes[ids.count.id].w, h: play.boxes[ids.count.id].h } : null;
            const label = `input ${mode.name} ${state.name}`;
            const deltas = {
                root: Math.max(Math.abs(got.root.w - playRoot.w), Math.abs(got.root.h - playRoot.h)),
                control: playControl && got.control ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.control[k] - playControl[k]))) : null,
                count: state.props.showCount ? (playCount && got.count ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.count[k] - playCount[k]))) : null) : null,
            };
            rows.push({ label, exported: got, play: { root: playRoot, control: playControl, count: playCount }, deltas });
            if (deltas.root > TOLERANCE_PX) failures.push(`${label}: the exported root is ${deltas.root.toFixed(2)} px from Play's`);
            if (deltas.control === null) failures.push(`${label}: the input is not on both`);
            else if (deltas.control > TOLERANCE_PX) failures.push(`${label}: the exported input is ${deltas.control.toFixed(2)} px from Play's box`);
            if (state.props.showCount && (deltas.count === null || deltas.count > TOLERANCE_PX)) failures.push(`${label}: the exported counter is ${deltas.count} px from Play's`);
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'export-parity.json'), JSON.stringify({ tolerancePx: TOLERANCE_PX, rows }, null, 2));
    assert.deepEqual(errors, [], 'console errors while rendering the export');
    assert.deepEqual(failures, [], 'the export and Play differ');
});
