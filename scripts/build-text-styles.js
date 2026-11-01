// Writes the Semantic text styles' raw data: the typography Primitives (literal members) and the Semantic typography styles that
// alias them whole. Sizes and weights follow antd-ref (fontSize 14 scale; headings 38/30/24/20/16; fontWeightStrong 600), and the
// line heights and family are read from the committed base snapshot, which already pairs each size to the Typography table.
// Run: node scripts/build-text-styles.js. Refuses when the snapshot has no pairing for a size.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(readFileSync(resolve(root, 'packages/builder-core/src/base-tokens/base-snapshot.json'), 'utf8'));
const typography = name => snapshot.items.find(i => i.collection === 'Typography' && i.name === name)?.values['Mode 1']?.literal;
const family = typography('font/family/body');
const letterSpacing = typography('font/letter-spacing/0');
if (family === undefined || letterSpacing === undefined) throw new Error('the snapshot has no body family or zero letter spacing');

// The Typography table's line height at the size's step; a size with no step of its own uses the nearest lower step (flagged).
const steps = snapshot.items.filter(i => i.collection === 'Typography' && /^font\/line-height\/\d+$/.test(i.name)).map(i => Number(i.name.split('/').pop())).sort((a, b) => a - b);
const lineFor = size => {
    const step = steps.includes(size) ? size : steps.filter(s => s < size).pop();
    if (step === undefined) throw new Error(`no line-height step at or below ${size}`);
    return { line: typography(`font/line-height/${step}`), step, exact: step === size };
};

// name, fontSize (antd), weight (antd: Regular, or fontWeightStrong 600 = SemiBold)
const LADDER = [
    ['textXs', 10, 'Regular'], ['textSm', 12, 'Regular'], ['textBase', 14, 'Regular'], ['textLg', 16, 'Regular'], ['textXl', 20, 'Regular'],
    ['heading1', 38, 'SemiBold'], ['heading2', 30, 'SemiBold'], ['heading3', 24, 'SemiBold'], ['heading4', 20, 'SemiBold'], ['heading5', 16, 'SemiBold'],
];
const STRONG = ['textXs', 'textSm', 'textBase', 'textLg', 'textXl'];
const primName = name => {
    const text = /^text([A-Z][a-z]*)(Strong)?$/.exec(name);
    if (text) return `text/${text[1].toLowerCase()}${text[2] ? '-strong' : ''}`;
    return name.replace(/^heading(\d)$/, 'heading/$1');
};
const primitives = [], semantic = [], derived = [];
const add = (name, size, weight) => {
    const { line, step, exact } = lineFor(size);
    if (!exact) derived.push({ name: `Primitives/${primName(name)}`, reason: `font size ${size} has no line-height step; nearest lower step ${step} (${line}px)` });
    primitives.push({ collection: 'Primitives', name: primName(name), type: 'typography', values: { Base: { literal: { fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: line, letterSpacing } } } });
    semantic.push({ collection: 'Semantic', name, type: 'typography', values: { Light: { alias: { collection: 'Primitives', name: primName(name) } }, Dark: { alias: { collection: 'Primitives', name: primName(name) } } } });
};
for (const [name, size, weight] of LADDER) add(name, size, weight);
for (const name of STRONG) add(`${name}Strong`, LADDER.find(([n]) => n === name)[1], 'SemiBold');

writeFileSync(resolve(root, 'packages/builder-core/src/base-tokens/text-styles.json'), JSON.stringify({ collections: [{ name: 'Primitives', modes: ['Base'] }, { name: 'Semantic', modes: ['Light', 'Dark'] }], items: [...primitives, ...semantic], report: { derived } }, null, 2) + '\n');
console.log(`Wrote ${primitives.length} typography primitives and ${semantic.length} Semantic styles`);
