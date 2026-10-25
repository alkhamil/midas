// Batch 2: form fields, selection controls, display and feedback basics.
import { b, ellipse, frame, text } from './lib.mjs';
import { defineComponent } from './define.mjs';

const S = n => `Semantic:${n}`;
const NONE = '#00000000';
const ring = (sz, name, token, visible) => frame(name, { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', radius: sz, stroke: b('Semantic', token), sw: 3, strokeAlign: 'outside', visible });

// ---------------------------------------------------------------- field-like components (share the Input look × state tokens)
const FIELD_TOKENS = {
    outlined: { bg: { default: S('bg/container'), disabled: S('bg/disabled') }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: { default: S('border/default'), hover: S('border/brand-hover'), focused: S('border/brand'), disabled: S('border/disabled'), error: S('border/danger'), warning: S('border/warning') }, 'stroke/width': 1 },
    filled: { bg: { default: S('bg/fill-tertiary'), hover: S('bg/fill'), focused: S('bg/container'), disabled: S('bg/disabled'), error: S('bg/danger-subtle'), warning: S('bg/warning-subtle') }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: { default: NONE, focused: S('border/brand'), error: S('border/danger'), warning: S('border/warning') }, 'stroke/width': 1 },
    borderless: { bg: { default: NONE, hover: S('bg/fill-tertiary'), disabled: NONE }, text: { default: S('text/primary'), disabled: S('text/disabled') }, placeholder: S('text/tertiary'), stroke: NONE, 'stroke/width': 0 },
};
function field({ key, name, description, placeholder, suffix = null, prefix = null, width = 240, tall = false, category = 'Data Entry' }) {
    defineComponent({
        key, name, category, description,
        axis: { coll: `${name} variant`, modes: ['outlined', 'filled', 'borderless'] },
        states: { coll: `${name} states`, modes: ['default', 'hover', 'focused', 'disabled', 'error', 'warning'] },
        props: { bg: 'color/background', text: 'color/text', stroke: 'color/stroke', placeholder: 'color/placeholder' },
        numeric: { 'stroke/width': 1 },
        stateBools: { 'ring/brand/visible': ['focused'], 'ring/danger/visible': ['error'], 'ring/warning/visible': ['warning'] },
        tokens: FIELD_TOKENS,
        sizes: { height: [24, 32, 40], 'padding-x': [7, 11, 11], gap: [4, 4, 8], 'font-size': [14, 14, 16], radius: [4, 6, 8] },
        text: { prop: 'Placeholder', def: placeholder },
        tree: ({ st, ax, sz, sf, label }) => frame(name, {
            dir: 'h', alignC: tall ? 'start' : 'center', w: width, ...(tall ? { h: 64, pad: [5, 11, 5, 11] } : { h: sz('height'), pad: [0, sz('padding-x'), 0, sz('padding-x')] }), gap: sz('gap'), radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width'),
        }, [
            ring(sz('radius'), 'Focus ring', 'ring/brand', sf('ring/brand/visible')),
            ring(sz('radius'), 'Error ring', 'ring/danger', sf('ring/danger/visible')),
            ring(sz('radius'), 'Warning ring', 'ring/warning', sf('ring/warning/visible')),
            ...(prefix === 'swatch' ? [frame('Swatch', { w: 16, h: 16, radius: 4, fill: b('Semantic', 'bg/brand') })] : []),
            text(label, { name: 'Placeholder', fs: sz('font-size'), fill: st('placeholder'), cprop: 'Placeholder', w: 'fill' }),
            ...(suffix ? [text(suffix, { name: 'Suffix', fs: 12, fill: st('placeholder') })] : []),
        ]),
    });
}
field({ key: 'select', name: 'Select', description: 'Select with options.', placeholder: 'Please select', suffix: '⌄' });
field({ key: 'textarea', name: 'Input.TextArea', description: 'Multi-line text input.', placeholder: 'Type here…', tall: true });
field({ key: 'inputnumber', name: 'InputNumber', description: 'Enter a number within certain range with the mouse or keyboard.', placeholder: '0', suffix: '⌃⌄', width: 120 });
field({ key: 'autocomplete', name: 'AutoComplete', description: 'Autocomplete function of input field.', placeholder: 'input here' });
field({ key: 'cascader', name: 'Cascader', description: 'Cascade selection box.', placeholder: 'Please select', suffix: '⌄' });
field({ key: 'treeselect', name: 'TreeSelect', description: 'Tree selection control.', placeholder: 'Please select', suffix: '⌄' });
field({ key: 'datepicker', name: 'DatePicker', description: 'To select or input a date.', placeholder: 'Select date', suffix: '▦' });
field({ key: 'timepicker', name: 'TimePicker', description: 'To select/input a time.', placeholder: 'Select time', suffix: '◷', width: 160 });
field({ key: 'mentions', name: 'Mentions', description: 'Used to mention someone or something in an input.', placeholder: '@ to mention' });
field({ key: 'colorpicker', name: 'ColorPicker', description: 'Used for color selection.', placeholder: '#1677ff', prefix: 'swatch', width: 140 });

// ---------------------------------------------------------------- Radio
defineComponent({
    key: 'radio', name: 'Radio', category: 'Data Entry', description: 'Used to select a single state from multiple options.',
    axis: { coll: 'Radio styles', modes: ['default'] },
    states: { coll: 'Radio states', modes: ['default', 'hover', 'selected', 'selected-hover', 'disabled-off', 'disabled-on', 'focused', 'error'] },
    props: { box: 'color/circle-background', boxStroke: 'color/circle-stroke', dot: 'color/dot', text: 'color/text' },
    stateBools: { 'focus/visible': ['focused'] },
    tokens: { default: {
        box: { default: S('bg/container'), 'disabled-off': S('bg/disabled'), 'disabled-on': S('bg/disabled') },
        boxStroke: { default: S('border/default'), hover: S('border/brand'), selected: S('border/brand'), 'selected-hover': S('border/brand-hover'), 'disabled-off': S('border/disabled'), 'disabled-on': S('border/disabled'), focused: S('border/brand'), error: S('border/danger') },
        dot: { default: NONE, selected: S('bg/brand'), 'selected-hover': S('bg/brand-hover'), 'disabled-on': S('text/disabled') },
        text: { default: S('text/primary'), 'disabled-off': S('text/disabled'), 'disabled-on': S('text/disabled') },
    } },
    text: { prop: 'Label', def: 'Radio' },
    tree: ({ st, label }) => frame('Radio', { dir: 'h', alignC: 'center', gap: 8 }, [
        frame('Circle', { dir: 'h', alignC: 'center', alignP: 'center', w: 16, h: 16, radius: 999, fill: st('box'), stroke: st('boxStroke'), sw: 1 }, [
            ring(999, 'Focus indicator', 'ring/brand', b('Radio states', 'focus/visible')),
            frame('Dot', { w: 8, h: 8, radius: 999, fill: st('dot') }),
        ]),
        text(label, { name: 'Label', fs: 14, fill: st('text'), cprop: 'Label' }),
    ]),
});

// ---------------------------------------------------------------- Switch
defineComponent({
    key: 'switch', name: 'Switch', category: 'Data Entry', description: 'Used to toggle between two states.',
    axis: { coll: 'Switch styles', modes: ['default'] },
    states: { coll: 'Switch states', modes: ['default', 'hover', 'selected', 'selected-hover', 'disabled-off', 'disabled-on', 'focused'] },
    props: { track: 'color/track', knob: 'color/knob' },
    stateBools: { 'focus/visible': ['focused'], 'knob/off/visible': ['default', 'hover', 'disabled-off', 'focused'], 'knob/on/visible': ['selected', 'selected-hover', 'disabled-on'] },
    tokens: { default: {
        track: { default: S('bg/toggle-off'), hover: S('bg/toggle-off-hover'), selected: S('bg/brand'), 'selected-hover': S('bg/brand-hover'), 'disabled-off': S('bg/fill'), 'disabled-on': S('bg/brand-subtle'), focused: S('bg/toggle-off') },
        knob: S('text/on-brand'),
    } },
    sizes: { width: [28, 44, 44], height: [16, 22, 22], knob: [12, 18, 18], 'knob-on-x': [14, 24, 24] },
    tree: ({ st, sz, sf }) => frame('Switch', { w: sz('width'), h: sz('height'), radius: 999, fill: st('track') }, [
        ring(999, 'Focus indicator', 'ring/brand', sf('focus/visible')),
        frame('Knob off', { pos: 'abs', x: 2, y: 2, w: sz('knob'), h: sz('knob'), radius: 999, fill: st('knob'), visible: sf('knob/off/visible') }),
        frame('Knob on', { pos: 'abs', x: 24, y: 2, w: sz('knob'), h: sz('knob'), radius: 999, fill: st('knob'), visible: sf('knob/on/visible') }),
    ]),
});

// ---------------------------------------------------------------- Slider
defineComponent({
    key: 'slider', name: 'Slider', category: 'Data Entry', description: 'A Slider component for displaying current value and intervals in range.',
    axis: { coll: 'Slider styles', modes: ['default'] },
    states: { coll: 'Slider states', modes: ['default', 'hover', 'disabled'] },
    props: { rail: 'color/rail', track: 'color/track', handle: 'color/handle' },
    tokens: { default: { rail: { default: S('bg/rail'), hover: S('bg/rail-hover') }, track: { default: S('border/info'), hover: S('border/brand-hover'), disabled: S('text/disabled') }, handle: { default: S('border/info'), hover: S('border/brand'), disabled: S('text/disabled') } } },
    tree: ({ st }) => frame('Slider', { w: 240, h: 14 }, [
        frame('Rail', { pos: 'abs', x: 0, y: 5, w: 240, h: 4, radius: 2, fill: st('rail') }),
        frame('Track', { pos: 'abs', x: 0, y: 5, w: 100, h: 4, radius: 2, fill: st('track') }),
        frame('Handle', { pos: 'abs', x: 93, y: 0, w: 14, h: 14, radius: 999, fill: b('Semantic', 'bg/container'), stroke: st('handle'), sw: 2 }),
    ]),
});

// ---------------------------------------------------------------- Rate
defineComponent({
    key: 'rate', name: 'Rate', category: 'Data Entry', description: 'Used for rating.',
    axis: { coll: 'Rate styles', modes: ['default'] },
    props: { on: 'color/star-on', off: 'color/star-off' },
    tokens: { default: { on: S('bg/warning'), off: S('bg/rail') } },
    tree: ({ st }) => frame('Rate', { dir: 'h', gap: 8, alignC: 'center' }, [1, 2, 3, 4, 5].map(i => text('★', { name: `Star ${i}`, fs: 20, lh: 1, fill: st(i <= 3 ? 'on' : 'off') }))),
});

// ---------------------------------------------------------------- Upload
defineComponent({
    key: 'upload', name: 'Upload', category: 'Data Entry', description: 'Upload file by selecting or dragging.',
    axis: { coll: 'Upload styles', modes: ['default'] },
    states: { coll: 'Upload states', modes: ['default', 'hover', 'disabled'] },
    props: { bg: 'color/background', stroke: 'color/stroke', text: 'color/text', hint: 'color/hint' },
    tokens: { default: { bg: { default: S('bg/fill-tertiary'), hover: S('bg/fill'), disabled: S('bg/disabled') }, stroke: { default: S('border/default'), hover: S('border/brand'), disabled: S('border/disabled') }, text: { default: S('text/primary'), disabled: S('text/disabled') }, hint: { default: S('text/tertiary'), disabled: S('text/disabled') } } },
    tree: ({ st }) => frame('Upload', { dir: 'v', alignC: 'center', alignP: 'center', gap: 8, w: 300, h: 140, radius: 8, fill: st('bg'), stroke: st('stroke'), sw: 1, dash: true }, [
        ellipse('Icon', { w: 32, h: 32, stroke: b('Semantic', 'bg/brand'), sw: 2 }),
        text('Click or drag file to this area to upload', { fs: 16, fill: st('text') }),
        text('Support for a single or bulk upload.', { fs: 14, fill: st('hint') }),
    ]),
});

// ---------------------------------------------------------------- Avatar
defineComponent({
    key: 'avatar', name: 'Avatar', category: 'Data Display', description: 'Used to represent users or things.',
    axis: { coll: 'Avatar styles', modes: ['circle', 'square'] },
    props: { bg: 'color/background', text: 'color/text' },
    numeric: { radius: 999 },
    tokens: { circle: { bg: S('bg/toggle-off'), text: S('text/on-brand'), radius: 999 }, square: { bg: S('bg/toggle-off'), text: S('text/on-brand'), radius: 6 } },
    sizes: { size: [24, 32, 40], 'font-size': [14, 14, 18] },
    text: { prop: 'Label', def: 'U' },
    tree: ({ st, ax, sz, label }) => frame('Avatar', { dir: 'h', alignC: 'center', alignP: 'center', w: sz('size'), h: sz('size'), radius: ax('radius'), fill: st('bg') }, [text(label, { name: 'Label', fs: sz('font-size'), fill: st('text'), cprop: 'Label' })]),
});

// ---------------------------------------------------------------- Badge
defineComponent({
    key: 'badge', name: 'Badge', category: 'Data Display', description: 'Small numerical value or status descriptor for UI elements.',
    axis: { coll: 'Badge styles', modes: ['error', 'success', 'processing', 'warning', 'default'] },
    props: { bg: 'color/background', text: 'color/text' },
    tokens: { error: { bg: S('bg/danger'), text: S('text/on-brand') }, success: { bg: S('bg/success'), text: S('text/on-brand') }, processing: { bg: S('bg/info'), text: S('text/on-brand') }, warning: { bg: S('bg/warning'), text: S('text/on-brand') }, default: { bg: S('text/tertiary'), text: S('text/on-brand') } },
    variants: { Type: { Count: '', Dot: '', Status: '' } },
    text: { prop: 'Label', def: '5' },
    tree: ({ st, v, label }) => v.Type === 'Dot'
        ? frame('Badge', { w: 6, h: 6, radius: 999, fill: st('bg') })
        : v.Type === 'Status'
            ? frame('Badge', { dir: 'h', alignC: 'center', gap: 8 }, [frame('Dot', { w: 6, h: 6, radius: 999, fill: st('bg') }), text(label, { name: 'Label', fs: 14, fill: b('Semantic', 'text/primary'), cprop: 'Label' })])
            : frame('Badge', { dir: 'h', alignC: 'center', alignP: 'center', h: 20, minW: 20, pad: [0, 6, 0, 6], radius: 10, fill: st('bg') }, [text(label, { name: 'Label', fs: 12, fill: st('text'), cprop: 'Label' })]),
});

// ---------------------------------------------------------------- Card
defineComponent({
    key: 'card', name: 'Card', category: 'Data Display', description: 'Simple rectangular container.',
    axis: { coll: 'Card styles', modes: ['outlined', 'borderless'] },
    states: { coll: 'Card states', modes: ['default', 'hover'] },
    props: { bg: 'color/background', stroke: 'color/stroke', title: 'color/title', body: 'color/body', line: 'color/divider' },
    numeric: { 'stroke/width': 1 },
    stateEffects: { elevation: { default: S('elevation/none'), hover: S('elevation/card') } },
    tokens: {
        outlined: { bg: S('bg/container'), stroke: S('border/secondary'), title: S('text/primary'), body: S('text/primary'), line: S('border/secondary'), 'stroke/width': 1 },
        borderless: { bg: S('bg/container'), stroke: NONE, title: S('text/primary'), body: S('text/primary'), line: S('border/secondary'), 'stroke/width': 0 },
    },
    sizes: { padding: [12, 24, 24], 'header-height': [38, 56, 56], 'title-size': [14, 16, 16], width: [300, 300, 300], radius: [8, 8, 8] },
    text: { prop: 'Title', def: 'Card title' },
    tree: ({ st, ax, sz, sf, label }) => frame('Card', { dir: 'v', w: sz('width'), radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width'), effects: sf('elevation') }, [
        frame('Head', { dir: 'h', alignC: 'center', w: 'fill', h: sz('header-height'), pad: [0, sz('padding'), 0, sz('padding')] }, [
            text(label, { name: 'Title', fs: sz('title-size'), fw: 600, fill: st('title'), cprop: 'Title', w: 'fill' }), text('More', { fs: 14, fill: b('Semantic', 'text/link') }),
        ]),
        frame('Divider', { w: 'fill', h: 1, fill: st('line') }),
        frame('Body', { dir: 'v', gap: 8, w: 'fill', pad: [sz('padding'), sz('padding'), sz('padding'), sz('padding')] }, [text('Card content', { fs: 14, fill: st('body') }), text('Card content', { fs: 14, fill: st('body') })]),
    ]),
});

// ---------------------------------------------------------------- Typography
defineComponent({
    key: 'text', name: 'Typography.Text', category: 'General', description: 'Basic text writing, including headings, body text, lists, and more.',
    axis: { coll: 'Text type', modes: ['default', 'secondary', 'success', 'warning', 'danger', 'disabled'] },
    props: { text: 'color/text' },
    tokens: { default: { text: S('text/primary') }, secondary: { text: S('text/secondary') }, success: { text: S('text/success') }, warning: { text: S('text/warning') }, danger: { text: S('text/danger') }, disabled: { text: S('text/disabled') } },
    text: { prop: 'Label', def: 'Ant Design' },
    tree: ({ st, label }) => text(label, { name: 'Label', fs: b('Typography', 'body/font-size'), fill: st('text'), cprop: 'Label' }),
});
defineComponent({
    key: 'title', name: 'Typography.Title', category: 'General', description: 'Headings h1 to h5.',
    axis: { coll: 'Title styles', modes: ['default'] },
    props: { text: 'color/text' },
    tokens: { default: { text: S('text/primary') } },
    variants: { Level: { 1: '', 2: '', 3: '', 4: '', 5: '' } },
    text: { prop: 'Label', def: 'h1. Ant Design' },
    tree: ({ st, v, label }) => text(label, { name: 'Label', fs: b('Typography', `heading-${v.Level}/font-size`), fw: b('Typography', `heading-${v.Level}/font-weight`), fill: st('text'), cprop: 'Label' }),
});

// ---------------------------------------------------------------- Divider
defineComponent({
    key: 'divider', name: 'Divider', category: 'Layout', description: 'A divider line separates different content.',
    axis: { coll: 'Divider styles', modes: ['subtle', 'default'] },
    props: { line: 'color/line' },
    tokens: { subtle: { line: S('border/secondary') }, default: { line: S('border/default') } },
    variants: { Text: { No: '', Yes: '' } },
    text: { prop: 'Label', def: 'Text' },
    tree: ({ st, v, label }) => v.Text === 'Yes'
        ? frame('Divider', { dir: 'h', alignC: 'center', gap: 16, w: 240 }, [frame('Line', { w: 'fill', h: 1, fill: st('line') }), text(label, { name: 'Label', fs: 14, fw: 600, fill: b('Semantic', 'text/primary'), cprop: 'Label' }), frame('Line', { w: 'fill', h: 1, fill: st('line') })])
        : frame('Divider', { w: 240, h: 1, fill: st('line') }),
});

// ---------------------------------------------------------------- Alert
defineComponent({
    key: 'alert', name: 'Alert', category: 'Feedback', description: 'Alert component for feedback.',
    axis: { coll: 'Alert type', modes: ['info', 'success', 'warning', 'error'] },
    props: { bg: 'color/background', stroke: 'color/stroke', icon: 'color/icon', text: 'color/text' },
    numeric: { 'stroke/width': 1 },
    tokens: {
        info: { bg: S('bg/info-subtle'), stroke: S('border/info'), icon: S('bg/info'), text: S('text/primary') },
        success: { bg: S('bg/success-subtle'), stroke: S('border/success-subtle'), icon: S('bg/success'), text: S('text/primary') },
        warning: { bg: S('bg/warning-subtle'), stroke: S('border/warning-subtle'), icon: S('bg/warning'), text: S('text/primary') },
        error: { bg: S('bg/danger-subtle'), stroke: S('border/danger-subtle'), icon: S('bg/danger'), text: S('text/primary') },
    },
    variants: { Icon: { Yes: '', No: '' }, Description: { No: '', Yes: '' } },
    sizes: { 'padding-x': [12, 12, 12], 'padding-y': [8, 8, 8], gap: [8, 8, 8], radius: [8, 8, 8] },
    text: { prop: 'Message', def: 'Alert message' },
    tree: ({ st, ax, sz, v, label }) => frame('Alert', { dir: 'h', alignC: v.Description === 'Yes' ? 'start' : 'center', gap: sz('gap'), w: 360, pad: [sz('padding-y'), sz('padding-x'), sz('padding-y'), sz('padding-x')], radius: sz('radius'), fill: st('bg'), stroke: st('stroke'), sw: ax('stroke/width') }, [
        ...(v.Icon === 'Yes' ? [ellipse('Icon', { w: 16, h: 16, fill: st('icon') })] : []),
        frame('Content', { dir: 'v', gap: 4, w: 'fill' }, [
            text(label, { name: 'Message', fs: 14, fill: st('text'), cprop: 'Message' }),
            ...(v.Description === 'Yes' ? [text('Detailed description and advice about successful copywriting.', { fs: 14, fill: b('Semantic', 'text/secondary'), w: 'fill' })] : []),
        ]),
    ]),
});

// ---------------------------------------------------------------- Progress
defineComponent({
    key: 'progress', name: 'Progress', category: 'Feedback', description: 'Display the current progress of an operation flow.',
    axis: { coll: 'Progress status', modes: ['normal', 'success', 'exception', 'active'] },
    props: { bar: 'color/bar', info: 'color/info' },
    tokens: { normal: { bar: S('bg/brand'), info: S('text/secondary') }, success: { bar: S('bg/success'), info: S('text/success') }, exception: { bar: S('bg/danger'), info: S('text/danger') }, active: { bar: S('bg/brand'), info: S('text/secondary') } },
    colls: [{ name: 'Progress value', modes: ['0%', '25%', '50%', '75%', '100%'], vars: [{ name: 'bar-width', type: 'number', values: [0, 50, 100, 150, 200] }] }],
    tree: ({ st, x }) => frame('Progress', { dir: 'h', alignC: 'center', gap: 8 }, [
        frame('Rail', { w: 200, h: 8, radius: 100, clip: true, fill: b('Semantic', 'bg/rail') }, [frame('Bar', { pos: 'abs', x: 0, y: 0, w: x('Progress value', 'bar-width'), h: 8, radius: 100, fill: st('bar') })]),
        text('50%', { name: 'Info', fs: 14, fill: st('info') }),
    ]),
});

// ---------------------------------------------------------------- Tooltip / Popover
defineComponent({
    key: 'tooltip', name: 'Tooltip', category: 'Data Display', description: 'Simple text popup tip.',
    axis: { coll: 'Tooltip styles', modes: ['default'] },
    props: { bg: 'color/background', text: 'color/text' },
    tokens: { default: { bg: S('bg/spotlight'), text: S('text/on-brand') } },
    text: { prop: 'Label', def: 'prompt text' },
    tree: ({ st, label }) => frame('Tooltip', { dir: 'v', alignC: 'center' }, [
        frame('Bubble', { dir: 'h', alignC: 'center', pad: [6, 8, 6, 8], radius: 6, fill: st('bg'), minW: 32 }, [text(label, { name: 'Label', fs: 14, fill: st('text'), cprop: 'Label' })]),
        frame('Arrow', { w: 12, h: 6, fill: st('bg'), extra: { rotation: 0 } }),
    ]),
});
defineComponent({
    key: 'popover', name: 'Popover', category: 'Data Display', description: 'The floating card popped by clicking or hovering.',
    axis: { coll: 'Popover styles', modes: ['default'] },
    props: { bg: 'color/background', title: 'color/title', body: 'color/body' },
    tokens: { default: { bg: S('bg/elevated'), title: S('text/primary'), body: S('text/primary') } },
    text: { prop: 'Title', def: 'Title' },
    tree: ({ st, label }) => frame('Popover', { dir: 'v', gap: 8, pad: [12, 16, 12, 16], radius: 8, fill: st('bg'), effects: b('Semantic', 'elevation/popup'), minW: 160 }, [text(label, { name: 'Title', fs: 16, fw: 600, fill: st('title'), cprop: 'Title' }), text('Content\nContent', { fs: 14, fill: st('body') })]),
});

// ---------------------------------------------------------------- Spin / Skeleton / Empty / Statistic / FloatButton
defineComponent({
    key: 'spin', name: 'Spin', category: 'Feedback', description: 'Used for the loading status of a page or a block.',
    axis: { coll: 'Spin styles', modes: ['default'] },
    props: { ring: 'color/ring', dot: 'color/dot' },
    tokens: { default: { ring: S('border/info'), dot: S('bg/brand') } },
    sizes: { size: [14, 20, 32] },
    tree: ({ st, sz }) => frame('Spin', { w: sz('size'), h: sz('size') }, [
        ellipse('Ring', { pos: 'abs', x: 0, y: 0, w: sz('size'), h: sz('size'), stroke: st('ring'), sw: 3 }),
        frame('Dot', { pos: 'abs', x: 4, y: 0, w: 6, h: 6, radius: 999, fill: st('dot') }),
    ]),
});
defineComponent({
    key: 'skeleton', name: 'Skeleton', category: 'Feedback', description: 'Provide a placeholder while you wait for content to load.',
    axis: { coll: 'Skeleton styles', modes: ['default'] },
    props: { bar: 'color/bar' },
    tokens: { default: { bar: S('bg/fill') } },
    tree: ({ st }) => frame('Skeleton', { dir: 'h', gap: 16, w: 280 }, [
        ellipse('Avatar', { w: 32, h: 32, fill: st('bar') }),
        frame('Lines', { dir: 'v', gap: 12, w: 'fill' }, [frame('Title', { w: 120, h: 16, radius: 4, fill: st('bar') }), frame('Line', { w: 'fill', h: 16, radius: 4, fill: st('bar') }), frame('Line', { w: 200, h: 16, radius: 4, fill: st('bar') })]),
    ]),
});
defineComponent({
    key: 'empty', name: 'Empty', category: 'Data Display', description: 'Empty state placeholder.',
    axis: { coll: 'Empty styles', modes: ['default'] },
    props: { art: 'color/art', text: 'color/text' },
    tokens: { default: { art: S('border/default'), text: S('text/tertiary') } },
    text: { prop: 'Description', def: 'No data' },
    tree: ({ st, label }) => frame('Empty', { dir: 'v', alignC: 'center', gap: 8, w: 160 }, [frame('Art', { w: 64, h: 41, radius: 8, stroke: st('art'), sw: 2 }), text(label, { name: 'Description', fs: 14, fill: st('text'), cprop: 'Description' })]),
});
defineComponent({
    key: 'statistic', name: 'Statistic', category: 'Data Display', description: 'Display statistic number.',
    axis: { coll: 'Statistic styles', modes: ['default'] },
    props: { title: 'color/title', value: 'color/value' },
    tokens: { default: { title: S('text/secondary'), value: S('text/primary') } },
    text: { prop: 'Title', def: 'Active Users' },
    tree: ({ st, label }) => frame('Statistic', { dir: 'v', gap: 4 }, [text(label, { name: 'Title', fs: 14, fill: st('title'), cprop: 'Title' }), text('112,893', { fs: 24, fill: st('value') })]),
});
defineComponent({
    key: 'floatbutton', name: 'FloatButton', category: 'General', description: 'A button suspended at the page.',
    axis: { coll: 'FloatButton type', modes: ['default', 'primary'] },
    states: { coll: 'FloatButton states', modes: ['default', 'hover'] },
    props: { bg: 'color/background', icon: 'color/icon' },
    tokens: { default: { bg: { default: S('bg/container'), hover: S('bg/fill-tertiary') }, icon: S('text/primary') }, primary: { bg: { default: S('bg/brand'), hover: S('bg/brand-hover') }, icon: S('text/on-brand') } },
    tree: ({ st }) => frame('FloatButton', { dir: 'h', alignC: 'center', alignP: 'center', w: 40, h: 40, radius: 999, fill: st('bg'), effects: b('Semantic', 'elevation/popup') }, [ellipse('Icon', { w: 16, h: 16, stroke: st('icon'), sw: 1.5 })]),
});
