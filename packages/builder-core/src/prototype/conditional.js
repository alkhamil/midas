// Conditional (pure). A condition compares a variable's value with a literal. The first branch whose condition holds runs its actions;
// when none holds, the else runs. The variable's value is an input: the caller resolves it for the node the conditional sits on.
// The editing helpers below return a new conditional; the Prototype panel writes it back as one edit.
import { CONDITION_OPERATORS } from './data.js';

const COMPARE = {
    '==': (value, literal) => value === literal,
    '!=': (value, literal) => value !== literal,
    '>': (value, literal) => value > literal,
    '<': (value, literal) => value < literal,
    '>=': (value, literal) => value >= literal,
    '<=': (value, literal) => value <= literal,
};

/**
 * Whether a condition holds for a value. A variable with no value in the mode does not hold, so its condition is false.
 * @param {{ operator: string, value: any }} condition
 * @param {any} value the variable's value, undefined when it has none
 */
export function conditionHolds(condition, value) {
    if (value === undefined) return false;
    return COMPARE[condition.operator](value, condition.value);
}

/**
 * The actions a conditional runs: the actions of the first branch whose condition holds, else its else (none when there is no else).
 * @param {{ branches: { condition: any, actions: any[] }[], else?: any[] }} conditional
 * @param {(variableId: string) => any} valueOf a variable's value on the node the conditional sits on
 * @returns {any[]}
 */
export function chooseBranch(conditional, valueOf) {
    const branch = conditional.branches.find(b => conditionHolds(b.condition, valueOf(b.condition.variableId)));
    return branch ? branch.actions : (conditional.else ?? []);
}

/**
 * The actions an action runs, a conditional's nested ones included, in order.
 * @param {any} action
 * @returns {any[]}
 */
export function actionsOf(action) {
    if (action?.type !== 'conditional') return [action];
    return [...(action.branches ?? []).flatMap(b => b?.actions ?? []), ...(action.else ?? [])];
}

/** The variable a new conditional starts on: the first boolean, else the first number or string. Undefined when there is none. */
export const defaultVariableOf = variables => variables.find(v => v.type === 'boolean') ?? variables.find(v => CONDITION_OPERATORS[v.type]);

/** The value a new condition on a variable of this type compares with. */
export const defaultValueOf = type => (type === 'boolean' ? true : type === 'number' ? 0 : '');

/** The condition a new branch starts from: equal to the variable's default value. */
export const defaultCondition = variable => ({ variableId: variable.id, operator: '==', value: defaultValueOf(variable.type) });

/** The index a branch path names: `b2` is the third branch. */
export const branchIndex = at => Number(at.slice(1));

/**
 * The actions a branch (`b<i>`) or the else (`e`) holds.
 * @param {{ branches: { actions: any[] }[], else?: any[] }} conditional
 * @param {string} at
 */
export function listOf(conditional, at) {
    return at === 'e' ? (conditional.else ?? []) : conditional.branches[branchIndex(at)].actions;
}

/**
 * The conditional with the actions of a branch or the else replaced. An empty list leaves the else out.
 * @param {any} conditional
 * @param {string} at
 * @param {any[]} actions
 */
export function withList(conditional, at, actions) {
    if (at === 'e') {
        const next = { ...conditional };
        delete next.else;
        if (actions.length) next.else = actions;
        return next;
    }
    const i = branchIndex(at);
    return { ...conditional, branches: conditional.branches.map((b, j) => (j === i ? { ...b, actions } : b)) };
}

/**
 * The conditional with one branch replaced.
 * @param {any} conditional
 * @param {string} at the branch, `b<i>`
 * @param {any} branch
 */
export function withBranch(conditional, at, branch) {
    const i = branchIndex(at);
    return { ...conditional, branches: conditional.branches.map((b, j) => (j === i ? branch : b)) };
}

/**
 * The conditional's branch operation: add, remove, or move one branch by one place (`delta` -1 or 1, ignored at the ends).
 * @param {any} conditional
 * @param {'add' | 'remove' | 'move'} op
 * @param {{ at?: string, branch?: any, delta?: number }} [args]
 */
export function withBranches(conditional, op, { at, branch, delta } = {}) {
    const branches = conditional.branches;
    if (op === 'add') return { ...conditional, branches: [...branches, branch] };
    const i = branchIndex(at);
    if (op === 'remove') return { ...conditional, branches: branches.filter((_, j) => j !== i) };
    const to = i + delta;
    if (to < 0 || to >= branches.length) return conditional;
    const moved = [...branches];
    [moved[i], moved[to]] = [moved[to], moved[i]];
    return { ...conditional, branches: moved };
}

/**
 * A condition field changed: the variable (its operator and value reset to the new variable's default), the operator, or the value.
 * The value is read as the variable's type. Throws when the operator or the value does not fit the variable.
 * @param {{ variableId: string, operator: string, value: any }} condition
 * @param {'cond-variable' | 'cond-operator' | 'cond-value'} field
 * @param {string} input the field's value as the panel reads it
 * @param {(id: string) => any} variableOf
 */
export function conditionPatch(condition, field, input, variableOf) {
    if (field === 'cond-variable') {
        const variable = variableOf(input);
        if (!variable || !CONDITION_OPERATORS[variable.type]) throw new Error('Choose a boolean, number or string variable.');
        return defaultCondition(variable);
    }
    const variable = variableOf(condition.variableId);
    if (field === 'cond-operator') {
        if (!CONDITION_OPERATORS[variable.type].includes(input)) throw new Error(`${variable.type} takes ${CONDITION_OPERATORS[variable.type].join(' ')}.`);
        return { ...condition, operator: input };
    }
    const value = variable.type === 'boolean' ? input === 'true' : variable.type === 'number' ? Number(input) : input;
    if (variable.type === 'number' && !Number.isFinite(value)) throw new Error('A number condition needs a number.');
    return { ...condition, value };
}

/**
 * A conditional's operation from the Prototype panel: add a branch or the else, remove them, move a branch, or add and remove the actions
 * of a branch or the else. `navigate` is the action a new branch or action starts from; `variable` is the variable a new branch compares.
 * @param {any} conditional
 * @param {'branch-add' | 'branch-remove' | 'branch-up' | 'branch-down' | 'else-add' | 'else-remove' | 'action-add' | 'action-remove'} op
 * @param {{ at?: string, index?: string | number, navigate: any, variable?: any }} args
 */
export function conditionalOp(conditional, op, { at, index, navigate, variable }) {
    switch (op) {
        case 'branch-add':
            if (!variable) throw new Error('There is no boolean, number or string variable to compare.');
            return withBranches(conditional, 'add', { branch: { condition: defaultCondition(variable), actions: [navigate] } });
        case 'branch-remove':
            return withBranches(conditional, 'remove', { at });
        case 'branch-up':
            return withBranches(conditional, 'move', { at, delta: -1 });
        case 'branch-down':
            return withBranches(conditional, 'move', { at, delta: 1 });
        case 'else-add':
            return withList(conditional, 'e', [navigate]);
        case 'else-remove':
            return withList(conditional, 'e', []);
        case 'action-add':
            return withList(conditional, at, [...listOf(conditional, at), navigate]);
        case 'action-remove':
            return withList(conditional, at, listOf(conditional, at).filter((_, j) => j !== Number(index)));
        default:
            throw new Error(`Unknown conditional operation "${op}".`);
    }
}
