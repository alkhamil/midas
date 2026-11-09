// Icon Button has Button's click wave, from the same code: the schema's interaction.wave and a wave-color token. The ring is the host's ::after with
// `border-radius: inherit`, so it follows the Shape (a circle host gives a circular ring). A disabled or loading host is blocked, so it shows none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { resolveTokens } from '../src/behavior-engine/tokens.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { iconButtonModel } from '../../../scripts/icon-button-model.mjs';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const template = BUILT_IN_TEMPLATES.get('icon-button');
const button = BUILT_IN_TEMPLATES.get('button');
const model = iconButtonModel();
const variables = { collections: model.collections, items: model.items };
const frame = { id: 'm', name: 'Icon Button', type: 'frame', parentId: null, fills: [], x: 400, y: 0 };
const { created } = applyTemplateToFrame(template, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
const files = generateComponent(template, model.binding, variables, componentNameOf(template), frame, id => created.filter(n => n.parentId === id)).files;
const css = files['IconButton.css'], jsx = files['IconButton.jsx'];

const bm = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const buttonFiles = generateComponent(button, bm.binding, { collections: bm.collections, items: bm.items }, 'Button', { id: 'm', name: 'Button', type: 'frame', layout: 'horizontal' }, () => []).files;
/** A template's wave text with its own id and name made neutral, so Button's and Icon Button's compare. */
const neutral = (text, id, name) => text.replaceAll(`${id}-`, 'T-').replaceAll(`.${id}`, '.T').replaceAll(name, 'N');
const block = (text, pattern) => pattern.exec(text)?.[0];

test('the schema turns the wave on and holds the wave-color token the ring is drawn in', () => {
    assert.deepEqual(template.interaction, { focus: 'outline', wave: true });
    assert.deepEqual(validateTemplateSchema(template), []);
    assert.ok(template.tokens.fromVariant.includes('wave-color'));
    assert.equal(template.tokenKinds['wave-color'], 'color');
    assert.ok(template.playOnly.some(p => p.id === 'wave'), 'the wave is a play-only behaviour the canvas does not draw');
});

test('the wave is a colour per Variant, resolved for every Variant and for both Types', () => {
    for (const [v, t] of [['outlined', 'default'], ['solid', 'default'], ['outlined', 'float'], ['filled', 'float']]) {
        const vars = resolveTokens(template, model.binding, { variant: v, color: 'primary', type: t, shape: 'square', size: 'md' }, variables).vars;
        assert.match(vars['--icon-button-wave-color'], /^#[0-9a-f]{6}/, v);
    }
});

test('the export emits the hooks Button emits: data-wave, the blocked click, animationend, and the same wave script', () => {
    assert.match(jsx, /\bdata-wave\b/);
    assert.match(jsx, /onClick=\{blocked \? undefined : \(e\) => \{ if \(onClick\) onClick\(e\); waveDown\(e\.currentTarget\); \}\}/);
    assert.match(jsx, /onAnimationEnd=\{\(e\) => \{ if \(e\.animationName === 'midas-wave'\) e\.currentTarget\.removeAttribute\('data-wave-on'\); \}\}/);
    const script = pattern => [jsx, buttonFiles['Button.jsx']].map(t => block(t, pattern));
    const [own, theirs] = script(/function waveDown[\s\S]*?\n}\n/);
    assert.ok(own, 'the script is there');
    assert.equal(own, theirs, 'the same function as Button');
    for (const attr of [/data-wave\b/, /onAnimationEnd=\{[^\n]*\}/, /onClick=\{[^\n]*\}/]) assert.equal(block(jsx, attr), block(buttonFiles['Button.jsx'], attr));
});

test('the stylesheet carries the same ring rules and keyframes as Button, in the wave-color token', () => {
    for (const [pattern, label] of [[/\.[a-z-]+\[data-wave-on\]::after \{[^}]*\}/, 'run'], [/\.[a-z-]+::after \{[^}]*\}/, 'ring'], [/@keyframes midas-wave \{[\s\S]*?\n\}\n/, 'keyframes'], [/\[data-wave-on\]::after \{\s*animation: none;\s*\}/, 'reduced motion']]) {
        const own = block(css, pattern), theirs = block(buttonFiles['Button.css'], pattern);
        assert.ok(own && theirs, label);
        assert.equal(neutral(own, 'icon-button', 'IconButton').replaceAll('--T-wave-color', 'C'), neutral(theirs, 'button', 'Button').replaceAll('--T-wave-color', 'C'), label);
    }
    assert.match(css, /\.icon-button::after \{[^}]*--midas-wave-color: var\(--icon-button-wave-color\);[^}]*box-shadow: 0 0 0 0 var\(--midas-wave-color\)/);
});

test('the ring follows the Shape: it inherits the host radius, and a circle host has the full radius at the same box', () => {
    const ring = /\.icon-button::after \{[^}]*\}/.exec(css)[0];
    assert.match(ring, /inset: 0;/, 'the ring is the host box');
    assert.match(ring, /border-radius: inherit;/, 'and the host radius, not a rounded square of its own');
    assert.ok(!/min\(|clamp\(/.test(ring));
    const rule = (shape, size) => new RegExp(`\\.icon-button\\[data-variant="outlined"\\]\\[data-color="primary"\\]\\[data-size="${size}"\\]\\[data-type="default"\\]\\[data-shape="${shape}"\\] \\{[^}]*\\}`, 's').exec(css)[0];
    assert.match(rule('circle', 'md'), /--icon-button-shape-radius: 9999px;/);
    assert.match(rule('square', 'md'), /--icon-button-shape-radius: 6px;/);
    assert.match(css, /\.icon-button \{[^}]*border-radius: var\(--icon-button-shape-radius\);/s);
});

/** The instance drawn in Play: its element. */
function played(props, type = 'default', shape = 'circle') {
    const nodes = instanceOf(template, frame, created, props, { id: src => `i-${src}`, varModes: { [model.ids.variant]: 'outlined', [model.ids.color]: 'primary', [model.ids.type]: type, [model.ids.shape]: shape, [model.ids.size]: 'md' } });
    Object.assign(nodes[0], { parentId: 'stage', x: 10, y: 10, w: 32, h: 32 });
    const stage = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [] };
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [stage, frame, ...created, ...nodes] }], variables }, 'stage');
    return { el: root.children.find(c => c.nodeId === nodes[0].id), styles };
}

test('Play marks both types as wave hosts, with the stylesheet the export writes', () => {
    for (const type of ['default', 'float']) {
        const { el, styles } = played({}, type);
        assert.equal(el.attrs['data-wave'], '', type);
        assert.equal(el.attrs['data-blocked'], undefined);
        assert.equal(styles, css, 'Play writes the export stylesheet');
    }
});

test('a disabled or loading host is blocked, which is what stops the wave (Play skips a blocked host; the export returns before waveDown)', () => {
    assert.equal(played({ loading: true }).el.attrs['data-blocked'], true);
    const disabled = played({ disabled: true }).el;
    assert.equal(disabled.attrs.disabled, true);
    assert.deepEqual(template.element.blockClickProps, ['disabled', 'loading']);
    assert.deepEqual(button.element.blockClickProps, ['disabled', 'loading'], 'the same rule as Button');
    assert.match(jsx, /const blocked = disabled \|\| loading;/);
});

test('Button and Input output match their pinned hashes (the Input text part is named value)', () => {
    const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
    assert.equal(hash(buttonFiles['Button.jsx']), '53b29f8cdc7c2916');
    assert.equal(hash(buttonFiles['Button.css']), '5d10105108ea07fd', 'the stylesheet changed only in the wave: the shared keyframes colour');
    const im = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size', semantic: 'c-input-semantic' }, prefix: 'in-' });
    const input = generateComponent(BUILT_IN_TEMPLATES.get('input'), im.binding, { collections: im.collections, items: im.items }, 'Input', { id: 'm', name: 'Input', type: 'frame', layout: 'horizontal' }, () => []).files;
    assert.equal(hash(input['Input.jsx']), 'aa7f58e9093dde76');
    assert.equal(hash(input['Input.css']), 'a18ea67046954e16', 'a master with no layers lays the managed text slots out as an instance draws them (the value fills); a generated master gives the same sheet as before');
});

test('two wave templates on one page do not fight over the keyframes: one shared midas-wave in the colour the ring sets on its own element', () => {
    // Play writes every template's stylesheet into one document, so a second @keyframes midas-wave overrides the first: it may name no template's variable.
    const both = [buttonFiles['Button.css'], css].join('\n');
    const blocks = both.match(/@keyframes midas-wave \{[\s\S]*?\n\}\n/g);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0], blocks[1], 'the same keyframes text from both templates');
    assert.ok(!/--(button|icon-button)-/.test(blocks[0]), 'no template variable in the keyframes');
    assert.match(blocks[0], /var\(--midas-wave-color\)/);
    for (const [text, id] of [[buttonFiles['Button.css'], 'button'], [css, 'icon-button']]) {
        assert.match(text, new RegExp(`\\.${id}::after \\{[^}]*--midas-wave-color: var\\(--${id}-wave-color\\);[^}]*box-shadow: 0 0 0 0 var\\(--midas-wave-color\\);`));
    }
});
