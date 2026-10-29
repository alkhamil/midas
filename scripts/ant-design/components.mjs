// Ant Design components, each defined as a table of tokens (look × state) plus a layer tree that only binds to variables.
import { addColl, addVar, b, ellipse, frame, text } from './lib.mjs';
import { defineComponent } from './define.mjs';

const S = n => `Semantic:${n}`;
const NONE = '#00000000';
/** Icon placeholder: a ring (real icons are vector assets; this keeps size, colour and visibility bound to variables). */
const icon = (name, size, stroke, extra = {}) => ellipse(name, { w: size, h: size, stroke, sw: 1.5, ...extra });

// ---------------------------------------------------------------- Button
// Structure of antd v5 Button (components/button/style): Color (default, primary, danger) holds the accent tokens of each colour,
// Variant (outlined, dashed, solid, filled, text, link) aliases into Color or Semantic, Size holds the metrics. Names are ours; the
// values are antd's (Semantic names are antd's global tokens, see antd-tokens.json).
const BUTTON_COLOR = {
    color: ['colorText', 'colorPrimary', 'colorError'],
    'color-hover': ['colorPrimaryHover', 'colorPrimaryHover', 'colorErrorHover'],
    'color-active': ['colorPrimaryActive', 'colorPrimaryActive', 'colorErrorActive'],
    'color-border': ['colorBorder', 'colorPrimary', 'colorError'],
    'color-border-hover': ['colorPrimaryHover', 'colorPrimaryHover', 'colorErrorBorderHover'],
    'color-border-active': ['colorPrimaryActive', 'colorPrimaryActive', 'colorErrorActive'],
    'color-bg': ['colorFillTertiary', 'colorPrimaryBg', 'colorErrorBg'],
    'color-bg-hover': ['colorFillSecondary', 'colorPrimaryBgHover', 'colorErrorBgFilledHover'],
    'color-bg-active': ['colorFill', 'colorPrimaryBorder', 'colorErrorBgActive'],
    'color-text': ['colorText', 'colorPrimaryText', 'colorError'],
    'color-text-hover': ['colorText', 'colorPrimaryTextHover', 'colorErrorHover'],
    'color-text-active': ['colorText', 'colorPrimaryTextActive', 'colorErrorActive'],
    'color-text-bg-hover': ['colorFillTertiary', 'colorPrimaryBg', 'colorErrorBg'],
    'color-text-bg-active': ['colorBgTextActive', 'colorPrimaryBorder', 'colorErrorBgActive'],
    'color-solid': ['colorBgSolid', 'colorPrimary', 'colorError'],
    'color-solid-hover': ['colorBgSolidHover', 'colorPrimaryHover', 'colorErrorHover'],
    'color-solid-active': ['colorBgSolidActive', 'colorPrimaryActive', 'colorErrorActive'],
    'color-solid-text': ['solidTextColor', 'colorTextLightSolid', 'colorTextLightSolid'],
};
// Variant values per mode: `s:` a Semantic token, `c:` a Color token, or `transparent`.
const BUTTON_VARIANT_MODES = ['outlined', 'dashed', 'solid', 'filled', 'text', 'link'];
const OUTLINED = {
    bg: 's:colorBgContainer', fg: 'c:color', border: 'c:color-border',
    'bg-hover': 's:colorBgContainer', 'fg-hover': 'c:color-hover', 'border-hover': 'c:color-border-hover',
    'bg-active': 's:colorBgContainer', 'fg-active': 'c:color-active', 'border-active': 'c:color-border-active',
    'bg-disabled': 's:colorBgContainerDisabled', 'fg-disabled': 's:colorTextDisabled', 'border-focus': 'c:color-border',
};
const SOLID = {
    bg: 'c:color-solid', fg: 'c:color-solid-text', border: 'transparent',
    'bg-hover': 'c:color-solid-hover', 'fg-hover': 'c:color-solid-text', 'border-hover': 'transparent',
    'bg-active': 'c:color-solid-active', 'fg-active': 'c:color-solid-text', 'border-active': 'transparent',
    'bg-disabled': 's:colorBgContainerDisabled', 'fg-disabled': 's:colorTextDisabled', 'border-focus': 'c:color-border',
};
const FILLED = {
    bg: 'c:color-bg', fg: 'c:color', border: 'transparent',
    'bg-hover': 'c:color-bg-hover', 'fg-hover': 'c:color', 'border-hover': 'transparent',
    'bg-active': 'c:color-bg-active', 'fg-active': 'c:color', 'border-active': 'transparent',
    'bg-disabled': 's:colorBgContainerDisabled', 'fg-disabled': 's:colorTextDisabled', 'border-focus': 'c:color-border',
};
const TEXT = {
    bg: 'transparent', fg: 'c:color-text', border: 'transparent',
    'bg-hover': 'c:color-text-bg-hover', 'fg-hover': 'c:color-text-hover', 'border-hover': 'transparent',
    'bg-active': 'c:color-text-bg-active', 'fg-active': 'c:color-text-active', 'border-active': 'transparent',
    'bg-disabled': 'transparent', 'fg-disabled': 's:colorTextDisabled', 'border-focus': 'c:color-border',
};
const LINK = { ...TEXT, 'bg-hover': 'transparent', 'bg-active': 'transparent' };
const BUTTON_VARIANT = { outlined: OUTLINED, dashed: OUTLINED, solid: SOLID, filled: FILLED, text: TEXT, link: LINK };
/** A Variant value in the library: a Color or Semantic reference, or a transparent colour. */
const buttonValue = v => (v === 'transparent' ? NONE : v.startsWith('c:') ? { ref: `Color/button/${v.slice(2)}` } : { ref: `Semantic/${v.slice(2)}` });
function buttonCollections() {
    addColl('Color', ['default', 'primary', 'danger']);
    for (const [token, values] of Object.entries(BUTTON_COLOR)) addVar('Color', `button/${token}`, 'color', values.map(n => ({ ref: `Semantic/${n}` })));
    addColl('Variant', BUTTON_VARIANT_MODES);
    for (const token of Object.keys(OUTLINED)) addVar('Variant', `button/${token}`, 'color', BUTTON_VARIANT_MODES.map(m => buttonValue(BUTTON_VARIANT[m][token])));
}
buttonCollections();
defineComponent({
    key: 'button', name: 'Button', category: 'General',
    description: 'To trigger an operation.',
    axis: { use: true, coll: 'Variant', modes: BUTTON_VARIANT_MODES },
    text: { prop: 'Label', def: 'Button' },
    sizes: { height: [24, 32, 40], 'padding-x': [7, 15, 23], 'padding-y': [0, 0, 0], gap: [8, 8, 8], 'font-size': [14, 14, 16], 'line-height': [22 / 14, 22 / 14, 24 / 16], radius: [4, 6, 8], 'icon-size': [14, 14, 16] },
    tree: ({ sz, label }) => frame('Button', {
        dir: 'h', alignC: 'center', alignP: 'center', h: sz('height'), pad: [sz('padding-y'), sz('padding-x'), sz('padding-y'), sz('padding-x')], gap: sz('gap'), radius: sz('radius'),
        fill: b('Variant', 'button/bg'), stroke: b('Variant', 'button/border'), sw: 1,
    }, [
        text(label, { name: 'Label', fs: sz('font-size'), lh: sz('line-height'), fill: b('Variant', 'button/fg'), cprop: 'Label' }),
    ]),
});

// ---------------------------------------------------------------- Input
defineComponent({
    key: 'input', name: 'Input', category: 'Data Entry',
    description: 'A basic widget for getting the user input is a text field.',
    axis: { coll: 'Input variant', modes: ['outlined', 'filled', 'borderless'] },
    states: { coll: 'Input states', modes: ['default', 'hover', 'focused', 'disabled', 'error', 'warning'] },
    props: { bg: 'color/background', text: 'color/text', stroke: 'color/stroke', placeholder: 'color/placeholder' },
    numeric: { 'stroke/width': 1 },
    stateBools: { 'ring/brand/visible': ['focused'], 'ring/danger/visible': ['error'], 'ring/warning/visible': ['warning'] },
    tokens: {
        outlined: { bg: { default: S('colorBgContainer'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, placeholder: S('colorTextTertiary'), stroke: { default: S('colorBorder'), hover: S('colorPrimaryBorderHover'), focused: S('colorPrimaryBorder'), disabled: S('colorBorder'), error: S('colorErrorBorder'), warning: S('colorWarningBorder') }, 'stroke/width': 1 },
        filled: { bg: { default: S('colorFillTertiary'), hover: S('colorFill'), focused: S('colorBgContainer'), disabled: S('colorBgContainerDisabled'), error: S('colorErrorBg'), warning: S('colorWarningBg') }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, placeholder: S('colorTextTertiary'), stroke: { default: NONE, focused: S('colorPrimaryBorder'), error: S('colorErrorBorder'), warning: S('colorWarningBorder') }, 'stroke/width': 1 },
        borderless: { bg: { default: NONE, hover: S('colorFillTertiary'), disabled: NONE }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, placeholder: S('colorTextTertiary'), stroke: NONE, 'stroke/width': 0 },
    },
    sizes: { height: [24, 32, 40], 'padding-x': [7, 11, 11], gap: [4, 4, 8], 'font-size': [14, 14, 16], radius: [4, 6, 8] },
    text: { prop: 'Placeholder', def: 'Placeholder' },
    tree: ({ st, ax, sz, sf, label }) => frame('Input', {
        dir: 'h', alignC: 'center', w: 240, h: sz('height'), pad: [0, sz('padding-x'), 0, sz('padding-x')], gap: sz('gap'), radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width'),
    }, [
        frame('Focus ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'controlOutline'), sw: 3, strokeAlign: 'outside', visible: sf('ring/brand/visible') }),
        frame('Error ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'colorErrorOutline'), sw: 3, strokeAlign: 'outside', visible: sf('ring/danger/visible') }),
        frame('Warning ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'colorWarningOutline'), sw: 3, strokeAlign: 'outside', visible: sf('ring/warning/visible') }),
        text(label, { name: 'Placeholder', fs: sz('font-size'), fill: st('placeholder'), cprop: 'Placeholder' }),
    ]),
});

// ---------------------------------------------------------------- Checkbox
defineComponent({
    key: 'checkbox', name: 'Checkbox', category: 'Data Entry',
    description: 'Collect user\'s choices.',
    axis: { coll: 'Checkbox styles', modes: ['default'] },
    states: { coll: 'Checkbox states', modes: ['default', 'hover', 'selected', 'selected-hover', 'indeterminate', 'disabled-off', 'disabled-on', 'focused', 'error'] },
    props: { box: 'color/box-background', boxStroke: 'color/box-stroke', check: 'color/mark-check', square: 'color/mark-square', text: 'color/text' },
    stateBools: { 'focus/visible': ['focused'] },
    tokens: {
        default: {
            box: { default: S('colorBgContainer'), selected: S('colorPrimary'), 'selected-hover': S('colorPrimaryHover'), 'disabled-off': S('colorBgContainerDisabled'), 'disabled-on': S('colorBgContainerDisabled') },
            boxStroke: { default: S('colorBorder'), hover: S('colorPrimaryBorder'), selected: S('colorPrimaryBorder'), 'selected-hover': S('colorPrimaryBorderHover'), 'disabled-off': S('colorBorder'), 'disabled-on': S('colorBorder'), focused: S('colorPrimaryBorder'), error: S('colorErrorBorder') },
            check: { default: NONE, selected: S('colorTextLightSolid'), 'selected-hover': S('colorTextLightSolid'), 'disabled-on': S('colorTextDisabled') },
            square: { default: NONE, indeterminate: S('colorPrimary') },
            text: { default: S('colorText'), 'disabled-off': S('colorTextDisabled'), 'disabled-on': S('colorTextDisabled') },
        },
    },
    text: { prop: 'Label', def: 'Checkbox' },
    tree: ({ st, label }) => frame('Checkbox', { dir: 'h', alignC: 'center', gap: 8 }, [
        frame('Box', { dir: 'h', alignC: 'center', alignP: 'center', w: 16, h: 16, radius: 4, fill: st('box'), stroke: st('boxStroke'), sw: 1 }, [
            frame('Focus indicator', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: 4, stroke: b('Semantic', 'controlOutline'), sw: 3, strokeAlign: 'outside', visible: b('Checkbox states', 'focus/visible') }),
            text('✓', { name: 'Check', fs: 11, fw: 700, lh: 1, fill: st('check') }),
            frame('Indeterminate', { pos: 'abs', x: 4, y: 4, w: 8, h: 8, radius: 2, fill: st('square') }),
        ]),
        text(label, { name: 'Label', fs: 14, fill: st('text'), cprop: 'Label' }),
    ]),
});

// ---------------------------------------------------------------- Tag
defineComponent({
    key: 'tag', name: 'Tag', category: 'Data Display',
    description: 'Tag for categorizing or markup.',
    axis: { coll: 'Tag styles', modes: ['default', 'success', 'processing', 'error', 'warning'] },
    props: { bg: 'color/background', text: 'color/text', stroke: 'color/stroke' },
    tokens: {
        default: { bg: S('colorFillTertiary'), text: S('colorText'), stroke: S('colorBorder') },
        success: { bg: S('colorSuccessBg'), text: S('colorSuccess'), stroke: S('colorSuccessBorder') },
        processing: { bg: S('colorPrimaryBg'), text: S('colorPrimaryText'), stroke: S('colorInfoBorder') },
        error: { bg: S('colorErrorBg'), text: S('colorError'), stroke: S('colorErrorBorder') },
        warning: { bg: S('colorWarningBg'), text: S('colorWarning'), stroke: S('colorWarningBorder') },
    },
    numeric: { 'stroke/width': 1 },
    variants: { Bordered: { Yes: '', No: '' } },
    sizes: { height: [22, 22, 22], 'padding-x': [7, 7, 7], 'font-size': [12, 12, 12], radius: [4, 4, 4] },
    text: { prop: 'Label', def: 'Tag' },
    tree: ({ st, ax, sz, v, label }) => frame('Tag', { dir: 'h', alignC: 'center', h: sz('height'), pad: [0, sz('padding-x'), 0, sz('padding-x')], radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: v.Bordered === 'No' ? 0 : ax('stroke/width') }, [
        text(label, { name: 'Label', fs: sz('font-size'), fill: st('text'), cprop: 'Label' }),
    ]),
});
