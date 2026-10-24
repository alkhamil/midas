// Scroll Behavior: Overflow di setiap frame; Position untuk node child.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeScroll, SCROLL_OVERFLOWS, SCROLL_POSITIONS } from '../src/index.js';

test('opsi overflow dan position sesuai permintaan', () => {
    assert.deepEqual(SCROLL_OVERFLOWS.map(o => o.id), ['none', 'both', 'horizontal', 'vertical']);
    assert.deepEqual(SCROLL_POSITIONS.map(o => o.id), ['scroll', 'fixed', 'sticky']);
});

test('default tidak disimpan (file lama tetap bersih)', () => {
    assert.deepEqual(normalizeScroll({}), {});
    assert.deepEqual(normalizeScroll({ overflow: 'none', scroll: 'scroll' }), {});
    assert.deepEqual(normalizeScroll(null), {});
});

test('non-default dan valid disimpan; yang asing dibuang', () => {
    assert.deepEqual(normalizeScroll({ overflow: 'both' }), { overflow: 'both' });
    assert.deepEqual(normalizeScroll({ scroll: 'fixed' }), { scroll: 'fixed' });
    assert.deepEqual(normalizeScroll({ overflow: 'diagonal', scroll: 'sticky' }), { scroll: 'sticky' });
});
