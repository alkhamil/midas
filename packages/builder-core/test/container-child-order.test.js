// Managed slots beside a container's children (round 4 follow-up): the plan's indexes are
// stored child indexes, the same space the editor inserts into. A container child (the
// Switch spinner under the handle) is not a direct child of the instance: it must not move
// a root slot's index, or every slot after the container lands one short, the backstop
// sees a permanent move ("wrong position") and rolls the edit back, so nothing renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { behaviorProblem } from '../src/behavior-engine/document-check.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');
const model = modelFor(sw);
const binding = model.binding;
const masterRoot = { isAutoLayout: true };
const masterTree = [{ id: 'x', type: 'frame' }];

/** Children as the document check sees them: the instance's children plus a container's, with the holder of each. */
const kids = (...list) => list.map(([id, slot, name, parent]) => ({ id, slot, name, ...(parent === undefined ? {} : { parent }) }));

test('a text slot after a container inserts among the direct children, not after its content', () => {
    // Root holds the handle; the spinner hangs under the handle. The unchecked text goes last among the direct children.
    const children = kids(['handle', null, 'handle'], ['spinner', null, 'spinner', 'handle']);
    const { ops, reason } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: false, uncheckedKind: 'text', uncheckedChildren: 'x' }, children });
    assert.equal(reason, undefined);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'uncheckedChildren', index: 1 }]);
});

test('the inserted text layer converges: no move, no wrong-position backstop', () => {
    const children = kids(['handle', null, 'handle'], ['uc', 'uncheckedChildren', 'uncheckedChildren'], ['spinner', null, 'spinner', 'handle']);
    const { ops, reason } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: false, uncheckedKind: 'text', uncheckedChildren: 'x' }, children });
    assert.equal(reason, undefined);
    assert.deepEqual(ops, [], 'direct [handle, uncheckedChildren] is settled');
});

test('a text slot before the container still inserts first', () => {
    const children = kids(['handle', null, 'handle'], ['spinner', null, 'spinner', 'handle']);
    const { ops } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: true, checkedKind: 'text', checkedChildren: 'Test' }, children });
    assert.deepEqual(ops, [{ op: 'insert', slot: 'checkedChildren', index: 0 }]);
});

test('the behaviour backstop names the expected and the actual index', () => {
    // A genuinely misplaced icon: the message carries both indexes, so the toast is actionable.
    const button = TEMPLATES.get('button');
    const bmodel = modelFor(button);
    const nodes = instanceFor(bmodel, { hasIcon: true, iconPlacement: 'start', icon: null });
    const root = nodes[0];
    const icon = nodes.find(n => n.behavior?.slot === 'iconStart');
    const label = nodes.find(n => !n.behavior?.slot && n.type === 'text');
    assert.ok(icon && label, 'icon and label layers exist');
    icon.parentId = root.id; label.parentId = root.id;
    const ordered = [root, label, icon, ...nodes.filter(n => n !== root && n !== icon && n !== label)];
    const doc = { variables: bmodel.variables, pages: [{ name: 'p', nodes: [bmodel.frame, ...bmodel.created, ...ordered] }] };
    const problem = behaviorProblem(doc, {});
    assert.ok(problem, 'a problem is reported');
    assert.match(problem.problem, /wrong position \(expected 0, found 1\)/);
});
