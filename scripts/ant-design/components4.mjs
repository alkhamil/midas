// Batch 4: the remaining visual components of the overview page.
import { b, ellipse, frame, text } from './lib.mjs';
import { defineComponent } from './define.mjs';
import { at, pin, btn } from './components3.mjs';

const S = n => `Semantic:${n}`;
const NONE = '#00000000';
const sem = n => b('Semantic', n);

// ---------------------------------------------------------------- Icon
defineComponent({
    key: 'icon', name: 'Icon', category: 'General', description: 'Semantic vector graphics.',
    axis: { coll: 'Icon styles', modes: ['outlined', 'filled', 'two-tone'] },
    props: { fill: 'color/fill', stroke: 'color/stroke' }, numeric: { 'stroke/width': 1.5 },
    tokens: { outlined: { fill: NONE, stroke: S('text/primary'), 'stroke/width': 1.5 }, filled: { fill: S('text/primary'), stroke: S('text/primary'), 'stroke/width': 1.5 }, 'two-tone': { fill: S('bg/brand-subtle'), stroke: S('bg/brand'), 'stroke/width': 1.5 } },
    sizes: { size: [14, 20, 32] },
    tree: ({ st, ax, sz }) => ellipse('Icon', { w: sz('size'), h: sz('size'), fill: st('fill'), stroke: st('stroke'), sw: ax('stroke/width') }),
});

// ---------------------------------------------------------------- Flex / Masonry / Splitter
const box = (name, w, h, extra = {}) => frame(name, { w, h, radius: 6, fill: sem('bg/brand-subtle'), ...extra });
defineComponent({
    key: 'flex', name: 'Flex', category: 'Layout', description: 'Flex layout wrapper.',
    axis: { coll: 'Flex styles', modes: ['default'] }, props: {}, tokens: { default: {} },
    variants: { Direction: { Horizontal: '', Vertical: '' } },
    sizes: { gap: [8, 16, 24] },
    tree: ({ sz, v }) => frame('Flex', { dir: v.Direction === 'Vertical' ? 'v' : 'h', gap: sz('gap') }, [box('Item 1', 64, 36), box('Item 2', 64, 36), box('Item 3', 64, 36)]),
});
defineComponent({
    key: 'masonry', name: 'Masonry', category: 'Layout', description: 'A masonry layout component for displaying content with varying heights.',
    axis: { coll: 'Masonry styles', modes: ['default'] }, props: { card: 'color/card' }, tokens: { default: { card: S('bg/brand-subtle') } },
    sizes: { gap: [8, 16, 24] },
    tree: ({ st, sz }) => frame('Masonry', { dir: 'h', gap: sz('gap') }, [[60, 96, 72], [96, 60, 84], [72, 84, 60]].map((hs, i) => frame(`Column ${i + 1}`, { dir: 'v', gap: sz('gap') }, hs.map((h, j) => frame(`Item ${i + 1}.${j + 1}`, { w: 80, h, radius: 6, fill: st('card') }))))),
});
defineComponent({
    key: 'splitter', name: 'Splitter', category: 'Layout', description: 'Split panels to isolate.',
    axis: { coll: 'Splitter styles', modes: ['default'] }, states: { coll: 'Splitter states', modes: ['default', 'hover'] },
    props: { bar: 'color/bar', panel: 'color/panel' }, tokens: { default: { bar: { default: S('border/secondary'), hover: S('border/brand') }, panel: S('bg/fill-tertiary') } },
    tree: ({ st }) => frame('Splitter', { dir: 'h', w: 360, h: 140, radius: 8, clip: true, stroke: sem('border/secondary'), sw: 1 }, [
        frame('Panel 1', { dir: 'h', alignC: 'center', alignP: 'center', w: 140, h: 'fill', fill: st('panel') }, [text('First', { fs: 14, fill: sem('text/secondary') })]),
        frame('Bar', { w: 4, h: 'fill', fill: st('bar') }),
        frame('Panel 2', { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 'fill' }, [text('Second', { fs: 14, fill: sem('text/secondary') })]),
    ]),
});

// ---------------------------------------------------------------- Anchor
const LINK_STATES = ['default', 'hover', 'active'];
const link = (c, label) => frame('Link', { dir: 'h', alignC: 'center', h: 28, pad: [0, 16, 0, 16], w: 'fill' }, [frame('Ink', { pos: 'abs', x: 0, y: 4, w: 2, h: 20, fill: c.st('ink') }), text(label, { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const LINK_PROPS = { text: 'color/text', ink: 'color/ink' };
defineComponent({
    key: 'anchorlink', name: 'Anchor.Link', category: 'Navigation', description: 'One link of Anchor.',
    axis: { coll: 'Anchor styles', modes: ['default'] }, states: { coll: 'Anchor states', modes: LINK_STATES },
    props: LINK_PROPS, tokens: { default: { text: { default: S('text/primary'), hover: S('text/brand-hover'), active: S('text/brand') }, ink: { default: NONE, active: S('bg/brand') } } },
    text: { prop: 'Label', def: 'Basic demo' }, tree: c => { const l = link(c, c.label); l.w = 180; return l; },
});
defineComponent({
    key: 'anchor', name: 'Anchor', category: 'Navigation', description: 'Hyperlinks to scroll on one page.',
    axis: { coll: 'Anchor styles', modes: ['default'], use: true }, states: { coll: 'Anchor states', modes: LINK_STATES, use: true }, noStateMatrix: true, props: LINK_PROPS,
    tree: c => frame('Anchor', { dir: 'v', w: 180 }, [frame('Rail', { pos: 'abs', x: 0, y: 0, w: 2, h: 'fill', fill: sem('border/secondary') }), pin(link(c, 'Basic demo'), 'Anchor states', 'active'), pin(link(c, 'Static demo'), 'Anchor states', 'default'), pin(link(c, 'API'), 'Anchor states', 'hover')]),
});

// ---------------------------------------------------------------- Calendar
const DAY_STATES = ['default', 'hover', 'selected', 'today', 'disabled'];
const day = (c, n) => frame('Day', { dir: 'h', alignC: 'center', alignP: 'center', w: 36, h: 32, radius: 4, fill: c.st('bg'), stroke: c.st('stroke'), sw: 1 }, [text(String(n), { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const DAY_PROPS = { bg: 'color/background', text: 'color/text', stroke: 'color/stroke' };
defineComponent({
    key: 'calendarday', name: 'Calendar.Day', category: 'Data Display', description: 'One day cell of Calendar.',
    axis: { coll: 'Calendar styles', modes: ['default'] }, states: { coll: 'Day cell states', modes: DAY_STATES },
    props: DAY_PROPS, tokens: { default: { bg: { default: NONE, hover: S('bg/fill'), selected: S('bg/brand') }, text: { default: S('text/primary'), selected: S('text/on-brand'), today: S('text/brand'), disabled: S('text/disabled') }, stroke: { default: NONE, today: S('border/brand') } } },
    text: { prop: 'Label', def: '15' }, tree: c => day(c, c.label),
});
defineComponent({
    key: 'calendar', name: 'Calendar', category: 'Data Display', description: 'Container for displaying data in calendar form.',
    axis: { coll: 'Calendar styles', modes: ['default'], use: true }, states: { coll: 'Day cell states', modes: DAY_STATES, use: true }, noStateMatrix: true, props: DAY_PROPS,
    tree: c => frame('Calendar', { dir: 'v', gap: 4, pad: [16, 16, 16, 16], radius: 8, fill: sem('bg/container'), stroke: sem('border/secondary'), sw: 1 }, [
        frame('Header', { dir: 'h', alignC: 'center', alignP: 'between', w: 'fill', pad: [0, 4, 8, 4] }, [text('‹', { fs: 16, fill: sem('text/secondary') }), text('October 2026', { fs: 14, fw: 600, fill: sem('text/primary') }), text('›', { fs: 16, fill: sem('text/secondary') })]),
        frame('Weekdays', { dir: 'h' }, ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => frame(d, { dir: 'h', alignP: 'center', w: 36, h: 24, alignC: 'center' }, [text(d, { fs: 12, fill: sem('text/tertiary') })]))),
        ...[0, 1, 2, 3, 4].map(r => frame(`Week ${r + 1}`, { dir: 'h' }, [0, 1, 2, 3, 4, 5, 6].map(k => {
            const n = r * 7 + k - 3;
            if (n < 1 || n > 31) return pin(day(c, n < 1 ? 30 + n : n - 31), 'Day cell states', 'disabled');
            return pin(day(c, n), 'Day cell states', n === 21 ? 'today' : n === 14 ? 'selected' : 'default');
        }))),
    ]),
});

// ---------------------------------------------------------------- Carousel
const DOT_STATES = ['inactive', 'active'];
defineComponent({
    key: 'carouseldot', name: 'Carousel.Dot', category: 'Data Display', description: 'One dot of Carousel.',
    axis: { coll: 'Carousel styles', modes: ['default'] }, states: { coll: 'Carousel dot states', modes: DOT_STATES },
    props: { bg: 'color/background' }, tokens: { default: { bg: { inactive: S('bg/toggle-off'), active: S('bg/brand') } } },
    sizes: { 'dot-width': [16, 16, 16] },
    tree: c => frame('Dot', { w: c.sz('dot-width'), h: 3, radius: 2, fill: c.st('bg') }),
});
defineComponent({
    key: 'carousel', name: 'Carousel', category: 'Data Display', description: 'A set of carousel areas.',
    axis: { coll: 'Carousel styles', modes: ['default'], use: true }, states: { coll: 'Carousel dot states', modes: DOT_STATES, use: true }, noStateMatrix: true, props: { bg: 'color/background' }, sizeKey: 'carouseldot',
    tree: c => frame('Carousel', { dir: 'v', alignC: 'center', gap: 8, w: 320 }, [
        frame('Slide', { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 120, radius: 8, fill: sem('bg/spotlight') }, [text('1', { fs: 24, fill: sem('text/on-brand') })]),
        frame('Dots', { dir: 'h', gap: 4 }, [pin(frame('Dot', { w: c.sz('dot-width'), h: 3, radius: 2, fill: c.st('bg') }), 'Carousel dot states', 'active'), pin(frame('Dot', { w: c.sz('dot-width'), h: 3, radius: 2, fill: c.st('bg') }), 'Carousel dot states', 'inactive'), pin(frame('Dot', { w: c.sz('dot-width'), h: 3, radius: 2, fill: c.st('bg') }), 'Carousel dot states', 'inactive'), pin(frame('Dot', { w: c.sz('dot-width'), h: 3, radius: 2, fill: c.st('bg') }), 'Carousel dot states', 'inactive')]),
    ]),
});

// ---------------------------------------------------------------- Descriptions / Transfer
defineComponent({
    key: 'descriptions', name: 'Descriptions', category: 'Data Display', description: 'Display multiple read-only fields in groups.',
    axis: { coll: 'Descriptions styles', modes: ['bordered', 'plain'] },
    props: { labelBg: 'color/label-background', line: 'color/line', label: 'color/label', value: 'color/value' }, numeric: { 'border/width': 1 },
    tokens: { bordered: { labelBg: S('bg/fill-tertiary'), line: S('border/secondary'), label: S('text/secondary'), value: S('text/primary'), 'border/width': 1 }, plain: { labelBg: NONE, line: NONE, label: S('text/tertiary'), value: S('text/primary'), 'border/width': 0 } },
    tree: ({ st, ax }) => frame('Descriptions', { dir: 'v', w: 420, radius: 8, stroke: st('line'), sw: ax('border/width'), clip: true }, [['Product', 'Cloud Database'], ['Billing', 'Prepaid'], ['Time', '2018-04-24 18:00:00']].map(([k, v]) => frame(k, { dir: 'h', w: 'fill', alignC: 'center' }, [
        frame('Label', { dir: 'h', alignC: 'center', w: 120, h: 44, pad: [0, 16, 0, 16], fill: st('labelBg') }, [text(k, { fs: 14, fill: st('label') })]),
        frame('Value', { dir: 'h', alignC: 'center', w: 'fill', h: 44, pad: [0, 16, 0, 16] }, [text(v, { fs: 14, fill: st('value') })]),
    ]))),
});
defineComponent({
    key: 'transfer', name: 'Transfer', category: 'Data Entry', description: 'Double columns transfer choice box.',
    axis: { coll: 'Transfer styles', modes: ['default'] },
    props: { line: 'color/line', head: 'color/header' }, tokens: { default: { line: S('border/default'), head: S('bg/fill-tertiary') } },
    tree: ({ st }) => frame('Transfer', { dir: 'h', alignC: 'center', gap: 12 }, [
        ...['Source', 'Target'].flatMap((t, i) => [
            ...(i === 1 ? [frame('Actions', { dir: 'v', gap: 4 }, [btn('›', 'default', 'small'), btn('‹', 'default', 'small')])] : []),
            frame(t, { dir: 'v', w: 150, h: 180, radius: 8, stroke: st('line'), sw: 1, clip: true }, [frame('Header', { dir: 'h', alignC: 'center', w: 'fill', h: 40, pad: [0, 12, 0, 12], fill: st('head') }, [text(`${t} list`, { fs: 14, fill: sem('text/primary') })]), ...[1, 2, 3].map(n => frame(`Item ${n}`, { dir: 'h', alignC: 'center', w: 'fill', h: 32, pad: [0, 12, 0, 12] }, [text(`content${n}`, { fs: 14, fill: sem('text/primary') })]))]),
        ]).reduce((acc, x, i) => (acc.push(x), acc), []),
    ]),
});

// ---------------------------------------------------------------- Image / QRCode / Tour / Watermark
defineComponent({
    key: 'image', name: 'Image', category: 'Data Display', description: 'Previewable image.',
    axis: { coll: 'Image styles', modes: ['default'] }, states: { coll: 'Image states', modes: ['default', 'hover'] },
    props: { bg: 'color/background', mark: 'color/icon' }, stateBools: { 'mask/visible': ['hover'] },
    tokens: { default: { bg: S('bg/fill'), mark: S('text/tertiary') } },
    tree: ({ st, sf }) => frame('Image', { dir: 'h', alignC: 'center', alignP: 'center', w: 160, h: 120, radius: 6, fill: st('bg'), clip: true }, [
        ellipse('Icon', { w: 32, h: 32, stroke: st('mark'), sw: 2 }),
        frame('Mask', { pos: 'abs', x: 0, y: 0, w: 'fill', h: 'fill', fill: sem('bg/mask'), visible: sf('mask/visible') }, [text('Preview', { fs: 14, fill: sem('text/on-brand'), pos: 'abs', x: 54, y: 50 })]),
    ]),
});
{
    // a fixed 9×9 pattern; a QR code is data, so this only shows the component's frame and colours
    const cells = [];
    for (let i = 0; i < 81; i++) { const x = i % 9, y = Math.floor(i / 9); if (((x * 7 + y * 13 + x * y) % 5) < 2 || (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5)) cells.push([x, y]); }
    defineComponent({
        key: 'qrcode', name: 'QRCode', category: 'Data Display', description: 'Components that can convert text into QR codes.',
        axis: { coll: 'QRCode styles', modes: ['default'] }, props: { bg: 'color/background', fg: 'color/foreground', line: 'color/border' },
        tokens: { default: { bg: S('bg/container'), fg: S('text/primary'), line: S('border/secondary') } },
        tree: ({ st }) => frame('QRCode', { w: 120, h: 120, radius: 8, fill: st('bg'), stroke: st('line'), sw: 1 }, cells.map(([x, y]) => frame('Module', { pos: 'abs', x: 12 + x * 10, y: 12 + y * 10, w: 10, h: 10, fill: st('fg') }))),
    });
}
defineComponent({
    key: 'tour', name: 'Tour', category: 'Data Display', description: 'A popup component for guiding users through a product.',
    axis: { coll: 'Tour styles', modes: ['default'] }, props: { bg: 'color/background', title: 'color/title', body: 'color/body' },
    tokens: { default: { bg: S('bg/elevated'), title: S('text/primary'), body: S('text/secondary') } },
    text: { prop: 'Title', def: 'Upload File' },
    tree: ({ st, label }) => frame('Tour', { dir: 'v', gap: 8, w: 260, pad: [16, 16, 16, 16], radius: 8, fill: st('bg'), effects: sem('elevation/popup') }, [
        text(label, { name: 'Title', fs: 16, fw: 600, fill: st('title'), cprop: 'Title' }), text('Put your files here.', { fs: 14, fill: st('body') }),
        frame('Footer', { dir: 'h', alignC: 'center', alignP: 'between', w: 'fill', pad: [8, 0, 0, 0] }, [text('1 / 3', { fs: 12, fill: sem('text/tertiary') }), frame('Actions', { dir: 'h', gap: 8 }, [btn('Prev', 'default', 'small'), btn('Next', 'primary', 'small')])]),
    ]),
});
defineComponent({
    key: 'watermark', name: 'Watermark', category: 'Feedback', description: 'Add specific text or patterns to the page.',
    axis: { coll: 'Watermark styles', modes: ['default'] }, props: { mark: 'color/mark' }, tokens: { default: { mark: S('text/disabled') } },
    tree: ({ st }) => frame('Watermark', { w: 300, h: 160, radius: 8, clip: true, fill: sem('bg/container'), stroke: sem('border/secondary'), sw: 1 }, [
        text('Content area', { fs: 14, fill: sem('text/primary'), pos: 'abs', x: 108, y: 70 }),
        ...[[16, 24], [160, 20], [40, 96], [180, 100], [100, 130]].map(([x, y], i) => text('Ant Design', { name: `Mark ${i + 1}`, fs: 16, fill: st('mark'), pos: 'abs', x, y, extra: { rotation: -22 } })),
    ]),
});
