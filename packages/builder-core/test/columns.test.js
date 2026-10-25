// The Data window's edits of a List: columns and import.
import test from 'node:test';
import assert from 'node:assert/strict';
import { editColumns, importInto, uniqueKey, rowsFromCSV } from '../src/index.js';

test('columns: add, rename (rows follow), change type (cells converted), label, options, move, delete', () => {
    const base = { schema: [{ key: 'name', type: 'string' }, { key: 'age', type: 'string' }], rows: [{ name: 'Ana', age: '31' }, { name: 'Budi', age: 'x' }] };
    let d = editColumns(base, { op: 'add' });
    assert.deepEqual(d.schema.map(f => f.key), ['name', 'age', 'column']);
    assert.deepEqual(d.rows[0], { name: 'Ana', age: '31', column: '' });
    assert.equal(uniqueKey(d.schema, 'column'), 'column-2');
    d = editColumns(d, { op: 'rename', key: 'column', value: 'Home town' });
    assert.equal(d.schema[2].key, 'Home-town');
    assert.ok('Home-town' in d.rows[0]);
    assert.deepEqual(editColumns(d, { op: 'rename', key: 'age', value: 'name' }).schema.map(f => f.key), d.schema.map(f => f.key));      // a clash changes nothing
    d = editColumns(d, { op: 'type', key: 'age', value: 'number' });
    assert.deepEqual(d.rows.map(r => r.age), [31, 0]);
    d = editColumns(d, { op: 'type', key: 'Home-town', value: 'option' });
    assert.deepEqual(d.schema[2].options, []);
    d = editColumns(d, { op: 'options', key: 'Home-town', value: 'Jakarta, Bandung, Jakarta' });
    assert.deepEqual(d.schema[2].options, ['Jakarta', 'Bandung']);
    assert.deepEqual(editColumns(d, { op: 'options', key: 'age', value: 'a' }).schema[1], { key: 'age', type: 'number' });             // only for option columns
    d = editColumns(d, { op: 'label', key: 'name', value: 'Full name' });
    assert.equal(d.schema[0].label, 'Full name');
    assert.equal(editColumns(d, { op: 'label', key: 'name', value: '' }).schema[0].label, undefined);
    assert.deepEqual(editColumns(d, { op: 'move', key: 'age', value: -1 }).schema.map(f => f.key), ['age', 'name', 'Home-town']);
    assert.deepEqual(editColumns(d, { op: 'move', key: 'name', value: -1 }).schema.map(f => f.key), ['name', 'age', 'Home-town']);        // already first
    d = editColumns(d, { op: 'type', key: 'Home-town', value: 'string' });
    assert.equal(d.schema[2].options, undefined);
    d = editColumns(d, { op: 'del', key: 'age' });
    assert.deepEqual(Object.keys(d.rows[0]), ['name', 'Home-town']);
    assert.equal(editColumns({ schema: [{ key: 'a', type: 'string' }], rows: [] }, { op: 'del', key: 'a' }).schema.length, 1);             // the last column stays
    assert.equal(base.schema.length, 2);                                                                                                // the input is not changed
});

test('import: the file brings its columns, or fills the ones you have; replace or append', () => {
    const current = { schema: [{ key: 'name', type: 'string' }, { key: 'age', type: 'number' }], rows: [{ name: 'Old', age: 1 }] };
    const parsed = rowsFromCSV('name,city\nAna,Jakarta\nBudi,Bandung');
    assert.deepEqual(importInto(current, parsed), { schema: parsed.schema, rows: parsed.rows });
    const keep = importInto(current, parsed, { keepColumns: true });
    assert.deepEqual(keep.schema, current.schema);
    assert.deepEqual(keep.rows, [{ name: 'Ana', age: 0 }, { name: 'Budi', age: 0 }]);
    assert.deepEqual(importInto(current, parsed, { keepColumns: true, append: true }).rows.map(r => r.name), ['Old', 'Ana', 'Budi']);
    assert.equal(importInto(current, parsed, { append: true }).rows.length, 3);                       // new columns + append: the old rows are fitted to them
});
