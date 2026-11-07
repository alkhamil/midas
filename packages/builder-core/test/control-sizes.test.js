// The base data the form controls read (Checkbox, Switch, Radio): the box and indicator sizes and the Switch metrics, each a Semantic alias of a size
// Primitive (antd: controlInteractiveSize, the Switch track and handle, in components/switch/style/index.ts), reached by a role.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT } from '../src/index.js';
import ROLES from '../src/base-tokens/roles.json' with { type: 'json' };
import SIZES from '../src/base-tokens/antd-sizes.json' with { type: 'json' };

const WANT = {
    controlInteractiveSize: ['box-size', 16],
    controlIndicatorSize: ['indicator-size', 8],
    switchTrackHeight: ['switch-height', 22],
    switchTrackHeightSM: ['switch-height-sm', 16],
    switchTrackMinWidth: ['switch-min-width', 44],
    switchTrackMinWidthSM: ['switch-min-width-sm', 28],
    switchHandleSize: ['switch-handle', 18],
    switchHandleSizeSM: ['switch-handle-sm', 12],
    switchPadding: ['switch-padding', 2],
    switchInnerPadNear: ['switch-inner-pad-near', 4],
    switchInnerPadFarSM: ['switch-inner-pad-far-sm', 4],
    switchInnerPadFar: ['switch-inner-pad-far', 7],
};
const item = (collection, name) => BASE_SNAPSHOT.items.find(i => i.collection === collection && i.name === name);

test('each control size is a Semantic number that aliases a size Primitive of the same value', () => {
    for (const [name, [, value]] of Object.entries(WANT)) {
        const semantic = item('Semantic', name);
        assert.ok(semantic, `${name} is in the snapshot`);
        for (const mode of ['Light', 'Dark']) {
            const target = item('Primitives', semantic.values[mode].alias.name);
            assert.equal(target.values.Base.literal, value, `${name} (${mode})`);
        }
        assert.equal(SIZES[name].value, value, `${name} is in the antd size table`);
    }
});

test('each control size has a role that names it', () => {
    for (const [name, [role]] of Object.entries(WANT)) assert.equal(ROLES[role]?.base, `Semantic/${name}`, role);
});

test('the switch track colours have roles: the off track and its hover', () => {
    assert.equal(ROLES['track-off']?.base, 'Semantic/colorTextDisabled');
    assert.equal(ROLES['track-off-hover']?.base, 'Semantic/colorTextTertiary');
});
