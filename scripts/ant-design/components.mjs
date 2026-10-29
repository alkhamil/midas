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
        default: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/primary'), hover: S('text/brand-hover'), pressed: S('text/brand-pressed'), disabled: S('text/disabled') }, stroke: { default: S('border/default'), hover: S('border/brand-hover'), pressed: S('border/brand'), disabled: S('border/disabled') }, 'stroke/width': 1 },
        primary: { bg: { default: S('bg/brand'), hover: S('bg/brand-hover'), pressed: S('bg/brand-pressed'), disabled: S('bg/disabled') }, text: { default: S('text/on-brand'), disabled: S('text/disabled') }, stroke: NONE, 'stroke/width': 0 },
        dashed: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/primary'), hover: S('text/brand-hover'), pressed: S('text/brand-pressed'), disabled: S('text/disabled') }, stroke: { default: S('border/default'), hover: S('border/brand-hover'), pressed: S('border/brand'), disabled: S('border/disabled') }, 'stroke/width': 1 },
        text: { bg: { default: NONE, hover: S('bg/fill'), pressed: S('bg/fill'), disabled: NONE }, text: { default: S('text/primary'), disabled: S('text/disabled') }, stroke: NONE, 'stroke/width': 0 },
        link: { bg: NONE, text: { default: S('text/link'), hover: S('text/link-hover'), pressed: S('text/link-pressed'), disabled: S('text/disabled') }, stroke: NONE, 'stroke/width': 0 },
    },
    suffixTokens: {
        '-danger': {
            default: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/danger'), hover: S('text/danger-hover'), pressed: S('text/danger-pressed'), disabled: S('text/disabled') }, stroke: { default: S('border/danger'), hover: S('border/danger-hover'), pressed: S('border/danger'), disabled: S('border/disabled') } },
            primary: { bg: { default: S('bg/danger'), hover: S('bg/danger-hover'), pressed: S('bg/danger-pressed'), disabled: S('bg/disabled') }, text: { default: S('text/on-brand'), disabled: S('text/disabled') }, stroke: NONE },
            dashed: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/danger'), hover: S('text/danger-hover'), pressed: S('text/danger-pressed'), disabled: S('text/disabled') }, stroke: { default: S('border/danger'), hover: S('border/danger-hover'), pressed: S('border/danger'), disabled: S('border/disabled') } },
            text: { bg: { default: NONE, hover: S('bg/danger-subtle'), pressed: S('bg/danger-subtle'), disabled: NONE }, text: { default: S('text/danger'), hover: S('text/danger-hover'), pressed: S('text/danger-pressed'), disabled: S('text/disabled') }, stroke: NONE },
            link: { bg: NONE, text: { default: S('text/danger'), hover: S('text/danger-hover'), pressed: S('text/danger-pressed'), disabled: S('text/disabled') }, stroke: NONE },
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
        frame('Focus indicator', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', v.Danger === 'Yes' ? 'ring/danger' : 'ring/brand'), sw: 3, strokeAlign: 'outside', visible: sf('focus/visible') }),
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
        outlined: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: { default: S('border/default'), hover: S('border/brand-hover'), focused: S('border/brand'), disabled: S('border/disabled'), error: S('border/danger'), warning: S('border/warning') }, 'stroke/width': 1 },
        filled: { bg: { default: S('bg/fill-tertiary'), hover: S('bg/fill'), focused: S('bg/container'), disabled: S('bg/disabled'), error: S('bg/danger-subtle'), warning: S('bg/warning-subtle') }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: { default: NONE, focused: S('border/brand'), error: S('border/danger'), warning: S('border/warning') }, 'stroke/width': 1 },
        borderless: { bg: { default: NONE, hover: S('bg/fill-tertiary'), disabled: NONE }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: NONE, 'stroke/width': 0 },
    },
    sizes: { height: [24, 32, 40], 'padding-x': [7, 11, 11], gap: [4, 4, 8], 'font-size': [14, 14, 16], radius: [4, 6, 8] },
    text: { prop: 'Placeholder', def: 'Placeholder' },
    tree: ({ st, ax, sz, sf, label }) => frame('Input', {
        dir: 'h', alignC: 'center', w: 240, h: sz('height'), pad: [0, sz('padding-x'), 0, sz('padding-x')], gap: sz('gap'), radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width'),
    }, [
        frame('Focus ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'ring/brand'), sw: 3, strokeAlign: 'outside', visible: sf('ring/brand/visible') }),
        frame('Error ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'ring/danger'), sw: 3, strokeAlign: 'outside', visible: sf('ring/danger/visible') }),
        frame('Warning ring', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz('radius'), stroke: b('Semantic', 'ring/warning'), sw: 3, strokeAlign: 'outside', visible: sf('ring/warning/visible') }),
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
            box: { default: S('bg/container'), selected: S('bg/brand'), 'selected-hover': S('bg/brand-hover'), 'disabled-off': S('bg/disabled'), 'disabled-on': S('bg/disabled') },
            boxStroke: { default: S('border/default'), hover: S('border/brand'), selected: S('border/brand'), 'selected-hover': S('border/brand-hover'), 'disabled-off': S('border/disabled'), 'disabled-on': S('border/disabled'), focused: S('border/brand'), error: S('border/danger') },
            check: { default: NONE, selected: S('text/on-brand'), 'selected-hover': S('text/on-brand'), 'disabled-on': S('text/disabled') },
            square: { default: NONE, indeterminate: S('bg/brand') },
            text: { default: S('text/primary'), 'disabled-off': S('text/disabled'), 'disabled-on': S('text/disabled') },
        },
    },
    text: { prop: 'Label', def: 'Checkbox' },
    tree: ({ st, label }) => frame('Checkbox', { dir: 'h', alignC: 'center', gap: 8 }, [
        frame('Box', { dir: 'h', alignC: 'center', alignP: 'center', w: 16, h: 16, radius: 4, fill: st('box'), stroke: st('boxStroke'), sw: 1 }, [
            frame('Focus indicator', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: 4, stroke: b('Semantic', 'ring/brand'), sw: 3, strokeAlign: 'outside', visible: b('Checkbox states', 'focus/visible') }),
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
        default: { bg: S('bg/fill-tertiary'), text: S('text/primary'), stroke: S('border/default') },
        success: { bg: S('bg/success-subtle'), text: S('text/success'), stroke: S('border/success-subtle') },
        processing: { bg: S('bg/brand-subtle'), text: S('text/brand'), stroke: S('border/info') },
        error: { bg: S('bg/danger-subtle'), text: S('text/danger'), stroke: S('border/danger-subtle') },
        warning: { bg: S('bg/warning-subtle'), text: S('text/warning'), stroke: S('border/warning-subtle') },
    },
    numeric: { 'stroke/width': 1 },
    variants: { Bordered: { Yes: '', No: '' } },
    sizes: { height: [22, 22, 22], 'padding-x': [7, 7, 7], 'font-size': [12, 12, 12], radius: [4, 4, 4] },
    text: { prop: 'Label', def: 'Tag' },
    tree: ({ st, ax, sz, v, label }) => frame('Tag', { dir: 'h', alignC: 'center', h: sz('height'), pad: [0, sz('padding-x'), 0, sz('padding-x')], radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: v.Bordered === 'No' ? 0 : ax('stroke/width') }, [
        text(label, { name: 'Label', fs: sz('font-size'), fill: st('text'), cprop: 'Label' }),
    ]),
});
