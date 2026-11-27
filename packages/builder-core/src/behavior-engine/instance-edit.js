// The plan of one edit to an instance's prop, as data: the instance's next behaviour, the box siblings an exclusive toggle deselects,
// and whether a placeholder picture is used. Pure: the studio applies it inside one transaction.
import { TEMPLATES } from './registry.js';
import { setInstanceValue } from './panel.js';
import { newlyShownIconDefaults } from './anatomy.js';
import { newlyShownImageProps, PLACEHOLDER_IMAGE_ID } from './placeholder-image.js';
import { resolveProps } from './instance-props.js';
import { exclusiveRivals, isBoxSlot, turnsExclusiveOn } from './selection.js';

/**
 * @param {object} args
 * @param {{ id: string, sourceId: string, behavior?: any }} args.instance the instance being written
 * @param {{ behavior?: any }} args.master its component (the bound template)
 * @param {string} args.prop
 * @param {unknown} args.value
 * @param {{ propBind?: { slot?: string } } | undefined} args.parent the instance's parent (a box slot holds items that select among each other)
 * @param {{ id: string, sourceId: string, behavior?: any }[]} args.siblings the parent's children
 * @param {{ defaultIcon: string | null, roleIcons: object, modes: object }} args.iconDefaults what a newly shown icon slot takes
 * @returns {{ behavior: any, usesPlaceholder: boolean, deselect: { id: string, behavior: any }[] }}
 */
export function planInstanceEdit({ instance, master, prop, value, parent, siblings, iconDefaults }) {
    let behavior = setInstanceValue(instance, master, prop, value);
    const template = master?.behavior?.templateId ? TEMPLATES.get(master.behavior.templateId) : null;
    let usesPlaceholder = false;
    if (template) {
        const before = instance.behavior?.props ?? {};
        const icons = newlyShownIconDefaults(template, before, behavior.props ?? {}, iconDefaults.defaultIcon, iconDefaults.roleIcons, iconDefaults.modes);
        behavior = { ...behavior, props: { ...behavior.props, ...icons } };
        // A slot drawn as a picture (the Card's cover) starts with the bundled placeholder when it turns on with no picture.
        const shown = newlyShownImageProps(template, resolveProps(template, before), resolveProps(template, behavior.props));
        if (shown.length) {
            usesPlaceholder = true;
            behavior = { ...behavior, props: { ...behavior.props, ...Object.fromEntries(shown.map(p => [p, PLACEHOLDER_IMAGE_ID])) } };
        }
    }
    const items = siblings.map(node => ({ node, group: node.sourceId, on: node.behavior?.props?.[prop] === true }));
    const rivals = turnsExclusiveOn(template, prop, value) && isBoxSlot(parent)
        ? exclusiveRivals({ node: instance, group: instance.sourceId }, items)
        : [];
    const deselect = rivals.map(({ node }) => ({ id: node.id, behavior: setInstanceValue(node, master, prop, false) }));
    return { behavior, usesPlaceholder, deselect };
}
