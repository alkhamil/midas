// The bundle's engine sequence, headless, over the real registry and the bundled base: Generate base, then for each template in dependency order its master
// (the part generator), Auto Fix, the token binding and a demo instance with the default icon. The studio does the same calls on its document (Generate Design
// System); this checks that they leave every master complete and the whole document free of the findings the bundle promises none of.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { orderTemplates, planDesignSystem } from '../src/behavior-engine/design-system.js';
import { applyTemplateToFrame, instanceOf, masterLayersByKey } from '../src/behavior-engine/template-master.js';
import { planAutoFix, applyAutoFix } from '../src/behavior-engine/auto-fix.js';
import { planBindTokens, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { createdIconDefaults, iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { setMasterTemplate } from '../src/behavior-engine/panel.js';
import { applyBasePlan, planFromSnapshot } from '../src/base-tokens/importer.js';
import { BASE_SNAPSHOT } from '../src/index.js';

let seq = 0;
const uid = () => `u${++seq}`;
/** Every node under `id`, depth first (what the studio's doc.descendants gives the generator). */
const descendants = (nodes, id) => nodes.filter(n => n.parentId === id).flatMap(n => [n, ...descendants(nodes, n.id)]);
const ICON = { id: 'icon-star', name: 'Icon/Star', type: 'frame', parentId: null, component: true, fills: [] };

/** One run of the sequence on a document ({ variables, nodes }); a second call is the second run. */
function run(doc, { defaultIcon = ICON.id } = {}) {
    const templates = [...BUILT_IN_TEMPLATES.values()];
    const counts = { variables: applyBasePlan(doc.variables, planFromSnapshot(BASE_SNAPSHOT), uid).items, created: 0, present: 0 };
    const plan = planDesignSystem({ templates, nodes: doc.nodes });
    for (const template of plan.order) {
        let master = plan.masters.get(template.id);
        const layersOf = () => masterLayersByKey(template, master, doc.nodes);
        if (master) {
            counts.present++;
            const out = applyTemplateToFrame(template, { frame: master, children: descendants(doc.nodes, master.id), binding: master.behavior, variables: doc.variables, idOf: uid });
            doc.nodes.push(...out.created);
        }
        else {
            counts.created++;
            master = { id: uid(), name: template.name, type: 'frame', parentId: null, component: true, fills: [], x: 0, y: 0, w: 160, h: 32 };
            doc.nodes.push(master);
            const out = applyTemplateToFrame(template, { frame: master, children: [], binding: setMasterTemplate(template.id, doc.variables.collections), variables: doc.variables, idOf: uid });
            doc.nodes.push(...out.created);
        }
        const fix = planAutoFix({ template, binding: master.behavior, variables: doc.variables, layers: layersOf() });
        if (fix.fixable) counts.variables += applyAutoFix(doc.variables, master.behavior, fix, uid).items;
        const { ops } = planBindTokens({ template, binding: master.behavior, layers: layersOf(), variables: doc.variables });
        applyBindTokens(layersOf(), ops);
        if (!plan.masters.has(template.id)) {
            const varModes = {};
            for (const [prop, cid] of Object.entries(master.behavior.variables)) {
                const modes = doc.variables.collections.find(c => c.id === cid)?.modes ?? [];
                const wanted = template.props[prop]?.defaultMode;
                const mode = modes.find(m => m.id === wanted || m.name === wanted) ?? modes[0];
                if (mode) varModes[cid] = mode.id;
            }
            const props = createdIconDefaults(template, {}, defaultIcon);
            const copies = instanceOf(template, master, descendants(doc.nodes, master.id), props, { id: uid, varModes });
            // The slot holds the icon its prop names: the nested instance the anatomy sync inserts in the studio.
            const resolved = { ...props };
            for (const def of iconDefsOf(template)) {
                const slot = copies.find(n => n.behavior?.slot === def.slot);
                if (slot && resolved[def.component]) copies.push({ id: uid(), name: 'Icon', type: 'frame', parentId: slot.id, isInstance: true, sourceId: resolved[def.component], overrides: {} });
            }
            doc.nodes.push(...copies);
        }
    }
    return { counts, plan };
}
/** The first path at which two plain values differ, or null. */
function firstDifference(a, b, path = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const found = firstDifference(a[key], b[key], `${path}/${key}`);
            if (found) return found;
        }
    }
    return `${path}: ${JSON.stringify(a)?.slice(0, 120)} became ${JSON.stringify(b)?.slice(0, 120)}`;
}
const findings = doc => diagnoseDocument({ variables: doc.variables, pages: [{ name: 'Design System', nodes: doc.nodes }] });
const fresh = () => ({ variables: { collections: [], items: [] }, nodes: [{ ...ICON }] });

test('the run builds a master for every registered template, in dependency order, each with its demo instance', () => {
    const doc = fresh();
    const { counts, plan } = run(doc);
    assert.deepEqual(plan.order.map(t => t.id), ['button', 'input', 'formitem', 'list', 'icon-button']);
    assert.equal(counts.created, 5);
    const masters = doc.nodes.filter(n => n.component && n.behavior?.templateId);
    assert.deepEqual(masters.map(m => m.behavior.templateId), ['button', 'input', 'formitem', 'list', 'icon-button']);
    for (const template of BUILT_IN_TEMPLATES.values()) {
        const master = masters.find(m => m.behavior.templateId === template.id);
        assert.ok(doc.nodes.some(n => n.isInstance && n.sourceId === master.id), `${template.id} has a demo instance`);
    }
});

test('right after the run no master lacks a part and no icon slot is empty', () => {
    const doc = fresh();
    run(doc);
    const found = findings(doc);
    assert.deepEqual(found.filter(f => f.code === 'part-missing'), []);
    assert.deepEqual(found.filter(f => f.code === 'icon-slot-empty'), []);
    assert.deepEqual(found.filter(f => f.severity === 'error').map(f => `${f.code}: ${f.message}`), []);
});

test('the Icon Button demo instance holds the default icon in its always visible slot', () => {
    const doc = fresh();
    run(doc);
    const master = doc.nodes.find(n => n.behavior?.templateId === 'icon-button');
    const instance = doc.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.equal(instance.behavior.props.icon, ICON.id);
    const slot = doc.nodes.find(n => n.parentId === instance.id && n.behavior?.slot === 'icon');
    assert.ok(doc.nodes.some(n => n.parentId === slot.id && n.sourceId === ICON.id));
});

test('a second run adds nothing: no variable, no master, no node', () => {
    const doc = fresh();
    run(doc);
    const before = structuredClone(doc);
    const again = run(doc);
    assert.equal(again.counts.variables, 0);
    assert.equal(again.counts.created, 0);
    assert.equal(again.counts.present, 5);
    assert.equal(firstDifference(before, doc), null, 'the document is what it was');
});

test('a master the designer changed is completed, not replaced: a deleted part comes back, the rest stays', () => {
    const doc = fresh();
    run(doc);
    const master = doc.nodes.find(n => n.behavior?.templateId === 'button');
    const spinner = doc.nodes.find(n => n.parentId === master.id && n.behavior?.part === 'spinner');
    master.name = 'My Button';
    doc.nodes.splice(doc.nodes.indexOf(spinner), 1);
    const again = run(doc);
    assert.equal(again.counts.created, 0, 'no second master');
    assert.equal(master.name, 'My Button', 'the designer name is kept');
    assert.ok(doc.nodes.some(n => n.parentId === master.id && n.behavior?.part === 'spinner'), 'the missing part is back');
    assert.equal(doc.nodes.filter(n => n.behavior?.templateId === 'button').length, 1);
});

test('with no icon in the file the icon slots stay empty and Diagnostics says so; nothing else breaks', () => {
    const doc = { variables: { collections: [], items: [] }, nodes: [] };
    run(doc, { defaultIcon: null });
    const found = findings(doc);
    assert.ok(found.some(f => f.code === 'icon-slot-empty'));
    assert.deepEqual(found.filter(f => f.code === 'part-missing'), []);
});

test('ordering the registry twice gives the same order', () => {
    const templates = [...BUILT_IN_TEMPLATES.values()];
    assert.deepEqual(orderTemplates(templates).order.map(t => t.id), orderTemplates(templates).order.map(t => t.id));
});
