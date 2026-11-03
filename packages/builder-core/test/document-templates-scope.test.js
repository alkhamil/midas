// The registry belongs to the document that is open. Reading another document's data (opening a file that then fails, a paste, an import, a page arriving)
// checks it against that data's templates for the duration of the check and puts the registry back; only adopting a document (opening it, a new one, undo)
// changes what the registry holds. So Custom templates of one document never leak into another.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { BEHAVIOR_DATA_VERSION } from '../src/behavior-engine/data.js';
import { activateDocumentTemplates, withDocumentTemplates } from '../src/behavior-engine/custom-templates.js';

afterEach(() => activateDocumentTemplates(undefined));

const custom = id => ({ ...structuredClone(FORM_ITEM), id, name: id });
const docWith = (...ids) => ({ version: BEHAVIOR_DATA_VERSION, templates: Object.fromEntries(ids.map(id => [id, custom(id)])) });
const ids = () => [...TEMPLATES.keys()];
const BUILT = [...BUILT_IN_TEMPLATES.keys()];

test('adopting documents one after another leaves the registry the built-in templates plus only the open document\'s', () => {
    activateDocumentTemplates(docWith('custom-a'));
    assert.deepEqual(ids(), [...BUILT, 'custom-a']);
    activateDocumentTemplates(docWith('custom-b', 'custom-c'));
    assert.deepEqual(ids(), [...BUILT, 'custom-b', 'custom-c'], 'document A\'s template is gone');
    activateDocumentTemplates(undefined);
    assert.deepEqual(ids(), BUILT, 'a new document, or one with no behavior data, has none');
    activateDocumentTemplates(docWith('custom-a'));
    activateDocumentTemplates(docWith('custom-a'));
    assert.deepEqual(ids(), [...BUILT, 'custom-a'], 'adopting the same templates twice changes nothing');
});

test('reading another document\'s data sees its templates inside the check and leaves the registry as it was after it', () => {
    activateDocumentTemplates(docWith('custom-a'));
    let inside;
    withDocumentTemplates(docWith('custom-b'), () => { inside = ids(); });
    assert.deepEqual(inside, [...BUILT, 'custom-b']);
    assert.deepEqual(ids(), [...BUILT, 'custom-a'], 'the open document\'s templates are back');
    withDocumentTemplates(undefined, () => { inside = ids(); });
    assert.deepEqual(inside, BUILT, 'data with no behavior sees only the built-in templates, as a paste of plain layers does');
    assert.deepEqual(ids(), [...BUILT, 'custom-a']);
});

test('the check returns what it computed; a check that throws puts the registry back and lets the error through; a malformed document is refused first', () => {
    activateDocumentTemplates(docWith('custom-a'));
    assert.equal(withDocumentTemplates(docWith('custom-b'), () => 42), 42);
    assert.throws(() => withDocumentTemplates(docWith('custom-b'), () => { throw new Error('page is invalid'); }), /page is invalid/);
    assert.deepEqual(ids(), [...BUILT, 'custom-a']);
    assert.throws(() => withDocumentTemplates({ version: 1, templates: {} }, () => 1), /Cannot open this file: the custom templates are invalid/);
    assert.deepEqual(ids(), [...BUILT, 'custom-a'], 'nothing was partly loaded');
});

test('the checks nest: the inner one restores the outer one\'s registry', () => {
    activateDocumentTemplates(docWith('custom-a'));
    withDocumentTemplates(docWith('custom-b'), () => {
        withDocumentTemplates(undefined, () => assert.deepEqual(ids(), BUILT));
        assert.deepEqual(ids(), [...BUILT, 'custom-b']);
    });
    assert.deepEqual(ids(), [...BUILT, 'custom-a']);
});
