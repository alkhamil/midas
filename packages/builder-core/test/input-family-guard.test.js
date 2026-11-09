// Guard for Input (every kind) and InputNumber: the default master and the demo instance (the sample props Generate Design System builds with) hold no hidden, opacity-0 or
// zero-size node and no unbound white fill; every optional prop adds exactly its layers when on and takes exactly those away when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

/** The relative luminance of a #rrggbb(aa) colour, 0 to 1; near white is above 0.93. */
function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const dead = n => n.visible === false || n.opacity === 0 || (n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h);
/** A fill that is near white and not bound to a token: the leftover placeholder of a generated layer. A white a token resolves to (the outlined background) is the token's. */
const strayWhite = n => (n.fills ?? []).some((f, i) => f.visible !== false && f.type === 'solid' && luminance(f.color) > 0.93 && n.vars?.[`fills.${i}`] === undefined);

/** The cases: a template with the props that make a kind, and for each optional prop the props that turn it on and the layers that appear (and go) with it. */
const CASES = [
    { id: 'input', label: 'input (text)', kind: {}, options: [
        { on: { showCount: true }, added: ['count'], why: 'the inline count' },
        { on: { allowClear: true, value: 'x' }, swap: { gone: ['placeholder'], added: ['value', 'clear'] }, why: 'a value and the clear icon' },
        { on: { hasSuffix: true, suffixText: 'kg' }, added: ['suffixText'], why: 'a suffix text' },
    ] },
    { id: 'input', label: 'input (password)', kind: { kind: 'password' }, options: [
        { off: { visibilityToggle: false }, gone: ['eyeOff'], why: 'the eye is made with visibilityToggle and removed without it' },
        { on: { passwordVisible: true }, swap: { gone: ['eyeOff'], added: ['eye'] }, why: 'a shown password swaps the closed eye for the open one' },
        { on: { hasSuffix: true, suffixText: 'kg' }, added: ['suffixText'], why: 'a suffix text' },
        { on: { hasPrefix: true, prefixText: 'USD' }, added: ['prefixText'], why: 'a prefix text' },
    ] },
    { id: 'input', label: 'input (textarea)', kind: { kind: 'textarea' }, options: [
        { on: { showCount: true }, added: ['footer', 'countArea'], why: 'the count closes the box in a footer' },
        { on: { resize: 'vertical' }, added: ['resizeHandle'], why: 'the resize grip' },
        { on: { value: 'hello' }, swap: { gone: ['placeholder'], added: ['value'] }, why: 'a value takes the placeholder place' },
    ] },
    { id: 'inputnumber', label: 'inputnumber', kind: {}, options: [
        { off: { controls: false }, gone: ['stepper', 'stepUpBox', 'stepDownBox', 'stepUp', 'stepDown', 'stepDivider', 'stepEdge'], why: 'the stepper and everything in it go with controls' },
        { off: { controlsPosition: 'none' }, gone: ['stepper', 'stepUpBox', 'stepDownBox', 'stepUp', 'stepDown', 'stepDivider', 'stepEdge'], why: 'position none draws no stepper' },
        { on: { hasSuffix: true, suffixText: 'kg' }, added: ['suffixText'], why: 'a suffix text' },
        { on: { hasPrefix: true, prefixText: '$' }, added: ['prefixText'], why: 'a prefix text' },
    ] },
];

for (const { id, label, kind, options } of CASES) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    const sample = { ...template.sampleProps, ...kind };
    const layers = props => instanceFor(model, { ...sample, ...props }).slice(1).map(n => n.name).sort();

    test(`${label}: the default master and the demo instance hold no hidden, transparent or zero-size node and no unbound white fill`, () => {
        const master = [model.frame, ...model.created];
        const demo = instanceFor(model, sample);
        for (const [what, nodes] of [['master', master], ['demo instance', demo]]) {
            assert.deepEqual(nodes.filter(dead).map(n => n.name), [], `${label} ${what}: dead layers`);
            assert.deepEqual(nodes.filter(strayWhite).map(n => n.name), [], `${label} ${what}: unbound white fills`);
        }
    });

    test(`${label}: every optional prop adds exactly its layers when on and removes exactly those when off`, () => {
        const base = layers({});
        for (const option of options) {
            const changed = layers(option.on ?? option.off);
            const gone = option.gone ?? option.swap?.gone ?? [], added = option.added ?? option.swap?.added ?? [];
            const expected = [...base.filter(n => !gone.includes(n)), ...added].sort();
            assert.deepEqual(changed, expected, `${label}: ${option.why}`);
            assert.deepEqual(layers({}), base, `${label}: ${option.why}: the default tree comes back`);
        }
    });

    test(`${label}: a limit or a state never hides a layer: states recolour by token`, () => {
        for (const props of [{ disabled: true }, { readOnly: true }, { value: '5', max: 5, min: 5 }]) {
            for (const n of instanceFor(model, { ...sample, ...props })) assert.ok(!dead(n), `${label} ${n.name} with ${JSON.stringify(props)}`);
        }
    });
}

test('the guard sees what it guards: a hidden, zero-size or transparent layer and an unbound white fill are caught, a bound white or a dark fill is not', () => {
    const white = [{ type: 'solid', color: '#ffffff', visible: true }];
    assert.ok(dead({ visible: false }));
    assert.ok(dead({ opacity: 0 }));
    assert.ok(dead({ w: 0, h: 0, layoutSizingH: 'fixed', layoutSizingV: 'fixed' }));
    assert.ok(!dead({ w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' }));
    assert.ok(strayWhite({ fills: white }));
    assert.ok(strayWhite({ fills: [{ type: 'solid', color: '#fafafa', visible: true }] }));
    assert.ok(!strayWhite({ fills: white, vars: { 'fills.0': 'bg' } }));
    assert.ok(!strayWhite({ fills: [{ type: 'solid', color: '#18181b', visible: true }] }));
});
