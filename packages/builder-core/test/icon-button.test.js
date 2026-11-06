// Icon Button: one swappable icon and no text. Variant and Color are Button's (the same modes and roles), Size (a square box of the Size height), Type (default | float:
// visual only, the elevation as a token) and Shape (square | circle, independent), the states of Button (hover, pressed, focus, disabled, loading). The canvas node tree is the source; Play and the export derive from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, slotShown } from '../src/behavior-engine/template-master.js';
import { resolveTokens } from '../src/behavior-engine/tokens.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { instancePanel, setInstanceValue } from '../src/behavior-engine/panel.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { cornerRadii } from '../src/geometry/shapes.js';
import { iconButtonModel } from '../../../scripts/icon-button-model.mjs';

const template = BUILT_IN_TEMPLATES.get('icon-button');
const model = iconButtonModel();
const variables = { collections: model.collections, items: model.items };
const { variant, color, shape, size, type } = model.ids;
/** The instance's mode per collection (varModes: type, shape, size; Variant and Color stay outlined and primary), and per dimension (what the token resolver takes). */
const modes = (t, s, z) => ({ [variant]: 'outlined', [color]: 'primary', [type]: t, [shape]: s, [size]: z });
const picked = (t, s, z) => ({ variant: 'outlined', color: 'primary', type: t, shape: s, size: z });

/** A master built by the generator, with its layers. */
function master() {
    const frame = { id: 'm', name: 'Icon Button', type: 'frame', parentId: null, fills: [], x: 400, y: 0 };
    const { created } = applyTemplateToFrame(template, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
    return { frame, created };
}
const childrenOf = layers => id => layers.filter(n => n.parentId === id);
/** An instance of the master with the props and modes, sized as the editor sizes it (a square of `box`). */
function instance({ frame, created }, props = {}, varModes = modes('default', 'square', 'md'), box = 32) {
    const nodes = instanceOf(template, frame, created, props, { id: src => `i-${src}`, varModes });
    Object.assign(nodes[0], { parentId: 'stage', x: 10, y: 10, w: box, h: box });
    return nodes;
}
const exported = m => generateComponent(template, model.binding, variables, componentNameOf(template), m.frame, childrenOf(m.created)).files;

test('the template is registered, valid, not a form control, and made of one always visible icon slot', () => {
    assert.ok(template);
    assert.deepEqual(validateTemplateSchema(template), []);
    assert.equal(template.control, undefined);
    assert.deepEqual(template.anatomy, [{ id: 'icon', kind: 'icon', managed: true, alwaysVisible: true }]);
    assert.ok(!template.anatomy.some(s => s.kind === 'text' || s.kind === 'control'), 'no text slot');
    assert.ok(!('hasIcon' in template.props) && !('label' in template.props), 'no icon switch and no label');
});

test('Variant and Color come from Button, Type is default | float, Shape is square | circle and defaults to square, Size is xs to xl', () => {
    const button = BUILT_IN_TEMPLATES.get('button');
    assert.deepEqual(template.props.variant, button.props.variant);
    assert.deepEqual(template.props.color, button.props.color);
    assert.deepEqual(template.props.type.modes, ['default', 'float']);
    assert.equal(template.props.type.defaultMode, 'default');
    assert.deepEqual(template.props.shape.modes, ['square', 'circle']);
    assert.equal(template.props.shape.defaultMode, 'square');
    assert.deepEqual(template.props.size.modes, ['xs', 'sm', 'md', 'lg', 'xl']);
    assert.notEqual(template.props.type.collection, template.props.shape.collection, 'the Shape is its own collection: the Type does not decide it');
});

test('the master is a fixed square bound to the Size height, the Shape radius, the border and the shadow tokens, with no text layer', () => {
    const m = master();
    assert.deepEqual([m.frame.layoutSizingH, m.frame.layoutSizingV], ['fixed', 'fixed']);
    assert.deepEqual(m.frame.vars, { 'fills.0': 'v-bg', stroke: 'v-border', strokeWidth: 's-borderWidth', radius: 'sh-shape-radius', w: 's-height', h: 's-height', effects: 't-shadow' });
    assert.deepEqual([m.frame.counterAlign, m.frame.primaryAlign], ['center', 'center']);
    assert.deepEqual(m.created.map(n => n.name), ['spinner'], 'the spinner part is the only master layer');
    assert.equal(m.created[0].visible, false);
    assert.ok(!m.created.some(n => n.type === 'text'));
});

test('an instance holds the icon slot, shown, with no label; a second planner run adds nothing', () => {
    const nodes = instance(master());
    const icon = nodes.find(n => n.behavior?.slot === 'icon');
    assert.ok(icon && icon.visible === true);
    assert.ok(!nodes.some(n => n.type === 'text'));
    const plan = planInstanceAnatomy({ binding: { templateId: 'icon-button' }, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'm', type: 'frame' }], stored: { icon: 'ic1' }, children: [] });
    assert.deepEqual(plan.ops, [{ op: 'insert', slot: 'icon', index: 0, component: 'ic1' }]);
});

test('the Shape picks the radius and the Type does not: every pairing of the two resolves on its own', () => {
    const radius = (v, s, z = 'md') => resolveTokens(template, model.binding, picked(v, s, z), variables).vars['--icon-button-shape-radius'];
    assert.equal(radius('default', 'square'), '6px');
    assert.equal(radius('float', 'square'), '6px', 'float stays a square until the Shape says circle');
    assert.equal(radius('default', 'circle'), '9999px');
    assert.equal(radius('float', 'circle'), '9999px');
    assert.equal(radius('default', 'square', 'xs'), '4px', 'a square follows the Size radius');
    assert.equal(radius('default', 'square', 'xl'), '8px');
});

test('the box is the Size height on both axes, from the same token as Button', () => {
    for (const [z, px] of [['xs', 16], ['sm', 24], ['md', 32], ['lg', 40], ['xl', 48]]) {
        const out = resolveTokens(template, model.binding, picked('default', 'square', z), variables);
        assert.equal(out.vars['--icon-button-height'], `${px}px`, z);
    }
    assert.equal(template.tokenRoles.height, BUILT_IN_TEMPLATES.get('button').tokenRoles.height);
    assert.equal(template.display.root.size, 'height');
});

test('Type is visual only: float adds the elevation and nothing else; the shadow is a token in both', () => {
    const tokens = v => resolveTokens(template, model.binding, picked(v, 'square', 'md'), variables).vars;
    assert.equal(tokens('default')['--icon-button-shadow'], 'none');
    assert.equal(tokens('float')['--icon-button-border'], tokens('default')['--icon-button-border'], 'the border follows the Variant and the Color, not the Type');
    assert.equal(tokens('float')['--icon-button-bg'], tokens('default')['--icon-button-bg']);
    assert.equal(tokens('float')['--icon-button-shadow'], '0px 6px 16px 0px #00000014, 0px 3px 6px -4px #0000001f, 0px 9px 28px 8px #0000000d');
    assert.equal(template.display.root.strokeWidth, 'borderWidth', 'the border width is the Semantic/lineWidth token for both');
});

test('loading: the spinner takes the icon place at 0.65 opacity, exclusive with disabled', () => {
    const m = master();
    const nodes = instance(m, { loading: true });
    assert.equal(nodes[0].opacity, 0.65);
    assert.equal(nodes.find(n => n.behavior?.part === 'spinner').visible, true);
    assert.equal(slotShown(template, 'icon', { loading: true }), false);
    assert.equal(slotShown(template, 'icon', { loading: false }), true);
    const rest = instance(m, {});
    assert.equal(rest[0].opacity, 1);
    assert.equal(rest.find(n => n.behavior?.part === 'spinner').visible, false);
    const loadingMaster = { behavior: model.binding, type: 'frame' };
    const next = setInstanceValue({ behavior: { props: { disabled: true } } }, loadingMaster, 'loading', true);
    assert.deepEqual([next.props.loading, next.props.disabled], [true, false]);
    assert.deepEqual(setInstanceValue({ behavior: { props: { loading: true } } }, loadingMaster, 'disabled', true).props, { disabled: true, loading: false });
});

test('the panel lists Variant, Color, Size and Type like Button, then Shape and the icon, with no icon switch', () => {
    const rows = instancePanel({ behavior: { props: {} } }, { behavior: model.binding }, model.collections, {}).rows;
    assert.deepEqual(rows.map(r => r.prop), ['variant', 'color', 'size', 'type', 'shape', 'icon', 'loading', 'disabled']);
    assert.equal(rows.find(r => r.prop === 'icon').kind, 'icon');
});

test('the ring: the outline starts at the border, drawn inside it with no gap, from the outline tokens', () => {
    const css = exported(master())['IconButton.css'];
    assert.match(css, /\.icon-button \{[^}]*outline: 2px solid var\(--icon-button-outline-color\);[^}]*outline-offset: -1px;/s);
    assert.match(css, /:focus-visible:not\(:disabled\):not\(\[data-blocked\]\) \{\s*--icon-button-outline-color: var\(--icon-button-outline-color-active\);/);
    assert.deepEqual([template.outline, template.interaction], [{ offset: 0 }, { focus: 'outline', wave: true }]);
});

test('the export: a fixed square host that draws its own border, radius and shadow, with no positioning, no text and no icon switch', () => {
    const files = exported(master());
    const root = /\.icon-button \{[^}]*\}/s.exec(files['IconButton.css'])[0];
    for (const rule of ['width: var(--icon-button-height);', 'height: var(--icon-button-height);', 'border-radius: var(--icon-button-shape-radius);', 'box-shadow: var(--icon-button-shadow);', 'border-color: var(--icon-button-border);', 'border-width: 1px;', 'background-color: var(--icon-button-bg);']) assert.ok(root.includes(rule), rule);
    assert.ok(!/position:\s*(fixed|absolute|sticky)/.test(root), 'float is visual only');
    assert.ok(!/padding-(inline|block)|padding:/.test(root), 'no padding: the icon is centred');
    assert.match(files['IconButton.jsx'], /\{loading !== true && <span className="icon-button-icon">\{icon\}<\/span>\}/);
    assert.match(files['IconButton.jsx'], /\{loading === true && \(<svg className="icon-button-spinner"/);
    assert.ok(!/hasIcon|label|children/.test(files['IconButton.jsx']));
    assert.match(files['IconButton.css'], /\.icon-button\[data-blocked\][^{]*\{[^}]*opacity: 0\.65;/s);
});

test('a circle is a circle on a square box on every surface: the radius is clamped to half the box', () => {
    // Canvas: the radius a node holds is clamped to half its shorter side wherever it is drawn.
    assert.deepEqual(cornerRadii({ type: 'frame', w: 32, h: 32, radius: 9999 }), [16, 16, 16, 16]);
    assert.deepEqual(cornerRadii({ type: 'frame', w: 48, h: 48, radius: 9999 }), [24, 24, 24, 24]);
    // Play and the export: the host's radius is the token in the one stylesheet, a plain length that the browser clamps to half the box
    // (CSS scales a radius that overflows the box). Not measurable here: see the report.
    const m = master();
    const nodes = instance(m, {}, modes('default', 'circle', 'md'));
    const stage = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [] };
    const { styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [stage, m.frame, ...m.created, ...nodes] }], variables }, 'stage');
    const play = styles;
    const circle = /\.icon-button\[data-variant="outlined"\]\[data-color="primary"\]\[data-size="md"\]\[data-type="default"\]\[data-shape="circle"\] \{[^}]*\}/s.exec(play)[0];
    assert.match(circle, /--icon-button-shape-radius: 9999px;/);
    assert.match(circle, /--icon-button-height: 32px;/, 'a square box: width and height are the one token');
    assert.equal(play, exported(m)['IconButton.css'], 'Play writes the stylesheet the export writes');
    assert.match(play, /\.icon-button \{[^}]*border-radius: var\(--icon-button-shape-radius\);[^}]*\}/s);
    assert.ok(!/min\(|clamp\(/.test(play), 'no second clamp: the browser does it');
});
