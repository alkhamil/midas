// Generate Design System: the Assets tab has one button, and the action is one undo step that reuses the existing flows (Generate base, the part generator,
// Auto Fix, the default icon) over the registry, with no template named in it. midas.js is read as text, as autoFix.test.js reads it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const start = src.indexOf('// ===== Design System bundle =====');
const bundle = start < 0 ? '' : src.slice(start, src.indexOf('// ===== plugins =====', start));

test('the Assets tab has one Generate Design System button', () => {
    const row = /function templateCreateRow\(\) \{[\s\S]*?\n\}/.exec(src)?.[0] ?? '';
    assert.equal(row.split('data-generate-design-system').length - 1, 1, 'one button');
    assert.ok(row.includes('Generate Design System'));
    assert.ok(!row.includes('templateChoices'), 'no button per template');
    assert.ok(/closest\('\[data-generate-design-system\]'\)/.test(src) && src.includes('generateDesignSystem()'), 'the click runs the action');
});

test('the action is one undo step on its own page, over the registry, and names no template', () => {
    assert.ok(bundle.length > 0, 'the bundle section exists');
    assert.equal(bundle.split("transaction(DESIGN_SYSTEM_LABEL").length - 1, 1, 'one transaction is one undo step');
    assert.ok(bundle.includes("const DESIGN_SYSTEM_LABEL = 'Generate Design System'"), 'the undo step is named Generate Design System');
    assert.ok(bundle.includes('BEHAVIOR_TEMPLATES.values()'), 'the templates are the live registry (built-in and Custom)');
    assert.ok(bundle.includes('DESIGN_SYSTEM_PAGE') && bundle.includes('onPage('), 'the work is on its own page; other pages are not touched');
    assert.ok(!/['"`](button|input|formitem|list|icon-button)['"`]/.test(bundle), 'no template name in the bundle code');
});

test('it reuses the existing flows: Generate base, the part generator, Auto Fix, the default icon, the instance sync', () => {
    for (const call of ['applyBasePlan(varStore(), planFromSnapshot(BASE_SNAPSHOT), uid)', 'planDesignSystem(', 'applyTemplateNodes(', 'planAutoFix(', 'applyAutoFixPlan(', 'createdIconDefaults(', 'syncInstance(', 'diagnoseDocument(', 'designSystemSummary(']) {
        assert.ok(bundle.includes(call), call);
    }
});

test('a master that is already there is completed with its own binding, and gets no second demo instance', () => {
    assert.ok(bundle.includes('applyTemplateNodes(master, template, master.behavior)'), 'completed through the generator with its binding');
    assert.ok(/counts\.present\+\+/.test(bundle) && /counts\.created\+\+/.test(bundle));
    assert.equal(bundle.split('instanceOf(').length - 1, 1, 'the demo instance is made once, for a master the run created');
});

test('the per-template Create buttons and their handlers are gone; the Template dropdown still lists the registry', () => {
    assert.ok(!src.includes('data-create-template'), 'no Create button markup or handler');
    assert.ok(!src.includes('createTemplateComponent'), 'the old Create action is removed');
    assert.ok(src.includes('function templateChoices()'), 'the dropdown keeps listing every registered template');
});

test('the bundle makes the icons before the templates, from the core set, and the editor reads the default icon from the same definition', () => {
    for (const call of ['planIcons(', 'iconNodes(', 'ICONS_SECTION', 'sectionFor(root, ICONS_SECTION)']) assert.ok(bundle.includes(call), call);
    assert.ok(bundle.indexOf('planIcons(') < bundle.indexOf('for (const template of plan.order)'), 'icons first, so the default icon exists when the masters are completed');
    assert.ok(/function defaultIconId\(\) \{\s*return defaultIconOf\(doc\.data\.pages\)/.test(src), 'one definition of the default icon');
    assert.ok(bundle.includes('counts.icons++') && bundle.includes('counts.iconsPresent'), 'the toast counts the icons');
    assert.ok(!bundle.includes("'Icon/"), 'no icon name in the bundle code: the set is core data');
});
