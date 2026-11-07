// Switch children through the REAL editor path, replayed: a fresh instance takes a prop edit,
// the real syncInstance applies the anatomy plan, then the real behavior backstop runs. Before
// the placement fix the backstop saw a permanent move for every slot after the handle (the plan
// counted the spinner under the handle), rolled the edit back and toasted "wrong position", so
// nothing rendered on canvas or in Play.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, DESIGN_SYSTEM_PAGE } = core;
const sw = TEMPLATES.get('switch');

function generate() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.refresh();
    return { replay, page };
}

const collId = (doc, name) => doc.data.variables.collections.find(c => c.name === name)?.id;
const modeId = (doc, coll, name) => doc.data.variables.collections.find(c => c.id === coll)?.modes.find(m => m.name === name)?.id;

/** A fresh instance under a top frame, the prop edit applied, the real sync run, the backstop asked. */
function synced(replay, page, props, size) {
    const { doc } = replay;
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === 'switch');
    const frame = { id: `top-${size}-${replay.stubs.uid()}`, name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    doc.add(frame);
    // The demo instance as Generate leaves it, then the panel edit: props set, sync runs.
    const copies = core.instanceOf(sw, master, doc.descendants(master.id), {}, { id: () => replay.stubs.uid(), varModes: {} });
    copies[0].parentId = frame.id;
    for (const n of copies) doc.add(n);
    doc.refresh();
    Object.assign(copies[0].behavior, { props: { ...copies[0].behavior?.props, ...props } });
    copies[0].varModes = {
        [collId(doc, 'Switch Color')]: modeId(doc, collId(doc, 'Switch Color'), 'primary'),
        [collId(doc, 'Switch Size')]: modeId(doc, collId(doc, 'Switch Size'), size),
    };
    doc.refresh();
    replay.syncInstance(copies[0]);
    return { inst: copies[0], frame };
}

const CASES = [
    [{ checked: true, checkedKind: 'text', checkedChildren: 'Test' }, 'checkedChildren', 'Test', 'default'],
    [{ checked: true, checkedKind: 'text', checkedChildren: 'Test' }, 'checkedChildren', 'Test', 'small'],
    [{ checked: true, checkedKind: 'icon', checkedIcon: null }, 'checkedIcon', null, 'default'],
    [{ checked: true, checkedKind: 'icon', checkedIcon: null }, 'checkedIcon', null, 'small'],
    [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'Off' }, 'uncheckedChildren', 'Off', 'default'],
    [{ checked: false, uncheckedKind: 'text', uncheckedChildren: 'Off' }, 'uncheckedChildren', 'Off', 'small'],
    [{ checked: false, uncheckedKind: 'icon', uncheckedIcon: null }, 'uncheckedIcon', null, 'default'],
    [{ checked: false, uncheckedKind: 'icon', uncheckedIcon: null }, 'uncheckedIcon', null, 'small'],
];

for (const [props, slot, text, size] of CASES) {
    test(`switch ${size} ${JSON.stringify(props)}: the edit applies, canvas and Play draw the child opposite the handle`, () => {
        const { replay, page } = generate();
        const { doc } = replay;
        const { inst, frame } = synced(replay, page, props, size);
        // The backstop sees no problem and no toast reports one: the edit is not rolled back.
        assert.equal(core.behaviorProblem(doc.data, {}), null, 'backstop converges');
        assert.deepEqual(replay.toasts.filter(t => /not applied/i.test(t)), [], 'no rollback toast');
        // Canvas: the managed layer exists with its content, opposite the handle (text sits in its box).
        const kids = doc.children(inst.id);
        const layer = doc.descendants(inst.id).find(n => n.behavior?.slot === slot);
        assert.ok(layer, `canvas holds ${slot}`);
        if (text !== null) assert.equal(layer.text, text, 'the layer shows the typed text');
        assert.equal(layer.visible !== false, true, 'the layer is shown');
        const topKey = n => n.behavior?.slot ?? (n.behavior?.group === 'handle' ? 'handle' : n.name);
        const holder = kids.find(n => n.id === layer.id || doc.descendants(n.id).some(d => d.id === layer.id));
        const order = kids.map(topKey);
        const at = order.indexOf(topKey(holder)), handle = order.indexOf('handle');
        assert.ok(at !== -1 && handle !== -1, `order is [${order}]`);
        assert.equal(at < handle, props.checked === true, `child ${props.checked ? 'before' : 'after'} the handle`);
        // The layer is bound to its tokens and hugs; the track hugs with the token minimum.
        if (text !== null) assert.ok(layer.vars?.['fills.0'], 'text colour is bound');
        assert.equal(inst.layoutSizingH, 'hug', 'the track hugs its content');
        assert.ok(inst.vars?.minW, 'the track minimum is bound');
        // Play: the child renders with its content in the same order, under the same rules.
        const { root, styles, problems } = core.toDomTree(doc.data, frame.id);
        assert.deepEqual(problems, []);
        const els = [];
        const walk = el => { els.push(el); (el.children || []).forEach(walk); };
        walk(root);
        const swEl = els.find(el => el.attrs?.class === 'switch');
        const classes = swEl.children.map(c => c.attrs?.class ?? (c.text ? 'text' : ''));
        const cls = `switch-${slot}`;
        if (text !== null) {
            const atPlay = swEl.children.findIndex(c => (c.children || []).some(k => k.text === text));
            assert.ok(atPlay !== -1, `Play draws "${text}"`);
            assert.equal(atPlay < classes.indexOf('switch-handle'), props.checked === true, 'Play order matches canvas');
        } else {
            assert.ok(classes.includes(cls), `Play draws ${cls}`);
            assert.equal(classes.indexOf(cls) < classes.indexOf('switch-handle'), props.checked === true, 'Play order matches canvas');
        }
        assert.ok(styles.includes(`.${cls}`), 'Play reads the slot rule');
        assert.ok(/\.switch \{[^}]*min-width: var\(--switch-track-width\)/.test(styles), 'track min-width token in Play');
    });
}
