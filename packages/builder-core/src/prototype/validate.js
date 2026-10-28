// Prototype validator (pure). Returns every problem in a document as { code, page, node, interaction, message }, in document order.
// Nothing is repaired. A problem names the page and the node by name, and the interaction by id when there is one.
// `complete` false (a lazily opened file, pages still arriving): a reference that cannot be resolved yet is deferred, not refused.
import { PROTOTYPE_VERSION, TRIGGERS, ACTION_TYPES, PLAIN_ACTION_TYPES, CONDITION_OPERATORS, TRANSITIONS, DIRECTIONS, EASINGS, MOVING_TRANSITIONS, LINK_PROTOCOLS, OVERFLOWS } from './data.js';

export class PrototypeDataError extends Error {
    /** @param {string} message @param {Problem | null} [problem] */
    constructor(message, problem = null) {
        super(message);
        this.name = 'PrototypeDataError';
        this.problem = problem;
    }
}

/**
 * @typedef {{ code: string, page: string, node: string | null, interaction: string | null, message: string }} Problem
 */

/** Triggers that hold while the pointer is over or down. Navigation and back cannot run on them (open-link can). */
const CONTINUOUS = ['while-hovering', 'while-pressing'];
/** Actions that change the frame. */
const NAVIGATING = ['navigate-to', 'back'];

/** @param {unknown} v */
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {unknown} v */
const isNonEmptyString = v => typeof v === 'string' && v.length > 0;
/** @param {unknown} v */
const isWholeNumber = v => Number.isInteger(v);

/** Whether an object has no keys beyond the allowed ones. */
const onlyKeys = (obj, allowed) => Object.keys(obj).every(k => allowed.includes(k));

/**
 * Every problem in a document's prototype data.
 * @param {{ pages?: { id: string, name: string, nodes?: any[], prototype?: any }[] }} doc
 * @param {{ complete?: boolean }} [options] `complete` false defers references to nodes that are not loaded yet
 * @returns {Problem[]}
 */
export function validatePrototype(doc, { complete = true } = {}) {
    const pages = doc.pages || [];
    const nodes = pages.flatMap(p => p.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const pageOf = new Map(pages.flatMap(p => (p.nodes || []).map(n => [n.id, p.name])));
    /** @type {Problem[]} */
    const out = [];
    /** @param {string} page @param {string | null} node @param {string | null} interaction @param {string} code @param {string} message */
    const add = (page, node, interaction, code, message) => out.push({ code, page, node, interaction, message });

    /** The top-level frame a reference names, `undefined` when it is not loaded yet and the file is incomplete. */
    const topLevelFrame = id => {
        const n = byId.get(id);
        if (!n) return complete ? null : undefined;
        const parent = n.parentId ? byId.get(n.parentId) : null;
        return n.type === 'frame' && (!n.parentId || !!parent?.isSection) ? n : false;
    };

    /** The document variable a condition names, `undefined` when there is none. */
    const variableOf = id => (doc.variables?.items ?? []).find(v => v.id === id);
    const refs = { topLevelFrame, variableOf };

    for (const page of pages) {
        if (page.prototype !== undefined) checkPage(page, add, topLevelFrame);
        for (const node of page.nodes || []) {
            if (node.prototype !== undefined) checkNode(node, page, add, refs);
        }
    }
    return out;
}

/**
 * The page's flow starting points.
 * @param {any} page
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {(id: string) => any} topLevelFrame
 */
function checkPage(page, add, topLevelFrame) {
    const p = page.prototype;
    if (!isObject(p) || p.version !== PROTOTYPE_VERSION) return add(page.name, null, null, 'page-prototype-version', `page prototype must be version ${PROTOTYPE_VERSION}`);
    if (!onlyKeys(p, ['version', 'flows']) || !Array.isArray(p.flows)) return add(page.name, null, null, 'page-prototype-shape', 'page prototype holds only version and flows');
    for (const flow of p.flows) {
        if (!isObject(flow) || !onlyKeys(flow, ['id', 'name', 'startFrameId']) || !isNonEmptyString(flow.id) || typeof flow.name !== 'string' || !isNonEmptyString(flow.startFrameId)) {
            add(page.name, null, null, 'page-prototype-shape', 'a flow needs id, name and startFrameId');
            continue;
        }
        const start = topLevelFrame(flow.startFrameId);
        if (start === undefined) continue;
        if (start === null) add(page.name, null, null, 'flow-start-missing', `flow "${flow.name}" starts at "${flow.startFrameId}", which is not on any page`);
        else if (start === false) add(page.name, null, null, 'flow-start-not-frame', `flow "${flow.name}" must start at a top-level frame`);
    }
}

/**
 * The interactions a node owns.
 * @param {any} node
 * @param {any} page
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {{ topLevelFrame: (id: string) => any, variableOf: (id: string) => any }} refs
 */
function checkNode(node, page, add, refs) {
    const where = [page.name, node.name];
    if (node.behavior && typeof node.behavior === 'object' && 'slot' in node.behavior) {
        return add(...where, null, 'managed-layer-interaction', 'a managed layer cannot own interactions');
    }
    const p = node.prototype;
    if (!isObject(p) || p.version !== PROTOTYPE_VERSION) return add(...where, null, 'node-prototype-version', `node prototype must be version ${PROTOTYPE_VERSION}`);
    if (!onlyKeys(p, ['version', 'interactions', 'overflow']) || !Array.isArray(p.interactions)) return add(...where, null, 'node-prototype-shape', 'node prototype holds only version, interactions and overflow');
    if (p.overflow !== undefined) {
        if (node.type !== 'frame') add(...where, null, 'overflow-not-frame', 'only a frame can have a scroll behaviour');
        else if (node.isInstance) add(...where, null, 'overflow-on-instance', 'a template instance cannot have a scroll behaviour');
        else if (!OVERFLOWS.includes(p.overflow)) add(...where, null, 'overflow-unknown', `scroll behaviour must be one of ${OVERFLOWS.join(', ')}`);
    }
    const seen = new Set();
    for (const interaction of p.interactions) {
        const id = isObject(interaction) && isNonEmptyString(interaction.id) ? interaction.id : null;
        if (!id || !onlyKeys(interaction, ['id', 'trigger', 'action'])) {
            add(...where, id, 'node-prototype-shape', 'an interaction holds id, trigger and action');
            continue;
        }
        if (seen.has(id)) add(...where, id, 'interaction-duplicate-id', `interaction "${id}" appears twice on this node`);
        seen.add(id);
        checkTrigger(interaction.trigger, where, id, add);
        checkAction(interaction.action, where, id, add, refs, false);
        const navigating = CONTINUOUS.includes(interaction.trigger?.type) ? actionsOf(interaction.action).find(a => NAVIGATING.includes(a?.type)) : undefined;
        if (navigating) add(...where, id, 'trigger-action-mismatch', `${interaction.trigger.type} can only run open-link, not ${navigating.type}`);
    }
}

/** @param {any} trigger @param {string[]} where @param {string} id @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add */
function checkTrigger(trigger, where, id, add) {
    if (!isObject(trigger) || !TRIGGERS.includes(trigger.type)) return add(...where, id, 'trigger-unknown', `trigger must be one of ${TRIGGERS.join(', ')}`);
    if (trigger.type === 'after-delay') {
        if (!onlyKeys(trigger, ['type', 'delayMs']) || !isWholeNumber(trigger.delayMs) || trigger.delayMs <= 0) add(...where, id, 'trigger-delay', 'after-delay needs a whole delayMs above zero');
        return;
    }
    if (!onlyKeys(trigger, ['type'])) add(...where, id, 'trigger-shape', `${trigger.type} takes no delay`);
}

/**
 * @param {any} action
 * @param {string[]} where
 * @param {string} id
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {{ topLevelFrame: (id: string) => any, variableOf: (id: string) => any }} refs
 * @param {boolean} nested the action sits in a conditional's branch
 */
function checkAction(action, where, id, add, refs, nested) {
    if (!isObject(action) || !ACTION_TYPES.includes(action.type)) return add(...where, id, 'action-unknown', `action must be one of ${ACTION_TYPES.join(', ')}`);
    if (action.type === 'conditional') {
        if (nested) return add(...where, id, 'conditional-nested', 'a conditional cannot sit inside a conditional');
        return checkConditional(action, where, id, add, refs);
    }
    checkPlainAction(action, where, id, add, refs.topLevelFrame);
}

/**
 * The actions a node's action runs, the conditional's nested ones included, in order.
 * @param {any} action
 * @returns {any[]}
 */
function actionsOf(action) {
    if (action?.type !== 'conditional') return [action];
    return [...(action.branches ?? []).flatMap(b => b?.actions ?? []), ...(action.else ?? [])];
}

/**
 * A conditional: its branches in order, then an optional else. It needs a branch or an else; every branch and the else hold at least one
 * action, and each condition names a variable of the document.
 * @param {any} action
 * @param {string[]} where
 * @param {string} id
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {{ topLevelFrame: (id: string) => any, variableOf: (id: string) => any }} refs
 */
function checkConditional(action, where, id, add, refs) {
    if (!onlyKeys(action, ['type', 'branches', 'else']) || !Array.isArray(action.branches)) return add(...where, id, 'action-shape', 'conditional holds type, branches and an optional else');
    if (!action.branches.length && action.else === undefined) add(...where, id, 'conditional-empty', 'a conditional needs a branch or an else');
    if (action.else !== undefined && !isActionList(action.else)) add(...where, id, 'conditional-empty-branch', 'an else holds at least one action');
    for (const branch of action.branches) {
        if (!isObject(branch) || !onlyKeys(branch, ['condition', 'actions'])) {
            add(...where, id, 'action-shape', 'a branch holds a condition and actions');
            continue;
        }
        checkCondition(branch.condition, where, id, add, refs.variableOf);
        if (!isActionList(branch.actions)) add(...where, id, 'conditional-empty-branch', 'a branch holds at least one action');
    }
    for (const nested of [...action.branches.flatMap(b => (isObject(b) && Array.isArray(b.actions) ? b.actions : [])), ...(Array.isArray(action.else) ? action.else : [])]) {
        checkAction(nested, where, id, add, refs, true);
    }
}

/** @param {unknown} list a non-empty array */
const isActionList = list => Array.isArray(list) && list.length > 0;

/**
 * A condition: a variable, an operator the variable's type allows, and a literal of the variable's type.
 * @param {any} condition
 * @param {string[]} where
 * @param {string} id
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {(id: string) => any} variableOf
 */
function checkCondition(condition, where, id, add, variableOf) {
    if (!isObject(condition) || !onlyKeys(condition, ['variableId', 'operator', 'value'])) return add(...where, id, 'condition-shape', 'a condition holds variableId, operator and value');
    const variable = isNonEmptyString(condition.variableId) ? variableOf(condition.variableId) : undefined;
    if (!variable) return add(...where, id, 'condition-variable-missing', `variable "${condition.variableId}" does not exist`);
    const operators = CONDITION_OPERATORS[variable.type];
    if (!operators) return add(...where, id, 'condition-variable-type', `variable "${variable.name}" is a ${variable.type}; a condition compares booleans, numbers and strings`);
    if (!operators.includes(condition.operator)) add(...where, id, 'condition-operator', `${variable.type} takes ${operators.join(' ')}, not ${condition.operator}`);
    if (!valueMatches(variable.type, condition.value)) add(...where, id, 'condition-value-type', `the value must be a ${variable.type}`);
}

/** @param {string} type @param {unknown} value */
const valueMatches = (type, value) => (type === 'number' ? Number.isFinite(value) : typeof value === type);

/**
 * A plain action: navigate-to, back or open-link.
 * @param {any} action
 * @param {string[]} where
 * @param {string} id
 * @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add
 * @param {(id: string) => any} topLevelFrame
 */
function checkPlainAction(action, where, id, add, topLevelFrame) {
    if (!PLAIN_ACTION_TYPES.includes(action.type)) return add(...where, id, 'action-unknown', `action must be one of ${ACTION_TYPES.join(', ')}`);
    if (action.type === 'back') {
        if (!onlyKeys(action, ['type'])) add(...where, id, 'action-shape', 'back takes no fields');
        return;
    }
    if (action.type === 'open-link') {
        if (!onlyKeys(action, ['type', 'url']) || !isNonEmptyString(action.url) || !isLinkUrl(action.url)) add(...where, id, 'open-link-url', 'open-link needs an http or https URL');
        return;
    }
    if (!onlyKeys(action, ['type', 'destinationId', 'transition']) || !isNonEmptyString(action.destinationId)) {
        return add(...where, id, 'action-shape', 'navigate-to needs a destinationId and a transition');
    }
    checkTransition(action.transition, where, id, add);
    const target = topLevelFrame(action.destinationId);
    if (target === undefined) return;
    if (target === null) add(...where, id, 'destination-missing', `destination "${action.destinationId}" does not exist`);
    else if (target === false) add(...where, id, 'destination-not-frame', 'a destination must be a top-level frame');
}

/** @param {string} url */
function isLinkUrl(url) {
    try {
        return LINK_PROTOCOLS.includes(new URL(url).protocol);
    } catch {
        return false;
    }
}

/** @param {any} t @param {string[]} where @param {string} id @param {(o: string, n: string | null, i: string | null, code: string, message: string) => void} add */
function checkTransition(t, where, id, add) {
    if (!isObject(t) || !TRANSITIONS.includes(t.type)) return add(...where, id, 'transition-unknown', `transition must be one of ${TRANSITIONS.join(', ')}`);
    if (!isWholeNumber(t.durationMs) || t.durationMs < 0) add(...where, id, 'transition-duration', 'a transition needs a whole durationMs of zero or more');
    if (MOVING_TRANSITIONS.includes(t.type) && !DIRECTIONS.includes(t.direction)) add(...where, id, 'transition-direction', `${t.type} needs a direction: ${DIRECTIONS.join(', ')}`);
    if (t.easing !== undefined && !EASINGS.includes(t.easing)) add(...where, id, 'transition-easing', `easing must be one of ${EASINGS.join(', ')}`);
}

/**
 * Throws PrototypeDataError for the first problem. Used when a file is opened; `complete` false for a lazily opened file.
 * @param {{ pages?: any[] }} doc
 * @param {{ complete?: boolean }} [options]
 */
export function assertPrototypeData(doc, { complete = true } = {}) {
    const [problem] = validatePrototype(doc, { complete });
    if (!problem) return;
    throw new PrototypeDataError(`Cannot open this file: prototype data on "${problem.node ?? problem.page}" on page "${problem.page}" is invalid: ${problem.message}.`, problem);
}

/**
 * The first prototype problem in the document, which blocks a save. Null when the save may run. The editor does not call this
 * while a page is still loading: a save waits for every page first.
 * @param {{ pages?: any[] }} doc
 * @returns {Problem | null}
 */
export function saveBlockedBy(doc) {
    const [problem] = validatePrototype(doc);
    return problem ?? null;
}

/**
 * The problems an edit introduced: those in `after` that `before` did not have, matched by code, page, node and interaction. A
 * problem that was there before is not the edit's, so an edit is never refused for it.
 * @param {Problem[]} before the problems of the document before the edit
 * @param {Problem[]} after the problems of the document after it
 * @returns {Problem[]}
 */
export function introducedProblems(before, after) {
    const key = p => [p.code, p.page, p.node, p.interaction].join('\u0000');
    const known = new Set(before.map(key));
    return after.filter(p => !known.has(key(p)));
}
