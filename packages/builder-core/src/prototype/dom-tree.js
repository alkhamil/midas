// DOM descriptor (pure). `toDomTree` turns one top-level frame into a tree of element descriptors that a runtime mounts as real DOM.
// Frames with auto layout are flex containers, their absolutely positioned children and everything in a plain frame are placed at
// their x and y. A Button instance (a component bound to the Button template) is the same `<button>` the codegen exports, styled by the
// codegen stylesheet, so Play and export agree.
//
// Geometry and fills come from the shared modules (geometry/shapes.js, geometry/fills.js), the same ones the canvas and the SVG export
// read. A layer's fill, border radius and shadows are CSS. Outlines the CSS cannot draw (an arc, a line, a vector path, a stroke that is
// centred on the outline, a dash) are an `html` string of SVG, placed in the element.
//
// Anything the DOM does not draw is listed in `unsupported`, never drawn silently: image layers, boolean results, masks, image fills and
// effects with no DOM form (glass).
import { TEMPLATES, variableProps } from '../behavior-engine/registry.js';
import { resolveMode } from '../behavior-engine/modes.js';
import { resolveProps } from '../behavior-engine/instance-props.js';
import { generateComponent } from '../behavior-engine/codegen.js';
import { arcActive, cornerRadii, hasRadii, strokeIsOn, strokeSideWidths, svgShapeEl, svgStrokeAttrs, svgStrokeExtra } from '../geometry/shapes.js';
import { getFills } from '../geometry/fills.js';

/**
 * @typedef {{ tag: string, nodeId?: string, attrs: Record<string, string | boolean>, style: Record<string, string>, text?: string, html?: string, children: Element[] }} Element
 */

/** Layer kinds the DOM draws. Image, boolean results and masks are not drawn yet. */
const DRAWN = ['frame', 'group', 'rect', 'ellipse', 'text', 'line', 'path'];
/** Kinds whose outline is drawn as an SVG path, not a CSS box. */
const VECTOR = ['line', 'path'];

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
    // A boolean result is computed from its operands (polygon clipping), which the DOM does not have. Its operands are not drawn either.
    if (n.booleanOp) {
        cx.unsupported.push({ nodeId: n.id, type: 'boolean' });
        return null;
    }
    // A mask clips the layers under it. The DOM does not clip yet, so the mask is not drawn and is reported.
    if (n.isMask) {
        cx.unsupported.push({ nodeId: n.id, type: 'mask' });
        return null;
    }
    if (!DRAWN.includes(n.type)) {
        cx.unsupported.push({ nodeId: n.id, type: n.type });
        return null;
    }
    const base = { ...placement(n, parent, cx.responsive), ...opacityOf(n) };
    if (n.type === 'text') return textElement(n, { ...base, ...textStyle(n), ...effectStyle(n, cx, true) });
    if (VECTOR.includes(n.type) || arcActive(n)) {
        return { tag: 'div', nodeId: n.id, attrs: {}, style: { ...base, ...effectStyle(n, cx, true) }, html: vectorMarkup(n, cx), children: [] };
    }
    const style = { ...base, ...fillStyle(n, cx), ...radiusStyle(n), ...effectStyle(n, cx, false) };
    if (n.type === 'ellipse') style.borderRadius = '50%';
    if (n.type === 'frame' || n.type === 'group') style.position = style.position ?? 'relative';
    if (n.type === 'frame') {
        if (isAutoLayout(n)) Object.assign(style, flexOf(n));
        Object.assign(style, overflowOf(n));
    }
    if (n.type === 'group' && n.clip) style.overflow = 'hidden';
    if (n.type === 'frame') Object.assign(style, borderOf(n));
    const html = n.type === 'rect' || n.type === 'ellipse' ? strokeOverlay(n) : undefined;
    if (html !== undefined) style.position = style.position ?? 'relative';
    const children = cx.childrenOf(n.id).map(c => renderNode(c, n, cx)).filter(Boolean);
    return { tag: 'div', nodeId: n.id, attrs: {}, style, ...(html !== undefined ? { html } : {}), children };
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
    const transform = transformOf(n);
    if (transform) style.transform = transform;
    return style;
}

/**
 * The transform of a layer: its flip about its centre, then its rotation. The canvas applies the flip first, so the CSS list is the
 * rotation first (it is applied last).
 * @param {any} n
 * @returns {string}
 */
function transformOf(n) {
    const parts = [];
    if (n.rotation) parts.push(`rotate(${n.rotation}deg)`);
    if (n.flipX) parts.push('scaleX(-1)');
    if (n.flipY) parts.push('scaleY(-1)');
    return parts.join(' ');
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
 * The overflow of a frame: the axes its scroll behaviour opens. Every other axis clips. A template instance has no scroll behaviour:
 * the validator refuses one, and Play ignores any it finds.
 * @param {any} n
 * @returns {Record<string, string>}
 */
function overflowOf(n) {
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
 * The fill of a box as CSS. Each visible fill is one layer, the first on top, as the canvas stacks them. A solid fill is the background
 * colour; a gradient is a gradient layer. An image fill is not drawn yet: it is reported.
 * @param {any} n
 * @param {any} cx
 * @returns {Record<string, string>}
 */
function fillStyle(n, cx) {
    const layers = [];
    for (const f of getFills(n).filter(x => x.visible !== false)) {
        const layer = fillLayer(f);
        if (layer === null) cx.unsupported.push({ nodeId: n.id, type: `${f.type} fill` });
        else if (layer) layers.push(layer);
    }
    if (!layers.length) return {};
    if (layers.length === 1 && layers[0].solid) return { background: layers[0].css };
    return { background: layers.map(l => (l.solid ? `linear-gradient(${l.css}, ${l.css})` : l.css)).join(', ') };
}

/**
 * One fill as a CSS layer. A linear fill's angle is measured from the x axis on the canvas, and from the top in CSS: CSS is the canvas
 * angle plus 90 degrees. Null for a fill the DOM cannot draw; undefined for a fill that draws nothing.
 * @param {any} f
 * @returns {{ css: string, solid: boolean } | null | undefined}
 */
function fillLayer(f) {
    const o = f.opacity;
    if (f.type === 'solid') return f.color && f.color !== 'none' ? { css: colorWithAlpha(f.color, o), solid: true } : undefined;
    if (f.type === 'linear') return { css: `linear-gradient(${(f.angle ?? 90) + 90}deg, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    if (f.type === 'radial') return { css: `radial-gradient(circle, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    if (f.type === 'angular') return { css: `conic-gradient(from 0deg, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    return null;
}

/**
 * The border radius of a box: one radius, or the four corners in order (top-left, top-right, bottom-right, bottom-left).
 * @param {any} n
 * @returns {Record<string, string>}
 */
function radiusStyle(n) {
    if (!n.radius && !hasRadii(n)) return {};
    const r = cornerRadii(n);
    return { borderRadius: r.every(v => v === r[0]) ? `${r[0]}px` : r.map(v => `${v}px`).join(' ') };
}

/**
 * The border of a frame or group, from its stroke. Rectangles and ellipses draw their stroke as an SVG overlay, centred on the outline.
 * @param {any} n
 * @returns {Record<string, string>}
 */
function borderOf(n) {
    if (!strokeIsOn(n)) return {};
    return { border: `${strokeSideWidths(n).t}px solid ${colorWithAlpha(n.stroke, n.strokeOpacity)}`, boxSizing: 'border-box' };
}

/**
 * The stroke of a rectangle or an ellipse as an SVG overlay, over its CSS fill. Undefined when it has no stroke.
 * @param {any} n
 * @returns {string | undefined}
 */
function strokeOverlay(n) {
    if (!strokeIsOn(n)) return undefined;
    return svgMarkup(n, `fill="none" ${svgStrokeAttrs(n, fmt, escAttr)}`);
}

/**
 * An outline drawn as SVG: an arc, a line or a vector path, with its fill and its stroke.
 * @param {any} n
 * @param {any} cx
 * @returns {string}
 */
function vectorMarkup(n, cx) {
    const fill = n.type === 'line' ? 'fill="none"' : fillAttrs(n, cx);
    return svgMarkup(n, `${fill} ${svgStrokeAttrs(n, fmt, escAttr)}`);
}

/**
 * The SVG of one shape with its attributes, and the clip or mask an inside or outside stroke needs.
 * @param {any} n
 * @param {string} attrs
 * @returns {string}
 */
function svgMarkup(n, attrs) {
    const prefix = `${String(n.id).replace(/[^A-Za-z0-9_-]/g, '_')}-`;
    const extra = svgStrokeExtra(n, fmt, escAttr, prefix);
    const body = svgShapeEl(n, fmt, attrs) + extra.el;
    return `<svg width="${n.w}" height="${n.h}" viewBox="0 0 ${n.w} ${n.h}" overflow="visible" style="position:absolute;left:0;top:0;display:block;overflow:visible">${extra.defs}${body}</svg>`;
}

/**
 * The fill attributes of an SVG outline: its first visible fill when it is solid. A gradient or an image on an SVG outline is not drawn
 * yet, and a second fill is not drawn; both are reported.
 * @param {any} n
 * @param {any} cx
 */
function fillAttrs(n, cx) {
    const fills = getFills(n).filter(f => f.visible !== false);
    if (fills.length > 1) cx.unsupported.push({ nodeId: n.id, type: 'multiple fills on a vector layer' });
    const [first] = fills;
    if (!first) return 'fill="none"';
    if (first.type !== 'solid' || !first.color || first.color === 'none') {
        cx.unsupported.push({ nodeId: n.id, type: `${first.type} fill on a vector layer` });
        return 'fill="none"';
    }
    return `fill="${escAttr(first.color)}" fill-opacity="${fmt(first.opacity ?? 1)}"`;
}

/**
 * The effects of a layer as CSS. Drop and inner shadows are box shadows; on a text or vector layer a drop shadow is a filter, because the
 * shadow follows the glyphs or the outline. Layer blur is a filter; background blur is a backdrop filter. Effects the DOM has no form for
 * (glass, an inner shadow on text) are reported. Only the effects list is read.
 * @param {any} n
 * @param {any} cx
 * @param {boolean} onOutline true for text and vector layers
 * @returns {Record<string, string>}
 */
function effectStyle(n, cx, onOutline) {
    const shadows = [], filters = [], backdrops = [];
    for (const e of (Array.isArray(n.effects) ? n.effects : []).filter(x => x.visible !== false)) {
        const shadow = `${e.x || 0}px ${e.y || 0}px ${e.blur || 0}px ${e.spread || 0}px ${colorWithAlpha(e.color ?? '#000000', e.opacity ?? 0.25)}`;
        if (e.type === 'drop') {
            if (onOutline) filters.push(`drop-shadow(${e.x || 0}px ${e.y || 0}px ${e.blur || 0}px ${colorWithAlpha(e.color ?? '#000000', e.opacity ?? 0.25)})`);
            else shadows.push(shadow);
        }
        else if (e.type === 'inner') {
            if (onOutline) cx.unsupported.push({ nodeId: n.id, type: 'inner shadow on a text or vector layer' });
            else shadows.push(`inset ${shadow}`);
        }
        else if (e.type === 'layerBlur') filters.push(`blur(${(e.radius || 0) / 2}px)`);
        else if (e.type === 'bgBlur') backdrops.push(`blur(${(e.radius || 0) / 2}px)`);
        else cx.unsupported.push({ nodeId: n.id, type: e.type });
    }
    /** @type {Record<string, string>} */
    const style = {};
    if (shadows.length) style.boxShadow = shadows.join(', ');
    if (filters.length) style.filter = filters.join(' ');
    if (backdrops.length) style.backdropFilter = backdrops.join(' ');
    return style;
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
 * A colour with an opacity applied. A six digit hex takes the alpha as a byte; any other colour is mixed with transparent.
 * @param {string} color
 * @param {number | undefined} opacity
 */
function colorWithAlpha(color, opacity) {
    if (opacity === undefined || opacity >= 1) return color;
    const o = Math.max(0, opacity);
    if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(o * 255).toString(16).padStart(2, '0')}`;
    return `color-mix(in srgb, ${color} ${Math.round(o * 100)}%, transparent)`;
}

/** A number for an SVG attribute: at most three decimals. */
const fmt = v => +(+v).toFixed(3);

/** Escapes a value for an SVG attribute. */
const escAttr = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    const style = { color: s.fill && s.fill !== 'none' ? colorWithAlpha(s.fill, s.fillOpacity ?? n.fillOpacity) : 'transparent' };
    if (s.fontFamily) style.fontFamily = s.fontFamily;
    if (s.fontSize) style.fontSize = `${s.fontSize}px`;
    if (s.fontWeight) style.fontWeight = String(s.fontWeight);
    if (s.fontStyle) style.fontStyle = s.fontStyle;
    if (s.textDecoration && s.textDecoration !== 'none') style.textDecoration = s.textDecoration;
    return { tag: 'span', attrs: {}, style, text: s.text ?? '', children: [] };
}

/**
 * Font, colour, size, alignment, stroke, truncation and wrap of a text layer. The fill is the text colour; a layer with no fill draws no
 * colour, as on the canvas. A stroke is a text stroke centred on the glyphs.
 * @param {any} n
 */
function textStyle(n) {
    /** @type {Record<string, string>} */
    const style = {
        fontFamily: n.fontFamily ?? 'sans-serif',
        fontSize: `${n.fontSize ?? 14}px`,
        fontWeight: String(n.fontWeight ?? 400),
        fontStyle: n.fontStyle ?? 'normal',
        color: n.fill && n.fill !== 'none' ? colorWithAlpha(n.fill, n.fillOpacity) : 'transparent',
        lineHeight: String(n.lineHeight ?? 1.2),
        textAlign: n.textAlign ?? 'left',
        whiteSpace: 'pre-wrap',
    };
    if (strokeIsOn(n)) style.WebkitTextStroke = `${n.strokeWidth}px ${colorWithAlpha(n.stroke, n.strokeOpacity)}`;
    if (n.letterSpacing) style.letterSpacing = `${n.letterSpacing}px`;
    if (n.textDecoration && n.textDecoration !== 'none') style.textDecoration = n.textDecoration;
    if (n.textCase === 'upper') style.textTransform = 'uppercase';
    else if (n.textCase === 'lower') style.textTransform = 'lowercase';
    else if (n.textCase === 'title') style.textTransform = 'capitalize';
    if (n.textTruncate) {
        Object.assign(style, { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: String(Math.max(1, Math.floor(+n.maxLines) || 1)), overflow: 'hidden' });
    }
    if (n.textWrap === 'balance' || n.textWrap === 'pretty') style.textWrap = n.textWrap;
    return style;
}
