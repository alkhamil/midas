// Variable types the Variables window can create, and the Enum helpers. Pure.
// Enum is a string variable that only takes one of its `options` (a union prop such as size: 'small' | 'middle' | 'large'): it is picked from a list in the Variables window and in Preview.
export const VAR_TYPES = [['color', 'Color'], ['number', 'Number'], ['string', 'String'], ['boolean', 'Boolean'], ['effect', 'Effect']];
export const VAR_CREATE = [...VAR_TYPES.slice(0, 3), ['enum', 'Enum'], ...VAR_TYPES.slice(3)];
export const ENUM_DEFAULT_OPTIONS = ['option-1', 'option-2'];
export const varOptions = item => item?.type === 'string' && Array.isArray(item.options) && item.options.length ? item.options : null;
