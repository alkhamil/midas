// Switch text and icons (round 4, antd children): managed text slots inside the track
// (like Input managed text) per state plus a managed icon slot per state (like Button's
// icon). The layer exists only while its kind matches and its content is set; typed text
// is never lost on toggle or kind switch. Text sits opposite the handle by anatomy order,
// bound to Color and Size tokens, with canvas = Play = export parity per state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/index.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const sw = TEMPLATES.get('switch');

function childrenOf(nodes, parentId) {
    return nodes.filter(n => n.parentId === parentId);
}

test('the schema declares a kind, text and icon per side, remembered', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)).filter(p => /icon|text|kind|slot|show/i.test(p)), []);
    for (const [kind, text, icon] of [['checkedKind', 'checkedChildren', 'checkedIcon'], ['uncheckedKind', 'uncheckedChildren', 'uncheckedIcon']]) {
        assert.equal(sw.props[kind].type, 'enum', `${kind} is an enum`);
        assert.deepEqual(sw.props[kind].options, ['text', 'icon'], `${kind} is Text|Icon`);
        assert.equal(sw.props[kind].control, 'segmented', `${kind} renders segmented`);
        assert.equal(sw.props[kind].remembered, undefined, `${kind} is always visible, so remembering is vacuous`);
        assert.deepEqual(sw.props[kind].slots, { icon: icon }, `${kind} places the icon slot`);
        assert.equal(sw.props[text].type, 'string', `${text} is text`);
        assert.equal(sw.props[text].remembered, true, `${text} is remembered`);
        assert.deepEqual(sw.props[text].visibleIf, { prop: kind, is: 'text' }, `${text} shows for text kind`);
        assert.equal(sw.props[icon].type, 'iconComponent', `${icon} is an icon`);
        assert.equal(sw.props[icon].remembered, true, `${icon} is remembered`);
        assert.deepEqual(sw.props[icon].visibleIf, { prop: kind, is: 'icon' }, `${icon} shows for icon kind`);
    }
});

test('the icon defs gate on state and kind, with a component, label and tokens', () => {
    const defs = iconDefsOf(sw);
    assert.equal(defs.length, 2);
    assert.deepEqual(defs[0], { show: 'checked', placement: 'checkedKind', slot: 'checkedIcon', component: 'checkedIcon', label: 'Checked icon', tokens: { colour: 'handle-bg', disabledColour: 'handle-bg', size: 'iconSize' } });
    assert.deepEqual(defs[1].show, { prop: 'checked', is: false });
    assert.equal(defs[1].placement, 'uncheckedKind');
    assert.equal(defs[1].slot, 'uncheckedIcon');
    assert.equal(defs[1].component, 'uncheckedIcon');
    const kinds = new Set(sw.anatomy.map(s => s.kind));
    assert.ok(kinds.has('text') && kinds.has('icon'), 'anatomy holds text and icon slots');
    assert.deepEqual(sw.display.checkedChildren, { fill: 'handle-bg', typography: 'textTypography' });
    assert.deepEqual(sw.display.checkedIcon, { size: 'iconSize' });
});

test('managed layers order the text box before the handle when checked and after it when unchecked', () => {
    for (const [props, want] of [
        [{ checked: true, checkedKind: 'text', checkedChildren: 'on' }, ['innerOn', 'handle']],
        [{ checked: true, checkedKind: 'icon', checkedIcon: 'Icon/check' }, ['checkedIcon', 'handle']],
        [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'off' }, ['handle', 'innerOff']],
        [{ checked: false, uncheckedKind: 'icon', uncheckedIcon: 'Icon/close' }, ['handle', 'uncheckedIcon']],
    ]) {
        const model = modelFor(sw);
        const nodes = instanceFor(model, props);
        const order = childrenOf(nodes, nodes[0].id).map(n => n.behavior?.slot ?? n.behavior?.group);
        assert.deepEqual(order, want, `order for ${JSON.stringify(props)}`);
    }
});

test('typed text and icons survive toggling the state and switching the kind', () => {
    const model = modelFor(sw);
    const textOf = nodes => nodes.find(n => n.behavior?.slot === 'checkedChildren')?.text;
    let nodes = instanceFor(model, { checked: true, checkedKind: 'text', checkedChildren: 'on' });
    assert.equal(textOf(nodes), 'on');
    // Toggling off removes the layer but keeps the prop; toggling on restores the same text.
    nodes = instanceFor(model, { checked: false, checkedKind: 'text', checkedChildren: 'on' });
    assert.equal(nodes.some(n => n.behavior?.slot === 'checkedChildren'), false);
    nodes = instanceFor(model, { checked: true, checkedKind: 'text', checkedChildren: 'on' });
    assert.equal(textOf(nodes), 'on');
    // An icon kind keeps the text prop; switching back restores the text layer.
    nodes = instanceFor(model, { checked: true, checkedKind: 'icon', checkedChildren: 'on', checkedIcon: 'Icon/check' });
    assert.equal(nodes.some(n => n.behavior?.slot === 'checkedChildren'), false);
});

test('an icon show naming a missing or non-boolean prop is refused', () => {
    for (const show of ['nope', { prop: 'checkedChildren', is: false }, { prop: 'checked' }]) {
        const bad = structuredClone(sw);
        bad.icons.find(i => i.slot === 'uncheckedIcon').show = show;
        assert.ok(validateTemplateSchema(bad).some(p => /show/i.test(p)), `show ${JSON.stringify(show)} is refused`);
    }
});

test('the export draws text opposite the handle with token colours and typography', () => {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Switch.css'], /\.switch-checkedChildren \{\s*[^}]*color: var\(--switch-handle-bg\);/s);
    assert.match(out.files['Switch.css'], /font-size: var\(--switch-text-typography-font-size\);/s);
    const jsx = out.files['Switch.jsx'];
    assert.match(jsx, /\{\(\(checked === true\) && \(checkedKind === "text"\) && \(String\(checkedChildren \?\? ""\) !== ""\)\) && <span className="switch-checkedChildren">\{checkedChildren\}<\/span>\}/s);
    assert.match(jsx, /\{checked && checkedKind === "icon" && <span className="switch-checkedIcon">\{checkedIcon\}<\/span>\}/s);
    assert.match(jsx, /\{checked === false && uncheckedKind === "icon" && <span className="switch-uncheckedIcon">\{uncheckedIcon\}<\/span>\}/s);
});

function playTree(model, nodes) {
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { root, styles };
}

test('Play draws the canvas text layer opposite the handle; the export rule names the same tokens its bindings do', () => {
    for (const [props, text, handleFirst] of [
        [{ checked: true, checkedKind: 'text', checkedChildren: 'on' }, 'on', false],
        [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'off' }, 'off', true],
    ]) {
        const model = modelFor(sw);
        const nodes = instanceFor(model, props);
        const layer = nodes.find(n => n.behavior?.slot && n.type === 'text');
        assert.ok(layer, `canvas holds the text layer for ${JSON.stringify(props)}`);
        assert.equal(layer.text, text, 'the canvas layer shows the prop text');
        // The layer binds the tokens the export rule names (canvas = export).
        const layers = [{ key: layer.behavior.slot, node: layer }];
        const { problems } = planManagedTextBindings({ template: sw, binding: model.binding, props: resolveProps(sw, props), layers, variables: model.variables });
        assert.deepEqual(problems, []);
        applyBindTokens(layers, planManagedTextBindings({ template: sw, binding: model.binding, props: resolveProps(sw, props), layers, variables: model.variables }).ops);
        const { root, styles } = playTree(model, nodes);
        const swEl = elementsOf(root).find(({ el }) => el.attrs?.class === 'switch');
        const kids = swEl.el.children;
        const box = kids.find(c => c.children?.some(k => k.tag === 'span' && k.text === text));
        assert.ok(box, `Play draws the text "${text}" inside its box`);
        assert.equal(kids.findIndex(c => c.attrs?.class === 'switch-handle') === 0, handleFirst, `handle ${handleFirst ? 'first' : 'last'} for ${JSON.stringify(props)}`);
        assert.equal((kids.indexOf(box) === 0) !== handleFirst, true, `text sits opposite the handle for ${JSON.stringify(props)}`);
        assert.ok(styles.includes(`.switch-${layer.behavior.slot}`), 'Play reads the same rule the export writes');
    }
    for (const [props, iconClass, handleFirst] of [
        [{ checked: true, checkedKind: 'icon', checkedIcon: 'Icon/check' }, 'switch-checkedIcon', false],
        [{ checked: false, uncheckedKind: 'icon', uncheckedIcon: 'Icon/close' }, 'switch-uncheckedIcon', true],
    ]) {
        const model = modelFor(sw);
        const nodes = instanceFor(model, props);
        const { root } = playTree(model, nodes);
        const swEl = elementsOf(root).find(({ el }) => el.attrs?.class === 'switch');
        const classes = swEl.el.children.map(c => c.attrs?.class);
        assert.ok(classes.includes(iconClass), `Play draws ${iconClass}`);
        assert.equal(classes.indexOf('switch-handle') === 0, handleFirst, `handle ${handleFirst ? 'first' : 'last'} for ${JSON.stringify(props)}`);
    }
});

test('the track hugs its content with the token width as the minimum, on every surface', () => {
    assert.deepEqual(sw.display.root.minWidth, 'trackWidth', 'min-width bound to the track token');
    assert.equal(sw.display.root.width, undefined, 'no fixed width: the track hugs');
    const model = modelFor(sw);
    const sizeColl = model.variables.collections.find(c => c.name === 'Switch Size');
    assert.ok(model.variables.items.some(i => i.collectionId === sizeColl.id && i.name === 'trackWidth'), 'Auto Fix aliases the track min-width through the Size collection');
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.match(out.files['Switch.css'], /\.switch \{\s*[^}]*min-width: var\(--switch-track-width\);/s);
    assert.ok(!/^\s+width: var\(--switch-track-width\)/m.test(out.files['Switch.css']), 'no fixed track width in the export');
});

