// Guard for the Input family (Password, TextArea, InputNumber): the default master and the demo instance (the sample props Generate Design System builds with) hold no
// hidden, opacity-0 or zero-size node and no unbound white fill; every optional prop adds exactly its layers when it turns on and takes exactly those away when it turns off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const FAMILY = ['password', 'textarea', 'inputnumber'];

/** The relative luminance of a #rrggbb(aa) colour, 0 to 1; near white is above 0.93. */
function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const dead = n => n.visible === false || n.opacity === 0 || (n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h);
/** A fill that is near white and not bound to a token: the leftover placeholder of a generated layer. A white a token resolves to (the outlined background) is the token's. */
const strayWhite = n => (n.fills ?? []).some((f, i) => f.visible !== false && f.type === 'solid' && luminance(f.color) > 0.93 && n.vars?.[`fills.${i}`] === undefined);

/** For each optional prop: the props that turn it on and the layers that appear with it (and go with it). */
const OPTIONS = {
    password: [
        { off: { visibilityToggle: false }, gone: ['eyeOff'], why: 'the eye is made with visibilityToggle and removed without it' },
        { on: { passwordVisible: true }, swap: { gone: ['eyeOff'], added: ['eye'] }, why: 'a shown password swaps the closed eye for the open one' },
        { on: { hasSuffix: true, suffixText: 'kg' }, added: ['suffixText'], why: 'a suffix text' },
        { on: { hasPrefix: true, prefixText: 'USD' }, added: ['prefixText'], why: 'a prefix text' },
    ],
    textarea: [
        { on: { showCount: true }, added: ['count'], why: 'the count' },
        { on: { value: 'hello' }, swap: { gone: ['placeholder'], added: ['value'] }, why: 'a value takes the placeholder place' },
    ],
    inputnumber: [
        { off: { controls: false }, gone: ['stepper', 'stepUp', 'stepDown'], why: 'the stepper and its arrows go with controls' },
        { off: { controlsPosition: 'none' }, gone: ['stepper', 'stepUp', 'stepDown'], why: 'position none draws no stepper' },
        { on: { hasSuffix: true, suffixText: 'kg' }, added: ['suffixText'], why: 'a suffix text' },
        { on: { hasPrefix: true, prefixText: '$' }, added: ['prefixText'], why: 'a prefix text' },
    ],
};

for (const id of FAMILY) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    const sample = template.sampleProps;
    const layers = props => instanceFor(model, { ...sample, ...props }).slice(1).map(n => n.name).sort();

    test(`${id}: the default master and the demo instance hold no hidden, transparent or zero-size node and no unbound white fill`, () => {
        const master = [model.frame, ...model.created];
        const demo = instanceFor(model, sample);
        for (const [label, nodes] of [['master', master], ['demo instance', demo]]) {
            assert.deepEqual(nodes.filter(dead).map(n => n.name), [], `${id} ${label}: dead layers`);
            assert.deepEqual(nodes.filter(strayWhite).map(n => n.name), [], `${id} ${label}: unbound white fills`);
        }
        assert.ok(model.created.every(n => n.type !== 'text' || n.name === 'placeholder'), 'the master holds the placeholder as its one text layer');
    });

    test(`${id}: every optional prop adds exactly its layers when on and removes exactly those when off`, () => {
        const base = layers({});
        for (const option of OPTIONS[id]) {
            const probe = option.on ?? option.off;
            const changed = layers(probe);
            const gone = option.gone ?? option.swap?.gone ?? [], added = option.added ?? option.swap?.added ?? [];
            const expected = [...base.filter(n => !gone.includes(n)), ...added].sort();
            assert.deepEqual(changed, expected, `${id}: ${option.why}`);
            // Back to the defaults: exactly the base layers again, so nothing is lost or left behind by the toggle.
            assert.deepEqual(layers({}), base, `${id}: ${option.why}: the default tree comes back`);
        }
    });

    test(`${id}: a limit or a toggle never hides a layer: states recolour by token`, () => {
        for (const props of [{ disabled: true }, { readOnly: true }, { value: '5', max: 5, min: 5 }]) {
            for (const n of instanceFor(model, { ...sample, ...props })) assert.ok(!dead(n), `${id} ${n.name} with ${JSON.stringify(props)}`);
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
