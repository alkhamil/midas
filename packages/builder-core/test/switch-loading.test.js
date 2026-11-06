// Switch loading (round 4): a spinner inside the handle (the Button spinner mechanism:
// an arc part with spin, shown while loading), the switch not interactive while loading
// (blocked clicks, dimmed to 0.65 like Button) and exclusive with disabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/index.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { isDisabledTarget } from '../src/prototype/events.js';
import { LOADING_OPACITY } from '../src/behavior-engine/display.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const sw = TEMPLATES.get('switch');
const button = TEMPLATES.get('button');

test('the schema declares loading: a boolean that dims the root, blocks clicks, exclusive with disabled', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)).filter(p => /loading|blockClick|spinner|parent/i.test(p)), []);
    assert.deepEqual(sw.props.loading, { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'disabled', clearsPreview: true, node: { key: 'root', field: 'opacity' } });
    assert.equal(sw.props.disabled.exclusiveWith, 'loading');
    assert.deepEqual(sw.element.blockClickProps, ['loading']);
});

test('the spinner reuses the Button spinner mechanism: an arc part with spin inside the handle', () => {
    const spinner = sw.parts.find(p => p.id === 'spinner');
    assert.ok(spinner, 'switch has a spinner part');
    assert.equal(spinner.parent, 'handle', 'the spinner lives inside the handle');
    assert.equal(spinner.kind, 'frame');
    assert.equal(spinner.spin, true);
    const btn = button.parts.find(p => p.id === 'spinner');
    assert.deepEqual(
        { start: spinner.arc.start, sweep: spinner.arc.sweep, ratio: spinner.arc.ratio, width: spinner.arc.width },
        { start: btn.arc.start, sweep: btn.arc.sweep, ratio: btn.arc.ratio, width: btn.arc.width },
        'same LoadingOutlined arc geometry as Button',
    );
    assert.deepEqual(spinner.shownWhen, { prop: 'loading', is: true });
    assert.deepEqual(spinner.tokens, { size: 'iconSize', colour: 'track-bg', disabledColour: 'track-bg' });
    assert.deepEqual(sw.display.spinner, { stroke: 'track-bg', size: 'iconSize' });
    assert.equal(sw.tokenKinds.iconSize, 'length');
});

test('a part parent that names no frame slot is refused', () => {
    const bad = structuredClone(sw);
    bad.parts.find(p => p.id === 'spinner').parent = 'nope';
    assert.ok(validateTemplateSchema(bad).some(p => /parent/i.test(p)));
});

test('the export draws the spinner inside the handle and dims plus blocks clicks while loading', () => {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const css = out.files['Switch.css'];
    assert.match(css, /\.switch-spinner \{\s*[^}]*color: var\(--switch-track-bg\);\s*[^}]*width: var\(--switch-icon-size\);\s*[^}]*height: var\(--switch-icon-size\);/s);
    assert.match(css, new RegExp(`\\.switch\\[data-blocked\\][^{]*\\{[^}]*opacity: ${LOADING_OPACITY};[^}]*pointer-events: none;`));
    const jsx = out.files['Switch.jsx'];
    assert.match(jsx, /data-blocked=\{blocked \|\| undefined\}/);
    assert.ok(jsx.indexOf('<div className="switch-handle">') < jsx.indexOf('switch-spinner'), 'spinner inside the handle');
    assert.match(jsx, /\{loading === true && \(\<svg className="switch-spinner"/, 'spinner shown while loading');
});

test('Play shows the spinner and treats loading as disabling the click', () => {
    const model = modelFor(sw);
    const nodes = instanceFor(model, { loading: true });
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    const swEl = found.find(({ el }) => el.attrs?.class === 'switch');
    assert.equal(swEl.el.attrs['data-blocked'], true);
    const handle = found.find(({ el }) => el.attrs?.class === 'switch-handle');
    const spinner = found.find(({ el, chain }) => typeof el.html === 'string' && el.html.includes('<svg') && chain.includes(handle.el));
    assert.ok(spinner, 'spinner element inside the handle');
    assert.equal(spinner.el.style.animation, 'midas-spin 1s linear infinite', 'Play spins the arc (the export draws it at rest)');
    assert.ok(isDisabledTarget({ attrs: swEl.el.attrs }, []), 'a loading root is a disabled click target');
});
