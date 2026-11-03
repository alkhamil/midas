import { SIZE_MODES } from '../packages/builder-core/src/templates/size-modes.js';
// The FormItem variable model shared by the fixtures and the tests: one collection, FormItem Size, holding the gap between the label and the control, the
// label's typography and its two colours, and the required mark's colour (the gap between the label and the control is the labelGap prop, not a variable). Every literal sits in a Primitive and is reached through a Semantic alias (see literal-bank.mjs).
import { literalBank, textStyleBank } from './literal-bank.mjs';

export const FORM_ITEM_SIZES = SIZE_MODES.map(id => ({ id, name: id }));
const LABEL_STYLE = { xs: 'textXs', sm: 'textSm', md: 'textBase', lg: 'textLg', xl: 'textXl' };

/**
 * The FormItem collections and variables. Item ids: `{prefix}s-<token>` (Size). `shared` reuses the Semantic and Primitives collections of another call.
 */
export function formItemModel({ ids = {}, prefix = '', sizeModes = FORM_ITEM_SIZES, shared = null } = {}) {
    const size = ids.size ?? 'c-size';
    const semantic = shared?.semantic ?? ids.semantic ?? 'c-semantic';
    const primitives = shared?.primitives ?? ids.primitives ?? 'c-primitives';
    const common = shared ? '' : prefix;
    const bank = literalBank(primitives, semantic);
    const text = textStyleBank(primitives, semantic, common);
    const collections = [
        { id: size, name: 'FormItem Size', modes: sizeModes },
        ...(shared ? [] : [
            { id: semantic, name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] },
            { id: primitives, name: 'Primitives', modes: [{ id: 'base', name: 'Base' }] },
        ]),
    ];
    const items = [];
    const each = (token, type, valueOf) => items.push({ id: `${prefix}s-${token}`, name: token, type, collectionId: size, values: Object.fromEntries(sizeModes.map(m => [m.id, { alias: valueOf(m.id) }])) });
    each('labelTypography', 'typography', mode => text.ref(LABEL_STYLE[mode]));
    each('fg', 'color', () => bank.ref('#18181b'));
    each('fg-disabled', 'color', () => bank.ref('#a1a1aa'));
    each('mark', 'color', () => bank.ref('#ff4d4f'));
    items.unshift(...bank.items(), ...text.items);
    return { collections, items, ids: { size, semantic, primitives }, binding: { version: 2, templateId: 'formitem', variables: { size } } };
}
