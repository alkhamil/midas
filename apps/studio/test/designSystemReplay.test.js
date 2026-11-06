// Generate Design System, replayed with the REAL midas.js functions of the path (helpers/studioReplay.js) over a plain document: the base, a master and a demo
// instance of every registered template, then what a commit runs after the transaction (the component sync and the behavior backstop that rolls an edit back).
// A regression guard for ALL templates: collections exist, every master and demo instance holds its layers, nothing throws, and the backstop does not undo the run
// (it once did, whole: the page came back empty with no collections, because a managed layer inside a container was not known to the document check).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, behaviorProblem, validatePrototype } = core;

/** The run as runDesignSystem makes it, on a new Design System page of a plain file, then the page is shown (switchPage). */
function generate() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    counts.variables += applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid).items;
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.data.pageId = page.id;
    doc.refresh();
    return { ...replay, page, counts };
}
const masterOf = (page, template) => page.nodes.find(n => n.component && n.behavior?.templateId === template.id);

test('the run finishes for every registered template, and no toast reports a failure', () => {
    const { counts, toasts } = generate();
    assert.equal(counts.created, TEMPLATES.size, 'a master per template');
    assert.deepEqual(toasts.filter(t => /fail|error|cannot|not applied/i.test(t)), []);
});

test('every template has its collections, one per variable prop, named for the template; Button and Icon Button keep Variant, Color and Size', () => {
    const { doc } = generate();
    const names = doc.data.variables.collections.map(c => c.name);
    for (const template of TEMPLATES.values())
        for (const [, def] of Object.entries(template.props).filter(([, d]) => d.source === 'variable'))
            assert.ok(names.includes(`${template.name} ${def.collection}`), `${template.id}: ${template.name} ${def.collection}`);
    for (const name of ['Button', 'Icon Button', 'Checkbox', 'Radio', 'Switch'])
        for (const dim of ['Color', 'Size']) assert.ok(names.includes(`${name} ${dim}`), `${name} ${dim}`);
    assert.ok(names.includes('Button Variant') && names.includes('Icon Button Variant') && names.includes('Icon Button Type'));
});

test('every master is on the Design System page with the layers its template builds', () => {
    const { doc, page } = generate();
    for (const template of TEMPLATES.values()) {
        const master = masterOf(page, template);
        assert.ok(master, `${template.id} has a master`);
        const names = doc.descendants(master.id).map(n => n.name);
        for (const slot of template.anatomy.filter(s => s.kind === 'frame')) assert.ok(names.includes(slot.id), `${template.id} master holds ${slot.id}`);
        for (const part of template.parts ?? []) if (part.canvas !== false) assert.ok(names.includes(part.id), `${template.id} master holds ${part.id}`);
    }
});

test('every demo instance holds the box and the handle and the label its sample props ask for, and no glyph layer while no state is on', () => {
    const { doc, page } = generate();
    for (const template of TEMPLATES.values()) {
        const master = masterOf(page, template);
        const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
        assert.ok(demo, `${template.id} has a demo instance`);
        const layers = doc.descendants(demo.id);
        for (const slot of template.anatomy.filter(s => s.kind === 'frame')) assert.ok(layers.some(n => n.behavior?.group === slot.id), `${template.id} demo holds ${slot.id}`);
        for (const slot of template.anatomy.filter(s => s.kind === 'glyph')) assert.ok(!layers.some(n => n.behavior?.slot === slot.id), `${template.id} demo has no ${slot.id} while it is off`);
        if (template.sampleProps?.label) assert.equal(layers.find(n => n.behavior?.slot === 'label')?.text, template.sampleProps.label, `${template.id} demo label`);
    }
});

test('the commit after the run does not undo it: the component sync runs, and the behavior and prototype backstops find nothing', () => {
    const replay = generate();
    const { doc, page } = replay;
    const before = page.nodes.length;
    replay.syncComponents(false);
    assert.equal(replay.rolledBackForBehavior(), false, JSON.stringify(behaviorProblem(doc.data)));
    assert.equal(replay.stubs.history.cancelled, 0, 'the run is not cancelled');
    assert.equal(behaviorProblem(doc.data), null);
    assert.deepEqual(validatePrototype(doc.data, { complete: true }), []);
    assert.equal(page.nodes.length, before, 'the sync neither adds nor removes a layer of the finished page');
});

test('every token of every template names a dimension the template has, and resolves in every mode combination of the generated variables', () => {
    const { doc } = generate();
    const variables = doc.data.variables;
    for (const template of TEMPLATES.values()) {
        const dims = Object.keys(template.props).filter(p => template.props[p].source === 'variable');
        for (const group of Object.keys(template.tokens)) {
            const dim = core.dimensionOfGroup(group, template.props);
            assert.ok(dim && dims.includes(dim), `${template.id}: ${group} names no dimension (${dim})`);
        }
        const binding = { variables: Object.fromEntries(dims.map(d => [d, variables.collections.find(c => c.name === `${template.name} ${template.props[d].collection}`)?.id])) };
        const combos = dims.reduce((acc, d) => acc.flatMap(c => variables.collections.find(x => x.id === binding.variables[d]).modes.map(m => ({ ...c, [d]: m.id }))), [{}]);
        for (const modes of combos) {
            const { unresolved } = core.resolveTokens(template, binding, modes, variables);
            assert.deepEqual(unresolved, [], `${template.id} ${JSON.stringify(modes)}`);
        }
    }
});

// ---- loud failures ----
import fs from 'node:fs';
const midas = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const body = name => { const at = midas.indexOf(`function ${name}(`); return midas.slice(at, midas.indexOf('\n}\n', at)); };

/** runDesignSystem over the fake document; `rollback` makes the transaction end as the commit backstop ends one it rejects: the page is gone. */
function run({ rollback = false, extra = {} } = {}) {
    const calls = { switched: [] };
    const replay = studioReplay({
        switchPage: id => calls.switched.push(id),
        transaction: (label, fn) => { fn(); if (rollback) replay.doc.data.pages = replay.doc.data.pages.filter(p => p.name !== DESIGN_SYSTEM_PAGE); },
        ...extra,
    });
    replay.runDesignSystem();
    return { ...replay, calls };
}

test('a finished run switches to the page and says what it made', () => {
    const { toasts, calls, doc } = run();
    assert.equal(calls.switched.length, 1);
    assert.ok(doc.data.pages.some(p => p.name === DESIGN_SYSTEM_PAGE));
    assert.equal(toasts.length, 1);
});

test('a run the backstop rolled back neither switches pages nor reports a success: the reason it gave is the last word', () => {
    const { toasts, calls } = run({ rollback: true });
    assert.deepEqual(calls.switched, []);
    assert.deepEqual(toasts, [], 'no summary toast over the "Not applied" one');
});

test('a template that throws stops the run with its id in the message', () => {
    assert.throws(() => run({ extra: { fixMaster: (master, template) => { if (template.id === 'radio') throw new Error('boom'); return 0; } } }), /radio.*boom/s);
});

test('Generate Design System catches what the run throws: it cancels the open edit, logs the template and tells the user, never an empty page in silence', () => {
    const fn = body('generateDesignSystem');
    assert.ok(fn.includes('catch (err)'), 'a failure is caught here');
    for (const part of ['history.cancel()', 'doc.refresh()', 'console.error(', 'toast(']) assert.ok(fn.includes(part), part);
    assert.ok(body('buildDesignSystemPage').includes('${template.id}'), 'the failing template is named');
});
