// Glyphs: the Checkbox's checkmark and dash and the Radio's dot are built-in glyph definitions (data), not icon instances. A glyph slot is a managed layer of the
// instance made while its state prop is on and removed when it is off, as a managed text layer is; it is a vector layer with the glyph's outline, bound to a colour
// token and sized from a token. Play and the export draw the same outline from the definition, and a stylesheet rule shows it while the state attribute is on, so a
// click in Play needs no layer. There is no icon picker for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { GLYPHS, glyphPathD } from '../src/behavior-engine/glyphs.js';
import { ICON_SET, iconRolesOf } from '../src/behavior-engine/icon-set.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { applyToggle } from '../src/prototype/toggle.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const GLYPH_SLOTS = { checkbox: [['check', 'checkmark', 'checked'], ['indeterminate', 'dash', 'indeterminate']], radio: [['dot', 'dot', 'checked']] };

test('the built-in glyphs are closed outlines in a 24 x 24 space, and a path comes from each', () => {
    assert.deepEqual(Object.keys(GLYPHS).sort(), ['checkmark', 'chevronDown', 'chevronUp', 'dash', 'dot', 'eye', 'eyeOff']);
    for (const [name, glyph] of Object.entries(GLYPHS)) {
        assert.ok(glyph.points.length >= 3, name);
        assert.ok(glyph.points.every(p => p.x >= 0 && p.x <= 24 && p.y >= 0 && p.y <= 24), `${name} stays in its space`);
        assert.match(glyphPathD(name), /^M[\d. -]+/, name);
    }
});

test('Checkbox and Radio have glyph slots in the box, no icons and no icon props', () => {
    for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
        const t = TEMPLATES.get(id);
        assert.deepEqual(t.icons, [], `${id} has no icon defs`);
        assert.ok(!Object.values(t.props).some(p => p.type === 'iconComponent'), `${id} has no icon prop`);
        for (const [slot, glyph, prop] of slots) {
            assert.deepEqual(t.anatomy.find(s => s.id === slot), { id: slot, kind: 'glyph', glyph, parent: 'box', optional: true, managed: true, shownWhen: { prop, is: true } }, `${id}.${slot}`);
        }
    }
    assert.deepEqual(ICON_SET.map(e => e.name), ['circle'], 'the icon set holds no glyph');
    assert.deepEqual(iconRolesOf([...TEMPLATES.values()]), ['default']);
});

test('the schema refuses a glyph slot that names no glyph, has no condition, or follows a prop that is not a state with an attribute', () => {
    const bad = patch => { const t = structuredClone(TEMPLATES.get('checkbox')); Object.assign(t.anatomy.find(s => s.id === 'check'), patch); return validateTemplateSchema(t); };
    assert.deepEqual(bad({}), []);
    assert.ok(bad({ glyph: 'nope' }).some(p => /glyph/.test(p)));
    assert.ok(bad({ shownWhen: undefined }).some(p => /glyph/.test(p)));
    assert.ok(bad({ shownWhen: { prop: 'hasLabel', is: true } }).some(p => /glyph/.test(p)));
    assert.ok(bad({ managed: false }).some(p => /glyph/.test(p)));
});

test('a fresh instance holds only the box and the label; a state turns its glyph layer on and off, under the box', () => {
    for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
        const model = modelFor(TEMPLATES.get(id));
        const layers = props => instanceFor(model, props).slice(1);
        assert.deepEqual(layers({}).map(n => n.name), ['box', 'label'], `${id} fresh`);
        for (const [slot, , prop] of slots) {
            const nodes = instanceFor(model, { [prop]: true }), box = nodes.find(n => n.behavior?.group === 'box');
            const glyph = nodes.find(n => n.behavior?.slot === slot);
            assert.equal(glyph.parentId, box.id, `${id}.${slot} sits in the box`);
            const held = nodes.slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name }));
            assert.deepEqual(planAnatomy(model.template, resolveProps(model.template, {}), held), [{ op: 'remove', id: glyph.id }], `${id}.${slot} is removed when off`);
        }
    }
});

test('a glyph layer is a vector with its outline, not an instance, bound to its colour and size tokens', () => {
    const model = modelFor(TEMPLATES.get('checkbox'));
    const nodes = instanceFor(model, { checked: true }), glyph = nodes.find(n => n.behavior?.slot === 'check');
    assert.equal(glyph.type, 'path');
    assert.equal(glyph.isInstance, false);
    assert.equal(glyph.sourceId, undefined);
    assert.equal(glyph.closed, true);
    assert.deepEqual(glyph.points, GLYPHS.checkmark.points);
    assert.ok(!nodes.some(n => n.parentId === glyph.id), 'nothing inside it');
    const layers = [{ key: 'check', node: glyph }];
    const { ops, problems } = planManagedTextBindings({ template: model.template, binding: model.binding, props: resolveProps(model.template, { checked: true }), layers, variables: model.variables });
    assert.deepEqual(problems, []);
    applyBindTokens(layers, ops);
    assert.deepEqual(Object.keys(glyph.vars).sort(), ['fills.0', 'h', 'w']);
    assert.deepEqual([glyph.layoutSizingH, glyph.layoutSizingV], ['fixed', 'fixed']);
    const item = id => model.variables.items.find(i => i.id === id).name;
    assert.deepEqual([item(glyph.vars['fills.0']), item(glyph.vars.w)], ['check-fg', 'checkSize']);
});

test('while disabled the glyph takes its disabled colour on the canvas', () => {
    const model = modelFor(TEMPLATES.get('checkbox'));
    const glyph = instanceFor(model, { checked: true, disabled: true }).find(n => n.behavior?.slot === 'check');
    const layers = [{ key: 'check', node: glyph }];
    applyBindTokens(layers, planManagedTextBindings({ template: model.template, binding: model.binding, props: resolveProps(model.template, { checked: true, disabled: true }), layers, variables: model.variables }).ops);
    assert.equal(model.variables.items.find(i => i.id === glyph.vars['fills.0']).name, 'glyph-fg-disabled');
});

test('the panel offers no icon for a glyph: the states are plain switches', () => {
    for (const id of ['checkbox', 'radio']) {
        const model = modelFor(TEMPLATES.get(id));
        const rows = instancePanel({ behavior: { props: { checked: true } } }, { behavior: model.binding }, model.variables.collections, {}).rows;
        assert.ok(!rows.some(r => r.kind === 'icon'), `${id} has no icon row`);
        assert.ok(rows.some(r => r.prop === 'checked' && r.type === 'boolean' && !r.slot), `${id} Checked is a plain prop`);
    }
});

test('the export and Play draw the same outline from the definition, always, and the stylesheet shows it while the state attribute is on', () => {
    for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
        const model = modelFor(TEMPLATES.get(id));
        const out = generateComponent(model.template, model.binding, model.variables, model.template.name, model.frame, parent => model.created.filter(n => n.parentId === parent));
        assert.deepEqual(out.problems, []);
        const jsx = out.files[`${model.template.name}.jsx`], css = out.files[`${model.template.name}.css`];
        for (const [slot, glyph, prop] of slots) {
            assert.match(jsx, new RegExp(`<span className="${id}-${slot}"><svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="${glyphPathD(glyph).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" fill="currentColor" /></svg></span>`), `${id}.${slot} svg`);
            assert.match(css, new RegExp(`\\.${id}:not\\(\\[data-${prop}\\]\\) \\.${id}-${slot} \\{\\s*display: none;`), `${id}.${slot} is hidden while its state is off`);
        }
    }
});

/** The Play element of a glyph and its computed style for the props, with the stylesheet the export writes. */
function playGlyph(model, props, slot) {
    const nodes = instanceFor(model, props), instance = nodes[0];
    const modes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, collectionId]) => {
        const collection = model.variables.collections.find(c => c.id === collectionId), wanted = model.template.props[prop].defaultMode;
        return [collectionId, (collection.modes.find(m => m.id === wanted || m.name === wanted) ?? collection.modes[0]).id];
    }));
    instance.varModes = modes;
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, instance.id);
    assert.deepEqual(problems, []);
    const found = elementsOf(root).find(({ el }) => el.attrs?.class === `${model.template.id}-${slot}`);
    return { found, styles, root, nodes, modes };
}

test('Play: per state, the glyph is shown exactly when its canvas layer exists, with that layer\'s size and colour', () => {
    for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
        const model = modelFor(TEMPLATES.get(id));
        for (const state of ['unchecked', 'checked', 'indeterminate', 'disabled', 'disabled+checked']) {
            const props = { unchecked: {}, checked: { checked: true }, indeterminate: { indeterminate: true }, disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true } }[state];
            if (id === 'radio' && state === 'indeterminate') continue;
            for (const [slot, , prop] of slots) {
                const { found, styles, nodes } = playGlyph(model, props, slot);
                assert.ok(found, `${id} ${state}: Play has the ${slot} element`);
                const play = computed(styles, found.chain);
                const layer = nodes.find(n => n.behavior?.slot === slot);
                assert.equal(play.display !== 'none', props[prop] === true, `${id} ${state}: ${slot} shown`);
                assert.equal(!!layer, props[prop] === true, `${id} ${state}: the canvas layer exists exactly then`);
                if (!layer) continue;
                const modes = playGlyph(model, props, slot).modes;
                const { vars: shown } = previewOf(model.template, model.binding, Object.fromEntries(Object.entries(model.binding.variables).map(([p, cid]) => [p, modes[cid]])), model.variables, props, 'default');
                const token = display => shown[cssVarOf(id, model.template.display[slot][display])];
                assert.equal(play.width, token('size'), `${id} ${state}: ${slot} width`);
                assert.equal(play.height, token('size'), `${id} ${state}: ${slot} height`);
                assert.equal(play.color, token('fill'), `${id} ${state}: ${slot} colour`);
            }
        }
    }
});

test('a click in Play shows and hides the glyph with no layer: the stylesheet follows the attribute applyToggle flips', () => {
    const model = modelFor(TEMPLATES.get('checkbox'));
    const { found, styles, root } = playGlyph(model, {}, 'check');
    const attrs = new Map(Object.entries(root.attrs).filter(([, v]) => v !== false).map(([k, v]) => [k, v === true ? '' : String(v)]));
    const el = { style: {}, getAttribute: n => attrs.get(n) ?? null, hasAttribute: n => attrs.has(n), setAttribute: (n, v) => attrs.set(n, String(v)), removeAttribute: n => attrs.delete(n), querySelectorAll: () => [] };
    const shown = () => computed(styles, [{ ...root, attrs: Object.fromEntries([...attrs].map(([k, v]) => [k, v === '' ? true : v])) }, found.chain.at(-1)]).display !== 'none';
    assert.equal(shown(), false);
    applyToggle(el);
    assert.equal(shown(), true);
    applyToggle(el);
    assert.equal(shown(), false);
});
