// The bundle's engine sequence, headless, over the real registry and the bundled base: Generate base, then for each template in dependency order its master
// (the part generator), Auto Fix, the token binding and a demo instance with the default icon. The studio does the same calls on its document (Generate Design
// System); this checks that they leave every master complete and the whole document free of the findings the bundle promises none of.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { orderTemplates, planDesignSystem } from '../src/behavior-engine/design-system.js';
import { defaultIconOf, iconNodes, planIcons } from '../src/behavior-engine/icon-set.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
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
/** An icon a designer made: a component named Icon/<name> holding its own path. */
const designerIcon = (name, id) => [
    { id, name: `Icon/${name}`, type: 'frame', parentId: null, component: true, w: 24, h: 24, fills: [] },
    { id: `${id}-path`, name: 'mine', type: 'path', parentId: id, points: [{ x: 1, y: 1 }, { x: 9, y: 9 }], closed: false, fills: [], stroke: '#123456', strokeWidth: 2 },
];

/** One run of the sequence on a document ({ variables, nodes }); a second call is the second run. */
function run(doc) {
    const templates = [...BUILT_IN_TEMPLATES.values()];
    const counts = { variables: applyBasePlan(doc.variables, planFromSnapshot(BASE_SNAPSHOT), uid).items, icons: 0, iconsPresent: 0, created: 0, present: 0 };
    // The icons come before the templates: the ones the file lacks, in a row of the Icons section (so they are nested, as in the studio).
    const iconPlan = planIcons({ pages: [{ nodes: doc.nodes }] });
    counts.iconsPresent = iconPlan.present.length;
    if (iconPlan.create.length) {
        const row = { id: uid(), name: 'Components', type: 'frame', parentId: null };
        doc.nodes.push(row);
        for (const entry of iconPlan.create) {
            const [root, ...rest] = iconNodes(entry, uid);
            doc.nodes.push({ ...root, parentId: row.id }, ...rest);
            counts.icons++;
        }
    }
    const defaultIcon = defaultIconOf([{ nodes: doc.nodes }]);
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
            const props = { ...template.sampleProps, ...createdIconDefaults(template, {}, defaultIcon) };
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
const fresh = (nodes = []) => ({ variables: { collections: [], items: [] }, nodes });
const icon = doc => doc.nodes.find(n => n.id === defaultIconOf([{ nodes: doc.nodes }]));

test('the run builds a master for every registered template, in dependency order, each with its demo instance', () => {
    const doc = fresh();
    const { counts, plan } = run(doc);
    assert.deepEqual(plan.order.map(t => t.id), ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag']);
    assert.equal(counts.created, 11);
    const masters = doc.nodes.filter(n => n.component && n.behavior?.templateId);
    assert.deepEqual(masters.map(m => m.behavior.templateId), ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag']);
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

test('in an empty file the run creates the icon as a vector component, and the Icon Button demo instance holds it in its always visible slot', () => {
    const doc = fresh();
    const { counts } = run(doc);
    assert.deepEqual([counts.icons, counts.iconsPresent], [1, 0]);
    const created = icon(doc);
    assert.equal(created.name, 'Icon/circle');
    assert.equal(created.component, true);
    const path = doc.nodes.find(n => n.parentId === created.id);
    assert.equal(path.type, 'path');
    assert.ok(path.fills.length > 0 && path.points.length > 2, 'a filled vector: the foreground and the icon size bind');
    const master = doc.nodes.find(n => n.behavior?.templateId === 'icon-button');
    const instance = doc.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.equal(instance.behavior.props.icon, created.id);
    const slot = doc.nodes.find(n => n.parentId === instance.id && n.behavior?.slot === 'icon');
    assert.ok(doc.nodes.some(n => n.parentId === slot.id && n.sourceId === created.id));
});

test('a second run adds nothing: no variable, no master, no node', () => {
    const doc = fresh();
    run(doc);
    const before = structuredClone(doc);
    const again = run(doc);
    assert.equal(again.counts.variables, 0);
    assert.equal(again.counts.icons, 0);
    assert.equal(again.counts.iconsPresent, 1);
    assert.equal(again.counts.created, 0);
    assert.equal(again.counts.present, 11);
    assert.equal(firstDifference(before, doc), null, 'the document is what it was');
});

test('a master the designer changed is completed, not replaced: a deleted required layer comes back, a conditional part stays an instance layer', () => {
    const doc = fresh();
    run(doc);
    const master = doc.nodes.find(n => n.behavior?.templateId === 'button');
    const label = doc.nodes.find(n => n.parentId === master.id && n.type === 'text' && !n.behavior?.part && !n.behavior?.slot);
    master.name = 'My Button';
    doc.nodes.splice(doc.nodes.indexOf(label), 1);
    const again = run(doc);
    assert.equal(again.counts.created, 0, 'no second master');
    assert.equal(master.name, 'My Button', 'the designer name is kept');
    assert.ok(doc.nodes.some(n => n.parentId === master.id && n.type === 'text' && !n.behavior?.part && !n.behavior?.slot), 'the missing label is back');
    assert.ok(!doc.nodes.some(n => n.parentId === master.id && n.behavior?.part === 'spinner'), 'no spinner on the master while loading is off');
    assert.equal(doc.nodes.filter(n => n.behavior?.templateId === 'button').length, 1);
});

test('an icon the designer made with the same name is untouched, and the run makes no second one', () => {
    const doc = fresh(designerIcon('circle', 'mine'));
    const before = structuredClone(doc.nodes);
    const { counts } = run(doc);
    assert.deepEqual([counts.icons, counts.iconsPresent], [0, 1]);
    assert.deepEqual(doc.nodes.filter(n => before.some(b => b.id === n.id)), before, 'their nodes are what they were');
    assert.equal(doc.nodes.filter(n => n.name === 'Icon/circle').length, 1);
    assert.equal(doc.nodes.find(n => n.isInstance && n.behavior?.props?.icon).behavior.props.icon, 'mine');
    assert.deepEqual(findings(doc).filter(f => f.code === 'icon-slot-empty'), []);
});

test('a file that already has a default icon under another name gets no icon of its own, and its slots use that one', () => {
    const doc = fresh(designerIcon('arrow', 'theirs'));
    const { counts } = run(doc);
    assert.deepEqual([counts.icons, counts.iconsPresent], [0, 1]);
    assert.ok(!doc.nodes.some(n => n.name === 'Icon/circle'));
    assert.equal(doc.nodes.find(n => n.isInstance && n.behavior?.props?.icon).behavior.props.icon, 'theirs');
    assert.deepEqual(findings(doc).filter(f => f.code === 'icon-slot-empty'), []);
});

test('Button and Input come out byte for byte the same with or without an icon already in the file (the icon is the only difference)', () => {
    const exportOf = (doc, id) => {
        const template = BUILT_IN_TEMPLATES.get(id);
        const master = doc.nodes.find(n => n.behavior?.templateId === id);
        const files = generateComponent(template, master.behavior, doc.variables, template.name, master, parent => doc.nodes.filter(n => n.parentId === parent)).files;
        // The ids of the modes are the run's own counter (data-variant="u12"): the same everywhere else.
        return Object.fromEntries(Object.entries(files).map(([name, text]) => [name, text.replace(/\bu\d+\b/g, 'ID')]));
    };
    const empty = fresh(), withIcon = fresh(designerIcon('arrow', 'theirs'));
    run(empty);
    run(withIcon);
    for (const id of ['button', 'input']) {
        const [a, b] = [exportOf(empty, id), exportOf(withIcon, id)];
        for (const name of Object.keys(a)) {
            const at = [...a[name]].findIndex((ch, i) => ch !== b[name][i]);
            assert.ok(a[name] === b[name], `${name} is the same (first difference at ${at}: ${JSON.stringify(a[name].slice(at - 40, at + 60))} against ${JSON.stringify(b[name].slice(at - 40, at + 60))})`);
        }
    }
    const shape = (doc, id) => descendants(doc.nodes, doc.nodes.find(n => n.behavior?.templateId === id).id).map(n => `${n.name}:${n.type}:${n.visible}`);
    for (const id of ['button', 'input']) assert.deepEqual(shape(empty, id), shape(withIcon, id), `${id} master layers`);
});

test('ordering the registry twice gives the same order', () => {
    const templates = [...BUILT_IN_TEMPLATES.values()];
    assert.deepEqual(orderTemplates(templates).order.map(t => t.id), orderTemplates(templates).order.map(t => t.id));
});

test('the Input master and its demo instance show the sample placeholder', () => {
    const doc = fresh();
    run(doc);
    const master = doc.nodes.find(n => n.component && n.behavior?.templateId === 'input');
    const demo = doc.nodes.find(n => n.isInstance && n.sourceId === master.id);
    for (const root of [master, demo]) {
        const placeholder = descendants(doc.nodes, root.id).find(n => n.name === 'placeholder');
        assert.equal(placeholder.text, 'Input placeholder');
        assert.equal(placeholder.visible, true);
    }
});
