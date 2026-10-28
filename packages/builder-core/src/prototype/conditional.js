// Conditional evaluation (pure). A condition compares a variable's value with a literal. The first branch whose condition holds runs its
// actions; when none holds, the else runs. The variable's value is an input: the caller resolves it for the node the conditional sits on.

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
