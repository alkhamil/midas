// The export of a Breadcrumb: its separator and ellipsis are made per instance, and the export has no code that interleaves them with the items. The
// export reports that as a problem instead of dropping them silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { BREADCRUMB } from '../src/templates/breadcrumb.js';

test('the export of a Breadcrumb reports its box separator and ellipsis as not exported, and writes no files', () => {
    const master = { id: 'm', name: 'Breadcrumb', type: 'FRAME', width: 100, height: 20, children: [] };
    const out = generateComponent(BREADCRUMB, { variables: {}, props: {} }, { collections: [], items: [] }, 'Breadcrumb', master, () => []);
    const reasons = out.problems.filter(p => p.reason === 'box-between-not-exported').map(p => p.slot).sort();
    assert.deepEqual(reasons, ['ellipsis', 'separator']);
    assert.equal(out.files, null);
});
