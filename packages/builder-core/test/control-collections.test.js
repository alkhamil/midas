// Checkbox, Radio and Switch split their variables as Button does: the Size collection holds size and typography only, a Color collection (modes default,
// primary, danger; a new instance takes primary) holds every colour: fill, stroke, glyph, handle, track and label colours with their per-state values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { variableKey } from '../src/behavior-engine/tokens.js';
import { modelFor } from './helpers/box-template.js';

const names = ['checkbox', 'radio', 'switch'];
const tokensOf = (template, group) => template.tokens[group] ?? [];

test('each control has a Color dimension and a Size dimension, in the order Button has them', () => {
    for (const id of names) {
        const t = TEMPLATES.get(id);
        const dims = Object.entries(t.props).filter(([, d]) => d.source === 'variable').map(([p]) => p);
        assert.deepEqual(dims, ['color', 'size'], id);
        assert.deepEqual(t.props.color.modes, ['default', 'primary', 'danger'], `${id} uses Button's Color modes`);
        assert.equal(t.props.color.collection, 'Color');
        assert.equal(t.props.color.defaultMode, 'primary', `${id} starts on the brand colour`);
        assert.equal(t.props.size.collection, 'Size');
    }
});

test('Size tokens are lengths and typography, Color tokens are colours, and no colour token is left in Size', () => {
    for (const id of names) {
        const t = TEMPLATES.get(id);
        for (const token of tokensOf(t, 'fromSize')) assert.notEqual(t.tokenKinds[token], 'color', `${id}: ${token} is a colour in Size`);
        for (const token of tokensOf(t, 'fromColor')) assert.equal(t.tokenKinds[token], 'color', `${id}: ${token} is not a colour`);
        const colours = Object.keys(t.tokenKinds).filter(token => t.tokenKinds[token] === 'color');
        assert.deepEqual([...tokensOf(t, 'fromColor')].sort(), colours.sort(), `${id}: every colour is in Color`);
        assert.equal(tokensOf(t, 'fromVariant').length, 0);
    }
});

test('the generated variables follow: Color holds the colours and Size holds none, and the accent follows the Color mode', () => {
    for (const id of names) {
        const model = modelFor(TEMPLATES.get(id));
        const collection = prop => model.variables.collections.find(c => c.id === model.binding.variables[prop]);
        const items = prop => model.variables.items.filter(i => i.collectionId === collection(prop).id);
        assert.deepEqual(items('size').filter(i => i.type === 'color'), [], `${id}: no colour in Size`);
        assert.ok(items('color').length > 0 && items('color').every(i => i.type === 'color'), `${id}: Color holds colours only`);
        assert.equal(items('color').length, tokensOf(model.template, 'fromColor').length, `${id}: one variable per colour token`);
        const checked = items('color').find(i => variableKey(i.name) === variableKey(id === 'switch' ? 'track-bg-checked' : id === 'radio' ? 'box-border-checked' : 'box-bg-checked'));
        const aliasOf = modeName => checked.values[collection('color').modes.find(m => m.name.toLowerCase() === modeName).id].alias;
        assert.notEqual(aliasOf('primary'), aliasOf('danger'), `${id}: the accent changes with the Color mode`);
    }
});
