import test from 'node:test';
import assert from 'node:assert/strict';
import { BEHAVIOR_VERSION, migrateBehavior } from '../src/migrate.js';
import { cleanState, initialValues } from '../src/state.js';

const rows = [{ label: 'Item 1', value: 'one' }, { label: 'Item 2', value: 'two' }];
const old = () => ({
    format: 'midas', version: 1, name: 'Old', pageId: 'p', pages: [{ id: 'p', name: 'P', nodes: [{ id: 'f', type: 'frame', repeat: { variableId: 'arr1', bind: { t: { text: 'label' } } } }] }],
    variables: {
        collections: [{ id: 'c1', name: 'Data', modes: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }], groups: [] }],
        items: [
            { id: 'col1', collectionId: 'c1', name: 'Brand', type: 'color', values: { m1: '#fff', m2: '#000' } },
            { id: 'arr1', collectionId: 'c1', name: 'Data/Menu', type: 'array', schema: [{ key: 'label', type: 'string' }, { key: 'value', type: 'string' }], values: { m1: rows, m2: [] } },
        ],
    },
});

test('an old file moves its array tokens into State as page lists, ids kept', () => {
    const src = old(), out = migrateBehavior(src);
    assert.equal(out.behaviorVersion, BEHAVIOR_VERSION);
    assert.equal(out.version, 1);
    assert.deepEqual(out.variables.items.map(i => i.id), ['col1']);
    const [list] = out.state.variables;
    assert.deepEqual([list.id, list.name, list.type, list.scope, list.itemType], ['arr1', 'Menu', 'list', 'page', 'object']);
    assert.deepEqual(list.schema, [{ key: 'label', type: 'string' }, { key: 'value', type: 'string' }]);
    assert.deepEqual(initialValues(out.state).get('arr1'), rows);
    assert.equal(out.pages[0].nodes[0].repeat.variableId, 'arr1');
    assert.ok(out.state.variables.some(v => v.id === out.pages[0].nodes[0].repeat.variableId));
    assert.equal(src.variables.items.length, 2);
    assert.equal(src.behaviorVersion, undefined);
});

test('migration is idempotent', () => {
    const once = migrateBehavior(old());
    assert.deepEqual(migrateBehavior(once), once);
    assert.deepEqual(migrateBehavior(migrateBehavior(once)), once);
});

test('a file without arrays only gains an empty State and the version', () => {
    const out = migrateBehavior({ format: 'midas', version: 1, pages: [], variables: { collections: [], items: [] } });
    assert.deepEqual(out.state, { variables: [], derived: [] });
    assert.equal(out.behaviorVersion, 2);
    const bare = migrateBehavior({ format: 'midas', version: 1, pages: [] });
    assert.equal(bare.variables, undefined);
    assert.equal(bare.behaviorVersion, 2);
});

test('name clashes get a suffix and a list that already exists in State is not duplicated', () => {
    const src = old();
    src.state = { variables: [{ id: 'x', name: 'Menu', type: 'string', initial: 'hi' }] };
    const out = migrateBehavior(src);
    assert.deepEqual(out.state.variables.map(v => v.name), ['Menu', 'Menu 2']);
    const again = migrateBehavior({ ...out, behaviorVersion: 1, variables: { ...out.variables, items: [...out.variables.items, { id: 'arr1', collectionId: 'c1', name: 'Data/Menu', type: 'array', values: {} }] } });
    assert.equal(again.state.variables.filter(v => v.id === 'arr1').length, 1);
});

test('a newer behaviorVersion is kept; unknown State fields are dropped', () => {
    const src = { format: 'midas', version: 1, pages: [], behaviorVersion: 7, state: { variables: [{ id: 's', name: 'S', type: 'string', initial: 'a', future: { x: 1 } }, { id: 'z', type: 'hologram' }], derived: [], rules: [{ id: 'r' }] }, variables: { collections: [], items: [{ id: 'a', type: 'array', collectionId: 'c', values: {} }] } };
    const out = migrateBehavior(src);
    assert.equal(out.behaviorVersion, 7);
    assert.deepEqual(out.state, cleanState({ variables: [{ id: 's', name: 'S', type: 'string', initial: 'a' }] }));
    assert.equal(out.variables.items.length, 1);
    assert.deepEqual(migrateBehavior(out), out);
});

test('a version below 1 or junk reads as 1; non-objects pass through', () => {
    assert.equal(migrateBehavior({ behaviorVersion: 'x', pages: [] }).behaviorVersion, 2);
    assert.equal(migrateBehavior({ behaviorVersion: 0, pages: [] }).behaviorVersion, 2);
    assert.equal(migrateBehavior(null), null);
});
