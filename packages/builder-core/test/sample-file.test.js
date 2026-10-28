import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TEMPLATES,
    assertBehaviorShape,
    assertBehaviorData,
    behaviorProblem,
    diagnoseDocument,
    generateComponent,
    previewOf,
    resolveProps,
    resolveSelectTarget,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(here, '../../../scripts/fixtures/sample-app.midas');

function loadSample() {
    return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

test('sample-app.midas is under 1 MB and has the 6 Kopi Kita pages', () => {
    const stat = statSync(FIXTURE_PATH);
    assert.ok(stat.size > 1000 && stat.size < 1024 * 1024, `unexpected size ${stat.size}`);
    const doc = loadSample();
    assert.equal(doc.format, 'midas');
    assert.equal(doc.version, 1);
    assert.equal(doc.name, 'Kopi Kita');
    assert.deepEqual(
        doc.pages.map(p => p.name),
        ['Login', 'Home', 'Menu', 'Cart', 'Profile', 'Components'],
    );
});

test('passes phase-2 check on eager open in page order and with Components last', () => {
    const doc = loadSample();
    assert.equal(doc.pages.at(-1).name, 'Components');
    assert.doesNotThrow(() => assertBehaviorData(doc));
    assert.equal(behaviorProblem(doc), null);

    // Also when Components is moved to the front or back explicitly:
    const componentsFirst = {
        ...doc,
        pages: [doc.pages.at(-1), ...doc.pages.slice(0, -1)],
    };
    assert.doesNotThrow(() => assertBehaviorData(componentsFirst));
});

test('passes phase-1 during lazy open and phase-2 once all pages arrive (in page order and with Components arriving last)', () => {
    const full = loadSample();
    assert.ok(full.pages.length > 3, 'must cross the 3-page lazy-open threshold');

    // Simulate lazy open starting on Login, streaming remaining pages in page order (Components arrives last)
    const stubPages = full.pages.map((p, i) => (i === 0 ? structuredClone(p) : { id: p.id, name: p.name, parentId: null, nodes: [] }));
    const lazyDoc = { ...structuredClone(full), pages: stubPages };

    // Initial lazy open runs phase 1
    assert.doesNotThrow(() => assertBehaviorShape(lazyDoc));

    // Stream remaining pages in order: Home, Menu, Cart, Profile, Components (last)
    for (let i = 1; i < full.pages.length; i++) {
        const incoming = structuredClone(full.pages[i]);
        assert.doesNotThrow(() => assertBehaviorShape({ pages: [incoming] }));
        lazyDoc.pages[i] = incoming;
        assert.doesNotThrow(() => assertBehaviorShape(lazyDoc));
    }

    // Once the queue drains (Components arrived last), phase 2 passes on the full document
    assert.equal(full.pages.at(-1).name, 'Components');
    assert.doesNotThrow(() => assertBehaviorData(lazyDoc));
    assert.equal(behaviorProblem(lazyDoc), null);

    // Also test starting from Menu with Components explicitly arriving last after all other pages
    const order = ['Menu', 'Login', 'Home', 'Cart', 'Profile', 'Components'].map(name => full.pages.findIndex(p => p.name === name));
    const reorderedLazy = {
        ...structuredClone(full),
        pages: full.pages.map((p, idx) => (idx === order[0] ? structuredClone(p) : { id: p.id, name: p.name, parentId: null, nodes: [] })),
    };
    assert.doesNotThrow(() => assertBehaviorShape(reorderedLazy));
    for (const pageIdx of order.slice(1)) {
        const incoming = structuredClone(full.pages[pageIdx]);
        assert.doesNotThrow(() => assertBehaviorShape({ pages: [incoming] }));
        reorderedLazy.pages[pageIdx] = incoming;
    }
    assert.doesNotThrow(() => assertBehaviorData(reorderedLazy));
});

test('Button master is bound with Variant (Primary, Secondary, Danger) and Size (Small, Medium, Large) and has no diagnostics errors', () => {
    const doc = loadSample();
    const collections = doc.variables.collections;
    const variantColl = collections.find(c => c.name === 'Variant');
    const sizeColl = collections.find(c => c.name === 'Size');
    const stylingColl = collections.find(c => /color|typography/i.test(c.name));

    assert.ok(variantColl, 'Variant collection exists');
    assert.deepEqual(variantColl.modes.map(m => m.name), ['Primary', 'Secondary', 'Danger']);
    assert.ok(sizeColl, 'Size collection exists');
    assert.deepEqual(sizeColl.modes.map(m => m.name), ['Small', 'Medium', 'Large']);
    assert.ok(stylingColl, 'Colors/Typography variable collection exists');

    const componentsPage = doc.pages.find(p => p.name === 'Components');
    const master = componentsPage.nodes.find(n => n.component && n.name === 'Button');
    assert.ok(master, 'Button master exists on Components page');
    assert.deepEqual(master.behavior, {
        version: 2,
        templateId: 'button',
        variables: { variant: variantColl.id, size: sizeColl.id },
    });

    const findings = diagnoseDocument(doc);
    const errors = findings.filter(f => f.severity === 'error');
    assert.deepEqual(errors, [], 'no diagnostics errors allowed');

    const allNodes = doc.pages.flatMap(p => p.nodes);
    const buttons = allNodes.filter(n => n.id === master.id || (n.isInstance && n.sourceId === master.id));
    assert.ok(buttons.length >= 10, 'multiple Button instances across screens');

    const buttonTemplate = TEMPLATES.get('button');
    for (const btn of buttons) {
        const nodeFindings = findings.filter(f => f.nodeId === btn.id && f.severity !== 'info');
        assert.deepEqual(nodeFindings, [], `Button "${btn.name}" (${btn.id}) should have no issues`);
        if (btn.isInstance) {
            const modes = { variant: btn.varModes?.[master.behavior.variables.variant] ?? null, size: btn.varModes?.[master.behavior.variables.size] ?? null };
            const props = resolveProps(buttonTemplate, btn.behavior.props);
            for (const state of ['default', 'hover', 'active', 'focus', 'disabled']) {
                const prev = state === 'disabled' ? previewOf(buttonTemplate, master.behavior, modes, doc.variables, { ...props, disabled: true }) : previewOf(buttonTemplate, master.behavior, modes, doc.variables, props, state);
                assert.deepEqual(prev.unresolved, [], `Button "${btn.name}" state "${state}" should resolve all tokens`);
            }
        }
    }

    const code = generateComponent(buttonTemplate, master.behavior, doc.variables, 'Button');
    assert.deepEqual(code.problems, []);
    assert.ok(code.files['Button.jsx']);
    assert.ok(code.files['Button.css']);
});

test('screens have 390x844 top-level auto-layout frames, 3-4 level nesting, non-auto-layout frame with abs children, varied layers, 5+ Menu cards, and varied Button instances', () => {
    const doc = loadSample();
    const allNodes = doc.pages.flatMap(p => p.nodes);

    // Every layer has a reasonable name (no "Frame 12", "Rect 3", etc.)
    for (const n of allNodes) {
        assert.ok(n.name && n.name.trim().length > 0, `node ${n.id} has empty name`);
        assert.doesNotMatch(n.name, /^(Frame|Rect|Rectangle|Ellipse|Group|Text|Layer)\s*\d*$/i, `generic layer name "${n.name}" on ${n.id}`);
    }

    // Screen pages have 390x844 top-level auto-layout frames with 3-4 levels of nested auto-layout
    for (const pageName of ['Login', 'Home', 'Menu', 'Cart', 'Profile']) {
        const page = doc.pages.find(p => p.name === pageName);
        const byId = new Map(page.nodes.map(n => [n.id, n]));
        const screen = page.nodes.find(n => n.parentId === null && n.type === 'frame' && n.w === 390 && n.h === 844);
        assert.ok(screen, `${pageName} has a 390x844 top-level frame`);
        assert.ok(screen.layout && screen.layout !== 'none', `${pageName} screen is an auto-layout frame`);

        // Compute auto-layout nesting depth inside screen
        let maxAutoDepth = 0;
        for (const n of page.nodes) {
            if (n.type !== 'frame' || !n.layout || n.layout === 'none') continue;
            let depth = 0;
            let cur = byId.get(n.parentId);
            while (cur) {
                if (cur.type === 'frame' && cur.layout && cur.layout !== 'none') depth++;
                cur = byId.get(cur.parentId);
            }
            if (depth > maxAutoDepth) maxAutoDepth = depth;
        }
        assert.ok(maxAutoDepth >= 3, `${pageName} has nested auto-layout at least 3 levels deep (got ${maxAutoDepth})`);
    }

    // At least one non-auto-layout frame with positioned children
    const nonAutoFramesWithKids = doc.pages.flatMap(p => {
        const kidsOf = new Map();
        for (const n of p.nodes) {
            if (!n.parentId) continue;
            (kidsOf.get(n.parentId) || kidsOf.set(n.parentId, []).get(n.parentId)).push(n);
        }
        return p.nodes.filter(
            n => n.type === 'frame' && (!n.layout || n.layout === 'none') && !n.isInstance && !n.behavior?.slot && (kidsOf.get(n.id)?.length || 0) >= 2,
        );
    });
    assert.ok(nonAutoFramesWithKids.length >= 1, 'has at least one non-auto-layout frame with positioned children');

    // Text layers with mixed sizes and weights, rects with fills & radius, group, ellipse, image-less placeholder
    const texts = allNodes.filter(n => n.type === 'text');
    assert.ok(new Set(texts.map(t => t.fontSize)).size >= 4, 'mixed text sizes');
    assert.ok(new Set(texts.map(t => t.fontWeight)).size >= 3, 'mixed text weights');
    assert.ok(allNodes.some(n => n.type === 'rect' && n.fills.some(f => f.visible !== false && f.color && f.color !== 'none') && n.radius > 0), 'rect with fill and corner radius');
    assert.ok(allNodes.some(n => n.type === 'group'), 'at least one group');
    assert.ok(allNodes.some(n => n.type === 'ellipse'), 'at least one ellipse (avatar)');
    assert.ok(
        allNodes.some(n => n.type === 'rect' && Array.isArray(n.fills) && n.fills.some(f => f.type === 'image' && !f.image)),
        'at least one image-less placeholder',
    );

    // Menu page has 5+ repeated card frames
    const menuPage = doc.pages.find(p => p.name === 'Menu');
    const menuCards = menuPage.nodes.filter(n => n.type === 'frame' && /^Menu Card ·/i.test(n.name));
    assert.ok(menuCards.length >= 5, `Menu has 5+ repeated card frames (got ${menuCards.length})`);

    // Button instances across screens with varied props
    const componentsPage = doc.pages.find(p => p.name === 'Components');
    const master = componentsPage.nodes.find(n => n.component && n.name === 'Button');
    const instances = allNodes.filter(n => n.isInstance && n.sourceId === master.id);
    const nonComponentPageInstances = doc.pages
        .filter(p => p.name !== 'Components')
        .flatMap(p => p.nodes)
        .filter(n => n.isInstance && n.sourceId === master.id);
    assert.ok(nonComponentPageInstances.length >= 6, 'instances on pages other than master page');

    const variantsUsed = new Set(instances.map(i => i.varModes?.[master.behavior.variables.variant]));
    const sizesUsed = new Set(instances.map(i => i.varModes?.[master.behavior.variables.size]));
    const labelsUsed = new Set(instances.map(i => i.behavior.props.label));
    assert.equal(variantsUsed.size, 3, 'all 3 Variant modes used');
    assert.equal(sizesUsed.size, 3, 'all 3 Size modes used');
    assert.ok(labelsUsed.size >= 5, 'varied button labels');
    assert.ok(instances.some(i => i.behavior.props.loading === true), 'at least one loading button');
    assert.ok(instances.some(i => i.behavior.props.disabled === true), 'at least one disabled button');
    assert.ok(instances.some(i => i.behavior.props.hasIcon === true && (i.behavior.props.iconPlacement ?? 'start') === 'start'), 'leading icon button');
    assert.ok(instances.some(i => i.behavior.props.hasIcon === true && i.behavior.props.iconPlacement === 'end'), 'trailing icon button');
    assert.ok(instances.some(i => !i.behavior.props.hasIcon), 'icon-off button');
});

test('canvas selection rules work on the Menu screen hierarchy', () => {
    const doc = loadSample();
    const menuPage = doc.pages.find(p => p.name === 'Menu');
    const byId = new Map(menuPage.nodes.map(n => [n.id, n]));
    const kidsOf = new Map();
    for (const n of menuPage.nodes) {
        if (!n.parentId) continue;
        (kidsOf.get(n.parentId) || kidsOf.set(n.parentId, []).get(n.parentId)).push(n);
    }
    const toRecord = n => ({
        id: n.id,
        parentId: n.parentId ?? null,
        type: n.type,
        isSection: !!n.isSection,
        isInstance: !!n.isInstance,
        isAutoLayout: n.type === 'frame' && !!n.layout && n.layout !== 'none',
        componentSet: !!n.componentSet,
        parentIsSection: !!byId.get(n.parentId)?.isSection,
        childCount: (kidsOf.get(n.id) || []).length,
    });

    const screen = menuPage.nodes.find(n => n.parentId === null && n.type === 'frame');
    const card = menuPage.nodes.find(n => /^Menu Card ·/i.test(n.name));
    const leafText = menuPage.nodes.find(n => n.type === 'text' && byId.get(n.parentId)?.parentId === card.id);
    assert.ok(screen && card && leafText);

    // Build path from root screen down to leafText
    const chain = [];
    for (let cur = leafText; cur; cur = byId.get(cur.parentId)) chain.unshift(toRecord(cur));

    // 1. Empty area of top-level auto-layout frame is clickable
    assert.equal(resolveSelectTarget({ path: [chain[0]], selection: [] }), screen.id);

    // 2. Click inside top-level frame selects direct child of scope (level 1 container)
    const directChild = chain[1];
    assert.equal(resolveSelectTarget({ path: chain, selection: [] }), directChild.id);

    // 3. Double-click drills down one container level at a time
    assert.equal(resolveSelectTarget({ path: chain, selection: [directChild], drill: true }), chain[2].id);

    // 4. Ctrl/Cmd+click deep selects the deepest leaf node
    assert.equal(resolveSelectTarget({ path: chain, selection: [], deep: true }), leafText.id);
});
