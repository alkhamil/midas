// The Design System bundle (pure planning). One action builds the variables and a master for every template of the registry on one page: this module says
// in what order, which templates already have a master there, the layout of a section, and the toast. The studio applies it with the existing flows
// (Generate base, the part generator, Auto Fix); nothing here names a template.

/** The page the bundle builds on. */
export const DESIGN_SYSTEM_PAGE = 'Design System';

/** The gaps of the page, in px: between sections, between a section's title and its row, and between the masters of a row. */
const LAYOUT = { sectionGap: 64, titleGap: 16, rowGap: 24, titleSize: 20, titleWeight: 600 };

/**
 * The registered templates a template needs before it: those its slots accept (`accepts` names template ids). A template is never its own dependency, and an
 * id the list does not hold is not one either.
 * @param {{ id: string, slots?: { accepts?: string[] }[] }} template
 * @param {{ id: string }[]} all the templates in play
 * @returns {string[]}
 */
export function templateDependencies(template, all) {
    const known = new Set(all.map(t => t.id));
    const out = [];
    for (const slot of template.slots ?? []) for (const id of slot.accepts ?? []) if (id !== template.id && known.has(id) && !out.includes(id)) out.push(id);
    return out;
}

/**
 * The templates in dependency order: a template comes after every template its slots accept, and the rest keep the order they were given. Templates on a cycle
 * (and those that only wait for one) cannot be ordered: they follow the others in the given order, and the cycles are reported, once each, as groups of ids.
 * @template {{ id: string, slots?: { accepts?: string[] }[] }} T
 * @param {T[]} templates
 * @returns {{ order: T[], cycles: string[][] }}
 */
export function orderTemplates(templates) {
    const deps = new Map(templates.map(t => [t.id, templateDependencies(t, templates)]));
    const order = [], done = new Set();
    for (let progress = true; progress;) {
        progress = false;
        for (const t of templates) {
            if (done.has(t.id) || !deps.get(t.id).every(id => done.has(id))) continue;
            order.push(t);
            done.add(t.id);
            progress = true;
            break;
        }
    }
    const rest = templates.filter(t => !done.has(t.id));
    const reach = id => {
        const seen = new Set(), stack = [...deps.get(id)];
        while (stack.length) {
            const next = stack.pop();
            if (seen.has(next)) continue;
            seen.add(next);
            stack.push(...(deps.get(next) ?? []));
        }
        return seen;
    };
    const reached = new Map(rest.map(t => [t.id, reach(t.id)]));
    const cycles = [], grouped = new Set();
    for (const t of rest) {
        if (grouped.has(t.id) || !reached.get(t.id).has(t.id)) continue;
        const group = rest.filter(u => u.id === t.id || (reached.get(t.id).has(u.id) && reached.get(u.id).has(t.id))).map(u => u.id);
        group.forEach(id => grouped.add(id));
        cycles.push(group);
    }
    return { order: [...order, ...rest], cycles };
}

/**
 * The masters among a page's nodes: components bound to a template, keyed by template id. A template with two masters keeps the first in document order.
 * @param {any[]} nodes
 * @returns {Map<string, any>}
 */
export function mastersByTemplate(nodes) {
    const out = new Map();
    for (const n of nodes) {
        const id = n.component === true ? n.behavior?.templateId : undefined;
        if (typeof id === 'string' && !out.has(id)) out.set(id, n);
    }
    return out;
}

/**
 * What the bundle does for these templates on the page whose nodes are given: the templates in order, which get a new master, which already have one (they are
 * completed, never rebuilt), and the cycles found.
 * @template {{ id: string, slots?: { accepts?: string[] }[] }} T
 * @param {{ templates: T[], nodes: any[] }} input
 */
export function planDesignSystem({ templates, nodes }) {
    const { order, cycles } = orderTemplates(templates);
    const masters = mastersByTemplate(nodes);
    return { order, cycles, masters, create: order.filter(t => !masters.has(t.id)), present: order.filter(t => masters.has(t.id)) };
}

/** The frame that holds the sections, as a node spec ({ type, props }) the studio makes a node from: a vertical auto layout the sections stack in. */
export function rootSpec() {
    return { type: 'frame', props: { name: DESIGN_SYSTEM_PAGE, layout: 'vertical', gap: LAYOUT.sectionGap, padding: 0, fills: [], clip: false, layoutSizingH: 'hug', layoutSizingV: 'hug' } };
}

/**
 * A template's section as node specs: the section (a vertical auto layout titled with the template name), its title text, and the row its masters (and demo
 * instance) are laid out in. The gaps are the same in every section.
 * @param {{ id: string, name: string }} template
 */
export function sectionSpecs(template) {
    const hug = { layoutSizingH: 'hug', layoutSizingV: 'hug' };
    return {
        section: { type: 'frame', props: { name: template.name, layout: 'vertical', gap: LAYOUT.titleGap, padding: 0, fills: [], clip: false, ...hug } },
        title: { type: 'text', props: { name: 'Title', text: template.name, fontSize: LAYOUT.titleSize, fontWeight: LAYOUT.titleWeight, autoW: true, ...hug } },
        row: { type: 'frame', props: { name: 'Masters', layout: 'horizontal', gap: LAYOUT.rowGap, padding: 0, fills: [], clip: false, ...hug } },
    };
}

/**
 * The toast of a run: the variables added, the masters created and already present, and the problems found.
 * @param {{ variables: number, created: number, present: number, problems: number }} counts
 */
export function designSystemSummary({ variables, created, present, problems }) {
    const n = (count, one, many = one + 's') => `${count} ${count === 1 ? one : many}`;
    return `${DESIGN_SYSTEM_PAGE}: ${n(variables, 'variable')} added, ${n(created, 'master')} created, ${present} already present, ${n(problems, 'problem')}.`;
}
