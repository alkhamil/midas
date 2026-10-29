import test from 'node:test';
import assert from 'node:assert/strict';
import { colorTokens, tailwindClasses, tailwindPreset, tailwindTheme } from '../src/index.js';

const variables = {
    collections: [{ id: 'c', name: 'Semantic', modes: [{ id: 'm', name: 'Light' }] }, { id: 'p', name: 'Primitives', modes: [{ id: 'pm', name: 'Base' }] }],
    items: [
        { id: 'a', name: 'color/primary', type: 'color', collectionId: 'c', values: { m: '#123456' } },
        { id: 'b', name: 'color/muted-foreground', type: 'color', collectionId: 'c', values: { m: '#667085' } },
        { id: 'r', name: 'primary/500', type: 'color', collectionId: 'p', values: { pm: '#0a2540' } },
        { id: 'g', name: 'spacing/lg', type: 'number', collectionId: 'c', values: { m: 16 } },
    ],
};

test('tailwindClasses: static utilities, arbitrary properties and theme colours, all with the prefix', () => {
    const colors = new Set(['primary']);
    const c = tailwindClasses({ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 16px 8px 16px', background: 'var(--theme-primary, #123456)', color: 'var(--theme-other, #000)', fontFamily: "'Inter', sans-serif", opacity: undefined }, { colors });
    assert.deepEqual(c, ['mds:flex', 'mds:flex-col', 'mds:[gap:12px]', 'mds:[padding:8px_16px_8px_16px]', 'mds:bg-primary', 'mds:[color:var(--theme-other,_#000)]', 'mds:[font-family:Inter,_sans-serif]']);
});

test('tailwindClasses: a colour that is not a theme token stays an arbitrary property', () => {
    assert.deepEqual(tailwindClasses({ background: 'var(--theme-primary, #123)' }), ['mds:[background:var(--theme-primary,_#123)]']);
    assert.deepEqual(tailwindClasses({ background: '#FFFFFF' }), ['mds:[background:#FFFFFF]']);
});

test('the Tailwind theme, v4 and v3, holds only the library colours', () => {
    assert.ok(!colorTokens(variables).has('primary-500'), 'the raw palette is not a Tailwind colour');
    assert.deepEqual([...colorTokens(variables)], [['primary', '--theme-primary'], ['muted-foreground', '--theme-muted-foreground']]);
    const css = tailwindTheme(variables);
    assert.match(css, /@theme inline \{/);                                       // so a dark theme set on any element reaches the utilities
    assert.match(css, /--color-\*: initial;/);                                  // Tailwind's own palette is dropped
    assert.match(css, /--color-primary: var\(--theme-primary\);/);
    assert.match(css, /--color-muted-foreground: var\(--theme-muted-foreground\);/);
    assert.ok(!css.includes('spacing'), 'only colours');
    const preset = tailwindPreset(variables);
    assert.match(preset, /"primary": "var\(--theme-primary\)"/);
    assert.match(preset, /module\.exports/);
});
