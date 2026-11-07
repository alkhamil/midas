// Managed slots beside a container's children (round 4 follow-up): the plan's indexes are
// stored child indexes, the same space the editor inserts into. A container child (the
// Switch spinner under the handle) is not a direct child of the instance: it must not move
// a root slot's index, or every slot after the container lands one short, the backstop
// sees a permanent move ("wrong position") and rolls the edit back, so nothing renders.
// A managed text side is a container plus its text: the plan inserts the box among the
// direct children and the text inside it (see switch-children.test.js).
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

test('a text side after a container inserts its box among the direct children, the text inside it', () => {
    // Root holds the handle; the spinner hangs under the handle. The unchecked box goes last among the direct children.
    const children = kids(['handle', null, 'handle'], ['spinner', null, 'spinner', 'handle']);
    const { ops, reason } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: false, uncheckedKind: 'text', uncheckedChildren: 'x' }, children });
    assert.equal(reason, undefined);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'innerOff', index: 1 }, { op: 'insert', slot: 'uncheckedChildren', index: 0, parent: 'innerOff' }]);
});

test('the inserted text layer converges: no move, no wrong-position backstop', () => {
    const children = kids(['handle', null, 'handle'], ['inner', 'innerOff', 'innerOff'], ['uc', 'uncheckedChildren', 'uncheckedChildren', 'inner'], ['spinner', null, 'spinner', 'handle']);
    const { ops, reason } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: false, uncheckedKind: 'text', uncheckedChildren: 'x' }, children });
    assert.equal(reason, undefined);
    assert.deepEqual(ops, [], '[handle, innerOff holding the text] is settled');
});

test('a text side before the container still inserts first', () => {
    const children = kids(['handle', null, 'handle'], ['spinner', null, 'spinner', 'handle']);
    const { ops } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { checked: true, checkedKind: 'text', checkedChildren: 'Test' }, children });
    assert.deepEqual(ops, [{ op: 'insert', slot: 'innerOn', index: 0 }, { op: 'insert', slot: 'checkedChildren', index: 0, parent: 'innerOn' }]);
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
