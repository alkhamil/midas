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
import { canvasTree, createFromPanel, isolatedStage, playTree, setProp, TOLERANCE_PX } from './parity-helpers.mjs';
import { generateComponent } from '../../../../packages/builder-core/src/behavior-engine/codegen.js';
import { resolveProps } from '../../../../packages/builder-core/src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../../../../packages/builder-core/src/behavior-engine/registry.js';

const EXPORT_DIR = resolve(ARTIFACTS, 'export');

/** The states the export is checked in: the props each sets, and the node the control box is in Play (placeholder or value). */
// The affix switches come before their texts (a text row is shown only while its switch is on), and every state sets both switches.
const STATES = [
    { name: 'empty', props: { hasPrefix: false, hasSuffix: false, value: '', placeholder: 'Search', allowClear: false, showCount: false } },
    { name: 'value', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: false } },
    { name: 'showCount', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: true } },
    { name: 'allowClear', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: true, showCount: false } },
    { name: 'prefix', props: { hasPrefix: true, prefixText: 'Rp', hasSuffix: false, value: 'Hello', allowClear: false, showCount: false } },
    { name: 'suffix', props: { hasPrefix: false, hasSuffix: true, suffixText: '.com', value: 'Hello', allowClear: false, showCount: false } },
    { name: 'both', props: { hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com', value: 'Hello', allowClear: true, showCount: true } },
    { name: 'limits', props: { minLength: 3, maxLength: 5, hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: true } },
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
            control: box(root.querySelector('input.input-value')),
            count: box(root.querySelector('.input-count')),
            clear: box(root.querySelector('.input-clear')),
            prefix: box(root.querySelector('.input-prefixText')),
            suffix: box(root.querySelector('.input-suffixText')),
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
            // Each state sets both limits (null when it has none), so one state's limits do not stay for the next.
            for (const [name, value] of Object.entries({ minLength: null, maxLength: null, ...state.props })) await setProp(page, name, value);
            const canvas = await canvasTree(page, id);
            const play = await playTree(page, id, `export-${mode.name.toLowerCase()}-${state.name}`);
            const ids = Object.fromEntries(canvas.map(n => [n.name, n]));
            // Play's single input carries the id of the layer it covers: the value layer while there is a value (a managed layer, made only then), else the
            // placeholder's (the empty state sets a placeholder text, so the placeholder layer shows and the input has a node to cover).
            const controlId = (ids.value ?? ids.placeholder).id;
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
            const playAffix = name => ids[name] && play.boxes[ids[name].id] ? { x: play.boxes[ids[name].id].dx, y: play.boxes[ids[name].id].dy, w: play.boxes[ids[name].id].w, h: play.boxes[ids[name].id].h } : null;
            const playPrefix = state.props.hasPrefix ? playAffix('prefixText') : null;
            const playSuffix = state.props.hasSuffix ? playAffix('suffixText') : null;
            const label = `input ${mode.name} ${state.name}`;
            const deltas = {
                root: Math.max(Math.abs(got.root.w - playRoot.w), Math.abs(got.root.h - playRoot.h)),
                control: playControl && got.control ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.control[k] - playControl[k]))) : null,
                count: state.props.showCount ? (playCount && got.count ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.count[k] - playCount[k]))) : null) : null,
                clear: state.props.allowClear ? (play.boxes[ids.clear?.id] && got.clear ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.clear[k] - { x: play.boxes[ids.clear.id].dx, y: play.boxes[ids.clear.id].dy, w: play.boxes[ids.clear.id].w, h: play.boxes[ids.clear.id].h }[k]))) : null) : null,
                prefix: state.props.hasPrefix ? (playPrefix && got.prefix ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.prefix[k] - playPrefix[k]))) : null) : null,
                suffix: state.props.hasSuffix ? (playSuffix && got.suffix ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(got.suffix[k] - playSuffix[k]))) : null) : null,
            };
            rows.push({ label, exported: got, play: { root: playRoot, control: playControl, count: playCount, prefix: playPrefix, suffix: playSuffix }, deltas });
            if (deltas.root > TOLERANCE_PX) failures.push(`${label}: the exported root is ${deltas.root.toFixed(2)} px from Play's`);
            if (deltas.control === null) failures.push(`${label}: the input is not on both`);
            else if (deltas.control > TOLERANCE_PX) failures.push(`${label}: the exported input is ${deltas.control.toFixed(2)} px from Play's box`);
            if (state.props.showCount && (deltas.count === null || deltas.count > TOLERANCE_PX)) failures.push(`${label}: the exported counter is ${deltas.count} px from Play's`);
            if (state.props.allowClear && (deltas.clear === null || deltas.clear > TOLERANCE_PX)) failures.push(`${label}: the exported clear is ${deltas.clear} px from Play's`);
            if (state.props.hasPrefix && (deltas.prefix === null || deltas.prefix > TOLERANCE_PX)) failures.push(`${label}: the exported prefix is ${deltas.prefix} px from Play's`);
            if (state.props.hasSuffix && (deltas.suffix === null || deltas.suffix > TOLERANCE_PX)) failures.push(`${label}: the exported suffix is ${deltas.suffix} px from Play's`);
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'export-parity.json'), JSON.stringify({ tolerancePx: TOLERANCE_PX, rows }, null, 2));
    assert.deepEqual(errors, [], 'console errors while rendering the export');
    assert.deepEqual(failures, [], 'the export and Play differ');
});

/** The Button's states the export is checked in: its icon, its loading, and the props that show them. */
const BUTTON_STATES = [
    { name: 'plain', props: { hasIcon: false, iconPlacement: 'start', loading: false } },
    { name: 'loading', props: { hasIcon: false, iconPlacement: 'start', loading: true } },
    { name: 'icon-start', props: { hasIcon: true, iconPlacement: 'start', loading: false } },
    { name: 'icon-start-loading', props: { hasIcon: true, iconPlacement: 'start', loading: true } },
    { name: 'icon-end', props: { hasIcon: true, iconPlacement: 'end', loading: false } },
];

/** The exported Button's root, spinner, icon slots and label, measured relative to its root (CSS px). */
const renderButtonExport = (page, props) => page.evaluate(props => {
    document.getElementById('export-host')?.remove();
    const host = document.createElement('div');
    host.id = 'export-host';
    Object.assign(host.style, { position: 'fixed', left: '40px', top: '40px', zIndex: '10000', background: '#ffffff', padding: '0' });
    document.body.append(host);
    window.renderExport(props, host);
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
        const root = host.querySelector('.button');
        const r0 = root.getBoundingClientRect();
        const box = sel => { const el = root.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x - r0.x, y: r.y - r0.y, w: r.width, h: r.height }; };
        resolve({ root: { w: r0.width, h: r0.height }, spinner: box('svg.button-spinner'), label: box('.button-label'), iconStart: box('.button-iconStart'), iconEnd: box('.button-iconEnd') });
    })));
}, props);

test('the exported Button draws its spinner, icon slots and label where Play draws them, at every Size and icon and loading state', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'button');
    const data = await masterData(page, id);
    const template = TEMPLATES.get('button');
    const exported = generateComponent(template, data.binding, data.variables, 'Button', data.master, parent => data.nodes.filter(n => n.parentId === parent));
    assert.equal(exported.problems.length, 0, 'the Button exports without problems');
    await page.addStyleTag({ content: exported.files['Button.css'] });
    await page.addScriptTag({ content: await bundleExport(exported.files['Button.jsx'], 'Button') });
    const sizeColl = data.binding.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
    const rows = [];
    const failures = [];
    for (const mode of modes) {
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        for (const state of BUTTON_STATES) {
            await page.locator('#inspector-tab-behavior').click();
            for (const [name, value] of Object.entries(state.props)) if (name !== 'iconPlacement') await setProp(page, name, value);
            await page.locator('[data-bp-prop="iconPlacement"]').first().selectOption(state.props.iconPlacement).catch(() => {});
            const canvas = await canvasTree(page, id);
            const play = await playTree(page, id, `export-button-${mode.name.toLowerCase()}-${state.name}`);
            const shown = Object.fromEntries(canvas.filter(n => n.shown).map(n => [n.name, n]));
            const label = `button ${mode.name} ${state.name}`;
            const props = {
                ...resolveProps(template, { ...data.instanceProps, ...state.props }),
                variant: data.instanceModes[data.binding.variables.variant], color: data.instanceModes[data.binding.variables.color], size: mode.id,
            };
            const got = await renderButtonExport(page, props);
            const playBox = name => (shown[name] && play.boxes[shown[name].id]) ? { x: play.boxes[shown[name].id].dx, y: play.boxes[shown[name].id].dy, w: play.boxes[shown[name].id].w, h: play.boxes[shown[name].id].h } : null;
            const pairs = { spinner: playBox('spinner'), label: playBox('label'), iconStart: playBox('iconStart'), iconEnd: playBox('iconEnd') };
            const deltas = {};
            for (const key of ['spinner', 'label', 'iconStart', 'iconEnd']) {
                const exp = got[key], pl = pairs[key];
                if (!pl && !exp) continue;
                if (!pl || !exp) { deltas[key] = null; failures.push(`${label}: ${key} is ${exp ? 'only in the export' : 'only in Play'}`); continue; }
                deltas[key] = Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(exp[k] - pl[k])));
                if (deltas[key] > TOLERANCE_PX) failures.push(`${label}: the exported ${key} is ${deltas[key].toFixed(2)} px from Play's`);
            }
            const rootDelta = Math.max(Math.abs(got.root.w - play.rootWidth), Math.abs(got.root.h - play.rootHeight));
            if (rootDelta > TOLERANCE_PX) failures.push(`${label}: the exported root is ${rootDelta.toFixed(2)} px from Play's`);
            rows.push({ label, exported: got, play: { root: { w: play.rootWidth, h: play.rootHeight }, ...pairs }, deltas, rootDelta });
        }
    }
    const report = JSON.parse(readFileSync(resolve(ARTIFACTS, 'export-parity.json'), 'utf8'));
    report.buttonRows = rows;
    writeFileSync(resolve(ARTIFACTS, 'export-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while rendering the export');
    assert.deepEqual(failures, [], 'the exported Button and Play differ');
});
