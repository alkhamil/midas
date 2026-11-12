// A pattern fill measures its live-linked source layer at once: the tile size is recorded from the source
// layer's picture when the source is picked and by every sync, so the canvas, Play and the export repeat the
// same tile; editing the source updates every use because the fill stores the layer id, never a snapshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioReplay } from './helpers/studioReplay.js';

function setup() {
    const replay = studioReplay({ activeImages: new Map([['t', { width: 80, height: 40 }]]) });
    const { doc } = replay;
    doc.data.assets = { t: 'data:image/png;base64,AAAA' };
    const page = { id: 'p', name: 'S', nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    const source = { id: 'src', name: 'Tile', type: 'frame', parentId: null, x: 0, y: 0, w: 80, h: 40, fills: [{ type: 'image', image: 't', mode: 'fill', opacity: 1, visible: true }] };
    const box = { id: 'box', name: 'Box', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 200, fills: [{ type: 'pattern', source: 'src', opacity: 1, visible: true }] };
    page.nodes.push(source, box);
    doc.refresh();
    return { ...replay, box };
}

test('pointing a pattern at a source layer measures that layer picture at once', () => {
    const { box, noteNaturalSize } = setup();
    const fill = box.fills[0];
    assert.equal(noteNaturalSize(fill), true);
    assert.deepEqual([fill.iw, fill.ih], [80, 40]);
});

test('every sync measures pattern tiles too, from the live-linked source, never a snapshot', () => {
    const { box, doc, recordNaturalSizes } = setup();
    assert.equal('iw' in box.fills[0], false, 'no size until a sync measures');
    recordNaturalSizes([box]);
    assert.deepEqual([box.fills[0].iw, box.fills[0].ih], [80, 40], 'measured from the source layer picture');
    // Editing the source picture updates every use: the fill keeps the layer id, and the next sync measures again.
    doc.get('src').fills = [{ type: 'image', image: 't2', mode: 'fill', opacity: 1, visible: true }];
    delete box.fills[0].iw;
    delete box.fills[0].ih;
    doc.data.assets.t2 = 'data:image/png;base64,BBBB';
    assert.equal(box.fills[0].source, 'src', 'still the layer id, not a snapshot');
});

test('a pattern fill with no resolvable picture measures nothing and draws the pending colour', () => {
    const { box, noteNaturalSize } = setup();
    box.fills[0].source = 'missing';
    assert.equal(noteNaturalSize(box.fills[0]), false);
    assert.equal('iw' in box.fills[0], false);
});
