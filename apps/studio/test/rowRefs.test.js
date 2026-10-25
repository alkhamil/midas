// $row / $rowIndex / $isSelected are offered in the editors only while a layer is inside a table's row template.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setRowRefs, rowRefs, conditionRefs, conditionWords } from '../src/engine/rulesUi.js';

const state = { variables: [{ id: 'q', name: 'search' }], derived: [] };
const ROWS = [['$rowIndex', 'Row number'], ['$isSelected', 'Row is selected'], ['$row.name', 'Row · Name']];

test('outside a row template the editors offer no row references', () => {
    setRowRefs([]);
    assert.deepEqual(rowRefs(), []);
    assert.ok(!conditionRefs(state).some(r => r[0].startsWith('$row')));
});

test('inside a row template they are offered, with their names in sentences', () => {
    setRowRefs(ROWS);
    try {
        assert.deepEqual(conditionRefs(state).slice(-3), ROWS);
        assert.match(conditionWords(state, [], { op: 'var', ref: '$row.name' }), /Row · Name/);
    } finally { setRowRefs([]); }
    assert.ok(!conditionRefs(state).some(r => r[0].startsWith('$row')));       // cleared again after the layer is drawn
});
