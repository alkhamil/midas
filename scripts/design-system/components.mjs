// Komponen design system CMS. Setiap komponen: name, group (folder page), description, variants, cprops,
// render(variant, ctx, cp) → spec root variant, states?(ctx) → daftar { label, spec } untuk dokumentasi state.
// `cp.<Nama>` = id component property (untuk binding teks). Nama berawalan `_` = bagian internal (dirakit komponen
// lain, tidak diekspor ke kode). Urutan array = urutan build: komponen yang dipakai sebagai instance harus lebih dulu.
import { col, frame, icon, instance, row, text } from './build.mjs';

const FG = 'color/foreground', MUTED_FG = 'color/muted-foreground', STYLE = 'outline';
const SIZE = { Sm: { h: 32, padX: 12, font: 12, line: 16 }, Md: { h: 40, padX: 16, font: 14, line: 20 } };
const tone = { Success: 'color/success', Warning: 'color/warning', Danger: 'color/danger', Info: 'color/info' };
const ico = (ctx, name, color, size = 16) => icon(ctx.icon(name, STYLE, color), { size, name: 'Icon' });

export const COMPONENTS = [
    {
        name: 'Button',
        group: 'Actions',
        description: 'Actions. Primary for the main action (one per area), Secondary for supporting actions, Ghost for light actions, Danger for destructive actions.',
        variants: { Variant: ['Primary', 'Secondary', 'Ghost', 'Danger'], Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Button' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Icon', type: 'instance' }],
        render: (v, ctx, cp) => button(v.Variant, v.Size, ctx, { bind: cp.Label }),
        states: ctx => [
            { label: 'Default', spec: button('Primary', 'Md', ctx, { label: 'Save' }) },
            { label: 'Hover (85%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Save' }), fillOpacity: 0.85 } },
            { label: 'Disabled (50%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Save' }), opacity: 0.5 } },
            { label: 'With icon', spec: button('Primary', 'Md', ctx, { label: 'Add user', icon: 'add' }) },
            { label: 'Secondary + icon', spec: button('Secondary', 'Md', ctx, { label: 'Filter', icon: 'filter' }) },
        ],
    },
    {
        name: 'IconButton',
        group: 'Actions',
        description: 'Table row actions: view, edit, delete, restore. Icon only — add a tooltip/aria-label in code.',
        variants: { Action: ['View', 'Edit', 'Delete', 'Restore'] },
        cprops: [{ name: 'Disabled', type: 'boolean', default: false }],
        render: (v, ctx) => iconButton(v.Action, ctx),
    },
    {
        name: 'Badge',
        group: 'Feedback',
        description: 'Short status in tables and details. Color follows meaning, not decoration.',
        variants: { Variant: ['Success', 'Warning', 'Danger', 'Info', 'Neutral'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Badge' }],
        render: (v, _ctx, cp) => badge(v.Variant, { bind: cp.Label }),
    },
    {
        name: 'Avatar',
        group: 'Data Display',
        description: 'User initial in a circle.',
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Initial', type: 'text', default: 'A' }],
        render: (v, _ctx, cp) => avatar(v.Size, { bind: cp.Initial }),
    },
    {
        name: 'Alert',
        group: 'Feedback',
        description: 'Message inside a page or form. Icon + color match the type.',
        variants: { Variant: ['Success', 'Warning', 'Danger', 'Info'] },
        cprops: [{ name: 'Message', type: 'text', default: 'Message for the user' }],
        render: (v, ctx, cp) => {
            const c = tone[v.Variant], ic = { Success: 'check-circle', Warning: 'danger-triangle', Danger: 'close-circle', Info: 'info-circle' }[v.Variant];
            return row({ w: 480, gap: 12, pad: [12, 16], align: 'start', radius: 'radius/lg', fill: c, fillOpacity: 0.1, stroke: c }, [
                ico(ctx, ic, c, 20),
                text('Message for the user', { w: 480 - 32 - 20 - 12, size: 14, line: 20, bind: cp.Message, name: 'Message' }),
            ]);
        },
    },
    {
        name: 'Card',
        group: 'Data Display',
        description: 'Content container with a title. Used for tables, forms, and details.',
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Card title' }, { name: 'Content', type: 'slot' }],
        render: (_v, _ctx, cp) => card(480, { title: 'Card title', bind: cp.Title }, [text('Card content: a table, form, or detail view.', { color: MUTED_FG, name: 'Content' })]),
    },
    {
        name: 'StatCard',
        group: 'Data Display',
        description: 'Summary number on the dashboard with an up, down, or neutral trend.',
        variants: { Trend: ['Up', 'Down', 'Neutral'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Total users' }, { name: 'Value', type: 'text', default: '1.248' }, { name: 'Caption', type: 'text', default: '12% vs last month' }],
        render: (v, ctx, cp) => {
            const c = { Up: 'color/success', Down: 'color/danger', Neutral: MUTED_FG }[v.Trend];
            return col({ w: 260, gap: 8, pad: 20, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border' }, [
                text('Total users', { size: 14, line: 20, color: MUTED_FG, bind: cp.Label, name: 'Label' }),
                text('1.248', { size: 30, line: 36, weight: 600, bind: cp.Value, name: 'Value' }),
                row({ gap: 4, name: 'Trend' }, [
                    v.Trend === 'Neutral' ? null : ico(ctx, v.Trend === 'Up' ? 'arrow-up' : 'arrow-down', c, 14),
                    text('12% vs last month', { size: 12, line: 16, weight: 500, color: c, bind: cp.Caption, name: 'Caption' }),
                ]),
            ]);
        },
    },
    ...['TextField', 'TextAreaField', 'PasswordField', 'SelectField'].map(name => ({
        name,
        group: 'Forms',
        description: {
            TextField: 'Single-line text input with a label. The error message shows below the input.',
            TextAreaField: 'Multi-line text input with a label.',
            PasswordField: 'Password input with a show/hide button.',
            SelectField: 'Choice from a list (dropdown) with a label.',
        }[name],
        variants: {},
        cprops: [
            { name: 'Label', type: 'text', default: { TextField: 'Full name', TextAreaField: 'Notes', PasswordField: 'Password', SelectField: 'Role' }[name] },
            { name: 'Placeholder', type: 'text', default: name === 'SelectField' ? 'Select…' : 'Type here…' },
            { name: 'Disabled', type: 'boolean', default: false },
        ],
        render: (_v, ctx, cp) => formField(name, ctx, { bindLabel: cp.Label, bindPlaceholder: cp.Placeholder }),
        states: ctx => [
            { label: 'Default', spec: formField(name, ctx, { label: 'Label', placeholder: 'Placeholder' }) },
            { label: 'Terisi', spec: formField(name, ctx, { label: 'Label', value: name === 'PasswordField' ? '••••••••' : 'John Smith' }) },
            { label: 'Focus', spec: formField(name, ctx, { label: 'Label', value: 'Budi', focus: true }) },
            { label: 'Error', spec: formField(name, ctx, { label: 'Label', value: 'budi@', error: 'Invalid format' }) },
            { label: 'Disabled', spec: { ...formField(name, ctx, { label: 'Label', value: 'Cannot be changed' }), opacity: 0.5 } },
            ...(name === 'SelectField' ? [{ label: 'Open', spec: selectOpen(ctx) }] : []),
        ],
    })),
    {
        name: 'SwitchField',
        group: 'Forms',
        description: 'On/off switch that applies immediately, e.g. an active status.',
        variants: {},
        cprops: [{ name: 'Label', type: 'text', default: 'Active' }, { name: 'Disabled', type: 'boolean', default: false }],
        render: (_v, _ctx, cp) => toggle({ bind: cp.Label }),
        states: () => [
            { label: 'Off', spec: toggle({ label: 'Active account' }) },
            { label: 'On', spec: toggle({ label: 'Active account', on: true }) },
            { label: 'Disabled', spec: { ...toggle({ label: 'Active account', on: true }), opacity: 0.5 } },
        ],
    },
    {
        name: 'Dialog',
        group: 'Feedback',
        description: 'Confirmation or short form on top of the page. Tone = Danger/Primary sets the confirm button color. Message, Cancel and Confirm labels are properties; the Content slot can hold custom content.',
        variants: { Size: ['Sm', 'Md'], Tone: ['Danger', 'Primary'] },
        cprops: [
            { name: 'Title', type: 'text', default: 'Dialog title' },
            { name: 'Message', type: 'text', default: 'Deleted data cannot be restored.' },
            { name: 'CancelLabel', type: 'text', default: 'Cancel' },
            { name: 'ConfirmLabel', type: 'text', default: 'Delete' },
            { name: 'Content', type: 'slot' },
        ],
        render: (v, ctx, cp) => {
            const w = { Sm: 400, Md: 520 }[v.Size];
            const confirm = { ...button(v.Tone === 'Danger' ? 'Danger' : 'Primary', 'Md', ctx, { label: 'Delete', bind: cp.ConfirmLabel }), name: 'Confirm' };
            const cancel = { ...button('Secondary', 'Md', ctx, { label: 'Cancel', bind: cp.CancelLabel }), name: 'Cancel' };
            return col({ w, radius: 'radius/xl', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 12, blur: 32, opacity: 0.16 }, clip: true }, [
                row({ w: 'fill', pad: [16, 24], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
                    text('Dialog title', { size: 18, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                    ico(ctx, 'close', MUTED_FG, 20),
                ]),
                col({ w: 'fill', pad: 24, name: 'Content' }, [text('Deleted data cannot be restored.', { w: w - 48, color: MUTED_FG, bind: cp.Message, name: 'Message' })]),
                row({ w: 'fill', pad: [16, 24], gap: 8, justify: 'end', stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Footer' }, [cancel, confirm]),
            ]);
        },
    },
    {
        name: 'Drawer',
        group: 'Feedback',
        description: 'Side panel that slides in from the right, e.g. for list filters. Title and the Reset / Apply labels are properties; the Content slot holds the fields.',
        variants: {},
        cprops: [
            { name: 'Title', type: 'text', default: 'Filters' },
            { name: 'SecondaryLabel', type: 'text', default: 'Reset' },
            { name: 'PrimaryLabel', type: 'text', default: 'Apply' },
            { name: 'Content', type: 'slot' },
        ],
        render: (_v, ctx, cp) => col({ w: 400, h: 640, fill: 'color/background', stroke: 'color/border', shadow: { x: -8, y: 0, blur: 32, opacity: 0.12 }, clip: true }, [
            row({ w: 'fill', pad: [16, 24], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
                text('Filters', { size: 18, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                ico(ctx, 'close', MUTED_FG, 20),
            ]),
            col({ w: 'fill', h: 'fill', pad: 24, gap: 16, name: 'Content' }, [
                { ...formField('SelectField', ctx, { label: 'Status', value: 'All' }), w: 'fill' },
                { ...formField('SelectField', ctx, { label: 'Role', value: 'All' }), w: 'fill' },
            ]),
            row({ w: 'fill', pad: [16, 24], gap: 8, justify: 'end', stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Footer' }, [
                { ...button('Secondary', 'Md', ctx, { label: 'Reset', bind: cp.SecondaryLabel }), name: 'Secondary' },
                { ...button('Primary', 'Md', ctx, { label: 'Apply', bind: cp.PrimaryLabel }), name: 'Primary' },
            ]),
        ]),
    },
    {
        name: 'Table',
        group: 'Data Display',
        description: 'Data list with a header, row actions, and pagination. Columns and data are configured in Code Builder.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => table(ctx, 960),
    },
    {
        name: '_SidebarItem',
        page: 'Sidebar',
        description: 'Sidebar menu item. Active: primary background. Collapsed: icon only. Kind: Item = a page link; Parent / ParentOpen = a group with a chevron (its sub-menu is closed / open); Child = an indented sub-menu entry below its parent (no icon). A parent that contains the active page is shown as Active (bold text, no fill).',
        setFill: 'color/sidebar',
        variants: { State: ['Default', 'Active'], Collapsed: ['false', 'true'], Kind: ['Item', 'Parent', 'ParentOpen', 'Child'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Menu' }],
        render: (v, ctx, cp) => sidebarItem(v.State === 'Active', v.Collapsed === 'true', ctx, { bind: cp.Label, kind: v.Kind }),
    },
    {
        name: 'Sidebar',
        group: 'Navigation',
        description: 'Main navigation on a dark background. The header button collapses the sidebar (256 → 72): the menu becomes icons only. Menus can be nested one level (parent → child, e.g. Master Data → Region): a parent shows a chevron and expands to its children; Groups = Expanded opens every group by default.',
        variants: { Collapsed: ['false', 'true'], Groups: ['Collapsed', 'Expanded'] },
        cprops: [],
        render: (v, ctx) => sidebar(ctx, v.Groups === 'Expanded' ? 'Region' : 'Dashboard', v.Collapsed === 'true', v.Groups === 'Expanded'),
    },
    {
        name: 'Topbar',
        group: 'Layout',
        description: 'App top bar: page title and breadcrumb on the left, user name and avatar on the right. The avatar is a button that opens the user menu (Menu = Open shows it) with the Sign out action.',
        variants: { Menu: ['Closed', 'Open'] },
        cprops: [
            { name: 'Title', type: 'text', default: 'Page title' },
            { name: 'Breadcrumb', type: 'text', default: 'Home / Page' },
            { name: 'UserName', type: 'text', default: 'Administrator' },
            { name: 'UserRole', type: 'text', default: 'admin' },
        ],
        render: (v, ctx, cp) => {
            const bar = row({ w: 960, h: 72, pad: [0, 24], justify: 'between', fill: 'color/background', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Bar' }, [
                col({ gap: 2, name: 'Title block' }, [
                    text('Page title', { size: 18, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                    text('Home / Page', { size: 12, line: 16, color: MUTED_FG, bind: cp.Breadcrumb, name: 'Breadcrumb' }),
                ]),
                row({ gap: 12, name: 'User' }, [
                    col({ align: 'end' }, [
                        text('Administrator', { size: 14, line: 20, weight: 500, bind: cp.UserName, name: 'UserName' }),
                        text('admin', { size: 12, line: 16, color: MUTED_FG, bind: cp.UserRole, name: 'UserRole' }),
                    ]),
                    instance(ctx.variant('Avatar', { Size: 'Md' }), { Initial: 'A' }),
                ]),
            ]);
            if (v.Menu !== 'Open') return bar;
            // User menu: opens under the avatar (right aligned).
            const menu = col({ w: 220, pad: [4, 0], radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 }, name: 'User menu' }, [
                col({ w: 'fill', pad: [8, 12], gap: 2, name: 'Account' }, [
                    text('Administrator', { size: 14, line: 20, weight: 500 }),
                    text('admin', { size: 12, line: 16, color: MUTED_FG }),
                ]),
                frame({ w: 'fill', h: 1, fill: 'color/border', name: 'Divider' }),
                row({ w: 'fill', h: 36, pad: [0, 12], gap: 8, name: 'Sign out' }, [
                    ico(ctx, 'logout', 'color/danger', 16),
                    text('Sign out', { size: 14, line: 20, color: 'color/danger' }),
                ]),
            ]);
            return col({ w: 960, name: 'Topbar with menu' }, [bar, row({ w: 'fill', justify: 'end', pad: [8, 24, 0, 0], name: 'Menu slot' }, [menu])]);
        },
    },
    {
        name: 'SectionHeader',
        group: 'Layout',
        description: 'Section header inside the content (list, create, edit, detail): title + description on the left, the main action button on the right — one frame. The action can be turned off with the Action = None variant.',
        variants: { Action: ['Primary', 'Secondary', 'None'] },
        cprops: [
            { name: 'Title', type: 'text', default: 'Section title' },
            { name: 'Description', type: 'text', default: 'Short description of this section' },
            { name: 'ActionLabel', type: 'text', default: 'Add' },
        ],
        render: (v, ctx, cp) => row({ w: 960, justify: 'between', align: 'center', gap: 16 }, [
            col({ gap: 4, name: 'Text' }, [
                text('Section title', { size: 20, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                text('Short description of this section', { size: 14, line: 20, color: MUTED_FG, bind: cp.Description, name: 'Description' }),
            ]),
            v.Action === 'None' ? null : { ...button(v.Action, 'Md', ctx, { label: 'Add', bind: cp.ActionLabel }), name: 'Action' },
        ]),
    },
    {
        name: 'FilterToolbar',
        group: 'Layout',
        description: 'Search (320 wide) on the left, Filter button on the right, above the table.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 960, justify: 'between' }, [
            { ...formField('TextField', ctx, { placeholder: 'Search…', leading: 'magnifer', bare: true }), w: 320, name: 'Search' },
            instance(ctx.variant('Button', { Variant: 'Secondary', Size: 'Md' }), { Label: 'Filter' }, { name: 'Filter' }),
        ]),
    },
    {
        name: 'AppShell',
        group: 'Layout',
        description: 'App shell: Sidebar + topbar (title and user) + a content area on the surface background.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1440, h: 900, align: 'start', fill: 'color/surface', clip: true }, [
            instance(ctx.variant('Sidebar', { Collapsed: 'false', Groups: 'Collapsed' })),
            col({ w: 'fill', h: 'fill' }, [
                instance(ctx.variant('Topbar', { Menu: 'Closed' }), { Title: 'Dashboard' }, { name: 'Topbar', w: 'fill' }),
                col({ w: 'fill', h: 'fill', pad: 24, name: 'Content' }, [
                    frame({ w: 'fill', h: 'fill', radius: 'radius/lg', stroke: 'color/border', props: { strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 }, name: 'Content slot' }),
                ]),
            ]),
        ]),
    },
];

// ---------------------------------------------------------------- bagian yang dipakai ulang
export function button(variant, size, ctx, { label = 'Button', bind, icon: ic } = {}) {
    const s = SIZE[size];
    const fill = { Primary: 'color/primary', Secondary: 'color/background', Ghost: 'none', Danger: 'color/danger' }[variant];
    const fg = { Primary: 'color/primary-foreground', Secondary: FG, Ghost: FG, Danger: '#FFFFFF' }[variant];
    const stroke = { Primary: fill, Danger: fill, Secondary: 'color/border' }[variant];
    return row({ h: s.h, pad: [0, s.padX - 1], gap: 8, justify: 'center', radius: 'radius/lg', fill, stroke }, [
        ic ? icon(ctx.icon(ic, STYLE, fg), { size: 16, name: 'Icon' }) : null,
        text(label, { size: s.font, line: s.line, weight: 500, color: fg, bind, name: 'Label' }),
    ]);
}

function iconButton(action, ctx) {
    const [name, c] = { View: ['eye', MUTED_FG], Edit: ['pen', MUTED_FG], Delete: ['trash-bin', 'color/danger'], Restore: ['restart', 'color/success'] }[action];
    return row({ w: 32, h: 32, justify: 'center', radius: 'radius/md' }, [ico(ctx, name, c)]);
}

export function badge(variant, { label = 'Badge', bind } = {}) {
    const neutral = variant === 'Neutral', c = tone[variant];
    return row({ pad: [2, 10], radius: 999, fill: neutral ? 'color/muted' : c, fillOpacity: neutral ? 1 : 0.12 }, [
        text(label, { size: 12, line: 16, weight: 500, color: neutral ? MUTED_FG : c, bind, name: 'Label' }),
    ]);
}

export function avatar(size, { initial = 'A', bind } = {}) {
    const d = { Sm: 28, Md: 36 }[size], f = { Sm: 12, Md: 14 }[size];
    return row({ w: d, h: d, justify: 'center', radius: 999, fill: 'color/primary', fillOpacity: 0.12, name: 'Avatar' }, [
        text(initial, { size: f, line: Math.round(f * 1.43), weight: 700, color: 'color/primary', bind, name: 'Initial' }),
    ]);
}

export function card(w, { title, bind, actions = [] }, body) {
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true }, [
        row({ w: 'fill', pad: [16, 20], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
            text(title, { size: 18, line: 28, weight: 600, bind, name: 'Title' }),
            actions.length ? row({ gap: 8, name: 'Actions' }, actions) : null,
        ]),
        col({ w: 'fill', pad: 20, gap: 16, name: 'Body' }, body),
    ]);
}

/** Field berlabel: label di atas, kotak input, pesan error di bawah (bila ada). `bare` = tanpa label (mis. pencarian). */
export function formField(kind, ctx, { label = 'Label', bindLabel, placeholder = 'Type here…', bindPlaceholder, value, focus, error, leading, bare } = {}) {
    const area = kind === 'TextAreaField';
    const trailing = kind === 'SelectField' ? 'alt-arrow-down' : kind === 'PasswordField' ? 'eye' : null;
    const shown = value ?? (kind === 'PasswordField' && !value ? 'Password' : placeholder);
    const box = row({ w: 'fill', h: area ? 96 : 40, pad: area ? [10, 12] : [0, 12], gap: 8, align: area ? 'start' : 'center', radius: 'radius/lg', fill: 'color/background',
        stroke: error ? 'color/danger' : focus ? 'color/primary' : 'color/border', strokeWidth: focus ? 2 : 1, name: 'Input' }, [
        leading ? ico(ctx, leading, MUTED_FG) : null,
        text(shown, { w: 'fill', size: 14, line: 20, color: value ? FG : MUTED_FG, bind: value ? undefined : bindPlaceholder, name: value ? 'Value' : 'Placeholder' }),
        trailing ? ico(ctx, trailing, MUTED_FG) : null,
    ]);
    return col({ w: 320, gap: 6 }, [
        bare ? null : text(label, { size: 14, line: 20, weight: 500, bind: bindLabel, name: 'Label' }),
        box,
        error ? text(error, { size: 12, line: 16, color: 'color/danger', name: 'Error' }) : null,
    ]);
}

function selectOpen(ctx) {
    const items = [['Administrator', true], ['Editor', false], ['Viewer', false]];
    return col({ gap: 8 }, [
        formField('SelectField', ctx, { label: 'Role', value: 'Administrator', focus: true }),
        col({ w: 320, pad: [4, 0], radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 }, name: 'Dropdown' },
            items.map(([label, on]) => row({ w: 'fill', h: 36, pad: [0, 12], fill: on ? 'color/primary' : 'none', fillOpacity: 0.1, name: label }, [text(label, { size: 14, line: 20, weight: on ? 500 : 400, color: on ? 'color/primary' : FG })]))),
    ]);
}

function toggle({ label = 'Active', bind, on } = {}) {
    return row({ gap: 8 }, [
        row({ w: 40, h: 22, pad: [0, 2], justify: on ? 'end' : 'start', radius: 999, fill: on ? 'color/primary' : 'color/border', name: 'Track' }, [
            frame({ w: 18, h: 18, radius: 999, fill: '#FFFFFF', shadow: { x: 0, y: 1, blur: 2, opacity: 0.2 }, name: 'Knob' }),
        ]),
        text(label, { size: 14, line: 20, weight: 500, bind, name: 'Label' }),
    ]);
}

const NAV = [['Dashboard', 'widget'], ['User', 'user'], ['Role', 'shield-check'], ['Master Data', 'database', [['Region']]]];

function sidebarItem(active, collapsed, ctx, { label = 'Menu', bind, ic = 'widget', kind = 'Item' } = {}) {
    const parent = !collapsed && (kind === 'Parent' || kind === 'ParentOpen'), child = !collapsed && kind === 'Child';
    // A parent holding the active page keeps its fill off and turns bold white; items and children use the primary fill.
    const filled = active && !parent;
    const c = filled ? 'color/primary-foreground' : active && parent ? '#FFFFFF' : 'color/sidebar-foreground';
    return row({ w: collapsed ? 48 : 232, h: 40, pad: collapsed ? 0 : [0, 12, 0, child ? 44 : 12], gap: 12, justify: collapsed ? 'center' : 'start', radius: 'radius/lg', fill: filled ? 'color/primary' : 'none', name: 'SidebarItem' }, [
        child ? null : ico(ctx, ic, c, 20),
        collapsed ? null : text(label, { w: 'fill', size: 14, line: 20, weight: child && !active ? 400 : 500, color: c, bind, name: 'Label' }),
        parent ? ico(ctx, kind === 'ParentOpen' ? 'alt-arrow-up' : 'alt-arrow-down', c, 16) : null,
    ]);
}

/** Sidebar dirakit dari instance _SidebarItem (ikon diganti per item lewat override). */
export function sidebar(ctx, active, collapsed = false, expanded = false) {
    const W = collapsed ? 72 : 256;
    return col({ w: W, h: 900, pad: [0, 12, 12, 12], gap: 4, fill: 'color/sidebar', name: 'Sidebar' }, [
        row({ w: 'fill', h: 72, pad: collapsed ? 0 : [0, 4], justify: collapsed ? 'center' : 'between', name: 'Brand' }, [
            collapsed ? null : row({ gap: 10 }, [
                row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', fill: 'color/primary', name: 'Logo' }, [text('C', { size: 16, line: 24, weight: 700, color: 'color/primary-foreground' })]),
                text('CMS Admin', { size: 16, line: 24, weight: 600, color: '#FFFFFF', name: 'App name' }),
            ]),
            row({ w: 28, h: 28, justify: 'center', radius: 'radius/md', stroke: 'color/sidebar-foreground', name: 'Toggle' }, [
                ico(ctx, collapsed ? 'double-alt-arrow-right' : 'double-alt-arrow-left', 'color/sidebar-foreground', 14),
            ]),
        ]),
        ...NAV.flatMap(([label, ic, kids]) => {
            const holdsActive = !!kids?.some(([k]) => k === active), on = label === active || holdsActive;
            const kind = kids ? (expanded ? 'ParentOpen' : 'Parent') : 'Item';
            const color = on && !kids ? 'color/primary-foreground' : on ? '#FFFFFF' : 'color/sidebar-foreground';
            const item = instance(ctx.variant('_SidebarItem', { State: on ? 'Active' : 'Default', Collapsed: String(collapsed), Kind: kind }), { Label: label }, {
                name: label,
                set: { Icon: { assetId: ctx.icon(ic, STYLE, color) } },
            });
            const children = !collapsed && kids && expanded ? kids.map(([k]) => instance(ctx.variant('_SidebarItem', { State: k === active ? 'Active' : 'Default', Collapsed: 'false', Kind: 'Child' }), { Label: k }, { name: k })) : [];
            return [item, ...children];
        }),
    ]);
}

export function table(ctx, w, rows = [['John Smith', 'john@example.com', 'Administrator', 'Active'], ['Anna Johnson', 'anna@example.com', 'Editor', 'Active'], ['Carlos Rivera', 'carlos@example.com', 'Viewer', 'Inactive']]) {
    const cols = [['Name', 'fill'], ['Email', 'fill'], ['Role', 160], ['Status', 120], ['Actions', 144]];
    const cell = (content, width, header) => row({ w: width, h: header ? 40 : 52, pad: [0, 16], name: 'Cell' }, [content]);
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true, name: 'Table' }, [
        row({ w: 'fill', fill: 'color/muted', name: 'Header' }, cols.map(([h, cw]) => cell(text(h, { size: 12, line: 16, weight: 600, color: MUTED_FG }), cw, true))),
        ...rows.map((r, i) => row({ w: 'fill', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: `Row ${i + 1}` }, [
            cell(text(r[0], { weight: 500 }), 'fill'),
            cell(text(r[1], { color: MUTED_FG }), 'fill'),
            cell(text(r[2]), 160),
            cell(instance(ctx.variant('Badge', { Variant: r[3] === 'Active' ? 'Success' : 'Neutral' }), { Label: r[3] }), 120),
            cell(row({ gap: 4 }, ['View', 'Edit', 'Delete'].map(a => instance(ctx.variant('IconButton', { Action: a })))), 144),
        ])),
        row({ w: 'fill', pad: [12, 16], justify: 'between', name: 'Pagination' }, [
            text(`Showing 1–${rows.length} of ${rows.length}`, { size: 14, line: 20, color: MUTED_FG }),
            row({ gap: 4 }, [
                ico(ctx, 'alt-arrow-left', MUTED_FG),
                row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', stroke: 'color/primary' }, [text('1', { size: 14, weight: 500, color: 'color/primary' })]),
                ico(ctx, 'alt-arrow-right', MUTED_FG),
            ]),
        ]),
    ]);
}
