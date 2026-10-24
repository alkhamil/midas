// Klik kanvas: yang dipilih tidak boleh menyeberang batas Slot. Isi dalam slot
// milik instance pemakai, jadi klik memilih bagian dalam slot itu — delete
// sesudahnya hanya menghapus yang dipilih, bukan seluruh instance induk.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clickPick } from '../src/index.js';

// Dropdown menu instance > frame slot > menu item instance > teks.
const dropdown = { id: 'dd', name: 'Dropdown', type: 'frame', isInstance: true, sourceId: 'dd-master' };
const slot = { id: 'slot', parentId: 'dd', name: 'Items', type: 'frame', propBind: { slot: 'p-items' }, sourceId: 'slot-master' };
const item = { id: 'item1', parentId: 'slot', name: 'Menu item', type: 'frame', isInstance: true, sourceId: 'item-master' };
const label = { id: 'label1', parentId: 'item1', name: 'Label', type: 'text' };
const icon = { id: 'icon1', parentId: 'slot', name: 'Icon', type: 'rect' };

test('klik teks dalam item di slot memilih item itu, bukan dropdown', () => {
    assert.equal(clickPick(label, [item, slot, dropdown], 0), item);
});

test('klik layer langsung dalam slot memilih layer itu sendiri', () => {
    assert.equal(clickPick(icon, [slot, dropdown], 0), icon);
});

test('slot kosong tetap dipilih langsung (placeholder "+")', () => {
    const empty = { ...slot, id: 'slot-empty' };
    assert.equal(clickPick(empty, [dropdown], 0), empty);
});

test('di luar slot, klik tetap memilih container terluar seperti semula', () => {
    const plain = { id: 't', name: 'T', type: 'text' };
    assert.equal(clickPick(plain, [item, dropdown], 0), dropdown);
    const auto = { id: 'row', name: 'Row', type: 'frame', layout: 'horizontal' };
    const cell = { id: 'c', parentId: 'row', name: 'C', type: 'text' };
    assert.equal(clickPick(cell, [auto], 0), auto);
});
