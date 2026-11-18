// An instance of a library component whose library is not added to the file shows as missing: Diagnostics name the library. Once
// the library is mounted, its component is in the file and nothing is reported.
import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';

const instance = { id: 'inst', name: 'Next', type: 'frame', parentId: null, isInstance: true, sourceId: 'lib-1~main', libRef: 'lib-1:main', x: 0, y: 0, w: 10, h: 10 };

test('an instance of a library component whose library is not added is reported as library-missing, naming the library', () => {
    const found = diagnoseDocument({ pages: [{ id: 'p', name: 'Page', nodes: [instance] }] }).filter(f => f.code === 'library-missing');
    assert.equal(found.length, 1);
    assert.equal(found[0].nodeId, 'inst');
    assert.equal(found[0].library, 'lib-1');
});

test('the same instance is not reported once its library page is mounted in the file', () => {
    const master = { id: 'lib-1~main', name: 'Button', type: 'frame', parentId: null, component: true, libRef: 'lib-1:main', x: 0, y: 0, w: 10, h: 10 };
    const found = diagnoseDocument({ pages: [{ id: 'library:lib-1', name: 'Library · X', nodes: [master] }, { id: 'p', name: 'Page', nodes: [instance] }] });
    assert.equal(found.filter(f => f.code === 'library-missing').length, 0);
});
