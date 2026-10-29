// Generates scripts/fixtures/sample-app.midas ("Kopi Kita" mobile coffee ordering app)
// for general manual testing and phase-1 / phase-2 / diagnostics verification.
//
//   node scripts/make-sample-file.js [output.midas]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertBehaviorData, diagnoseDocument, managedBehavior } from '@midas/builder-core';
import { buttonModel } from './button-model.mjs';
const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = join(here, 'fixtures', 'sample-app.midas');

// ---------- Node defaults & helpers ----------
export const NODE_BASE = {
    rotation: 0,
    fills: solid('#0058CA'),
    stroke: '#000000',
    strokeWidth: 0,
    radius: 0,
    opacity: 1,
    visible: true,
    locked: false,
    clip: false,
    version: 0,
};

export const TEXT_DEFAULTS = {
    text: 'Text',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: 400,
    fontStyle: 'normal',
    lineHeight: 1.4,
    letterSpacing: 0,
    textAlign: 'left',
    textDecoration: 'none',
    textCase: 'none',
    direction: 'auto',
    fills: solid('#231815'),
    autoW: true,
};

function solidFills(fill) {
    return fill && fill !== 'none' ? [{ type: 'solid', color: fill, opacity: 1, visible: true }] : [];
}

export function frameNode(id, name, props = {}) {
    const fill = props.fill ?? '#FFFFFF';
    return {
        ...NODE_BASE,
        id,
        type: 'frame',
        name,
        parentId: null,
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        clip: true,
        fill,
        fills: props.fills ?? solidFills(fill),
        ...props,
    };
}

export function autoFrameNode(id, name, layout = 'vertical', props = {}) {
    const pad = props.padding ?? 16;
    return frameNode(id, name, {
        layout,
        gap: props.gap ?? 12,
        gapAuto: false,
        padding: pad,
        padT: props.padT ?? pad,
        padR: props.padR ?? pad,
        padB: props.padB ?? pad,
        padL: props.padL ?? pad,
        layoutWrap: false,
         primaryAlign: props.primaryAlign ?? 'start',
        counterAlign: props.counterAlign ?? 'start',
        layoutSizingH: props.layoutSizingH ?? 'fixed',
        layoutSizingV: props.layoutSizingV ?? 'hug',
        ...props,
    });
}

export function textNode(id, name, textContent, props = {}) {
    const fs = props.fontSize ?? 14;
    const lh = props.lineHeight ?? 1.4;
    const fw = props.fontWeight ?? 400;
    const estW = props.w ?? Math.max(24, Math.ceil(String(textContent).length * fs * (fw >= 600 ? 0.6 : 0.55)));
    const estH = props.h ?? Math.ceil(fs * lh);
    return {
        ...NODE_BASE,
        ...TEXT_DEFAULTS,
        id,
        type: 'text',
        name,
        parentId: null,
        x: 0,
        y: 0,
        w: estW,
        h: estH,
        text: String(textContent),
        fontSize: fs,
        fontWeight: fw,
        lineHeight: lh,
        ...props,
    };
}

export function rectNode(id, name, props = {}) {
    const fill = props.fill ?? '#EADACA';
    return {
        ...NODE_BASE,
        id,
        type: 'rect',
        name,
        parentId: null,
        x: 0,
        y: 0,
        w: 64,
        h: 64,
        radius: 8,
        fill,
        fills: props.fills ?? solidFills(fill),
        ...props,
    };
}

export function imagePlaceholderNode(id, name, props = {}) {
    return rectNode(id, name, {
        fills: solid('#E5DDD5'),
        radius: 10,
        fills: [{ type: 'image', image: null, mode: 'fill', scale: 1, opacity: 1, visible: true }],
        ...props,
    });
}

export function ellipseNode(id, name, props = {}) {
    const fill = props.fill ?? '#C87D4B';
    return {
        ...NODE_BASE,
        id,
        type: 'ellipse',
        name,
        parentId: null,
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        fill,
        fills: props.fills ?? solidFills(fill),
        ...props,
    };
}

export function groupNode(id, name, props = {}) {
    return {
        ...NODE_BASE,
        id,
        type: 'group',
        name,
        parentId: null,
        x: 0,
        y: 0,
        w: 48,
        h: 24,
        fills: solid('none'),
        fills: [],
        ...props,
    };
}

// ---------- Variable collections ----------
const COL_VARIANT_ID = 'col-variant';
const COL_COLOR_ID = 'col-color';
const COL_SIZE_ID = 'col-size';
const COL_THEME_ID = 'col-theme';

export const MODES = {
    variant: {
        primary: 'mode-primary',
        secondary: 'mode-secondary',
        danger: 'mode-danger',
    },
    size: {
        sm: 'mode-sm',
        md: 'mode-md',
        lg: 'mode-lg',
    },
    theme: {
        light: 'mode-kopi-light',
    },
};

/** The Kopi Kita look names, each as the Variant and the Color of the shared Button model. */
const LOOKS = {
    [MODES.variant.primary]: { variant: 'solid', color: 'primary' },
    [MODES.variant.secondary]: { variant: 'outlined', color: 'primary' },
    [MODES.variant.danger]: { variant: 'solid', color: 'danger' },
};

/** The brand colours of the Color collection: the roast accent, its cream tint, and the danger red. */
const BRAND_PALETTE = {
    primary: { accent: '#6F4E37', accentHover: '#5C3E2A', accentActive: '#4A3121', tint: '#F5EBE1', tintHover: '#EADACA', tintActive: '#DEC8B4', text: '#6F4E37', textHover: '#5C3E2A', textActive: '#4A3121', solid: '#6F4E37', solidHover: '#5C3E2A', solidActive: '#4A3121', solidText: '#FFFFFF', outline: '#6F4E3733' },
    danger: { accent: '#DC2626', accentHover: '#B91C1C', accentActive: '#991B1B', tint: '#FEE2E2', tintHover: '#FECACA', tintActive: '#FCA5A5', text: '#DC2626', textHover: '#B91C1C', textActive: '#991B1B', solid: '#DC2626', solidHover: '#B91C1C', solidActive: '#991B1B', solidText: '#FFFFFF', outline: '#DC262633' },
};

function buildVariables() {
    const sMode = (sm, md, lg) => ({
        [MODES.size.sm]: sm,
        [MODES.size.md]: md,
        [MODES.size.lg]: lg,
    });
    const tMode = val => ({ [MODES.theme.light]: val });
    const button = buttonModel({
        ids: { variant: COL_VARIANT_ID, color: COL_COLOR_ID, size: COL_SIZE_ID },
        variantModes: ['solid', 'outlined'],
        colors: ['primary', 'danger'],
        palette: BRAND_PALETTE,
        sizeModes: [{ id: MODES.size.sm, name: 'Small' }, { id: MODES.size.md, name: 'Medium' }, { id: MODES.size.lg, name: 'Large' }],
        sizeValues: {
            height: sMode(30, 40, 48), fontSize: sMode(12, 14, 16), lineHeight: sMode((12 + 8) / 12, (14 + 8) / 14, (16 + 8) / 16), paddingX: sMode(12, 16, 20),
            paddingY: sMode(6, 10, 14), gap: sMode(6, 8, 10), radius: sMode(6, 8, 10), iconSize: sMode(14, 16, 18),
        },
    });
    const collections = [
        ...button.collections,
        {
            id: COL_THEME_ID,
            name: 'Colors & Typography',
            modes: [{ id: MODES.theme.light, name: 'Default' }],
            groups: ['color', 'typography'],
        },
    ];
    const items = [
        ...button.items,
        // Kopi Kita tokens (theme): the page colours and the type scale.
        { id: 'var-col-bg-app', collectionId: COL_THEME_ID, name: 'color/bg-app', type: 'color', values: tMode('#FAF6F2'), description: 'App warm cream background', hidden: false },
        { id: 'var-col-bg-card', collectionId: COL_THEME_ID, name: 'color/bg-card', type: 'color', values: tMode('#FFFFFF'), description: 'Card surface color', hidden: false },
        { id: 'var-col-bg-banner', collectionId: COL_THEME_ID, name: 'color/bg-banner', type: 'color', values: tMode('#3E2723'), description: 'Dark espresso banner fill', hidden: false },
        { id: 'var-col-brand', collectionId: COL_THEME_ID, name: 'color/brand-roast', type: 'color', values: tMode('#6F4E37'), description: 'Primary coffee roast accent', hidden: false },
        { id: 'var-col-caramel', collectionId: COL_THEME_ID, name: 'color/brand-caramel', type: 'color', values: tMode('#C87D4B'), description: 'Warm caramel accent', hidden: false },
        { id: 'var-col-text-main', collectionId: COL_THEME_ID, name: 'color/text-primary', type: 'color', values: tMode('#231815'), description: 'Primary espresso ink', hidden: false },
        { id: 'var-col-text-sub', collectionId: COL_THEME_ID, name: 'color/text-secondary', type: 'color', values: tMode('#6D5D53'), description: 'Secondary muted roast text', hidden: false },
        { id: 'var-col-border', collectionId: COL_THEME_ID, name: 'color/border-subtle', type: 'color', values: tMode('#E6DCD2'), description: 'Card border stroke', hidden: false },
        { id: 'var-typ-display', collectionId: COL_THEME_ID, name: 'typography/display-size', type: 'number', values: tMode(24), description: 'Hero heading font size', hidden: false },
        { id: 'var-typ-title', collectionId: COL_THEME_ID, name: 'typography/title-size', type: 'number', values: tMode(18), description: 'Section title font size', hidden: false },
        { id: 'var-typ-body', collectionId: COL_THEME_ID, name: 'typography/body-size', type: 'number', values: tMode(14), description: 'Body copy font size', hidden: false },
        { id: 'var-typ-caption', collectionId: COL_THEME_ID, name: 'typography/caption-size', type: 'number', values: tMode(12), description: 'Caption and badge font size', hidden: false },
    ];
    return { collections, items };
}

// ---------- Button master & instance builders ----------
const MASTER_BUTTON_ID = 'comp-button';
const MASTER_LABEL_ID = 'comp-button-label';

// The Button variables the master and its instances are bound to (Bind tokens). Instances copy these, as sync does.
const BUTTON_ROOT_VARS = { fill: 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' };
const BUTTON_LABEL_VARS = { fill: 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' };

function buildButtonMaster(x = 440, y = 40) {
    const master = autoFrameNode(MASTER_BUTTON_ID, 'Button', 'horizontal', {
        x,
        y,
        w: 112,
        h: 40,
        padding: 16,
        padT: 10,
        padR: 16,
        padB: 10,
        padL: 16,
        gap: 8,
        radius: 8,
        fills: solid('#6F4E37'),
        primaryAlign: 'center',
        counterAlign: 'center',
        layoutSizingH: 'hug',
        layoutSizingV: 'hug',
        component: true,
        isInstance: false,
        vars: BUTTON_ROOT_VARS,
        behavior: {
            version: 2,
            templateId: 'button',
            variables: {
                variant: COL_VARIANT_ID,
                color: COL_COLOR_ID,
                size: COL_SIZE_ID,
            },
        },
    });
    const label = textNode(MASTER_LABEL_ID, 'Label', 'Button', {
        parentId: MASTER_BUTTON_ID,
        x: 16,
        y: 10,
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.4,
        fills: solid('#FFFFFF'),
    });
    label.vars = BUTTON_LABEL_VARS;
    return [master, label];
}

const VARIANT_COLORS = {
    [MODES.variant.primary]: { bg: '#6F4E37', fg: '#FFFFFF', border: '#6F4E37' },
    [MODES.variant.secondary]: { bg: '#F5EBE1', fg: '#6F4E37', border: '#6F4E37' },
    [MODES.variant.danger]: { bg: '#DC2626', fg: '#FFFFFF', border: '#DC2626' },
};
const SIZE_METRICS = {
    [MODES.size.sm]: { fs: 12, px: 12, py: 6, gap: 6, radius: 6, h: 30 },
    [MODES.size.md]: { fs: 14, px: 16, py: 10, gap: 8, radius: 8, h: 40 },
    [MODES.size.lg]: { fs: 16, px: 20, py: 14, gap: 10, radius: 10, h: 48 },
};

/**
 * Builds a Button instance and its child layers (including managed iconStart / iconEnd when hasIcon is true).
 */
function buildButtonInstance(id, name, parentId, opts = {}) {
    const variant = opts.variant ?? MODES.variant.primary;
    const size = opts.size ?? MODES.size.md;
    const labelText = opts.label ?? 'Button';
    const hasIcon = !!opts.hasIcon;
    const placement = opts.iconPlacement ?? 'start';
    const loading = !!opts.loading;
    const disabled = !!opts.disabled;
    const block = !!opts.block;

    const colors = VARIANT_COLORS[variant] || VARIANT_COLORS[MODES.variant.primary];
    const look = LOOKS[variant];
    const metrics = SIZE_METRICS[size] || SIZE_METRICS[MODES.size.md];

    const behaviorProps = {
        label: labelText,
        hasIcon,
        ...(hasIcon ? { iconPlacement: placement } : {}),
        loading,
        disabled,
        block,
    };

    const textW = Math.max(28, Math.ceil(labelText.length * metrics.fs * 0.6));
    const estW = opts.w ?? (block ? 358 : metrics.px * 2 + textW + (hasIcon ? 16 + metrics.gap : 0));

    const inst = autoFrameNode(id, name, 'horizontal', {
        parentId,
        x: opts.x ?? 0,
        y: opts.y ?? 0,
        w: estW,
        h: metrics.h,
        padding: metrics.px,
        padT: metrics.py,
        padR: metrics.px,
        padB: metrics.py,
        padL: metrics.px,
        gap: metrics.gap,
        radius: metrics.radius,
        fills: solid(disabled ? '#C8B7A6' : colors.bg),
        stroke: colors.border,
        strokeWidth: variant === MODES.variant.secondary ? 1 : 0,
        primaryAlign: 'center',
        counterAlign: 'center',
        layoutSizingH: block ? 'fill' : 'hug',
        layoutSizingV: 'hug',
        isInstance: true,
        varModes: { [COL_VARIANT_ID]: look.variant, [COL_COLOR_ID]: look.color, [COL_SIZE_ID]: size },
        sourceId: MASTER_BUTTON_ID,
        overrides: { fill: true, radius: true, w: true, h: true },
        vars: BUTTON_ROOT_VARS,
        behavior: {
            version: 2,
            props: behaviorProps,
        },
    });

    const labelNode = textNode(`${id}-label`, 'Label', labelText, {
        parentId: id,
        sourceId: MASTER_LABEL_ID,
        x: metrics.px + (hasIcon && placement === 'start' ? 16 + metrics.gap : 0),
        y: metrics.py,
        w: textW,
        h: Math.ceil(metrics.fs * 1.4),
        fontSize: metrics.fs,
        fontWeight: 600,
        lineHeight: 1.4,
        fills: solid(colors.fg),
        overrides: { text: true, fill: true, fontSize: true, w: true },
    });
    labelNode.vars = BUTTON_LABEL_VARS;

    if (!hasIcon) return [inst, labelNode];

    const slot = placement === 'end' ? 'iconEnd' : 'iconStart';
    const managedIcon = frameNode(`${id}-${slot}`, slot, {
        parentId: id,
        x: placement === 'start' ? metrics.px : metrics.px + textW + metrics.gap,
        y: Math.round((metrics.h - 16) / 2),
        w: 16,
        h: 16,
        radius: 4,
        fills: solid(colors.fg),
        clip: false,
        behavior: managedBehavior(slot),
    });

    return placement === 'start' ? [inst, managedIcon, labelNode] : [inst, labelNode, managedIcon];
}

// ---------- Shared screen chrome builders ----------
function buildScreenRoot(id, name) {
    return autoFrameNode(id, name, 'vertical', {
        parentId: null,
        x: 0,
        y: 0,
        w: 390,
        h: 844,
        padding: 16,
        padT: 16,
        padR: 16,
        padB: 16,
        padL: 16,
        gap: 14,
        fills: solid('#FAF6F2'),
        vars: { 'fills.0': 'var-col-bg-app' },
        layoutSizingH: 'fixed',
        layoutSizingV: 'fixed',
        clip: true,
    });
}

/**
 * Top header bar (auto-layout level 1) with nested title stack (level 2), status pill (level 3), avatar ellipse, and rating group.
 */
function buildHeaderBar(prefix, title, subtitle) {
    const out = [];
    const headerId = `${prefix}-header`;
    const leftId = `${prefix}-header-titles`;
    const pillId = `${prefix}-header-outlet-pill`;
    const rightId = `${prefix}-header-actions`;
    const grpId = `${prefix}-brand-badge-group`;

    out.push(
        autoFrameNode(headerId, 'Top Navigation Header', 'horizontal', {
            parentId: `${prefix}-screen`,
            w: 358,
            h: 56,
            padding: 8,
            padT: 6,
            padR: 8,
            padB: 6,
            padL: 8,
            gap: 10,
            radius: 12,
            fills: solid('#FFFFFF'),
            vars: { 'fills.0': 'var-col-bg-card' },
            primaryAlign: 'between',
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(leftId, 'Header Title Stack', 'vertical', {
            parentId: headerId,
            w: 220,
            h: 44,
            padding: 0,
            gap: 2,
            fills: solid('none'),
            layoutSizingH: 'hug',
            layoutSizingV: 'hug',
        }),
        textNode(`${prefix}-header-title`, 'Screen Title', title, {
            parentId: leftId,
            fontSize: 18,
            fontWeight: 700,
            fills: solid('#231815'),
            vars: { fill: 'var-col-text-main', fontSize: 'var-typ-title' },
        }),
        autoFrameNode(pillId, 'Outlet Status Pill', 'horizontal', {
            parentId: leftId,
            w: 160,
            h: 18,
            padding: 4,
            padT: 2,
            padR: 6,
            padB: 2,
            padL: 6,
            gap: 4,
            radius: 6,
            fills: solid('#F3ECE4'),
            counterAlign: 'center',
            layoutSizingH: 'hug',
            layoutSizingV: 'hug',
        }),
        rectNode(`${prefix}-status-dot`, 'Status Indicator Dot', {
            parentId: pillId,
            w: 6,
            h: 6,
            radius: 3,
            fills: solid('#15803D'),
        }),
        textNode(`${prefix}-header-subtitle`, 'Outlet Subtitle', subtitle, {
            parentId: pillId,
            fontSize: 11,
            fontWeight: 500,
            fills: solid('#6D5D53'),
            vars: { fill: 'var-col-text-sub' },
        }),
        autoFrameNode(rightId, 'Header Profile Cluster', 'horizontal', {
            parentId: headerId,
            w: 92,
            h: 36,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            counterAlign: 'center',
            layoutSizingH: 'hug',
            layoutSizingV: 'hug',
        }),
        groupNode(grpId, 'Bean Points Group', {
            parentId: rightId,
            w: 44,
            h: 24,
        }),
        rectNode(`${prefix}-points-bg`, 'Points Badge Background', {
            parentId: grpId,
            x: 0,
            y: 0,
            w: 44,
            h: 24,
            radius: 6,
            fills: solid('#EADACA'),
        }),
        textNode(`${prefix}-points-label`, 'Points Count Text', '240pt', {
            parentId: grpId,
            x: 6,
            y: 4,
            fontSize: 11,
            fontWeight: 600,
            fills: solid('#6F4E37'),
            vars: { fill: 'var-col-brand' },
        }),
        ellipseNode(`${prefix}-avatar`, 'Member Avatar', {
            parentId: rightId,
            w: 32,
            h: 32,
            fills: solid('#C87D4B'),
            vars: { 'fills.0': 'var-col-caramel' },
        }),
    );
    return out;
}

/**
 * Non-auto-layout promo banner frame containing positioned children (exercises non-auto-layout container selection).
 */
function buildFreeformBanner(prefix, badgeText, headline, caption) {
    const bannerId = `${prefix}-promo-canvas`;
    return [
        frameNode(bannerId, 'Promo Spotlight Banner', {
            parentId: `${prefix}-screen`,
            w: 358,
            h: 92,
            radius: 14,
            fills: solid('#3E2723'),
            vars: { 'fills.0': 'var-col-bg-banner' },
            layoutSizingH: 'fill',
            layoutSizingV: 'fixed',
        }),
        imagePlaceholderNode(`${prefix}-promo-photo`, 'Roastery Photo Placeholder', {
            parentId: bannerId,
            x: 254,
            y: 10,
            w: 92,
            h: 72,
            radius: 10,
            layoutPositioning: 'absolute',
        }),
        rectNode(`${prefix}-promo-pill`, 'Promo Tag Background', {
            parentId: bannerId,
            x: 14,
            y: 12,
            w: 88,
            h: 20,
            radius: 6,
            fills: solid('#C87D4B'),
            vars: { 'fills.0': 'var-col-caramel' },
            layoutPositioning: 'absolute',
        }),
        textNode(`${prefix}-promo-badge`, 'Promo Tag Label', badgeText, {
            parentId: bannerId,
            x: 20,
            y: 14,
            fontSize: 11,
            fontWeight: 600,
            fills: solid('#FFFFFF'),
            layoutPositioning: 'absolute',
        }),
        textNode(`${prefix}-promo-headline`, 'Promo Headline', headline, {
            parentId: bannerId,
            x: 14,
            y: 38,
            fontSize: 16,
            fontWeight: 700,
            fills: solid('#FFFFFF'),
            layoutPositioning: 'absolute',
        }),
        textNode(`${prefix}-promo-caption`, 'Promo Caption', caption, {
            parentId: bannerId,
            x: 14,
            y: 62,
            fontSize: 12,
            fontWeight: 400,
            fills: solid('#EADACA'),
            vars: { fontSize: 'var-typ-caption' },
            layoutPositioning: 'absolute',
        }),
    ];
}

/**
 * Bottom navigation tab bar (level 1 -> level 2 tab items).
 */
function buildBottomTabBar(prefix, activeTab) {
    const barId = `${prefix}-tab-bar`;
    const out = [
        autoFrameNode(barId, 'Bottom Tab Bar', 'horizontal', {
            parentId: `${prefix}-screen`,
            w: 358,
            h: 52,
            padding: 8,
            padT: 8,
            padR: 12,
            padB: 8,
            padL: 12,
            gap: 8,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            primaryAlign: 'between',
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
    ];
    for (const tab of ['Home', 'Menu', 'Cart', 'Profile']) {
        const isCurrent = tab === activeTab;
        const tabId = `${prefix}-tab-${tab.toLowerCase()}`;
        out.push(
            autoFrameNode(tabId, `Tab Item · ${tab}`, 'vertical', {
                parentId: barId,
                w: 74,
                h: 36,
                padding: 4,
                gap: 2,
                radius: 8,
                fills: solid(isCurrent ? '#F3ECE4' : 'none'),
                primaryAlign: 'center',
                counterAlign: 'center',
                layoutSizingH: 'hug',
                layoutSizingV: 'hug',
            }),
            textNode(`${tabId}-label`, `Tab Label · ${tab}`, tab, {
                parentId: tabId,
                fontSize: 12,
                fontWeight: isCurrent ? 700 : 500,
                fills: solid(isCurrent ? '#6F4E37' : '#6D5D53'),
            }),
        );
    }
    return out;
}

// ---------- Page 1: Login ----------
function buildLoginPage() {
    const p = 'login';
    const cardId = `${p}-form-card`;
    const fieldsId = `${p}-fields-stack`;
    const emailRowId = `${p}-email-field`;
    const emailInnerId = `${p}-email-input-row`;
    const actionsId = `${p}-actions-stack`;

    return [
        buildScreenRoot(`${p}-screen`, 'Login Screen'),
        ...buildHeaderBar(p, 'Kopi Kita', 'Senopati Flagship'),
        ...buildFreeformBanner(p, 'MEMBER PERKS', 'Morning Brew 20% Off', 'Sign in to claim your daily voucher'),
        autoFrameNode(cardId, 'Sign In Card', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 360,
            padding: 16,
            gap: 12,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-welcome-heading`, 'Welcome Heading', 'Welcome back, coffee lover', {
            parentId: cardId,
            fontSize: 24,
            fontWeight: 700,
            fills: solid('#231815'),
        }),
        textNode(`${p}-welcome-body`, 'Welcome Description', 'Enter your phone or email to order ahead and skip the queue.', {
            parentId: cardId,
            fontSize: 14,
            fontWeight: 400,
            fills: solid('#6D5D53'),
        }),
        autoFrameNode(fieldsId, 'Credential Fields Stack', 'vertical', {
            parentId: cardId,
            w: 326,
            h: 110,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(emailRowId, 'Email Input Container', 'vertical', {
            parentId: fieldsId,
            w: 326,
            h: 58,
            padding: 10,
            gap: 4,
            radius: 10,
            fills: solid('#FAF6F2'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-email-caption`, 'Email Field Label', 'Phone or Email', {
            parentId: emailRowId,
            fontSize: 11,
            fontWeight: 600,
            fills: solid('#6D5D53'),
        }),
        autoFrameNode(emailInnerId, 'Email Value Row', 'horizontal', {
            parentId: emailRowId,
            w: 306,
            h: 22,
            padding: 0,
            gap: 6,
            fills: solid('none'),
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        rectNode(`${p}-email-icon-box`, 'Phone Prefix Badge', {
            parentId: emailInnerId,
            w: 28,
            h: 18,
            radius: 4,
            fills: solid('#EADACA'),
        }),
        textNode(`${p}-email-value`, 'Email Input Value', 'nadia.putri@kopikita.id', {
            parentId: emailInnerId,
            fontSize: 14,
            fontWeight: 500,
            fills: solid('#231815'),
        }),
        autoFrameNode(actionsId, 'Login Buttons Stack', 'vertical', {
            parentId: cardId,
            w: 326,
            h: 96,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-signin`, 'Sign In Button', actionsId, {
            variant: MODES.variant.primary,
            size: MODES.size.lg,
            label: 'Sign In to Kopi Kita',
            hasIcon: true,
            iconPlacement: 'end',
            block: true,
        }),
        ...buildButtonInstance(`${p}-btn-sso`, 'Continue with Passkey Button', actionsId, {
            variant: MODES.variant.secondary,
            size: MODES.size.md,
            label: 'Continue with Passkey',
            hasIcon: true,
            iconPlacement: 'start',
            block: true,
        }),
        ...buildBottomTabBar(p, 'Profile'),
    ];
}

// ---------- Page 2: Home ----------
function buildHomePage() {
    const p = 'home';
    const featuredId = `${p}-featured-section`;
    const cardId = `${p}-signature-card`;
    const infoId = `${p}-signature-info`;
    const metaRowId = `${p}-signature-meta-row`;
    const quickActionsId = `${p}-quick-actions`;

    return [
        buildScreenRoot(`${p}-screen`, 'Home Screen'),
        ...buildHeaderBar(p, 'Good Morning, Nadia', 'Pickup in 8 mins · Senopati'),
        ...buildFreeformBanner(p, 'NEW HARVEST', 'Toraja Sapan Honey Process', 'Tasting notes: brown sugar, Mandarin orange'),
        autoFrameNode(featuredId, 'Featured Recommendations Section', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 280,
            padding: 12,
            gap: 10,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-section-heading`, 'Featured Section Heading', 'Barista Picks Today', {
            parentId: featuredId,
            fontSize: 16,
            fontWeight: 700,
            fills: solid('#231815'),
        }),
        autoFrameNode(cardId, 'Signature Drink Card', 'horizontal', {
            parentId: featuredId,
            w: 334,
            h: 112,
            padding: 10,
            gap: 12,
            radius: 12,
            fills: solid('#FAF6F2'),
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        imagePlaceholderNode(`${p}-drink-thumb`, 'Kopi Susu Photo Placeholder', {
            parentId: cardId,
            w: 76,
            h: 76,
            radius: 10,
        }),
        autoFrameNode(infoId, 'Signature Drink Details', 'vertical', {
            parentId: cardId,
            w: 220,
            h: 88,
            padding: 0,
            gap: 6,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-drink-title`, 'Signature Drink Name', 'Es Kopi Susu Gula Aren', {
            parentId: infoId,
            fontSize: 16,
            fontWeight: 600,
            fills: solid('#231815'),
        }),
        autoFrameNode(metaRowId, 'Drink Price and Action Row', 'horizontal', {
            parentId: infoId,
            w: 220,
            h: 34,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            primaryAlign: 'between',
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-drink-price`, 'Signature Drink Price', 'Rp 28.000', {
            parentId: metaRowId,
            fontSize: 14,
            fontWeight: 700,
            fills: solid('#6F4E37'),
        }),
        ...buildButtonInstance(`${p}-btn-order-now`, 'Quick Order Button', metaRowId, {
            variant: MODES.variant.primary,
            size: MODES.size.sm,
            label: 'Order Now',
            hasIcon: true,
            iconPlacement: 'start',
        }),
        autoFrameNode(quickActionsId, 'Home Voucher Action Row', 'horizontal', {
            parentId: featuredId,
            w: 334,
            h: 44,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            primaryAlign: 'between',
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-redeem`, 'Redeem Voucher Button', quickActionsId, {
            variant: MODES.variant.secondary,
            size: MODES.size.md,
            label: 'Redeem Voucher',
            hasIcon: false,
        }),
        ...buildButtonInstance(`${p}-btn-reorder`, 'Repeat Last Order Button', quickActionsId, {
            variant: MODES.variant.primary,
            size: MODES.size.md,
            label: 'Repeat Last Order',
            hasIcon: true,
            iconPlacement: 'end',
        }),
        ...buildBottomTabBar(p, 'Home'),
    ];
}

// ---------- Page 3: Menu (with 6 repeated card frames) ----------
const MENU_ITEMS = [
    { slug: 'aren', name: 'Kopi Susu Gula Aren', notes: 'Double ristretto, organic palm sugar, fresh milk', price: 'Rp 28.000', btnLabel: 'Add', variant: MODES.variant.primary, size: MODES.size.sm, hasIcon: true, iconPlacement: 'start', disabled: false },
    { slug: 'espresso', name: 'Espresso Single Origin', notes: ' Flores Bajawa dark chocolate & roasted hazelnut', price: 'Rp 22.000', btnLabel: 'Add', variant: MODES.variant.primary, size: MODES.size.sm, hasIcon: false, disabled: false },
    { slug: 'matcha', name: 'Matcha Oat Latte', notes: 'Uji ceremonial grade matcha with barista oat milk', price: 'Rp 36.000', btnLabel: 'Customize', variant: MODES.variant.secondary, size: MODES.size.sm, hasIcon: true, iconPlacement: 'end', disabled: false },
    { slug: 'coldbrew', name: 'Cold Brew Citrus Tonic', notes: '18-hour steeped Arabica with calamansi zest', price: 'Rp 34.000', btnLabel: 'Add', variant: MODES.variant.primary, size: MODES.size.sm, hasIcon: true, iconPlacement: 'start', disabled: false },
    { slug: 'mocha', name: 'Mocha Pandan Signature', notes: 'House cacao ganache infused with pandan leaf', price: 'Rp 35.000', btnLabel: 'Add', variant: MODES.variant.secondary, size: MODES.size.sm, hasIcon: false, disabled: false },
    { slug: 'v60', name: 'Manual Brew V60 Aceh Gayo', notes: 'Filter pour-over · seasonal micro-lot (sold out)', price: 'Rp 38.000', btnLabel: 'Sold Out', variant: MODES.variant.secondary, size: MODES.size.sm, hasIcon: false, disabled: true },
];

function buildMenuPage() {
    const p = 'menu';
    const listId = `${p}-card-list`;
    const out = [
        buildScreenRoot(`${p}-screen`, 'Menu Screen'),
        ...buildHeaderBar(p, 'Full Coffee Menu', '6 handcrafted beverages'),
        ...buildFreeformBanner(p, 'SEASONAL', 'Single Origin Pour-Over Bar', 'Freshly roasted every Tuesday & Friday'),
        autoFrameNode(listId, 'Menu Card List', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 520,
            padding: 8,
            gap: 8,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
    ];

    for (const item of MENU_ITEMS) {
        const cardId = `${p}-card-${item.slug}`;
        const bodyId = `${cardId}-body`;
        const footerId = `${cardId}-footer`;
        out.push(
            autoFrameNode(cardId, `Menu Card · ${item.name}`, 'horizontal', {
                parentId: listId,
                w: 342,
                h: 78,
                padding: 8,
                gap: 10,
                radius: 10,
                fills: solid('#FAF6F2'),
                counterAlign: 'center',
                layoutSizingH: 'fill',
                layoutSizingV: 'hug',
            }),
            imagePlaceholderNode(`${cardId}-thumb`, `${item.name} Thumbnail`, {
                parentId: cardId,
                w: 56,
                h: 56,
                radius: 8,
            }),
            autoFrameNode(bodyId, `${item.name} Info Column`, 'vertical', {
                parentId: cardId,
                w: 256,
                h: 62,
                padding: 0,
                gap: 4,
                fills: solid('none'),
                layoutSizingH: 'fill',
                layoutSizingV: 'hug',
            }),
            textNode(`${cardId}-title`, `${item.name} Title`, item.name, {
                parentId: bodyId,
                fontSize: 14,
                fontWeight: 600,
                fills: solid('#231815'),
            }),
            textNode(`${cardId}-notes`, `${item.name} Tasting Notes`, item.notes, {
                parentId: bodyId,
                fontSize: 11,
                fontWeight: 400,
                fills: solid('#6D5D53'),
            }),
            autoFrameNode(footerId, `${item.name} Price Bar`, 'horizontal', {
                parentId: bodyId,
                w: 256,
                h: 30,
                padding: 0,
                gap: 8,
                fills: solid('none'),
                primaryAlign: 'between',
                counterAlign: 'center',
                layoutSizingH: 'fill',
                layoutSizingV: 'hug',
            }),
            textNode(`${cardId}-price`, `${item.name} Price`, item.price, {
                parentId: footerId,
                fontSize: 12,
                fontWeight: 700,
                fills: solid('#6F4E37'),
            }),
            ...buildButtonInstance(`${cardId}-btn`, `${item.name} Action Button`, footerId, {
                variant: item.variant,
                size: item.size,
                label: item.btnLabel,
                hasIcon: item.hasIcon,
                iconPlacement: item.iconPlacement,
                disabled: item.disabled,
            }),
        );
    }

    out.push(...buildBottomTabBar(p, 'Menu'));
    return out;
}

// ---------- Page 4: Cart ----------
function buildCartPage() {
    const p = 'cart';
    const bagId = `${p}-order-summary-card`;
    const lineId = `${p}-line-item-row`;
    const lineMetaId = `${p}-line-item-meta`;
    const totalsId = `${p}-totals-box`;
    const footerActionsId = `${p}-checkout-actions`;

    return [
        buildScreenRoot(`${p}-screen`, 'Cart Screen'),
        ...buildHeaderBar(p, 'Your Coffee Bag', '2 items · Pickup at Counter'),
        ...buildFreeformBanner(p, 'FREE UPSIZE', 'Applied: Regular to Large', 'Member reward unlocked on this order'),
        autoFrameNode(bagId, 'Cart Order Summary Card', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 320,
            padding: 14,
            gap: 12,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(lineId, 'Cart Line Item · Kopi Susu', 'horizontal', {
            parentId: bagId,
            w: 330,
            h: 68,
            padding: 8,
            gap: 10,
            radius: 10,
            fills: solid('#FAF6F2'),
            primaryAlign: 'between',
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(lineMetaId, 'Line Item Spec Stack', 'vertical', {
            parentId: lineId,
            w: 210,
            h: 48,
            padding: 0,
            gap: 2,
            fills: solid('none'),
            layoutSizingH: 'hug',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-item-title`, 'Cart Item Title', '2x Es Kopi Susu Gula Aren', {
            parentId: lineMetaId,
            fontSize: 14,
            fontWeight: 600,
            fills: solid('#231815'),
        }),
        textNode(`${p}-item-mods`, 'Cart Item Modifiers', 'Less ice · Oat milk · Extra shot', {
            parentId: lineMetaId,
            fontSize: 12,
            fontWeight: 400,
            fills: solid('#6D5D53'),
        }),
        textNode(`${p}-item-subtotal`, 'Cart Item Subtotal', 'Rp 64.000', {
            parentId: lineId,
            fontSize: 14,
            fontWeight: 700,
            fills: solid('#6F4E37'),
        }),
        autoFrameNode(totalsId, 'Payment Breakdown Box', 'vertical', {
            parentId: bagId,
            w: 330,
            h: 56,
            padding: 8,
            gap: 4,
            radius: 8,
            fills: solid('#F3ECE4'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-tax-row`, 'Tax and Service Label', 'PB1 10% included · Packaging Rp 4.000', {
            parentId: totalsId,
            fontSize: 12,
            fontWeight: 400,
            fills: solid('#6D5D53'),
        }),
        textNode(`${p}-grand-total`, 'Grand Total Amount', 'Total Payment: Rp 68.000', {
            parentId: totalsId,
            fontSize: 16,
            fontWeight: 700,
            fills: solid('#231815'),
        }),
        autoFrameNode(footerActionsId, 'Cart Action Buttons Row', 'vertical', {
            parentId: bagId,
            w: 330,
            h: 132,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-pay`, 'Pay with QRIS Button', footerActionsId, {
            variant: MODES.variant.primary,
            size: MODES.size.lg,
            label: 'Pay Now · Rp 68.000',
            hasIcon: true,
            iconPlacement: 'end',
            block: true,
        }),
        ...buildButtonInstance(`${p}-btn-syncing`, 'Syncing Promo Button', footerActionsId, {
            variant: MODES.variant.secondary,
            size: MODES.size.md,
            label: 'Verifying Voucher...',
            hasIcon: false,
            loading: true,
            block: true,
        }),
        ...buildButtonInstance(`${p}-btn-clear`, 'Clear Cart Danger Button', footerActionsId, {
            variant: MODES.variant.danger,
            size: MODES.size.sm,
            label: 'Remove All Items',
            hasIcon: true,
            iconPlacement: 'start',
        }),
        ...buildBottomTabBar(p, 'Cart'),
    ];
}

// ---------- Page 5: Profile ----------
function buildProfilePage() {
    const p = 'profile';
    const cardId = `${p}-member-card`;
    const tierRowId = `${p}-tier-row`;
    const tierDetailsId = `${p}-tier-details`;
    const actionsId = `${p}-account-actions`;

    return [
        buildScreenRoot(`${p}-screen`, 'Profile Screen'),
        ...buildHeaderBar(p, 'Nadia Putri', 'Gold Roast Member · Since 2024'),
        ...buildFreeformBanner(p, 'GOLD TIER', '240 Kopi Beans Collected', '60 beans away from a free bag of house blend'),
        autoFrameNode(cardId, 'Member Account Preferences Card', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 260,
            padding: 14,
            gap: 12,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(tierRowId, 'Favorite Outlet Row', 'horizontal', {
            parentId: cardId,
            w: 330,
            h: 64,
            padding: 10,
            gap: 10,
            radius: 10,
            fills: solid('#FAF6F2'),
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        autoFrameNode(tierDetailsId, 'Outlet Preference Stack', 'vertical', {
            parentId: tierRowId,
            w: 290,
            h: 44,
            padding: 0,
            gap: 2,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-pref-title`, 'Default Brew Preference Title', 'Default Milk: Oatside Barista Blend', {
            parentId: tierDetailsId,
            fontSize: 14,
            fontWeight: 600,
            fills: solid('#231815'),
        }),
        textNode(`${p}-pref-sub`, 'Default Sweetness Subtitle', 'Sweetness: 50% Gula Aren · Ice: Less Ice', {
            parentId: tierDetailsId,
            fontSize: 12,
            fontWeight: 400,
            fills: solid('#6D5D53'),
        }),
        autoFrameNode(actionsId, 'Profile Action Buttons', 'vertical', {
            parentId: cardId,
            w: 330,
            h: 96,
            padding: 0,
            gap: 8,
            fills: solid('none'),
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-edit`, 'Edit Taste Profile Button', actionsId, {
            variant: MODES.variant.secondary,
            size: MODES.size.md,
            label: 'Edit Taste Profile',
            hasIcon: true,
            iconPlacement: 'start',
            block: true,
        }),
        ...buildButtonInstance(`${p}-btn-signout`, 'Sign Out Button', actionsId, {
            variant: MODES.variant.danger,
            size: MODES.size.md,
            label: 'Sign Out of Device',
            hasIcon: true,
            iconPlacement: 'end',
            block: true,
        }),
        ...buildBottomTabBar(p, 'Profile'),
    ];
}

// ---------- Page 6: Components (arrives last in page order) ----------
function buildComponentsPage() {
    const p = 'components';
    const galleryId = `${p}-gallery-card`;
    const rowPrimaryId = `${p}-row-variants`;
    const rowStatesId = `${p}-row-states`;

    return [
        // Button master component (bound to Button template with Variant and Size collections)
        ...buildButtonMaster(430, 24),
        // Component Showcase 390x844 screen
        buildScreenRoot(`${p}-screen`, 'Components Showcase Screen'),
        ...buildHeaderBar(p, 'Kopi Kita UI Kit', 'Button Master & Token Matrix'),
        ...buildFreeformBanner(p, 'DESIGN SYSTEM', 'Button Behavior Contract', 'Variant (Primary, Secondary, Danger) × Size (S, M, L)'),
        autoFrameNode(galleryId, 'Button Variant Matrix Card', 'vertical', {
            parentId: `${p}-screen`,
            w: 358,
            h: 240,
            padding: 14,
            gap: 12,
            radius: 14,
            fills: solid('#FFFFFF'),
            stroke: '#E6DCD2',
            strokeWidth: 1,
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        textNode(`${p}-matrix-title`, 'Matrix Section Heading', 'Live Button Instances', {
            parentId: galleryId,
            fontSize: 16,
            fontWeight: 700,
            fills: solid('#231815'),
        }),
        autoFrameNode(rowPrimaryId, 'Variant Showcase Row', 'horizontal', {
            parentId: galleryId,
            w: 330,
            h: 52,
            padding: 4,
            gap: 8,
            fills: solid('none'),
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-primary-sm`, 'Primary Small Instance', rowPrimaryId, {
            variant: MODES.variant.primary,
            size: MODES.size.sm,
            label: 'Primary S',
            hasIcon: false,
        }),
        ...buildButtonInstance(`${p}-btn-secondary-md`, 'Secondary Medium Instance', rowPrimaryId, {
            variant: MODES.variant.secondary,
            size: MODES.size.md,
            label: 'Secondary M',
            hasIcon: true,
            iconPlacement: 'start',
        }),
        ...buildButtonInstance(`${p}-btn-danger-lg`, 'Danger Large Instance', rowPrimaryId, {
            variant: MODES.variant.danger,
            size: MODES.size.lg,
            label: 'Danger L',
            hasIcon: true,
            iconPlacement: 'end',
        }),
        autoFrameNode(rowStatesId, 'State Showcase Row', 'horizontal', {
            parentId: galleryId,
            w: 330,
            h: 48,
            padding: 4,
            gap: 8,
            fills: solid('none'),
            counterAlign: 'center',
            layoutSizingH: 'fill',
            layoutSizingV: 'hug',
        }),
        ...buildButtonInstance(`${p}-btn-loading`, 'Loading Instance', rowStatesId, {
            variant: MODES.variant.primary,
            size: MODES.size.md,
            label: 'Brewing...',
            loading: true,
            hasIcon: false,
        }),
        ...buildButtonInstance(`${p}-btn-disabled`, 'Disabled Instance', rowStatesId, {
            variant: MODES.variant.danger,
            size: MODES.size.md,
            label: 'Unavailable',
            disabled: true,
            hasIcon: false,
        }),
        ...buildBottomTabBar(p, 'Home'),
    ];
}

export function buildSampleApp() {
    const pages = [
        { id: 'page-login', name: 'Login', parentId: null, nodes: buildLoginPage() },
        { id: 'page-home', name: 'Home', parentId: null, nodes: buildHomePage() },
        { id: 'page-menu', name: 'Menu', parentId: null, nodes: buildMenuPage() },
        { id: 'page-cart', name: 'Cart', parentId: null, nodes: buildCartPage() },
        { id: 'page-profile', name: 'Profile', parentId: null, nodes: buildProfilePage() },
        { id: 'page-components', name: 'Components', parentId: null, nodes: buildComponentsPage() },
    ];

    const doc = {
        format: 'midas',
        version: 1,
        name: 'Kopi Kita',
        pageId: pages[0].id,
        pages,
        tokens: { colors: [], typography: [] },
        variables: buildVariables(),
        guideStyles: [],
        created: 1793159000000,
        assets: {},
    };

    assertBehaviorData(doc);
    const errors = diagnoseDocument(doc).filter(f => f.severity === 'error');
    if (errors.length) {
        throw new Error(`Sample app has diagnostics errors: ${errors.map(e => e.message).join('; ')}`);
    }

    return doc;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const outPath = process.argv[2] || DEFAULT_OUT;
    mkdirSync(dirname(outPath), { recursive: true });
    const doc = buildSampleApp();
    const json = JSON.stringify(doc, null, 2);
    writeFileSync(outPath, json);
    const totalNodes = doc.pages.reduce((sum, p) => sum + p.nodes.length, 0);
    const instances = doc.pages.flatMap(p => p.nodes).filter(n => n.isInstance).length;
    console.log(
        `Wrote ${outPath} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB): ${doc.pages.length} pages, ${totalNodes} nodes, ${instances} Button instances, ${doc.variables.items.length} variables in ${doc.variables.collections.length} collections.`,
    );
}
