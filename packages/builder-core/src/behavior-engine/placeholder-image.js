// The neutral picture an image slot starts with (a Card's cover): a bundled grey landscape, an image fill and not a flat colour. It is an SVG data URL so the file
// holds it as an ordinary image asset.
import { conditionHolds } from './display.js';

/** The id of the placeholder among the file's assets. */
export const PLACEHOLDER_IMAGE_ID = 'placeholder-picture';

const SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="280" viewBox="0 0 560 280">',
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#cbd0d8"/></linearGradient></defs>',
    '<rect width="560" height="280" fill="url(#g)"/>',
    '<circle cx="440" cy="84" r="30" fill="#f3f4f6"/>',
    '<path d="M0 280 0 200 120 120 220 190 330 100 460 200 560 150 560 280Z" fill="#b4bac4"/>',
    '<path d="M0 280 0 240 140 170 260 230 380 160 560 250 560 280Z" fill="#9aa1ad"/>',
    '</svg>',
].join('');

/** The placeholder picture as a data URL. */
export const PLACEHOLDER_IMAGE = `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(SVG) : Buffer.from(SVG).toString('base64')}`;

/**
 * The image props that start with the placeholder when their slot turns on: a prop with `placeholder: true` whose slot's condition goes from off to on while it holds no
 * picture. The caller puts the placeholder in the file's assets and writes the id.
 * @param {any} template
 * @param {Record<string, unknown>} before the resolved props before the edit
 * @param {Record<string, unknown>} after the resolved props after it
 * @returns {string[]} the image props to fill
 */
export function newlyShownImageProps(template, before, after) {
    return Object.entries(template.props)
        .filter(([name, def]) => def.type === 'image' && def.placeholder === true && (after[name] == null || after[name] === ''))
        .filter(([, def]) => {
            const keys = [def.node, ...(def.nodes ?? [])].filter(Boolean).map(w => w.key);
            const conditions = keys.map(key => template.anatomy.find(s => s.id === key)?.shownWhen).filter(Boolean);
            return conditions.length > 0 && conditions.some(c => conditionHolds(c, after)) && !conditions.some(c => conditionHolds(c, before));
        })
        .map(([name]) => name);
}
