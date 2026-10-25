// node --test scripts/ant-design/build.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(mkdtempSync(join(tmpdir(), 'ant-')), 'ant.midas');
execFileSync(process.execPath, [join(here, 'build.mjs'), out], { stdio: 'pipe' });
const doc = JSON.parse(readFileSync(out, 'utf8'));
const props = JSON.parse(readFileSync(join(here, 'ant-props.json'), 'utf8'));
const nodes = doc.pages.flatMap(p => p.nodes);
const { collections, items } = doc.variables;
const byId = new Map(nodes.map(n => [n.id, n]));
const varById = new Map(items.map(i => [i.id, i]));
const collById = new Map(collections.map(c => [c.id, c]));

test('foundations follow the WDS layers', () => {
    const c = name => collections.find(x => x.name === name);
    assert.deepEqual(c('Primitives').modes.map(m => m.name), ['Base']);
    assert.deepEqual(c('Semantic').modes.map(m => m.name), ['Light', 'Dark']);
    assert.deepEqual(c('Size').modes.map(m => m.name), ['small', 'middle', 'large']);
    for (const n of ['Button type', 'Button states', 'Input states', 'Checkbox states']) assert.ok(c(n), n);
    assert.ok(c('Button states').modes.length >= 5);
});

test('every Ant component is covered, except the ones without a visual', () => {
    const have = new Set(nodes.filter(n => / — Documentation$/.test(n.name)).map(n => n.name.replace(' — Documentation', '')));
    const missing = [...new Set(props.map(c => c.name.split('.')[0]))].filter(n => ![...have].some(h => h === n || h.startsWith(n + '.') || n.startsWith(h)));
    assert.deepEqual(missing.sort(), ['Affix', 'App', 'BorderBeam', 'ConfigProvider']);
});

test('variables: aliases resolve to a variable of the same type, with no cycles; values exist for every mode', () => {
    for (const i of items) {
        const coll = collById.get(i.collectionId);
        assert.ok(coll, i.name);
        for (const m of coll.modes) {
            assert.ok(m.id in i.values, `${coll.name}/${i.name} has a value for ${m.name}`);
            let v = i.values[m.id], depth = 0;
            while (v && typeof v === 'object' && v.alias) {
                const t = varById.get(v.alias);
                assert.ok(t, `${coll.name}/${i.name} alias`);
                assert.equal(t.type, i.type, `${coll.name}/${i.name} alias type`);
                v = t.values[Object.keys(t.values)[0]];
                assert.ok(++depth < 20, 'alias cycle');
            }
        }
    }
});

test('component layers only bind to variables that exist, and varModes point at real modes', () => {
    for (const n of nodes) {
        for (const id of Object.values(n.vars || {})) assert.ok(varById.has(id), `${n.name} binds to a missing variable`);
        for (const [cid, mid] of Object.entries(n.varModes || {})) assert.ok(collById.get(cid)?.modes.some(m => m.id === mid), `${n.name} varModes`);
    }
});

test('the file is well formed: unique ids, valid parents and sources, no negative sizes', () => {
    assert.equal(byId.size, nodes.length);
    for (const n of nodes) {
        assert.ok(n.parentId === null || byId.has(n.parentId), `${n.name} parent`);
        assert.ok(!n.sourceId || byId.has(n.sourceId), `${n.name} source`);
        assert.ok(n.w >= 0 && n.h >= 0, `${n.name} size`);
    }
});

test('state collections are named so Preview picks them up (hover / pressed switch by themselves)', () => {
    for (const c of collections.filter(c => / states?$/.test(c.name))) assert.ok(c.modes.length >= 2, c.name);
    const button = nodes.find(n => n.name === 'Danger=No, Dashed=No' && n.component);
    const states = collections.find(c => c.name === 'Button states');
    assert.ok(button.varModes[states.id], 'Button variant pins Button states');
});

test('overview cards open their documentation', () => {
    const cards = nodes.filter(n => n.prototypeTarget);
    assert.ok(cards.length > 50);
    for (const c of cards) assert.match(byId.get(c.prototypeTarget).name, / — Documentation$/);
});
