// DOM descriptor (pure). `toDomTree` turns one top-level frame into a tree of element descriptors that a runtime mounts as real DOM.
// Frames with auto layout are flex containers, their absolutely positioned children and everything in a plain frame are placed at
// their x and y. A Button instance (a component bound to the Button template) is the same `<button>` the codegen exports, styled by the
// codegen stylesheet, so Play and export agree.
//
// Geometry and fills come from the shared modules (geometry/shapes.js, geometry/fills.js), the same ones the canvas and the SVG export
// read. A layer's fill, border radius and shadows are CSS. Outlines the CSS cannot draw (an arc, a line, a vector path, a stroke that is
// centred on the outline, a dash) are an `html` string of SVG, placed in the element.
//
// Anything the DOM does not draw is listed in `unsupported`, never drawn silently: a boolean group with no stored result, masks inside an
// auto layout, image fills on vector layers and effects with no DOM form (glass).
import { TEMPLATES, variableProps } from '../behavior-engine/registry.js';
import { cssVarOf } from '../behavior-engine/tokens.js';
import { resolveMode } from '../behavior-engine/modes.js';
import { resolveProps } from '../behavior-engine/instance-props.js';
import { generateComponent } from '../behavior-engine/codegen.js';
import { controlOf, placementsOfDef, slotDefsOf } from '../behavior-engine/anatomy.js';
import { flexOf, flowSizing, rootLayoutOf, labelLayoutOf } from '../behavior-engine/layout.js';
import { labelEntryOf } from '../behavior-engine/layers.js';
import { borderStyleOf } from '../behavior-engine/variant-style.js';
import { arcActive, cornerRadii, hasRadii, strokeDashArray, strokeIsOn, strokeMiterLimit, strokeSideWidths, strokeSidesUniform, strokeStrategyOf, svgShapeEl, svgStrokeAttrs, svgStrokeExtra } from '../geometry/shapes.js';
import { cssBackgroundOf, displayFills, getFills, topColorOf, topOpacityOf } from '../geometry/fills.js';
import { colorWithAlpha, escapeAttr, svgNumber } from '../geometry/format.js';
import { layoutOrder } from '../geometry/autolayout.js';

/**
 * @typedef {{ tag: string, nodeId?: string, attrs: Record<string, string | boolean>, style: Record<string, string>, text?: string, html?: string, children: Element[] }} Element
 */

/** Layer kinds the DOM draws. A mask is not drawn: it clips the layers above it. */
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
 * @param {boolean} [icon] true inside a managed icon slot: bound vector paint resolves through the slot colour
 */
function renderNode(n, parent, scope, icon = false) {
    if (n.visible === false) return null;
    const template = templateOf(n, scope);
    if (template === undefined) return null;
    if (template) return renderTemplate(n, template, parent, scope);
    // A boolean group draws its stored result, the path the canvas computed; its operands are not drawn. Without a result there is nothing.
    if (n.booleanOp && !(n.type === 'path' && (n.points?.length || n.contours?.length))) {
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
        // The outline is an SVG placed at the box's corner: the box must be positioned, or the SVG lands on an ancestor's corner.
        return { tag: 'div', nodeId: n.id, attrs: {}, style: { ...base, position: base.position ?? 'relative', ...effectStyle(n, scope, true) }, html: vectorMarkup(n, scope, icon), children: [] };
    }
    const style = { ...base, ...fillStyle(n, scope), ...radiusStyle(n), ...effectStyle(n, scope, false) };
    if (n.type === 'ellipse') style.borderRadius = '50%';
    if (n.type === 'frame' || n.type === 'group') style.position = style.position ?? 'relative';
    const children = renderChildren(n, scope, icon);
    if (n.type === 'frame') {
        // The flow is the children that are not absolutely positioned: a space-between with one of them starts it, as the canvas does.
        const flowCount = children.filter(c => c.style.position !== 'absolute').length;
        if (isAutoLayout(n)) Object.assign(style, flexOf(n, flowCount));
        Object.assign(style, overflowOf(n));
    }
    if (n.type === 'group' && n.clip) style.overflow = 'hidden';
    const outline = frameOutlineOf(n);
    if (outline !== undefined) {
        style.outline = outline;
        style.outlineOffset = '0px';
    }
    // A uniform outside stroke is an outline, which the frame's own clip does not cut; any other stroke is an overlay (see strokeOverlayEl).
    const overlayEl = outline === undefined ? strokeOverlayEl(n) : null;
    if (n.type === 'frame' && overlayEl) {
        // A frame's stroke is drawn above its fill and its content, as on the canvas, and takes no clicks.
        children.push(overlayEl);
    }
    const html = n.type !== 'frame' ? strokeOverlay(n, false) : undefined;
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
 * @param {boolean} [icon] true inside a managed icon slot (see renderNode)
 */
function renderChildren(n, scope, icon = false) {
    const out = [];
    const auto = n.type === 'frame' && isAutoLayout(n);
    // The flow order of an auto layout's children is the canvas's (a Figma import stores them back to front); the DOM order is the paint
    // order, so a flow position is a CSS `order` and the paint order is reversed when the frame paints its first child on top.
    const stored = scope.childrenOf(n.id);
    const flowPosition = new Map(layoutOrder(n, stored).filter(c => c.layoutPositioning !== 'absolute' && c.visible !== false).map((c, i) => [c.id, i]));
    // Which mask clips each sibling: the canvas reads a flipped frame's children back to front, and a visible mask clips every sibling
    // after it in that reading. A mask is not in the flow, so it sits at its stored place even in an auto layout.
    const maskFor = new Map();
    let active = null;
    for (const c of n.layoutFlip ? [...stored].reverse() : stored) {
        if (c.isMask && c.visible !== false) active = c;
        else maskFor.set(c.id, active);
    }
    for (const c of stored) {
        if (c.isMask) continue;
        const el = renderNode(c, n, scope, icon);
        if (!el) continue;
        const mask = maskFor.get(c.id);
        if (mask) {
            const clip = maskClipOf(mask, c);
            if (clip) el.style.clipPath = clip;
            else if (!mask.rotation && !c.rotation) Object.assign(el.style, maskImageOf(mask, c, scope));
            else scope.unsupported.push({ nodeId: mask.id, type: 'mask on a rotated layer' });
        }
        if (auto && flowPosition.has(c.id)) el.style.order = String(flowPosition.get(c.id));
        out.push(el);
    }
    return auto && n.layoutReverseZ ? out.reverse() : out;
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
 * A mask that is not a plain rectangle or ellipse, as a CSS mask image over the layer's own box: its shapes (a path, a group, or the
 * children of a frame) drawn in black, at the place they hold in the frame. The layer shows only where the mask is.
 * @param {any} mask
 * @param {any} child
 * @param {any} scope
 * @returns {Record<string, string>}
 */
function maskImageOf(mask, child, scope) {
    const shape = (n, dx, dy) => {
        if (n.type === 'frame' || n.type === 'group') return scope.childrenOf(n.id).filter(k => !k.isMask && k.visible !== false).map(k => shape(k, dx + k.x, dy + k.y)).join('');
        return `<g transform="translate(${svgNumber(dx)} ${svgNumber(dy)})">${svgShapeEl(n, svgNumber, 'fill="#000"')}</g>`;
    };
    const box = `width="${svgNumber(child.w)}" height="${svgNumber(child.h)}" viewBox="0 0 ${svgNumber(child.w)} ${svgNumber(child.h)}"`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${box}>${shape(mask, mask.x - child.x, mask.y - child.y)}</svg>`;
    return { maskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat' };
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
        const generated = generateComponent(template, binding, scope.variables, template.name, master, scope.childrenOf);
        if (!generated.files) {
            scope.problems.push(...generated.problems.map(p => ({ ...p, nodeId: n.id })));
            return undefined;
        }
        scope.styles.set(template.id, generated.files[`${template.name}.css`]);
    }
    return template;
}

/**
 * A template instance: the element the codegen exports, with its mode attributes, its disabled state and its anatomy in order.
 * The order is the schema order, as the codegen writes it; the planner keeps the stored children at the visual positions
 * it means, so Play draws what the canvas draws (a flipped root reads its stored children back to front).
 * @param {any} n
 * @param {any} template
 * @param {any} parent
 * @param {any} scope
 * @returns {Element}
 */
function renderTemplate(n, template, parent, scope) {
    const master = scope.byId.get(n.sourceId);
    const binding = master.behavior;
    const control = controlOf(template);
    const attrs = { ...template.element.attrs, class: template.id };
    /** @type {Record<string, string>} */
    const modes = {};
    for (const [dim] of variableProps(template)) {
        const collection = (scope.variables.collections || []).find(c => c.id === binding.variables[dim]);
        modes[dim] = attrs[`data-${dim}`] = collection ? resolveMode(collection, n, scope.byId, scope.pageVarModes) ?? '' : '';
    }
    const props = resolveProps(template, n.behavior?.props ?? {});
    if (!control && props[template.element.disabledState] === true) Object.assign(attrs, { disabled: true, 'aria-disabled': 'true', tabindex: '-1' });
    const children = [];
    // The label's layer and its parent, for the label's own width and alignment (see layout.js).
    const labelEntry = labelEntryOf(n.id, scope.childrenOf, n);
    for (const slot of template.anatomy) {
        if (slot.kind === 'text' || slot.kind === 'control') {
            const isControl = control && control.slot === slot.id;
            // A control slot is an input holding the value prop; the canvas keeps the text layer (see renderNode).
            const style = labelLayoutOf(labelEntry?.node, labelEntry?.parent ?? n);
            if (isControl) {
                const inputAttrs = { class: `${template.id}-${slot.id}`, value: String(props[control.value] ?? '') };
                if (control.placeholder && String(props[control.placeholder] ?? '') !== '') inputAttrs.placeholder = String(props[control.placeholder]);
                if (control.readonly && props[control.readonly] === true) inputAttrs.readOnly = true;
                if (control.maxlength && String(props[control.maxlength] ?? '') !== '') inputAttrs.maxLength = String(props[control.maxlength]);
                if (props[template.element.disabledState] === true) inputAttrs.disabled = true;
                children.push({ tag: 'input', attrs: inputAttrs, style, children: [] });
            }
            else if (!slot.optional || String(props[slot.id] ?? '') !== '') children.push({ tag: 'span', attrs: { class: `${template.id}-${slot.id}` }, style, text: String(props[slot.id] ?? ''), children: [] });
        }
        else if (slot.managed) {
            // The slot's own layer draws the icon its nested instance holds.
            const layer = scope.childrenOf(n.id).find(c => c.behavior?.slot === slot.id);
            for (const def of slotDefsOf(template, slot.id)) {
                if (props[def.show] !== true) continue;
                if (def.placement && !placementsOfDef(template, def, slot.id).includes(String(props[def.placement]))) continue;
                const el = layer && renderNode(layer, n, scope, true);
                if (!el) continue;
                const { position, left, top, width, height, ...style } = el.style;
                children.push({ ...el, attrs: { ...el.attrs, class: `${template.id}-${slot.id}` }, style: { ...style, ...(def.tokens?.colour ? { color: `var(${cssVarOf(template.id, def.tokens.colour)})` } : null) } });
                break;
            }
        }
    }
    // The stroke is the node's own. A uniform inside stroke draws on the host box (one drawer with the canvas and the codegen stylesheet); any other stroke draws as an overlay, and the host border is reset so only the overlay shows.
    // A CSS outline is not used for it: it would override the keyboard-focus ring. The shape comes from the master, as on the canvas.
    if (control && props[control.clear] === true && String(props[control.value] ?? '') !== '') children.push({ tag: 'span', attrs: { class: `${template.id}-clear` }, style: {}, text: '×', children: [] });
    if (control && props[control.count] === true) {
        const countMax = control.maxlength ? String(props[control.maxlength] ?? '') : '';
        children.push({ tag: 'span', attrs: { class: `${template.id}-count` }, style: {}, text: `${String(props[control.value] ?? '').length}${countMax !== '' ? ` / ${countMax}` : ''}`, children: [] });
    }
    const shape = { ...n };
    if (shape.radius === undefined) shape.radius = master.radius;
    if (shape.radii === undefined) shape.radii = master.radii;
    const customDash = shape.strokeDash !== undefined || shape.strokeGap !== undefined || shape.strokeStyle === 'dot';
    const hasStroke = strokeIsOn(shape);
    const strategy = hasStroke ? strokeStrategyOf(shape) : 'host';
    const known = new Set((scope.variables.items || []).map(i => i.id));
    const bound = hasStroke && shape.vars?.stroke != null && known.has(shape.vars.stroke);
    let strokeEl = null;
    if (strategy === 'overlay' && hasStroke) strokeEl = customDash ? strokeOverlayEl(shape) : borderOverlayEl(shape, borderStyleOf(template, modes));
    if (strokeEl) children.push(strokeEl);
    // The root is a flex row like the canvas auto layout frame (codegen emits the same rules as inline-flex; see displayRules).
    // The stroke overlay is absolutely positioned, so it is not one of the laid-out children.
    const style = { display: 'flex', ...placement(n, parent, scope.responsive), ...rootLayoutOf(master, children.length - (strokeEl ? 1 : 0)) };
    // The stroke overlay is placed on the button's box, so the box is a positioning context when it has a stroke.
    if (strategy === 'overlay') {
        // The host draws nothing: the overlay is the only drawer.
        Object.assign(style, { borderWidth: '0px', borderStyle: 'none', borderColor: 'transparent' });
        // The stroke overlay is placed on the button's box, so the box is a positioning context when it has a stroke.
        if (!style.position) style.position = 'relative';
    }
    else if (hasStroke && !bound) {
        // A literal stroke draws on the host, from the node paint. A bound stroke draws from the class rule alone.
        const hr = cornerRadii(shape);
        Object.assign(style, {
            borderWidth: `${svgNumber(strokeSideWidths(shape).t)}px`,
            borderStyle: borderStyleOf(template, modes) ?? 'solid',
            borderColor: colorWithAlpha(shape.stroke, shape.strokeOpacity),
            borderRadius: (shape.radius || hasRadii(shape)) ? (hr.every(v => v === hr[0]) ? `${svgNumber(hr[0])}px` : hr.map(v => `${svgNumber(v)}px`).join(' ')) : 'inherit',
        });
    }
    return { tag: template.element.tag, nodeId: n.id, attrs, style, children };
}

/**
 * A uniform solid stroke drawn over a box: a bordered layer that sits inside, centred on, or outside its edge, as the canvas draws
 * it. The corners are the box's own grown by the stroke, so they match in every mode; a dashed stroke has no border form (see strokeOverlayEl).
 * @param {any} n
 * @returns {Element}
 */
function borderOverlayEl(n, borderStyle = null) {
    const { t, r, b, l } = strokeSideWidths(n);
    const align = n.strokeAlign ?? 'center';
    const growOf = w => align === 'inside' ? 0 : align === 'center' ? w / 2 : w;
    const uniform = strokeSidesUniform(n);
    const grow = uniform ? growOf(t) : Math.max(growOf(t), growOf(r), growOf(b), growOf(l));
    const inset = uniform
        ? `${svgNumber(-grow)}px`
        : [t, r, b, l].map(w => `${svgNumber(-growOf(w))}px`).join(' ');
    const radii = cornerRadii(n).map(rad => rad > 0 ? Math.max(0, rad + grow) : 0);
    const borderRadius = (n.radius || hasRadii(n))
        ? (radii.every(v => v === radii[0]) ? `${svgNumber(radii[0])}px` : radii.map(v => `${svgNumber(v)}px`).join(' '))
        : 'inherit';
    const color = colorWithAlpha(n.stroke, n.strokeOpacity);
    const lineStyle = borderStyle ?? (n.strokeStyle === 'dash' ? 'dashed' : n.strokeStyle === 'dot' ? 'dotted' : 'solid');
    /** @type {Record<string, string>} */
    const style = {
        position: 'absolute',
        inset,
        boxSizing: 'border-box',
        background: 'transparent',
        pointerEvents: 'none',
        borderRadius,
    };
    if (uniform) {
        style.border = `${svgNumber(t)}px ${lineStyle} ${color}`;
    }
    else {
        for (const [side, w] of [['Top', t], ['Right', r], ['Bottom', b], ['Left', l]]) {
            style[`border${side}Width`] = `${svgNumber(w)}px`;
            style[`border${side}Style`] = w > 0 ? lineStyle : 'none';
            style[`border${side}Color`] = color;
        }
    }
    return { tag: 'div', attrs: {}, style, children: [] };
}

/**
 * The overlay drawing a box's stroke above its fill and its content, or null when it has no stroke. The overlay always spans the
 * box, so it follows hug and fill boxes; the SVG inside draws at the box size (see fluidStrokeOverlay).
 * @param {any} n
 * @returns {Element | null}
 */
function strokeOverlayEl(n) {
    const html = strokeOverlay(n, n.type === 'frame' && fluidStrokeOf(n));
    if (html === undefined) return null;
    return { tag: 'div', attrs: {}, style: { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%', pointerEvents: 'none' }, html, children: [] };
}

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
 * The overflow of a frame: the axes its scroll behaviour opens. Every other axis clips. A template instance has no scroll behaviour:
 * the validator refuses one, and Play ignores any it finds.
 * @param {any} n
 * @returns {Record<string, string>}
 */
function overflowOf(n) {
    const mode = n.isInstance ? 'none' : (n.prototype?.overflow ?? 'none');
    const scrollX = mode === 'horizontal' || mode === 'both', scrollY = mode === 'vertical' || mode === 'both';
    // `clip` (not `hidden`) so a centred stroke's outer half, which lies outside the box, is not cut; the margin is that half.
    const style = { overflowX: scrollX ? 'auto' : 'clip', overflowY: scrollY ? 'auto' : 'clip' };
    // The margin lets an overlay-drawn stroke's outer part show: a centred stroke's half, or a per-side outside stroke's widest side.
    const margin = centredStrokeHalf(n) || outsideOverlayMargin(n);
    if (margin) style.overflowClipMargin = `${margin}px`;
    return style;
}

/**
 * Half of a frame's centred stroke, the part that lies outside its box: the widest side's half. Zero for no stroke, or one not centred.
 * @param {any} n
 */
function centredStrokeHalf(n) {
    if (n.type !== 'frame' || !strokeIsOn(n) || (n.strokeAlign ?? 'center') !== 'center') return 0;
    const s = strokeSideWidths(n);
    return Math.max(s.t, s.r, s.b, s.l) / 2;
}

/**
 * The clip margin an overlay-drawn outside stroke needs: its widest side, so the part beyond the box still shows. Zero for no stroke,
 * for any other alignment, and for a uniform outside stroke, which is a CSS outline the clip does not cut.
 * @param {any} n
 */
function outsideOverlayMargin(n) {
    if (n.type !== 'frame' || !strokeIsOn(n) || (n.strokeAlign ?? 'center') !== 'outside' || strokeSidesUniform(n)) return 0;
    const s = strokeSideWidths(n);
    return Math.max(s.t, s.r, s.b, s.l);
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
function strokeOverlay(n, fluid = false) {
    if (!strokeIsOn(n)) return undefined;
    if (fluid) return fluidStrokeOverlay(n);
    return svgMarkup(n, `fill="none" ${svgStrokeAttrs(n, svgNumber, escapeAttr)}`);
}

/**
 * Whether a frame's stroke can be drawn to follow its box. A uniform stroke is one rectangle the box size drives; a per-side stroke
 * is one bar per side (see fluidSideBars). A uniform stroke needs one radius on every corner; anything else keeps the fixed overlay.
 * @param {any} n
 * @returns {boolean}
 */
function fluidStrokeOf(n) {
    if (!strokeIsOn(n)) return false;
    if (!strokeSidesUniform(n)) return true;
    const radii = hasRadii(n) ? n.radii : [n.radius || 0];
    return radii.every(v => (+v || 0) === (+radii[0] || 0));
}

/**
 * A frame stroke drawn at its box, not at the design size: the SVG fills the box (no viewBox, so lengths stay in px) and the
 * outline spans it in full, so the stroke sits on the box edges whatever the box size. An inside stroke is clipped to the
 * box, mirroring the fixed overlay's doubled-width stroke. A uniform outside stroke never reaches here: it is a CSS outline.
 * @param {any} n a frame with a fluid stroke (see fluidStrokeOf)
 * @returns {string}
 */
function fluidStrokeOverlay(n) {
    if (!strokeSidesUniform(n)) return fluidSideBars(n);
    const w = n.strokeWidth, f = svgNumber, e = escapeAttr;
    const prefix = `${String(n.id).replace(/[^A-Za-z0-9_-]/g, '_')}-`;
    // Raw, not design-clamped: the browser clamps against the box it draws. Lengths are px (no viewBox), so the stroke keeps its width.
    const rx = Math.max(0, +((hasRadii(n) ? n.radii[0] : n.radius) || 0));
    const rect = attrs => `<rect x="0" y="0" width="100%" height="100%" rx="${f(rx)}" ${attrs}/>`;
    const dash = strokeDashArray(n);
    const doubled = `fill="none" stroke="${e(n.stroke)}" stroke-opacity="${f(n.strokeOpacity ?? 1)}" stroke-width="${f(w * 2)}" stroke-linejoin="${n.strokeJoin || 'round'}" stroke-miterlimit="${f(strokeMiterLimit(n))}"${dash.length ? ` stroke-dasharray="${dash.map(f).join(' ')}"` : ''}`;
    if ((n.strokeAlign ?? 'center') === 'inside') {
        const stroked = rect(doubled);
        return `<svg width="100%" height="100%" overflow="visible" style="position:absolute;left:0;top:0;display:block;overflow:visible"><clipPath id="${prefix}k">${rect('')}</clipPath><g clip-path="url(#${prefix}k)">${stroked}</g></svg>`;
    }
    if ((n.strokeAlign ?? 'center') === 'outside') {
        // A doubled stroke masked to the outside, mirroring the fixed overlay's mask; a frame never reaches here (it is an outline).
        const stroked = rect(doubled);
        return `<svg width="100%" height="100%" overflow="visible" style="position:absolute;left:0;top:0;display:block;overflow:visible"><mask id="${prefix}m" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/>${rect('fill="#000"')}</mask><g mask="url(#${prefix}m)">${stroked}</g></svg>`;
    }
    return `<svg width="100%" height="100%" overflow="visible" style="position:absolute;left:0;top:0;display:block;overflow:visible">${rect(`fill="none" ${svgStrokeAttrs(n, f, e)}`)}</svg>`;
}

/**
 * A per-side frame stroke drawn at its box: one bar per nonzero side, placed over the box edges the way the canvas draws its fillRect
 * bars (see paintStroke). Lengths span the box in full, so the bars sit on the edges whatever the box size; widths stay in px, so the
 * stroke keeps its widths. A rounded inside stroke is clipped to the box, as the canvas clips it to the path; other alignments draw
 * their bars whole, as the canvas does.
 * @param {any} n a frame with a per-side stroke
 * @returns {string}
 */
function fluidSideBars(n) {
    const f = svgNumber, e = escapeAttr;
    const prefix = `${String(n.id).replace(/[^A-Za-z0-9_-]/g, '_')}-`;
    const { t, r, b, l } = strokeSideWidths(n);
    const align = n.strokeAlign ?? 'center';
    const off = v => align === 'inside' ? 0 : align === 'center' ? v / 2 : v;
    const fl = `fill="${e(n.stroke)}" fill-opacity="${f(n.strokeOpacity ?? 1)}"`;
    const rx = Math.max(0, +((hasRadii(n) ? n.radii[0] : n.radius) || 0));
    const bar = (key, left, top, width, height) => {
        const clip = align === 'inside' && rx > 0 ? `<clipPath id="${prefix}s-${key}"><rect x="0" y="0" width="100%" height="100%" rx="${f(rx)}"/></clipPath>` : '';
        const rect = `<rect x="0" y="0" width="100%" height="100%" ${fl}/>`;
        return `<svg style="position:absolute;left:${left};top:${top};width:${width};height:${height};display:block;overflow:visible">${clip}${clip ? `<g clip-path="url(#${prefix}s-${key})">${rect}</g>` : rect}</svg>`;
    };
    const px = v => `${f(v)}px`, span = extra => extra > 0 ? `calc(100% + ${f(extra)}px)` : '100%', at = v => v > 0 ? `-${px(v)}` : '0px';
    const edge = v => v > 0 ? `calc(100% - ${px(v)})` : '100%';
    const bars = [];
    if (t > 0) bars.push(bar('t', at(off(l)), at(off(t)), span(off(l) + off(r)), px(t)));
    if (b > 0) bars.push(bar('b', at(off(l)), edge(b - off(b)), span(off(l) + off(r)), px(b)));
    const sideTop = t > 0 && off(t) > 0 ? `-${px(off(t))}` : '0px';
    const sideHeight = span((t > 0 ? off(t) : 0) + (b > 0 ? off(b) : 0));
    if (l > 0) bars.push(bar('l', at(off(l)), sideTop, px(l), sideHeight));
    if (r > 0) bars.push(bar('r', edge(r - off(r)), sideTop, px(r), sideHeight));
    return bars.join('');
}

/**
 * The part of a uniform outside frame stroke that lies outside its box, as a CSS outline. An overlay inside the frame would only draw
 * the part the frame clips; an outline is not cut by the frame's own clip. A per-side outside stroke has no outline form: it is an
 * overlay with a clip margin instead (see fluidSideBars and outsideOverlayMargin).
 * @param {any} n
 * @returns {string | undefined}
 */
function frameOutlineOf(n) {
    if (n.type !== 'frame' || !strokeIsOn(n) || n.strokeAlign !== 'outside' || !strokeSidesUniform(n)) return undefined;
    return `${strokeSideWidths(n).t}px solid ${colorWithAlpha(n.stroke, n.strokeOpacity)}`;
}

/**
 * An outline drawn as SVG: an arc, a line or a vector path, with its fill and its stroke.
 * @param {any} n
 * @param {any} scope
 * @returns {string}
 * @param {boolean} [icon] true inside a managed icon slot (see renderNode)
 */
function vectorMarkup(n, scope, icon = false) {
    const fill = n.type === 'line' ? 'fill="none"' : fillAttrs(n, scope, icon);
    return svgMarkup(n, `${fill} ${svgStrokeAttrs(n, svgNumber, escapeAttr, icon)}`);
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
 * @param {boolean} [icon] true inside a managed icon slot: a bound fill paints in the slot colour
 */
function fillAttrs(n, scope, icon = false) {
    const fills = getFills(n).filter(f => f.visible !== false);
    if (fills.length > 1) scope.unsupported.push({ nodeId: n.id, type: 'multiple fills on a vector layer' });
    const [first] = fills;
    if (!first) return 'fill="none"';
    if (first.type !== 'solid' || !first.color || first.color === 'none') {
        scope.unsupported.push({ nodeId: n.id, type: `${first.type} fill on a vector layer` });
        return 'fill="none"';
    }
    if (icon && n.vars?.['fills.0']) return `fill="currentColor" fill-opacity="${svgNumber(first.opacity ?? 1)}"`;
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
