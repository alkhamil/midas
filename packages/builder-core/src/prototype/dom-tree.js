// DOM descriptor (pure). `toDomTree` turns one top-level frame into a tree of element descriptors that a runtime mounts as real DOM.
// Frames with auto layout are flex containers, their absolutely positioned children and everything in a plain frame are placed at
// their x and y. Text, rectangles and ellipses map to styled elements. A Button instance (a component bound to the Button template)
// is the same `<button>` the codegen exports, styled by the codegen stylesheet, so Play and export agree.
//
// Layers the DOM does not draw yet (path, line, image, vector and others) are not drawn; they are listed in `unsupported`.
import { TEMPLATES, variableProps } from '../behavior-engine/registry.js';
import { resolveMode } from '../behavior-engine/modes.js';
import { resolveProps } from '../behavior-engine/instance-props.js';
import { generateComponent } from '../behavior-engine/codegen.js';

/**
 * @typedef {{ tag: string, nodeId?: string, attrs: Record<string, string | boolean>, style: Record<string, string>, text?: string, children: Element[] }} Element
 */

const DRAWN = ['frame', 'group', 'rect', 'ellipse', 'text'];

/**
 * The tree for one top-level frame.
 * @param {{ pages?: { id: string, name: string, nodes?: any[] }[], variables?: any, }} doc the document data
 * @param {string} frameId
 * @returns {{ root: Element | null, styles: string | null, unsupported: { nodeId: string, type: string }[], problems: any[] }}
 */
export function toDomTree(doc, frameId, { responsive = false } = {}) {
    const pages = doc.pages || [];
    const nodes = pages.flatMap(p => p.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const frame = byId.get(frameId);
    const parent = frame?.parentId ? byId.get(frame.parentId) : null;
    if (!frame || !(frame.type === 'frame' && (!frame.parentId || parent?.isSection))) throw new Error(`"${frameId}" is not a top-level frame`);
    const pageVarModes = pages.find(p => (p.nodes || []).includes(frame))?.varModes;
    const cx = { byId, variables: doc.variables || {}, pageVarModes, responsive, unsupported: [], problems: [], styles: new Map(), childrenOf: id => nodes.filter(n => n.parentId === id) };
    const root = renderNode(frame, null, cx);
    if (!root) return { root: null, styles: null, unsupported: cx.unsupported, problems: cx.problems };
    const styles = [...cx.styles.values()].join('\n');
    return { root, styles: styles || null, unsupported: cx.unsupported, problems: cx.problems };
}

/**
 * One node as an element, or null when it is hidden or cannot be drawn (then its reason is recorded).
 * @param {any} n
 * @param {any} parent
 * @param {any} cx
 * @returns {Element | null}
 */
function renderNode(n, parent, cx) {
    if (n.visible === false) return null;
    const template = templateOf(n, cx);
    if (template === undefined) return null;
    if (template) return renderButton(n, template, parent, cx);
    if (!DRAWN.includes(n.type)) {
        cx.unsupported.push({ nodeId: n.id, type: n.type });
        return null;
    }
    if (n.type === 'text') return textElement(n, { ...placement(n, parent, cx.responsive), ...opacityOf(n), ...textStyle(n) });
    const style = { ...placement(n, parent, cx.responsive), ...paint(n), ...(n.type === 'ellipse' ? { borderRadius: '50%' } : {}) };
    if (n.type === 'frame' && isAutoLayout(n)) Object.assign(style, flexOf(n));
    if (n.type === 'frame') Object.assign(style, overflowOf(n));
    if (n.type === 'frame' || n.type === 'group') style.position = style.position ?? 'relative';
    const children = cx.childrenOf(n.id).map(c => renderNode(c, n, cx)).filter(Boolean);
    return { tag: 'div', nodeId: n.id, attrs: {}, style, children };
}

/**
 * A text layer: a span with its characters, or one span per style run when it has several (rich text).
 * @param {any} n
 * @param {Record<string, string>} style
 * @returns {Element}
 */
function textElement(n, style) {
    if (n.spans?.length > 1) return { tag: 'span', nodeId: n.id, attrs: {}, style, children: n.spans.map(s => spanElement(s, n)) };
    return { tag: 'span', nodeId: n.id, attrs: {}, style, text: n.text ?? '', children: [] };
}

/**
 * One style run of a rich text layer. It sets only the properties it has; the rest come from the layer.
 * @param {any} s
 * @param {any} n
 * @returns {Element}
 */
function spanElement(s, n) {
    /** @type {Record<string, string>} */
    const style = { color: s.fill && s.fill !== 'none' ? withAlpha(s.fill, s.fillOpacity ?? n.fillOpacity) : 'transparent' };
    if (s.fontFamily) style.fontFamily = s.fontFamily;
    if (s.fontSize) style.fontSize = `${s.fontSize}px`;
    if (s.fontWeight) style.fontWeight = String(s.fontWeight);
    if (s.fontStyle) style.fontStyle = s.fontStyle;
    if (s.textDecoration && s.textDecoration !== 'none') style.textDecoration = s.textDecoration;
    return { tag: 'span', attrs: {}, style, text: s.text ?? '', children: [] };
}

/**
 * The Button-style template a node is bound to, when it is an instance of a bound master: the template, or null for a plain node.
 * undefined when the binding cannot be drawn (the reason is in cx.problems).
 * @param {any} n
 * @param {any} cx
 */
function templateOf(n, cx) {
    if (!n.isInstance) return null;
    const master = cx.byId.get(n.sourceId);
    const binding = master?.behavior;
    if (!binding || !('templateId' in binding)) return null;
    const template = TEMPLATES.get(binding.templateId);
    if (!template) return null;
    if (!cx.styles.has(template.id)) {
        const generated = generateComponent(template, binding, cx.variables, template.name);
        if (!generated.files) {
            cx.problems.push(...generated.problems.map(p => ({ ...p, nodeId: n.id })));
            return undefined;
        }
        cx.styles.set(template.id, generated.files[`${template.name}.css`]);
    }
    return template;
}

/**
 * A Button-style instance: the element the codegen exports, with its mode attributes, its disabled state and its anatomy in order.
 * @param {any} n
 * @param {any} template
 * @param {any} parent
 * @param {any} cx
 * @returns {Element}
 */
function renderButton(n, template, parent, cx) {
    const master = cx.byId.get(n.sourceId);
    const binding = master.behavior;
    const attrs = { type: 'button', class: template.id };
    for (const [dim] of variableProps(template)) {
        const collection = (cx.variables.collections || []).find(c => c.id === binding.variables[dim]);
        attrs[`data-${dim}`] = collection ? resolveMode(collection, n, cx.byId, cx.pageVarModes) ?? '' : '';
    }
    const props = resolveProps(template, n.behavior?.props ?? {});
    if (props.disabled === true) Object.assign(attrs, { disabled: true, 'aria-disabled': 'true' });
    const children = [];
    for (const slot of template.anatomy) {
        if (slot.kind === 'text') children.push({ tag: 'span', attrs: { class: `${template.id}-${slot.id}` }, style: {}, text: String(props[slot.id] ?? ''), children: [] });
        else if (slot.managed && props.hasIcon === true && props.iconPlacement === placementOf(slot.id)) {
            children.push({ tag: 'span', attrs: { class: `${template.id}-${slot.id}` }, style: {}, text: String(props.icon ?? ''), children: [] });
        }
    }
    return { tag: 'button', nodeId: n.id, attrs, style: placement(n, parent, cx.responsive), children };
}

/** `iconStart` -> `start`, the placement a managed slot shows for. */
const placementOf = slot => (slot === 'iconStart' ? 'start' : 'end');

/** @param {any} n */
const isAutoLayout = n => !!n.layout && n.layout !== 'none';

/**
 * Where a node sits. The top-level frame fills the window when responsive, else keeps its size. A child of an auto layout frame is in
 * its flow; a child of a plain frame is placed absolutely at its x and y. Sizes follow the sizing of each axis: see `flowSizing`.
 * @param {any} n
 * @param {any} parent
 * @param {boolean} responsive
 */
function placement(n, parent, responsive) {
    /** @type {Record<string, string>} */
    const style = {};
    if (!parent) {
        Object.assign(style, responsive ? { width: '100%', height: '100%' } : { width: `${n.w}px`, height: `${n.h}px` });
    }
    else if (isAutoLayout(parent) && n.layoutPositioning !== 'absolute') {
        Object.assign(style, flowSizing(n, parent));
    }
    else {
        Object.assign(style, { position: 'absolute', left: `${n.x}px`, top: `${n.y}px` });
        if (n.layoutSizingH !== 'hug') style.width = `${n.w}px`;
        if (n.layoutSizingV !== 'hug') style.height = `${n.h}px`;
    }
    if (n.rotation) style.transform = `rotate(${n.rotation}deg)`;
    return style;
}

/**
 * How a child of an auto layout frame sizes itself on the parent's main axis (the flow direction) and on its cross axis.
 * - main fill: takes the free space (flex 1, may shrink to zero). Main fixed or hug: keeps its size and does not shrink, so a child
 *   wider than its frame is clipped by the frame instead of squeezed.
 * - cross fill: stretches across the parent. Cross fixed or hug: keeps its size, aligned to the start.
 * A text layer takes its natural size on a fixed or hug axis; only a fill axis changes it.
 * @param {any} n
 * @param {any} parent an auto layout frame
 * @returns {Record<string, string>}
 */
function flowSizing(n, parent) {
    const vertical = parent.layout === 'vertical';
    const mainAxis = vertical ? { sizing: n.layoutSizingV, size: 'height', length: n.h, min: 'minHeight' } : { sizing: n.layoutSizingH, size: 'width', length: n.w, min: 'minWidth' };
    const crossAxis = vertical ? { sizing: n.layoutSizingH, size: 'width', length: n.w } : { sizing: n.layoutSizingV, size: 'height', length: n.h };
    /** @type {Record<string, string>} */
    const style = {};
    if (mainAxis.sizing === 'fill') {
        style.flex = '1 1 0';
        style[mainAxis.min] = '0px';
    }
    else {
        style.flexShrink = '0';
        if (mainAxis.sizing !== 'hug' && n.type !== 'text') style[mainAxis.size] = `${mainAxis.length}px`;
    }
    if (crossAxis.sizing === 'fill') {
        style.alignSelf = 'stretch';
    }
    else {
        style.alignSelf = 'flex-start';
        if (crossAxis.sizing !== 'hug' && n.type !== 'text') style[crossAxis.size] = `${crossAxis.length}px`;
    }
    return style;
}

/**
 * The overflow of a frame: the axes its scroll behaviour opens. Every other axis clips.
 * @param {any} n
 * @returns {Record<string, string>}
 */
function overflowOf(n) {
    // A template instance has no scroll behaviour: the validator refuses one, and Play ignores any it finds.
    const mode = n.isInstance ? 'none' : (n.prototype?.overflow ?? 'none');
    return {
        overflowX: mode === 'horizontal' || mode === 'both' ? 'auto' : 'hidden',
        overflowY: mode === 'vertical' || mode === 'both' ? 'auto' : 'hidden',
    };
}

/**
 * The flex container style of an auto layout frame.
 * @param {any} n
 */
function flexOf(n) {
    const pad = (p, fallback) => `${p ?? fallback ?? 0}px`;
    return {
        display: 'flex',
        flexDirection: n.layout === 'vertical' ? 'column' : 'row',
        flexWrap: n.layoutWrap ? 'wrap' : 'nowrap',
        gap: `${n.gap ?? 0}px`,
        padding: [n.padT, n.padR, n.padB, n.padL].every(v => v === undefined)
            ? `${n.padding ?? 0}px`
            : `${pad(n.padT, n.padding)} ${pad(n.padR, n.padding)} ${pad(n.padB, n.padding)} ${pad(n.padL, n.padding)}`,
        boxSizing: 'border-box',
    };
}

/**
 * Fill, stroke, radius, shadow and opacity of a rect, ellipse, frame or group.
 * @param {any} n
 */
function paint(n) {
    /** @type {Record<string, string>} */
    const style = {};
    if (n.fill && n.fill !== 'none') {
        if (n.fillType === 'linear' && n.fill2) style.background = `linear-gradient(${n.gradientAngle ?? 90}deg, ${n.fill}, ${n.fill2})`;
        else style.background = withAlpha(n.fill, n.fillOpacity);
    }
    if (n.stroke && n.stroke !== 'none' && n.strokeWidth > 0 && n.strokeVisible !== false) {
        style.border = `${n.strokeWidth}px solid ${withAlpha(n.stroke, n.strokeOpacity)}`;
        style.boxSizing = 'border-box';
    }
    if (n.radius) style.borderRadius = `${n.radius}px`;
    if (n.shadow) style.boxShadow = `${n.shadowX ?? 0}px ${n.shadowY ?? 0}px ${n.shadowBlur ?? 20}px ${withAlpha(n.shadowColor ?? '#000000', n.shadowOpacity ?? 0.16)}`;
    return { ...style, ...opacityOf(n) };
}

/**
 * The opacity of a layer, when it is not fully opaque.
 * @param {any} n
 * @returns {Record<string, string>}
 */
function opacityOf(n) {
    return n.opacity !== undefined && n.opacity !== 1 ? { opacity: String(n.opacity) } : {};
}

/**
 * A colour with an opacity applied, for a six digit hex colour. Any other colour is returned as it is.
 * @param {string} color
 * @param {number | undefined} opacity
 */
function withAlpha(color, opacity) {
    if (opacity === undefined || opacity >= 1 || !/^#[0-9a-f]{6}$/i.test(color)) return color;
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `${color}${alpha}`;
}

/**
 * Font, colour, size and alignment of a text layer. The fill is the text colour; a layer with no fill draws no colour, as on the canvas.
 * @param {any} n
 */
function textStyle(n) {
    /** @type {Record<string, string>} */
    const style = {
        fontFamily: n.fontFamily ?? 'sans-serif',
        fontSize: `${n.fontSize ?? 14}px`,
        fontWeight: String(n.fontWeight ?? 400),
        fontStyle: n.fontStyle ?? 'normal',
        color: n.fill && n.fill !== 'none' ? withAlpha(n.fill, n.fillOpacity) : 'transparent',
        lineHeight: String(n.lineHeight ?? 1.2),
        textAlign: n.textAlign ?? 'left',
        whiteSpace: 'pre-wrap',
    };
    if (n.letterSpacing) style.letterSpacing = `${n.letterSpacing}px`;
    if (n.textDecoration && n.textDecoration !== 'none') style.textDecoration = n.textDecoration;
    if (n.textCase === 'upper') style.textTransform = 'uppercase';
    else if (n.textCase === 'lower') style.textTransform = 'lowercase';
    else if (n.textCase === 'title') style.textTransform = 'capitalize';
    return style;
}
