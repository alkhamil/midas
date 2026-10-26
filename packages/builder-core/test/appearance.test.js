// Appearance on a Show feedback action: pinned modes and variant values, kept on the action, read at runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, resolveAppearance, resolveFeedback, normalizeActions } from '../src/index.js';

const ev = states => ({ interpolate: t => t, get: id => states[id] });

test('empty entries are the default and are dropped; nothing pinned is undefined', () => {
    assert.equal(normalizeAppearance({ modes: { c1: '' }, variants: { State: '' } }), undefined);
    assert.equal(normalizeAppearance(undefined), undefined);
    assert.deepEqual(normalizeAppearance({ modes: { c1: 'm-error' }, variants: { State: '', Size: 'Large' } }), { modes: { c1: 'm-error' }, variants: { Size: 'Large' } });
});

test('a State binding is kept as { stateId }, and an empty id is dropped', () => {
    assert.deepEqual(normalizeAppearance({ modes: { c1: { stateId: 'st1' } } }), { modes: { c1: { stateId: 'st1' } } });
    assert.equal(normalizeAppearance({ modes: { c1: { stateId: '' } } }), undefined);
});

test('a State-bound value is read now; an empty State falls back to the default', () => {
    const ap = { modes: { c1: { stateId: 'st1' }, c2: 'm-info' }, variants: { State: { stateId: 'st2' } } };
    assert.deepEqual(resolveAppearance(ap, ev({ st1: 'm-error', st2: '' })), { modes: { c1: 'm-error', c2: 'm-info' }, variants: {} });
    assert.equal(resolveAppearance(ap, ev({ st1: '', st2: '' })).modes.c1, undefined, 'an empty State is the default');
    assert.equal(resolveAppearance(undefined, ev({})), undefined);
});

test('the Show feedback action keeps its pinned appearance and hands it to the host', () => {
    const [a] = normalizeActions([{ type: 'show-feedback', kind: 'alert', level: 'error', message: 'Wrong', appearance: { modes: { c1: 'm-error' } } }]);
    assert.deepEqual(a.appearance, { modes: { c1: 'm-error' } });
    assert.deepEqual(resolveFeedback(a, ev({})).appearance, { modes: { c1: 'm-error' }, variants: {} });
});

test('an open action (dropdown, overlay, popover) keeps its pinned appearance too', () => {
    const [d] = normalizeActions([{ type: 'open-dropdown', targetComponentId: 'menu', appearance: { variants: { Size: 'Large' }, modes: { c1: '' } } }]);
    assert.deepEqual(d.appearance, { variants: { Size: 'Large' } });
    const [o] = normalizeActions([{ type: 'open-overlay', targetComponentId: 'dlg' }]);
    assert.equal(o.appearance, undefined);
});

test('two actions on the same component can pin different modes; an unpinned action has no appearance', () => {
    const [x, y, z] = normalizeActions([
        { type: 'show-feedback', kind: 'alert', level: 'error', appearance: { modes: { c1: 'm-error' } } },
        { type: 'show-feedback', kind: 'alert', level: 'info', appearance: { modes: { c1: 'm-info' } } },
        { type: 'show-feedback', kind: 'alert', level: 'info' },
    ]);
    assert.equal(resolveFeedback(x, ev({})).appearance.modes.c1, 'm-error');
    assert.equal(resolveFeedback(y, ev({})).appearance.modes.c1, 'm-info');
    assert.equal(resolveFeedback(z, ev({})).appearance, undefined);
});
