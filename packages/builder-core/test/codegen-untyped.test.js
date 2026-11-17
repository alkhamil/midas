import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

// A template without slots is emitted as an untyped .jsx: no TypeScript syntax may reach that file,
// and esbuild must read it as plain JSX (the export-parity gate compiles it that way).
const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary', 'danger'], variantModes: ['solid', 'outlined'] });
const master = { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' };
const binding = { ...model.binding };
const variables = { collections: model.collections, items: model.items };

test('the untyped .jsx carries no TypeScript annotations or type aliases', () => {
    const jsx = generateComponent(button, binding, variables, 'Button', master, () => []).files['Button.jsx'];
    assert.doesNotMatch(jsx, /^type /m, 'no type alias');
    assert.doesNotMatch(jsx, /: GradientFill|: PatternFill/, 'no annotation on the fill serializers');
    assert.doesNotMatch(jsx, /: string \| undefined/, 'no return type on the gradient serializer');
});

test('the untyped .jsx compiles as plain JSX', () => {
    const jsx = generateComponent(button, binding, variables, 'Button', master, () => []).files['Button.jsx'];
    assert.doesNotThrow(() => transformSync(jsx, { loader: 'jsx', jsx: 'automatic' }));
});
