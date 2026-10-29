// Batch 3: navigation, containers and overlays. Composite components (Tabs, Menu, Table …) bind to the variables of their
// item component (Tabs.Tab, Menu.Item, Table.Row …) and pin each item to a state with its own variable mode.
import { b, ellipse, frame, text } from './lib.mjs';
import { defineComponent } from './define.mjs';

const S = n => `Semantic:${n}`;
const NONE = '#00000000';
const sem = n => b('Semantic', n);
/** Pin a layer (and what is inside it) to a mode of a collection: both for baking and in the file. */
const at = (coll, mode, extra = {}) => ({ modes: { [coll]: mode }, varModes: { [coll]: mode }, ...extra });
const pin = (spec, coll, mode) => Object.assign(spec, at(coll, mode));
/** Button drawn inline from the Button variables (for dialogs, popconfirm …). */
const btn = (label, type = 'default', size = 'middle') => frame('Button', {
    dir: 'h', alignC: 'center', alignP: 'center', h: b('Size', 'button/height'), pad: [0, b('Size', 'button/padding-x'), 0, b('Size', 'button/padding-x')], radius: b('Size', 'button/radius'),
    fill: b('Button states', 'color/background'), stroke: b('Button states', 'color/stroke'), sw: b('Button type', 'stroke/width'), ...at('Button type', type, { modes: { 'Button type': type, 'Button states': 'default', Size: size } }),
}, [text(label, { name: 'Label', fs: b('Size', 'button/font-size'), fill: b('Button states', 'color/text') })]);

// ---------------------------------------------------------------- Tabs
const TAB_STATES = ['default', 'hover', 'active', 'disabled'];
const tabTokens = {
    line: { text: { default: S('colorTextSecondary'), hover: S('colorPrimaryTextHover'), active: S('colorPrimaryText'), disabled: S('colorTextDisabled') }, bg: NONE, ink: { default: NONE, active: S('colorPrimary') }, border: NONE, 'border/width': 0 },
    card: { text: { default: S('colorTextSecondary'), hover: S('colorPrimaryTextHover'), active: S('colorPrimaryText'), disabled: S('colorTextDisabled') }, bg: { default: S('colorBgLayout'), active: S('colorBgContainer') }, ink: NONE, border: S('colorBorderSecondary'), 'border/width': 1 },
};
const tabTree = (c, label) => frame('Tab', { dir: 'v', alignC: 'center', fill: c.st('bg'), stroke: c.st('border'), sw: c.ax('border/width'), radius: 8 }, [
    frame('Content', { dir: 'h', alignC: 'center', pad: [c.sz('padding-y'), c.sz('padding-x'), c.sz('padding-y'), c.sz('padding-x')] }, [text(label, { name: 'Label', fs: c.sz('font-size'), fill: c.st('text'), cprop: 'Label' })]),
    frame('Ink bar', { w: 'fill', h: 2, fill: c.st('ink') }),
]);
const TAB_PROPS = { text: 'color/text', bg: 'color/background', ink: 'color/ink', border: 'color/border' };
defineComponent({
    key: 'tab', name: 'Tabs.Tab', category: 'Navigation', description: 'One tab of Tabs.',
    axis: { coll: 'Tab type', modes: ['line', 'card'] }, states: { coll: 'Tab states', modes: TAB_STATES },
    props: TAB_PROPS, numeric: { 'border/width': 0 }, tokens: tabTokens,
    stateBools: {},
    sizes: { 'padding-y': [8, 12, 16], 'padding-x': [16, 16, 16], 'font-size': [14, 14, 16] },
    text: { prop: 'Label', def: 'Tab' },
    tree: c => tabTree(c, c.label),
});
defineComponent({
    key: 'tabs', name: 'Tabs', category: 'Navigation', description: 'Tabs make it easy to explore and switch between different views.',
    axis: { coll: 'Tab type', modes: ['line', 'card'], use: true }, states: { coll: 'Tab states', modes: TAB_STATES, use: true }, noStateMatrix: true,
    props: TAB_PROPS, sizeKey: 'tab',
    tree: c => frame('Tabs', { dir: 'v', w: 320 }, [
        frame('Bar', { dir: 'h', gap: 0, w: 'fill', alignC: 'end' }, [pin(tabTree(c, 'Tab 1'), 'Tab states', 'active'), pin(tabTree(c, 'Tab 2'), 'Tab states', 'default'), pin(tabTree(c, 'Tab 3'), 'Tab states', 'disabled')]),
        frame('Line', { w: 'fill', h: 1, fill: sem('colorBorderSecondary') }),
        frame('Content', { dir: 'h', pad: [16, 0, 16, 0] }, [text('Content of Tab Pane 1', { fs: 14, fill: sem('colorText') })]),
    ]),
});

// ---------------------------------------------------------------- Menu
const MENU_STATES = ['default', 'hover', 'selected', 'disabled'];
const menuTokens = {
    light: { container: S('colorBgContainer'), bg: { default: NONE, hover: S('colorFill'), selected: S('colorPrimaryBg') }, text: { default: S('colorText'), selected: S('colorPrimaryText'), disabled: S('colorTextDisabled') } },
    dark: { container: '#001529', bg: { default: NONE, hover: '#ffffff14', selected: S('colorPrimary') }, text: { default: '#ffffffa6', hover: '#ffffff', selected: '#ffffff', disabled: '#ffffff40' } },
};
const MENU_PROPS = { container: 'color/container', bg: 'color/background', text: 'color/text' };
const menuItem = (c, label) => frame('Menu item', { dir: 'h', alignC: 'center', gap: 10, w: 200, h: c.sz('height'), pad: [0, 16, 0, 16], radius: 8, fill: c.st('bg') }, [ellipse('Icon', { w: 14, h: 14, stroke: c.st('text'), sw: 1.5 }), text(label, { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label', w: 'fill' })]);
defineComponent({
    key: 'menuitem', name: 'Menu.Item', category: 'Navigation', description: 'One item of Menu.',
    axis: { coll: 'Menu theme', modes: ['light', 'dark'] }, states: { coll: 'Menu item states', modes: MENU_STATES },
    props: MENU_PROPS, tokens: menuTokens, sizes: { height: [32, 40, 40] },
    text: { prop: 'Label', def: 'Navigation One' }, tree: c => menuItem(c, c.label),
});
defineComponent({
    key: 'menu', sizeKey: 'menuitem', name: 'Menu', category: 'Navigation', description: 'A versatile menu for navigation.',
    axis: { coll: 'Menu theme', modes: ['light', 'dark'], use: true }, states: { coll: 'Menu item states', modes: MENU_STATES, use: true }, noStateMatrix: true,
    props: MENU_PROPS,
    tree: c => frame('Menu', { dir: 'v', gap: 4, pad: [8, 8, 8, 8], w: 216, fill: c.st('container') }, [
        pin(menuItem(c, 'Navigation One'), 'Menu item states', 'selected'), pin(menuItem(c, 'Navigation Two'), 'Menu item states', 'default'), pin(menuItem(c, 'Navigation Three'), 'Menu item states', 'hover'), pin(menuItem(c, 'Navigation Four'), 'Menu item states', 'disabled'),
    ]),
});
defineComponent({
    key: 'dropdown', sizeKey: 'menuitem', name: 'Dropdown', category: 'Navigation', description: 'A dropdown list.',
    axis: { coll: 'Menu theme', modes: ['light', 'dark'], use: true }, states: { coll: 'Menu item states', modes: MENU_STATES, use: true }, noStateMatrix: true,
    props: MENU_PROPS,
    tree: c => frame('Dropdown', { dir: 'v', gap: 2, pad: [4, 4, 4, 4], w: 160, radius: 8, fill: sem('colorBgElevated'), effects: sem('elevation/popup') }, [
        pin(menuItem(c, '1st menu item'), 'Menu item states', 'default'), pin(menuItem(c, '2nd menu item'), 'Menu item states', 'hover'), pin(menuItem(c, '3rd menu item'), 'Menu item states', 'disabled'),
    ].map(i => { i.w = 'fill'; return i; })),
});

// ---------------------------------------------------------------- Breadcrumb
const crumb = (c, label) => text(label, { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label' });
defineComponent({
    key: 'breadcrumbitem', name: 'Breadcrumb.Item', category: 'Navigation', description: 'One item of Breadcrumb.',
    axis: { coll: 'Breadcrumb styles', modes: ['default'] }, states: { coll: 'Breadcrumb states', modes: ['default', 'hover', 'current'] },
    props: { text: 'color/text' }, tokens: { default: { text: { default: S('colorTextTertiary'), hover: S('colorText'), current: S('colorText') } } },
    text: { prop: 'Label', def: 'Home' }, tree: c => crumb(c, c.label),
});
defineComponent({
    key: 'breadcrumb', name: 'Breadcrumb', category: 'Navigation', description: 'A breadcrumb displays the current location within a hierarchy.',
    axis: { coll: 'Breadcrumb styles', modes: ['default'], use: true }, states: { coll: 'Breadcrumb states', modes: ['default', 'hover', 'current'], use: true }, noStateMatrix: true,
    props: { text: 'color/text' },
    tree: c => frame('Breadcrumb', { dir: 'h', alignC: 'center', gap: 8 }, [pin(crumb(c, 'Home'), 'Breadcrumb states', 'default'), text('/', { fs: 14, fill: sem('colorTextTertiary') }), pin(crumb(c, 'Application'), 'Breadcrumb states', 'default'), text('/', { fs: 14, fill: sem('colorTextTertiary') }), pin(crumb(c, 'Application List'), 'Breadcrumb states', 'current')]),
});

// ---------------------------------------------------------------- Pagination
const PAGE_STATES = ['default', 'hover', 'active', 'disabled'];
const pageItem = (c, label) => frame('Page', { dir: 'h', alignC: 'center', alignP: 'center', w: c.sz('size'), h: c.sz('size'), radius: c.ax('radius'), fill: c.st('bg'), stroke: c.st('stroke'), sw: 1 }, [text(label, { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const PAGE_PROPS = { bg: 'color/background', text: 'color/text', stroke: 'color/stroke' };
defineComponent({
    key: 'pageitem', name: 'Pagination.Item', category: 'Navigation', description: 'One page button of Pagination.',
    axis: { coll: 'Pagination styles', modes: ['square', 'round'] }, states: { coll: 'Pagination states', modes: PAGE_STATES },
    props: PAGE_PROPS, numeric: { radius: 6 },
    tokens: {
        square: { bg: { default: NONE, hover: S('colorFill'), active: S('colorBgContainer') }, text: { default: S('colorText'), active: S('colorPrimaryText'), disabled: S('colorTextDisabled') }, stroke: { default: NONE, hover: NONE, active: S('colorPrimaryBorder') }, radius: 6 },
        round: { bg: { default: NONE, hover: S('colorFill'), active: S('colorPrimary') }, text: { default: S('colorText'), active: S('colorTextLightSolid'), disabled: S('colorTextDisabled') }, stroke: NONE, radius: 999 },
    },
    sizes: { size: [24, 32, 40] }, text: { prop: 'Label', def: '1' }, tree: c => pageItem(c, c.label),
});
defineComponent({
    key: 'pagination', sizeKey: 'pageitem', name: 'Pagination', category: 'Navigation', description: 'A long list can be divided into several pages.',
    axis: { coll: 'Pagination styles', modes: ['square', 'round'], use: true }, states: { coll: 'Pagination states', modes: PAGE_STATES, use: true }, noStateMatrix: true,
    props: PAGE_PROPS,
    tree: c => frame('Pagination', { dir: 'h', alignC: 'center', gap: 8 }, [pin(pageItem(c, '‹'), 'Pagination states', 'disabled'), ...['1', '2', '3', '4', '5'].map((n, i) => pin(pageItem(c, n), 'Pagination states', i === 0 ? 'active' : 'default')), pin(pageItem(c, '›'), 'Pagination states', 'default')]),
});

// ---------------------------------------------------------------- Steps
const STEP_STATES = ['wait', 'process', 'finish', 'error'];
const stepTree = (c, label, mark) => frame('Step', { dir: 'h', alignC: 'center', gap: 8 }, [
    frame('Dot', { dir: 'h', alignC: 'center', alignP: 'center', w: 32, h: 32, radius: 999, fill: c.st('dotBg'), stroke: c.st('dotStroke'), sw: 1 }, [text(mark, { name: 'Mark', fs: 16, fill: c.st('dotText') })]),
    text(label, { name: 'Title', fs: 16, fill: c.st('title'), cprop: 'Label' }),
]);
const STEP_PROPS = { dotBg: 'color/dot-background', dotStroke: 'color/dot-stroke', dotText: 'color/dot-text', title: 'color/title' };
defineComponent({
    key: 'step', name: 'Steps.Step', category: 'Navigation', description: 'One step of Steps.',
    axis: { coll: 'Steps styles', modes: ['default'] }, states: { coll: 'Step states', modes: STEP_STATES },
    props: STEP_PROPS,
    tokens: { default: {
        dotBg: { wait: NONE, process: S('colorPrimary'), finish: S('colorPrimaryBg'), error: S('colorBgContainer') },
        dotStroke: { wait: S('colorBorder'), process: S('colorPrimaryBorder'), finish: S('colorPrimaryBorder'), error: S('colorErrorBorder') },
        dotText: { wait: S('colorTextTertiary'), process: S('colorTextLightSolid'), finish: S('colorPrimaryText'), error: S('colorError') },
        title: { wait: S('colorTextTertiary'), process: S('colorText'), finish: S('colorText'), error: S('colorError') },
    } },
    text: { prop: 'Label', def: 'Step' }, tree: c => stepTree(c, c.label, '1'),
});
defineComponent({
    key: 'steps', name: 'Steps', category: 'Navigation', description: 'A navigation bar that guides users through the steps of a task.',
    axis: { coll: 'Steps styles', modes: ['default'], use: true }, states: { coll: 'Step states', modes: STEP_STATES, use: true }, noStateMatrix: true,
    props: STEP_PROPS,
    tree: c => frame('Steps', { dir: 'h', alignC: 'center', gap: 12 }, [
        pin(stepTree(c, 'Finished', '✓'), 'Step states', 'finish'), frame('Line', { w: 48, h: 1, fill: sem('colorPrimaryBorder') }),
        pin(stepTree(c, 'In Progress', '2'), 'Step states', 'process'), frame('Line', { w: 48, h: 1, fill: sem('colorBorderSecondary') }),
        pin(stepTree(c, 'Waiting', '3'), 'Step states', 'wait'),
    ]),
});

// ---------------------------------------------------------------- Segmented
const SEG_STATES = ['default', 'hover', 'selected', 'disabled'];
const segItem = (c, label) => frame('Option', { dir: 'h', alignC: 'center', alignP: 'center', h: 28, pad: [0, 11, 0, 11], radius: 4, fill: c.st('bg') }, [text(label, { name: 'Label', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const SEG_PROPS = { container: 'color/container', bg: 'color/background', text: 'color/text' };
defineComponent({
    key: 'segmenteditem', name: 'Segmented.Option', category: 'Data Display', description: 'One option of Segmented.',
    axis: { coll: 'Segmented styles', modes: ['default'] }, states: { coll: 'Segmented states', modes: SEG_STATES },
    props: SEG_PROPS, tokens: { default: { container: S('segmented/track-bg'), bg: { default: NONE, hover: S('colorFill'), selected: S('colorBgContainer') }, text: { default: S('colorTextSecondary'), hover: S('colorText'), selected: S('colorText'), disabled: S('colorTextDisabled') } } },
    text: { prop: 'Label', def: 'Daily' }, tree: c => segItem(c, c.label),
});
defineComponent({
    key: 'segmented', name: 'Segmented', category: 'Data Display', description: 'Display multiple options and allow users to select a single option.',
    axis: { coll: 'Segmented styles', modes: ['default'], use: true }, states: { coll: 'Segmented states', modes: SEG_STATES, use: true }, noStateMatrix: true,
    props: SEG_PROPS,
    tree: c => frame('Segmented', { dir: 'h', gap: 2, pad: [2, 2, 2, 2], radius: 6, fill: c.st('container') }, [pin(segItem(c, 'Daily'), 'Segmented states', 'selected'), pin(segItem(c, 'Weekly'), 'Segmented states', 'default'), pin(segItem(c, 'Monthly'), 'Segmented states', 'default')]),
});

// ---------------------------------------------------------------- Collapse
const COL_STATES = ['default', 'hover', 'disabled'];
const colHeader = (c, label) => frame('Header', { dir: 'h', alignC: 'center', gap: 12, w: 'fill', h: 46, pad: [0, 16, 0, 16], fill: c.st('bg') }, [text('›', { name: 'Arrow', fs: 14, fill: c.st('text') }), text(label, { name: 'Title', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const COL_PROPS = { bg: 'color/header-background', text: 'color/text', border: 'color/border' };
defineComponent({
    key: 'collapsepanel', name: 'Collapse.Panel', category: 'Data Display', description: 'Header of a Collapse panel.',
    axis: { coll: 'Collapse styles', modes: ['bordered', 'ghost'] }, states: { coll: 'Collapse states', modes: COL_STATES },
    props: COL_PROPS,
    tokens: { bordered: { bg: { default: S('colorFillTertiary'), hover: S('colorFill') }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, border: S('colorBorder') }, ghost: { bg: { default: NONE, hover: S('colorFillTertiary') }, text: { default: S('colorText'), disabled: S('colorTextDisabled') }, border: NONE } },
    text: { prop: 'Label', def: 'This is panel header 1' }, tree: c => { const h = colHeader(c, c.label); h.w = 320; return h; },
});
defineComponent({
    key: 'collapse', name: 'Collapse', category: 'Data Display', description: 'A content area which can be collapsed and expanded.',
    axis: { coll: 'Collapse styles', modes: ['bordered', 'ghost'], use: true }, states: { coll: 'Collapse states', modes: COL_STATES, use: true }, noStateMatrix: true,
    props: COL_PROPS,
    tree: c => frame('Collapse', { dir: 'v', w: 320, radius: 8, stroke: c.st('border'), sw: 1, clip: true }, [
        pin(colHeader(c, 'This is panel header 1'), 'Collapse states', 'default'),
        frame('Body', { dir: 'v', w: 'fill', pad: [16, 16, 16, 16] }, [text('A dog is a type of domesticated animal.', { fs: 14, fill: sem('colorText') })]),
        frame('Line', { w: 'fill', h: 1, fill: sem('colorBorderSecondary') }),
        pin(colHeader(c, 'This is panel header 2'), 'Collapse states', 'default'),
        frame('Line', { w: 'fill', h: 1, fill: sem('colorBorderSecondary') }),
        pin(colHeader(c, 'This is panel header 3'), 'Collapse states', 'disabled'),
    ]),
});

// ---------------------------------------------------------------- List
const listItem = (c, title) => frame('Item', { dir: 'h', alignC: 'center', gap: 12, w: 'fill', pad: [12, 16, 12, 16], fill: c.st('bg') }, [ellipse('Avatar', { w: 32, h: 32, fill: sem('avatar/bg') }), frame('Meta', { dir: 'v', gap: 2, w: 'fill' }, [text(title, { name: 'Title', fs: 14, fill: c.st('title'), cprop: 'Label' }), text('Ant Design, a design language for background applications', { fs: 12, fill: c.st('desc') })]), text('Edit', { fs: 14, fill: sem('colorLink') })]);
const LIST_PROPS = { bg: 'color/background', title: 'color/title', desc: 'color/description' };
defineComponent({
    key: 'listitem', name: 'List.Item', category: 'Data Display', description: 'One row of List.',
    axis: { coll: 'List styles', modes: ['default'] }, states: { coll: 'List item states', modes: ['default', 'hover'] },
    props: LIST_PROPS, tokens: { default: { bg: { default: NONE, hover: S('colorFillTertiary') }, title: S('colorText'), desc: S('colorTextTertiary') } },
    text: { prop: 'Label', def: 'Ant Design Title 1' }, tree: c => { const r = listItem(c, c.label); r.w = 360; return r; },
});
defineComponent({
    key: 'list', name: 'List', category: 'Data Display', description: 'Simple List.',
    axis: { coll: 'List styles', modes: ['default'], use: true }, states: { coll: 'List item states', modes: ['default', 'hover'], use: true }, noStateMatrix: true,
    props: LIST_PROPS,
    tree: c => frame('List', { dir: 'v', w: 360 }, [pin(listItem(c, 'Ant Design Title 1'), 'List item states', 'default'), frame('Line', { w: 'fill', h: 1, fill: sem('colorBorderSecondary') }), pin(listItem(c, 'Ant Design Title 2'), 'List item states', 'hover'), frame('Line', { w: 'fill', h: 1, fill: sem('colorBorderSecondary') }), pin(listItem(c, 'Ant Design Title 3'), 'List item states', 'default')]),
});

// ---------------------------------------------------------------- Table
const ROW_STATES = ['default', 'hover', 'selected'];
const rowTree = (c, cells) => frame('Row', { dir: 'v', w: 'fill' }, [
    frame('Cells', { dir: 'h', alignC: 'center', w: 'fill', fill: c.st('bg') }, cells.map((t, i) => frame('Cell', { dir: 'h', alignC: 'center', w: [140, 80, 200, 100][i], h: 54, pad: [0, 16, 0, 16] }, [text(t, { fs: 14, fill: c.st('text') })]))),
    frame('Line', { w: 'fill', h: 1, fill: c.st('line') }),
]);
const ROW_PROPS = { bg: 'color/background', text: 'color/text', line: 'color/divider' };
defineComponent({
    key: 'tablerow', name: 'Table.Row', category: 'Data Display', description: 'A data row of Table.',
    axis: { coll: 'Table styles', modes: ['default'] }, states: { coll: 'Table row states', modes: ROW_STATES },
    props: ROW_PROPS, tokens: { default: { bg: { default: S('colorBgContainer'), hover: S('colorFillTertiary'), selected: S('colorPrimaryBg') }, text: S('colorText'), line: S('colorBorderSecondary') } },
    tree: c => { const r = rowTree(c, ['John Brown', '32', 'New York No. 1 Lake Park', 'nice']); r.w = 520; return r; },
});
defineComponent({
    key: 'table', name: 'Table', category: 'Data Display', description: 'A table displays rows of data.',
    axis: { coll: 'Table styles', modes: ['default'], use: true }, states: { coll: 'Table row states', modes: ROW_STATES, use: true }, noStateMatrix: true,
    props: { ...ROW_PROPS, headBg: 'color/header-background' },
    tree: c => frame('Table', { dir: 'v', w: 520, radius: 8, stroke: sem('colorBorderSecondary'), sw: 1, clip: true }, [
        frame('Header', { dir: 'h', alignC: 'center', w: 'fill', fill: sem('colorFillTertiary') }, ['Name', 'Age', 'Address', 'Tags'].map((t, i) => frame('Cell', { dir: 'h', alignC: 'center', w: [140, 80, 200, 100][i], h: 54, pad: [0, 16, 0, 16] }, [text(t, { fs: 14, fw: 600, fill: sem('colorText') })]))),
        pin(rowTree(c, ['John Brown', '32', 'New York No. 1 Lake Park', 'nice']), 'Table row states', 'default'),
        pin(rowTree(c, ['Jim Green', '42', 'London No. 1 Lake Park', 'loser']), 'Table row states', 'selected'),
        pin(rowTree(c, ['Joe Black', '32', 'Sydney No. 1 Lake Park', 'teacher']), 'Table row states', 'hover'),
    ]),
});

// ---------------------------------------------------------------- Tree / Timeline
const nodeTree = (c, label, depth) => frame('Node', { dir: 'h', alignC: 'center', gap: 6, w: 'fill', h: 28, pad: [0, 8, 0, 8 + depth * 24], radius: 4, fill: c.st('bg') }, [text('▾', { name: 'Switcher', fs: 12, fill: c.st('text') }), text(label, { name: 'Title', fs: 14, fill: c.st('text'), cprop: 'Label' })]);
const TREE_PROPS = { bg: 'color/background', text: 'color/text' };
defineComponent({
    key: 'treenode', name: 'Tree.Node', category: 'Data Display', description: 'One node of Tree.',
    axis: { coll: 'Tree styles', modes: ['default'] }, states: { coll: 'Tree node states', modes: ['default', 'hover', 'selected'] },
    props: TREE_PROPS, tokens: { default: { bg: { default: NONE, hover: S('colorFillTertiary'), selected: S('colorPrimaryBg') }, text: S('colorText') } },
    text: { prop: 'Label', def: 'parent 1' }, tree: c => { const n = nodeTree(c, c.label, 0); n.w = 240; return n; },
});
defineComponent({
    key: 'tree', name: 'Tree', category: 'Data Display', description: 'Multiple-level structure list.',
    axis: { coll: 'Tree styles', modes: ['default'], use: true }, states: { coll: 'Tree node states', modes: ['default', 'hover', 'selected'], use: true }, noStateMatrix: true,
    props: TREE_PROPS,
    tree: c => frame('Tree', { dir: 'v', gap: 2, w: 240 }, [pin(nodeTree(c, 'parent 1', 0), 'Tree node states', 'default'), pin(nodeTree(c, 'parent 1-0', 1), 'Tree node states', 'default'), pin(nodeTree(c, 'leaf', 2), 'Tree node states', 'selected'), pin(nodeTree(c, 'leaf', 2), 'Tree node states', 'hover'), pin(nodeTree(c, 'parent 1-1', 1), 'Tree node states', 'default')]),
});
defineComponent({
    key: 'timeline', name: 'Timeline', category: 'Data Display', description: 'Vertical display timeline.',
    axis: { coll: 'Timeline styles', modes: ['default'] },
    props: { dot: 'color/dot', line: 'color/line', text: 'color/text' }, tokens: { default: { dot: S('colorPrimary'), line: S('colorBorderSecondary'), text: S('colorText') } },
    tree: ({ st }) => frame('Timeline', { dir: 'v', w: 260 }, [['Create a services site 2015-09-01', 'colorSuccess'], ['Solve initial network problems 2015-09-01', 'colorPrimary'], ['Technical testing 2015-09-01', 'colorError']].flatMap(([t, tone], i, all) => [
        frame('Item', { dir: 'h', gap: 12, w: 'fill' }, [frame('Rail', { dir: 'v', alignC: 'center', w: 10, h: 'hug' }, [frame('Dot', { w: 10, h: 10, radius: 999, stroke: sem(tone), sw: 2, fill: sem('colorBgContainer') }), ...(i < all.length - 1 ? [frame('Tail', { w: 2, h: 36, fill: st('line') })] : [])]), text(t, { fs: 14, fill: st('text'), w: 'fill' })]),
    ])),
});

// ---------------------------------------------------------------- Overlays: Modal, Drawer, Message, Notification, Popconfirm, Result
defineComponent({
    key: 'modal', name: 'Modal', category: 'Feedback', description: 'Modal dialogs.',
    axis: { coll: 'Modal styles', modes: ['default'] },
    props: { bg: 'color/background', title: 'color/title', body: 'color/body' },
    tokens: { default: { bg: S('colorBgElevated'), title: S('colorText'), body: S('colorText') } },
    text: { prop: 'Title', def: 'Basic Modal' },
    tree: ({ st, label }) => frame('Modal', { dir: 'v', gap: 12, w: 416, pad: [20, 24, 20, 24], radius: 8, fill: st('bg'), effects: sem('elevation/popup') }, [
        text(label, { name: 'Title', fs: 16, fw: 600, fill: st('title'), cprop: 'Title' }),
        text('Some contents...\nSome contents...', { fs: 14, fill: st('body'), w: 'fill' }),
        frame('Footer', { dir: 'h', gap: 8, w: 'fill', alignP: 'end', pad: [12, 0, 0, 0] }, [btn('Cancel'), btn('OK', 'primary')]),
    ]),
});
defineComponent({
    key: 'drawer', name: 'Drawer', category: 'Feedback', description: 'A panel which slides in from the edge of the screen.',
    axis: { coll: 'Drawer styles', modes: ['default'] },
    props: { bg: 'color/background', title: 'color/title', body: 'color/body', line: 'color/divider' },
    tokens: { default: { bg: S('colorBgElevated'), title: S('colorText'), body: S('colorText'), line: S('colorBorderSecondary') } },
    text: { prop: 'Title', def: 'Basic Drawer' },
    tree: ({ st, label }) => frame('Drawer', { dir: 'v', w: 378, h: 320, fill: st('bg'), effects: sem('elevation/popup') }, [
        frame('Header', { dir: 'h', alignC: 'center', w: 'fill', h: 56, pad: [0, 24, 0, 24] }, [text(label, { name: 'Title', fs: 16, fw: 600, fill: st('title'), cprop: 'Title', w: 'fill' }), text('✕', { fs: 14, fill: sem('colorTextTertiary') })]),
        frame('Line', { w: 'fill', h: 1, fill: st('line') }),
        frame('Body', { dir: 'v', gap: 8, w: 'fill', h: 'fill', pad: [24, 24, 24, 24] }, [text('Some contents...', { fs: 14, fill: st('body') }), text('Some contents...', { fs: 14, fill: st('body') })]),
    ]),
});
defineComponent({
    key: 'message', name: 'Message', category: 'Feedback', description: 'Display global messages as feedback in response to user operations.',
    axis: { coll: 'Message type', modes: ['info', 'success', 'warning', 'error', 'loading'] },
    props: { bg: 'color/background', icon: 'color/icon', text: 'color/text' },
    tokens: { info: { bg: S('colorBgElevated'), icon: S('colorInfo'), text: S('colorText') }, success: { bg: S('colorBgElevated'), icon: S('colorSuccess'), text: S('colorText') }, warning: { bg: S('colorBgElevated'), icon: S('colorWarning'), text: S('colorText') }, error: { bg: S('colorBgElevated'), icon: S('colorError'), text: S('colorText') }, loading: { bg: S('colorBgElevated'), icon: S('colorPrimary'), text: S('colorText') } },
    text: { prop: 'Label', def: 'This is a message' },
    tree: ({ st, label }) => frame('Message', { dir: 'h', alignC: 'center', gap: 8, pad: [9, 12, 9, 12], radius: 8, fill: st('bg'), effects: sem('elevation/popup') }, [ellipse('Icon', { w: 16, h: 16, fill: st('icon') }), text(label, { name: 'Label', fs: 14, fill: st('text'), cprop: 'Label' })]),
});
defineComponent({
    key: 'notification', name: 'Notification', category: 'Feedback', description: 'Prompt notification message globally.',
    axis: { coll: 'Notification type', modes: ['info', 'success', 'warning', 'error'] },
    props: { bg: 'color/background', icon: 'color/icon', title: 'color/title', body: 'color/body' },
    tokens: { info: { bg: S('colorBgElevated'), icon: S('colorInfo'), title: S('colorText'), body: S('colorTextSecondary') }, success: { bg: S('colorBgElevated'), icon: S('colorSuccess'), title: S('colorText'), body: S('colorTextSecondary') }, warning: { bg: S('colorBgElevated'), icon: S('colorWarning'), title: S('colorText'), body: S('colorTextSecondary') }, error: { bg: S('colorBgElevated'), icon: S('colorError'), title: S('colorText'), body: S('colorTextSecondary') } },
    text: { prop: 'Title', def: 'Notification Title' },
    tree: ({ st, label }) => frame('Notification', { dir: 'h', gap: 12, w: 384, pad: [20, 24, 20, 24], radius: 8, fill: st('bg'), effects: sem('elevation/popup') }, [
        ellipse('Icon', { w: 24, h: 24, fill: st('icon') }),
        frame('Content', { dir: 'v', gap: 4, w: 'fill' }, [text(label, { name: 'Title', fs: 16, fw: 600, fill: st('title'), cprop: 'Title' }), text('This is the content of the notification.', { fs: 14, fill: st('body'), w: 'fill' })]),
        text('✕', { fs: 14, fill: sem('colorTextTertiary') }),
    ]),
});
defineComponent({
    key: 'popconfirm', name: 'Popconfirm', category: 'Feedback', description: 'A simple and compact confirmation dialog of an action.',
    axis: { coll: 'Popconfirm styles', modes: ['default'] },
    props: { bg: 'color/background', title: 'color/title', icon: 'color/icon' }, tokens: { default: { bg: S('colorBgElevated'), title: S('colorText'), icon: S('colorWarning') } },
    text: { prop: 'Title', def: 'Are you sure to delete this task?' },
    tree: ({ st, label }) => frame('Popconfirm', { dir: 'v', gap: 12, pad: [12, 16, 12, 16], radius: 8, fill: st('bg'), effects: sem('elevation/popup') }, [
        frame('Title row', { dir: 'h', alignC: 'center', gap: 8 }, [ellipse('Icon', { w: 14, h: 14, fill: st('icon') }), text(label, { name: 'Title', fs: 14, fill: st('title'), cprop: 'Title' })]),
        frame('Actions', { dir: 'h', gap: 8, w: 'fill', alignP: 'end' }, [btn('No', 'default', 'small'), btn('Yes', 'primary', 'small')]),
    ]),
});
defineComponent({
    key: 'result', name: 'Result', category: 'Feedback', description: 'Used to feed back the results of a series of operational tasks.',
    axis: { coll: 'Result status', modes: ['success', 'error', 'info', 'warning'] },
    props: { icon: 'color/icon', title: 'color/title', sub: 'color/subtitle' },
    tokens: { success: { icon: S('colorSuccess'), title: S('colorText'), sub: S('colorTextSecondary') }, error: { icon: S('colorError'), title: S('colorText'), sub: S('colorTextSecondary') }, info: { icon: S('colorInfo'), title: S('colorText'), sub: S('colorTextSecondary') }, warning: { icon: S('colorWarning'), title: S('colorText'), sub: S('colorTextSecondary') } },
    text: { prop: 'Title', def: 'Successfully Purchased' },
    tree: ({ st, label }) => frame('Result', { dir: 'v', alignC: 'center', gap: 16, w: 360, pad: [24, 24, 24, 24] }, [ellipse('Icon', { w: 72, h: 72, fill: st('icon') }), text(label, { name: 'Title', fs: 24, fill: st('title'), cprop: 'Title' }), text('Order number: 2017182818828182881', { fs: 14, fill: st('sub') }), frame('Actions', { dir: 'h', gap: 8 }, [btn('Go Console', 'primary'), btn('Buy Again')])]),
});

// ---------------------------------------------------------------- Form.Item, Space, Grid, Layout
defineComponent({
    key: 'formitem', name: 'Form.Item', category: 'Data Entry', description: 'A form item: label, field and help text.',
    axis: { coll: 'Form styles', modes: ['vertical', 'horizontal'] },
    props: { label: 'color/label', help: 'color/help' }, tokens: { vertical: { label: S('colorText'), help: S('colorTextTertiary') }, horizontal: { label: S('colorText'), help: S('colorTextTertiary') } },
    variants: { Status: { Default: '', Error: '', Warning: '' } },
    text: { prop: 'Label', def: 'Username' },
    tree: ({ st, v, label }) => {
        const state = v.Status === 'Error' ? 'error' : v.Status === 'Warning' ? 'warning' : 'default';
        const field = frame('Field', { dir: 'h', alignC: 'center', w: 240, h: b('Size', 'input/height'), pad: [0, b('Size', 'input/padding-x'), 0, b('Size', 'input/padding-x')], radius: b('Size', 'input/radius'), fill: b('Input states', 'color/background'), stroke: b('Input states', 'color/stroke'), sw: b('Input variant', 'stroke/width'), ...at('Input states', state, { modes: { 'Input states': state, 'Input variant': 'outlined' } }) }, [text('Please input', { fs: 14, fill: b('Input states', 'color/placeholder') })]);
        return frame('Form.Item', { dir: 'v', gap: 6 }, [
            text(label, { name: 'Label', fs: 14, fill: st('label'), cprop: 'Label' }), field,
            text(v.Status === 'Error' ? 'Please input your username!' : v.Status === 'Warning' ? 'Should be combination of numbers & alphabets' : 'Help message', { name: 'Help', fs: 14, fill: sem(v.Status === 'Error' ? 'colorError' : v.Status === 'Warning' ? 'colorWarning' : 'colorTextTertiary') }),
        ]);
    },
});
defineComponent({
    key: 'space', name: 'Space', category: 'Layout', description: 'Set components spacing.',
    axis: { coll: 'Space styles', modes: ['default'] }, props: {}, tokens: { default: {} },
    sizes: { gap: [8, 16, 24] },
    tree: ({ sz }) => frame('Space', { dir: 'h', alignC: 'center', gap: sz('gap') }, [btn('Primary', 'primary'), btn('Default'), btn('Dashed', 'dashed')]),
});
defineComponent({
    key: 'grid', name: 'Grid.Row', category: 'Layout', description: '24 Grids System.',
    axis: { coll: 'Grid styles', modes: ['default'] },
    props: { col: 'color/column', text: 'color/text' }, tokens: { default: { col: S('colorPrimaryBg'), text: S('colorPrimaryText') } },
    sizes: { gutter: [8, 16, 24] },
    tree: ({ st, sz }) => frame('Grid.Row', { dir: 'h', gap: sz('gutter'), w: 360 }, [1, 2, 3].map(i => frame(`Col ${i}`, { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 48, radius: 4, fill: st('col') }, [text('col-8', { fs: 14, fill: st('text') })]))),
});
defineComponent({
    key: 'layout', name: 'Layout', category: 'Layout', description: 'Handling the overall layout of a page.',
    axis: { coll: 'Layout styles', modes: ['light', 'dark'] },
    props: { header: 'color/header', sider: 'color/sider', content: 'color/content', footer: 'color/footer', text: 'color/text' },
    tokens: { light: { header: S('colorBgContainer'), sider: S('colorBgContainer'), content: S('colorBgLayout'), footer: S('colorBgLayout'), text: S('colorText') }, dark: { header: '#001529', sider: '#001529', content: S('colorBgLayout'), footer: S('colorBgLayout'), text: '#ffffffd9' } },
    tree: ({ st }) => frame('Layout', { dir: 'v', w: 420, h: 280, radius: 8, clip: true, stroke: sem('colorBorderSecondary'), sw: 1 }, [
        frame('Header', { dir: 'h', alignC: 'center', w: 'fill', h: 48, pad: [0, 24, 0, 24], fill: st('header') }, [text('Header', { fs: 14, fill: st('text') })]),
        frame('Body', { dir: 'h', w: 'fill', h: 'fill' }, [frame('Sider', { dir: 'h', alignC: 'center', alignP: 'center', w: 100, h: 'fill', fill: st('sider') }, [text('Sider', { fs: 14, fill: st('text') })]), frame('Content', { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 'fill', fill: st('content') }, [text('Content', { fs: 14, fill: sem('colorText') })])]),
        frame('Footer', { dir: 'h', alignC: 'center', alignP: 'center', w: 'fill', h: 40, fill: st('footer') }, [text('Footer', { fs: 14, fill: sem('colorTextSecondary') })]),
    ]),
});

export { at, pin, btn };
