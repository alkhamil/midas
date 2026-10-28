// DOM descriptor (pure). `toDomTree` turns one top-level frame into a tree of element descriptors that a runtime mounts as real DOM.
// Frames with auto layout are flex containers, their absolutely positioned children and everything in a plain frame are placed at
// their x and y. A Button instance (a component bound to the Button template) is the same `<button>` the codegen exports, styled by the
// codegen stylesheet, so Play and export agree.
//
// Geometry and fills come from the shared modules (geometry/shapes.js, geometry/fills.js), the same ones the canvas and the SVG export
// read. A layer's fill, border radius and shadows are CSS. Outlines the CSS cannot draw (an arc, a line, a vector path, a stroke that is
// centred on the outline, a dash) are an `html` string of SVG, placed in the element.
//
// Anything the DOM does not draw is listed in `unsupported`, never drawn silently: boolean results, masks, image fills on vector
// layers and effects with no DOM form (glass).
import { TEMPLATES, variableProps } from '../behavior-engine/registry.js';
import { resolveMode } from '../behavior-engine/modes.js';
import { resolveProps } from '../behavior-engine/instance-props.js';
import { generateComponent } from '../behavior-engine/codegen.js';
import { arcActive, cornerRadii, hasRadii, strokeIsOn, strokeSideWidths, strokeSidesUniform, svgShapeEl, svgStrokeAttrs, svgStrokeExtra } from '../geometry/shapes.js';
import { cssBackgroundOf, displayFills, getFills, topColorOf, topOpacityOf } from '../geometry/fills.js';
import { colorWithAlpha, escapeAttr, svgNumber } from '../geometry/format.js';

/**
 * @typedef {{ tag: string, nodeId?: string, attrs: Record<string, string | boolean>, style: Record<string, string>, text?: string, html?: string, children: Element[] }} Element
 */

/** Layer kinds the DOM draws. Boolean results and masks are not drawn yet. */
const DRAWN = ['frame', 'group', 'rect', 'ellipse', 'text', 'line', 'path', 'image'];
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
    const scope = { byId, assets: doc.assets || {}, variables: doc.variables || {}, pageVarModes, responsive, unsupported: [], problems: [], styles: new Map(), childrenOf: id => nodes.filter(n => n.parentId === id) };
    const root = renderNode(frame, null, scope);
    if (!root) return { root: null, styles: null, unsupported: scope.unsupported, problems: scope.problems };
    const styles = [...scope.styles.values()].join('\n');
    return { root, styles: styles || null, unsupported: scope.unsupported, problems: scope.problems };
}

/**
 * One node as an element, or null when it is hidden or cannot be drawn (then its reason is recorded).
 * @param {any} n
 * @param {any} parent
 * @param {any} scope
 * @returns {Element | null}
 */
function renderNode(n, parent, scope) {
    if (n.visible === false) return null;
    const template = templateOf(n, scope);
    if (template === undefined) return null;
    if (template) return renderButton(n, template, parent, scope);
    // A boolean result is computed from its operands (polygon clipping), which the DOM does not have. Its operands are not drawn either.
    if (n.booleanOp) {
        scope.unsupported.push({ nodeId: n.id, type: 'boolean' });
        return null;
    }
    // A mask is not drawn: the box it sits in clips the layers above it (see renderChildren).
    if (n.isMask) return null;
    if (!DRAWN.includes(n.type)) {
        scope.unsupported.push({ nodeId: n.id, type: n.type });
        return null;
    }
    const base = { ...placement(n, parent, scope.responsive), ...opacityOf(n) };
    if (n.type === 'text') return textElement(n, { ...base, ...textStyle(n), ...effectStyle(n, scope, true) });
    if (VECTOR.includes(n.type) || arcActive(n)) {
        return { tag: 'div', nodeId: n.id, attrs: {}, style: { ...base, ...effectStyle(n, scope, true) }, html: vectorMarkup(n, scope), children: [] };
    }
    const style = { ...base, ...fillStyle(n, scope), ...radiusStyle(n), ...effectStyle(n, scope, false) };
    if (n.type === 'ellipse') style.borderRadius = '50%';
    if (n.type === 'frame' || n.type === 'group') style.position = style.position ?? 'relative';
    if (n.type === 'frame') {
        if (isAutoLayout(n)) Object.assign(style, flexOf(n));
        Object.assign(style, overflowOf(n));
    }
    if (n.type === 'group' && n.clip) style.overflow = 'hidden';
    const children = renderChildren(n, scope);
    const outline = frameOutlineOf(n, scope);
    if (outline !== undefined) {
        style.outline = outline;
        style.outlineOffset = '0px';
    }
    // An outside stroke of a frame is all outline: an overlay inside the frame would only draw the part the frame clips.
    const stroke = n.type === 'frame' && (n.strokeAlign ?? 'center') === 'outside' ? undefined : strokeOverlay(n);
    if (n.type === 'frame' && stroke !== undefined) {
        // A frame's stroke is a layer under its content, so the content draws over it. The isolation keeps that layer above the frame's fill.
        style.isolation = 'isolate';
        children.unshift({ tag: 'div', attrs: {}, style: { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%', zIndex: '-1', pointerEvents: 'none' }, html: stroke, children: [] });
    }
    const html = n.type !== 'frame' ? stroke : undefined;
    if (html !== undefined) style.position = style.position ?? 'relative';
    return { tag: 'div', nodeId: n.id, attrs: {}, style, ...(html !== undefined ? { html } : {}), children };
}

/**
 * The rendered children of a box, in stored order. A visible mask clips every sibling above it, until the next mask, as the canvas
 * does. The clip is a CSS inset or ellipse on the sibling's box; a mask that is not an unrotated rectangle or ellipse, or a sibling
 * that is rotated, has no such clip and is reported.
 * @param {any} n
 * @param {any} scope
 * @returns {any[]}
 */
function renderChildren(n, scope) {
    const out = [];
    let mask = null;
    for (const c of scope.childrenOf(n.id)) {
        if (c.isMask && c.visible !== false) {
            // An auto layout places its children itself, so a mask's stored position does not say where it sits on screen.
            mask = isAutoLayout(n) ? null : c;
            if (mask === null) scope.unsupported.push({ nodeId: c.id, type: 'mask in an auto layout' });
            continue;
        }
        const el = renderNode(c, n, scope);
        if (!el) continue;
        if (mask) {
            const clip = maskClipOf(mask, c);
            if (clip) el.style.clipPath = clip;
            else scope.unsupported.push({ nodeId: mask.id, type: 'mask that is not a rectangle or ellipse, or on a rotated layer' });
        }
        out.push(el);
    }
    return out;
}

/**
 * The CSS clip-path of a sibling by a mask: the mask's box, relative to the sibling's box. Null when the mask is not an unrotated
 * rectangle or ellipse (an arc is not one), or the sibling is rotated (its clip would turn with it).
 * @param {any} mask
 * @param {any} child
 * @returns {string | null}
 */
function maskClipOf(mask, child) {
    if (mask.rotation || child.rotation || arcActive(mask)) return null;
    if (mask.type !== 'rect' && mask.type !== 'ellipse') return null;
    const left = mask.x - child.x, top = mask.y - child.y;
    if (mask.type === 'ellipse') return `ellipse(${svgNumber(mask.w / 2)}px ${svgNumber(mask.h / 2)}px at ${svgNumber(left + mask.w / 2)}px ${svgNumber(top + mask.h / 2)}px)`;
    const right = child.w - left - mask.w, bottom = child.h - top - mask.h;
    const radii = cornerRadii(mask).map(r => `${svgNumber(r)}px`).join(' ');
    return `inset(${svgNumber(top)}px ${svgNumber(right)}px ${svgNumber(bottom)}px ${svgNumber(left)}px round ${radii})`;
}

/**
 * The Button-style template a node is bound to, when it is an instance of a bound master: the template, or null for a plain node.
 * undefined when the binding cannot be drawn (the reason is in scope.problems).
 * @param {any} n
 * @param {any} scope
 */
function templateOf(n, scope) {
    if (!n.isInstance) return null;
    const master = scope.byId.get(n.sourceId);
    const binding = master?.behavior;
    if (!binding || !('templateId' in binding)) return null;
    const template = TEMPLATES.get(binding.templateId);
    if (!template) return null;
    if (!scope.styles.has(template.id)) {
        const generated = generateComponent(template, binding, scope.variables, template.name);
        if (!generated.files) {
            scope.problems.push(...generated.problems.map(p => ({ ...p, nodeId: n.id })));
            return undefined;
        }
        scope.styles.set(template.id, generated.files[`${template.name}.css`]);
    }
    return template;
}

/**
 * A Button-style instance: the element the codegen exports, with its mode attributes, its disabled state and its anatomy in order.
 * @param {any} n
 * @param {any} template
 * @param {any} parent
 * @param {any} scope
 * @returns {Element}
 */
function renderButton(n, template, parent, scope) {
    const master = scope.byId.get(n.sourceId);
    const binding = master.behavior;
    const attrs = { type: 'button', class: template.id };
    for (const [dim] of variableProps(template)) {
        const collection = (scope.variables.collections || []).find(c => c.id === binding.variables[dim]);
        attrs[`data-${dim}`] = collection ? resolveMode(collection, n, scope.byId, scope.pageVarModes) ?? '' : '';
    }
    const props = resolveProps(template, n.behavior?.props ?? {});
    if (props.disabled === true) Object.assign(attrs, { disabled: true, 'aria-disabled': 'true' });
    const children = [];
    for (const slot of template.anatomy) {
        if (slot.kind === 'text') children.push({ tag: 'span', attrs: { class: `${template.id}-${slot.id}` }, style: {}, text: String(props[slot.id] ?? ''), children: [] });
        else if (slot.managed && props.hasIcon === true && props.iconPlacement === placementOf(slot.id)) {
            // The slot's own layer draws the icon its nested instance holds. It flows in the button, so its stored place is dropped.
            const layer = scope.childrenOf(n.id).find(c => c.behavior?.slot === slot.id);
            const el = layer && renderNode(layer, n, scope);
            if (el) {
                const { position, left, top, ...style } = el.style;
                children.push({ ...el, attrs: { ...el.attrs, class: `${template.id}-${slot.id}` }, style });
            }
        }
    }
    return { tag: 'button', nodeId: n.id, attrs, style: placement(n, parent, scope.responsive), children };
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
 * colour; a gradient or an image is a background layer. An image layer paints its asset.
 * @param {any} n
 * @param {any} scope
 * @returns {Record<string, string>}
 */
function fillStyle(n, scope) {
    const { background, unsupported } = cssBackgroundOf(displayFills(n), scope.assets);
    for (const type of unsupported) scope.unsupported.push({ nodeId: n.id, type: `${type} fill` });
    return background ? { background } : {};
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
 * The stroke of a rectangle or an ellipse as an SVG overlay, over its CSS fill. Undefined when it has no stroke.
 * @param {any} n
 * @returns {string | undefined}
 */
function strokeOverlay(n) {
    if (!strokeIsOn(n)) return undefined;
    return svgMarkup(n, `fill="none" ${svgStrokeAttrs(n, svgNumber, escapeAttr)}`);
}

/**
 * The part of a frame's stroke that lies outside its box, as a CSS outline. A frame clips its content, so an overlay cannot draw this part;
 * an outline is not cut by the frame's own clip. A stroke that is not uniform has no outline form, so its outside is reported.
 * @param {any} n
 * @param {any} scope
 * @returns {string | undefined}
 */
function frameOutlineOf(n, scope) {
    if (n.type !== 'frame' || !strokeIsOn(n)) return undefined;
    const width = strokeSideWidths(n).t, align = n.strokeAlign ?? 'center';
    const outside = align === 'outside' ? width : align === 'center' ? width / 2 : 0;
    if (!outside) return undefined;
    if (!strokeSidesUniform(n)) {
        scope.unsupported.push({ nodeId: n.id, type: 'frame outside stroke on some sides' });
        return undefined;
    }
    return `${outside}px solid ${colorWithAlpha(n.stroke, n.strokeOpacity)}`;
}

/**
 * An outline drawn as SVG: an arc, a line or a vector path, with its fill and its stroke.
 * @param {any} n
 * @param {any} scope
 * @returns {string}
 */
function vectorMarkup(n, scope) {
    const fill = n.type === 'line' ? 'fill="none"' : fillAttrs(n, scope);
    return svgMarkup(n, `${fill} ${svgStrokeAttrs(n, svgNumber, escapeAttr)}`);
}

/**
 * The SVG of one shape with its attributes, and the clip or mask an inside or outside stroke needs.
 * @param {any} n
 * @param {string} attrs
 * @returns {string}
 */
function svgMarkup(n, attrs) {
    const prefix = `${String(n.id).replace(/[^A-Za-z0-9_-]/g, '_')}-`;
    const extra = svgStrokeExtra(n, svgNumber, escapeAttr, prefix);
    const body = svgShapeEl(n, svgNumber, attrs) + extra.el;
    return `<svg width="${n.w}" height="${n.h}" viewBox="0 0 ${n.w} ${n.h}" overflow="visible" style="position:absolute;left:0;top:0;display:block;overflow:visible">${extra.defs}${body}</svg>`;
}

/**
 * The fill attributes of an SVG outline: its first visible fill when it is solid. A gradient or an image on an SVG outline is not drawn
 * yet, and a second fill is not drawn; both are reported.
 * @param {any} n
 * @param {any} scope
 */
function fillAttrs(n, scope) {
    const fills = getFills(n).filter(f => f.visible !== false);
    if (fills.length > 1) scope.unsupported.push({ nodeId: n.id, type: 'multiple fills on a vector layer' });
    const [first] = fills;
    if (!first) return 'fill="none"';
    if (first.type !== 'solid' || !first.color || first.color === 'none') {
        scope.unsupported.push({ nodeId: n.id, type: `${first.type} fill on a vector layer` });
        return 'fill="none"';
    }
    return `fill="${escapeAttr(first.color)}" fill-opacity="${svgNumber(first.opacity ?? 1)}"`;
}

/**
 * The effects of a layer as CSS. Drop and inner shadows are box shadows; on a text or vector layer a drop shadow is a filter, because the
 * shadow follows the glyphs or the outline. Layer blur is a filter; background blur is a backdrop filter. Effects the DOM has no form for
 * (glass, an inner shadow on text) are reported. Only the effects list is read.
 * @param {any} n
 * @param {any} scope
 * @param {boolean} onOutline true for text and vector layers
 * @returns {Record<string, string>}
 */
function effectStyle(n, scope, onOutline) {
    const shadows = [], filters = [], backdrops = [];
    for (const e of (Array.isArray(n.effects) ? n.effects : []).filter(x => x.visible !== false)) {
        const shadow = `${e.x || 0}px ${e.y || 0}px ${e.blur || 0}px ${e.spread || 0}px ${colorWithAlpha(e.color ?? '#000000', e.opacity ?? 0.25)}`;
        if (e.type === 'drop') {
            if (onOutline) filters.push(`drop-shadow(${e.x || 0}px ${e.y || 0}px ${e.blur || 0}px ${colorWithAlpha(e.color ?? '#000000', e.opacity ?? 0.25)})`);
            else shadows.push(shadow);
        }
        else if (e.type === 'inner') {
            if (onOutline) scope.unsupported.push({ nodeId: n.id, type: 'inner shadow on a text or vector layer' });
            else shadows.push(`inset ${shadow}`);
        }
        else if (e.type === 'layerBlur') filters.push(`blur(${(e.radius || 0) / 2}px)`);
        else if (e.type === 'bgBlur') backdrops.push(`blur(${(e.radius || 0) / 2}px)`);
        else scope.unsupported.push({ nodeId: n.id, type: e.type });
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
 * A text layer: a span with its characters, or one span per style run when it has several (rich text).
 * @param {any} n
 * @param {Record<string, string>} style
 * @returns {Element}
 */
function textElement(n, style) {
    if (n.spans?.length > 1) return { tag: 'span', nodeId: n.id, attrs: {}, style, children: n.spans.map(s => spanElement(s)) };
    return { tag: 'span', nodeId: n.id, attrs: {}, style, text: n.text ?? '', children: [] };
}

/**
 * One style run of a rich text layer. It sets only the properties it has; the rest come from the layer.
 * @param {any} s
 * @returns {Element}
 */
function spanElement(s) {
    /** @type {Record<string, string>} */
    const color = topColorOf(s);
    const style = { color: color !== 'none' ? colorWithAlpha(color, topOpacityOf(s)) : 'transparent' };
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
        color: topColorOf(n) !== 'none' ? colorWithAlpha(topColorOf(n), topOpacityOf(n)) : 'transparent',
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
    if (n.textWrap === 'balance') style.textWrap = 'balance';
    return style;
}
