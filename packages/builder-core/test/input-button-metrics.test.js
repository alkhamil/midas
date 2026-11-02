import test from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

test('Input and Button take the same height and vertical padding tokens at every Size', () => {
    for (const token of ['height', 'paddingY']) {
        for (const size of SIZE_MODES) {
            assert.equal(INPUT.tokenRoles[token][size], BUTTON.tokenRoles[token][size], `${token} at ${size}`);
        }
    }
});

/** A Size token's number in a model: the value its Primitive holds for the Size's mode, followed through the Semantic alias. */
function valueOf(model, token, size) {
    const sizeColl = model.collections.find(c => c.id === model.ids.size);
    const item = model.items.find(i => i.collectionId === sizeColl.id && i.name === token);
    let value = item.values[size];
    // Each mode holds an alias of a Semantic item, which aliases a Primitive; a Primitive holds the number.
    for (let guard = 0; guard < 4 && value && typeof value === 'object' && 'alias' in value; guard++) {
        const target = typeof value.alias === 'string' ? value.alias : value.alias.name;
        value = model.items.find(i => i.id === target)?.values?.base;
    }
    return value;
}

test('the fixture heights and vertical paddings of Input and Button are equal at every Size', () => {
    const button = buttonModel();
    const input = inputModel();
    for (const token of ['height', 'paddingY']) {
        for (const size of SIZE_MODES) {
            assert.equal(typeof valueOf(button, token, size), 'number', `${token} at ${size} is a number on Button`);
            assert.equal(valueOf(input, token, size), valueOf(button, token, size), `${token} at ${size}`);
        }
    }
});
