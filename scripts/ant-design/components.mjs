// Ant Design components, each defined as a table of tokens (look × state) plus a layer tree that only binds to variables.
import { b, ellipse, frame, text } from './lib.mjs';
import { defineComponent } from './define.mjs';

const S = n => `Semantic:${n}`;
const NONE = '#00000000';
/** Icon placeholder: a ring (real icons are vector assets; this keeps size, colour and visibility bound to variables). */
const icon = (name, size, stroke, extra = {}) => ellipse(name, { w: size, h: size, stroke, sw: 1.5, ...extra });

// ---------------------------------------------------------------- Button
defineComponent({
    key: 'button', name: 'Button', category: 'General',
    description: 'To trigger an operation.',
    axis: { coll: 'Button type', modes: ['default', 'primary', 'dashed', 'text', 'link'] },
    states: { coll: 'Button states', modes: ['default', 'hover', 'pressed', 'disabled', 'focused'] },
    props: { bg: 'color/background', text: 'color/text', stroke: 'color/stroke' },
    numeric: { 'stroke/width': 1 },
    stateBools: { 'focus/visible': ['focused'] },
    tokens: {
        default: { bg: { default: S('colorBgContainer'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorText'), hover: S('colorPrimaryTextHover'), pressed: S('colorPrimaryTextActive'), disabled: S('colorTextDisabled') }, stroke: { default: S('colorBorder'), hover: S('colorPrimaryBorderHover'), pressed: S('colorPrimaryBorder'), disabled: S('colorBorder') }, 'stroke/width': 1 },
        primary: { bg: { default: S('colorPrimary'), hover: S('colorPrimaryHover'), pressed: S('colorPrimaryActive'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorTextLightSolid'), disabled: S('colorTextDisabled') }, stroke: NONE, 'stroke/width': 0 },
        dashed: { bg: { default: S('colorBgContainer'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorText'), hover: S('colorPrimaryTextHover'), pressed: S('colorPrimaryTextActive'), disabled: S('colorTextDisabled') }, stroke: { default: S('colorBorder'), hover: S('colorPrimaryBorderHover'), pressed: S('colorPrimaryBorder'), disabled: S('colorBorder') }, 'stroke/width': 1 },
        text: { bg: { default: NONE, hover: S('colorFill'), pressed: S('colorFill'), disabled: NONE }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, stroke: NONE, 'stroke/width': 0 },
        link: { bg: NONE, text: { default: S('colorLink'), hover: S('colorLinkHover'), pressed: S('colorLinkActive'), disabled: S('colorTextDisabled') }, stroke: NONE, 'stroke/width': 0 },
    },
    suffixTokens: {
        '-danger': {
            default: { bg: { default: S('colorBgContainer'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorError'), hover: S('colorErrorHover'), pressed: S('colorErrorActive'), disabled: S('colorTextDisabled') }, stroke: { default: S('colorErrorBorder'), hover: S('colorErrorBorderHover'), pressed: S('colorErrorBorder'), disabled: S('colorBorder') } },
            primary: { bg: { default: S('colorError'), hover: S('colorErrorHover'), pressed: S('colorErrorActive'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorTextLightSolid'), disabled: S('colorTextDisabled') }, stroke: NONE },
            dashed: { bg: { default: S('colorBgContainer'), disabled: S('colorBgContainerDisabled') }, text: { default: S('colorError'), hover: S('colorErrorHover'), pressed: S('colorErrorActive'), disabled: S('colorTextDisabled') }, stroke: { default: S('colorErrorBorder'), hover: S('colorErrorBorderHover'), pressed: S('colorErrorBorder'), disabled: S('colorBorder') } },
            text: { bg: { default: NONE, hover: S('colorErrorBg'), pressed: S('colorErrorBg'), disabled: NONE }, text: { default: S('colorError'), hover: S('colorErrorHover'), pressed: S('colorErrorActive'), disabled: S('colorTextDisabled') }, stroke: NONE },
            link: { bg: NONE, text: { default: S('colorError'), hover: S('colorErrorHover'), pressed: S('colorErrorActive'), disabled: S('colorTextDisabled') }, stroke: NONE },
        },
    },
    colls: [{ name: 'Button icon', modes: ['none', 'start', 'end', 'only'], vars: [
        { name: 'icon/start/visible', type: 'boolean', values: [false, true, false, true] },
        { name: 'icon/end/visible', type: 'boolean', values: [false, false, true, false] },
        { name: 'label/visible', type: 'boolean', values: [true, true, true, false] },
        { name: 'padding-x', type: 'number', values: [{ ref: 'Size/button/padding-x' }, { ref: 'Size/button/padding-x' }, { ref: 'Size/button/padding-x' }, 0] },
        // Icon only: a square of the control height (antd's circle shape), so the minimum width is the height.
        { name: 'min-width', type: 'number', values: [0, 0, 0, { ref: 'Size/button/height' }] },
    ] }],
    variants: { Danger: { No: '', Yes: '-danger' }, Dashed: { No: '', Yes: '' } },
    sizes: { height: [24, 32, 40], 'padding-x': [7, 15, 23], 'padding-y': [0, 0, 0], gap: [8, 8, 8], 'font-size': [14, 14, 16], 'line-height': [22, 22, 24], radius: [4, 6, 8], 'icon-size': [14, 14, 16] },
    text: { prop: 'Label', def: 'Button' },
    tree: ({ st, ax, sz, x, sf, v, label }) => frame('Button', {
        dir: 'h', alignC: 'center', alignP: 'center', h: sz('height'), minW: x('Button icon', 'min-width'), pad: [sz('padding-y'), x('Button icon', 'padding-x'), sz('padding-y'), x('Button icon', 'padding-x')], gap: sz('gap'), radius: sz('radius'),
        fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width'), dash: v.Dashed === 'Yes',
    }, [
        frame('Focus indicator', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', v.Danger === 'Yes' ? 'colorErrorOutline' : 'controlOutline'), sw: 3, strokeAlign: 'outside', visible: sf('focus/visible') }),
        icon('Icon start', sz('icon-size'), st('text'), { visible: x('Button icon', 'icon/start/visible') }),
        text(label, { name: 'Label', fs: sz('font-size'), fill: st('text'), cprop: 'Label', visible: x('Button icon', 'label/visible') }),
        icon('Icon end', sz('icon-size'), st('text'), { visible: x('Button icon', 'icon/end/visible') }),
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
