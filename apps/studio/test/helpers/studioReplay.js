// Runs the REAL studio functions of the Generate Design System path (buildDesignSystemPage and everything it calls in midas.js) over a small fake document.
// midas.js cannot be imported (it needs a browser at load), so each function it needs is cut out of its source by name and compiled here; the names the
// functions use that are not cut out (the document, the toast, the DOM) are the stubs below. A name that is neither is a ReferenceError, so a test can never
// pass over a function it did not run. Nothing here re-implements studio logic.
import fs from 'node:fs';
import * as core from '@midas/builder-core';

const src = fs.readFileSync(new URL('../../src/engine/midas.js', import.meta.url), 'utf8');

/** The source of a top-level function declaration of midas.js, cut at its closing brace on a line of its own (or the one-line form). */
function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) >= 0 ? src.indexOf(`\nfunction ${name}(`) + 1 : src.indexOf(`function ${name}(`);
    if (head < 0) throw new Error(`midas.js has no function ${name}`);
    const lineEnd = src.indexOf('\n', head);
    const firstLine = src.slice(head, lineEnd);
    if (/\}\s*$/.test(firstLine) && (firstLine.match(/\{/g) || []).length === (firstLine.match(/\}/g) || []).length) return firstLine;
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}

/**
 * A document with the parts of DocumentModel the path uses, with its indexes kept the way the real one keeps them: a lookup map and a children list per parent
 * that `add` extends and `refresh` rebuilds from the page, so a read that needs a refresh it did not get sees the stale answer, as in the editor.
 */
export class FakeDoc {
    constructor() {
        this.data = { name: 'file', pageId: 'p1', variables: { collections: [], items: [] }, pages: [{ id: 'p1', name: 'Page 1', nodes: [] }] };
        this.revision = 0;
        this.structure = 0;
        this.refresh();
    }
    get page() { return this.data.pages.find(p => p.id === this.data.pageId) || this.data.pages[0]; }
    get nodes() { return this.page.nodes; }
    get(id) { return this._map.get(id); }
    indexes() { return { map: this._map, byParent: this._byParent }; }
    setIndexes(ix) { this._map = ix.map; this._byParent = ix.byParent; }
    refresh({ structure = true } = {}) {
        this._map = new Map();
        this._byParent = new Map();
        for (const n of this.nodes) {
            this._map.set(n.id, n);
            const pid = n.parentId || null;
            if (!this._byParent.has(pid)) this._byParent.set(pid, []);
            this._byParent.get(pid).push(n);
        }
        this.revision++;
        if (structure) this.structure++;
    }
    add(n) {
        this.nodes.push(n);
        this._map.set(n.id, n);
        const pid = n.parentId || null;
        if (!this._byParent.has(pid)) this._byParent.set(pid, []);
        this._byParent.get(pid).push(n);
        return n;
    }
    children(id) { return this._byParent.get(id || null) || []; }
    descendants(id) {
        const out = [], queue = [id], seen = new Set([id]);
        while (queue.length > 0) {
            for (const n of this.children(queue.shift())) if (!seen.has(n.id)) { seen.add(n.id); out.push(n); queue.push(n.id); }
        }
        return out;
    }
    remove(ids) {
        const all = new Set(ids);
        for (const id of ids) for (const n of this.descendants(id)) all.add(n.id);
        this.page.nodes = this.nodes.filter(n => !all.has(n.id));
        this.refresh();
    }
    touch() { this.revision++; }
    scene() {}
}

/** The functions of midas.js the replay runs, in no particular order (function declarations hoist). */
const FUNCTIONS = [
    'runDesignSystem', 'buildDesignSystemPage', 'sectionFor', 'nodeFromSpec', 'fixMaster', 'placeDemoInstance', 'applyTemplateNodes', 'pageMasterLayers', 'bindMasterTokens', 'applyAutoFixPlan',
    'syncInstance', 'anatomyPlanOf', 'managedLayersOf', 'containerOf', 'managedTextLayersOf', 'managedTextSlotOf', 'managedTemplateOf', 'placeAmongChildren', 'depthFirstOf',
    'applyStateBindings', 'stateBindingsOf', 'copyPairsOf', 'instanceLabelOf', 'applyManagedTextBindings', 'applyLiteralFields', 'partLayersOf', 'groupLayersOf',
    'textSlotLayersOf', 'applyIconSlotBindings', 'setIconVars', 'iconVariableId', 'iconOfSlot', 'setSlotIcon', 'placeIconInSlot', 'defaultIconId', 'onPage', 'componentById',
    'instancesOf', 'pageOfNode', 'varStore', 'varColl', 'isAutoLayout', 'repairBoundStroke', 'rootSpec', 'designSystemSummary', 'remeasureText',
    // What a commit runs after an edit: the component sync (changed({ commit: true }) -> syncComponents).
    'rolledBackForBehavior', 'syncComponents', 'detachOrphans', 'syncInstanceStructure', 'labelIdsOfComponents', 'ownedVarsOf', 'ownedFieldsOf', 'ownedTemplateOf', 'propControlled', 'iconLayerOf',
    'pageTree', 'instanceTree', 'constrainInstanceLayers', 'nodeMode', 'varValue', 'varItem', 'cpropById',
];

/**
 * Compiles the functions against a fresh fake document. Returns the document, the toasts and every function by name.
 * @param {Record<string, unknown>} [extra] more stubs, by name
 */
export function studioReplay(extra = {}) {
    const doc = new FakeDoc();
    const toasts = [];
    const stubs = {
        ...core, doc, uid: (() => { let n = 0; return () => `u${++n}`; })(), toast: message => toasts.push(String(message)),
        BEHAVIOR_TEMPLATES: core.TEMPLATES, DESIGN_SYSTEM_PAGE: core.DESIGN_SYSTEM_PAGE, lazyPages: new Map(),
        paintOf: color => [{ type: 'solid', color, opacity: 1, visible: true }],
        node: (type, props) => ({ id: `n-${Math.random().toString(36).slice(2)}`, name: type, type, x: 0, y: 0, w: 100, h: 100, rotation: 0, visible: true, locked: false, fills: [], ...props }),
        hugText: () => {}, layoutText: () => ({ height: 0 }), ensureGlobalIndexes: () => {},
        // The document-wide indexes midas.js keeps (components, instances, pages, children), read live from the pages.
        _compMap: { get: id => doc.data.pages.flatMap(p => p.nodes).find(n => n.id === id && n.component) },
        _instMap: { get: id => doc.data.pages.flatMap(p => p.nodes).filter(n => n.isInstance && n.sourceId === id) },
        _pageMap: { get: id => doc.data.pages.find(p => p.nodes.some(n => n.id === id)) },
        nodeIndex: () => new Map(doc.data.pages.flatMap(p => p.nodes).map(n => [n.id, n])), allNodes: () => doc.data.pages.flatMap(p => p.nodes),
        _kidsMap: { get: id => doc.data.pages.flatMap(p => p.nodes).filter(n => n.parentId === id) },
        DESIGN_SYSTEM_LABEL: 'Generate Design System', transaction: (label, fn) => fn(), failedPages: new Set(), refreshUI: () => {}, history: { cancelled: 0, cancel() { this.cancelled++; } }, ...extra,
    };
    const body = `with (S) {\n${FUNCTIONS.filter(name => !(name in stubs)).map(sliceFunction).join('\n')}\nreturn { ${FUNCTIONS.filter(name => !(name in stubs)).join(', ')} };\n}`;
    const scope = new Proxy(stubs, { has: (target, key) => typeof key === 'string' && key in target, get: (target, key) => (key === Symbol.unscopables ? undefined : target[key]) });
    const fns = new Function('S', body)(scope);
    return { doc, toasts, stubs, ...fns };
}
