import { camelCase } from './screen.js';

/** `Text Field` → `TextField`: the name of a component or an icon in code. */
export const pascalCase = s => { const c = camelCase(s); return c[0].toUpperCase() + c.slice(1); };
